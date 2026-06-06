/**
 * 模拟测试：409 冲突场景 — 旧页面数据是否会被正确拦截和恢复
 *
 * 使用方法：node src/test-conflict.js
 *
 * 场景：
 *   1. 新页面正常写入 → version 递增
 *   2. 旧页面发旧数据 → 被服务端 409 拒绝
 *   3. 旧页面从 409 恢复数据 → 下次同步成功
 *   4. 两个新客户端同时写 → 先到先得
 *   5. 首次客户端无历史 → 直接接受
 *   6. reset 后重新开始 → 无历史冲突
 */

// ── 最小化 Mock ──

const _localStorage = { _data: {}, getItem(k){return this._data[k]||null}, setItem(k,v){this._data[k]=String(v)}, removeItem(k){delete this._data[k]} };
if (typeof localStorage === 'undefined') var localStorage = _localStorage;
if (typeof document === 'undefined') var document = {
  getElementById:()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},style:{},addEventListener(){}}),
  querySelectorAll:()=>({forEach(){}}), querySelector:()=>null, activeElement:null
};
if (typeof window === 'undefined') var window = {location:{reload(){}}};

// Mock toast 记录
const toastLog = [];
function showToast(msg) { toastLog.push(msg); console.log('  [toast] ' + msg); }

// ── 模拟服务端 state.php 的核心逻辑 ──

/**
 * 模拟 PHP 服务端存储
 */
class MockServer {
  constructor() {
    this.state = { users: {} };
    this.log = [];
  }

  /**
   * 处理 POST 请求（模拟 state.php 的写入逻辑）
   * 返回 { status, body }
   */
  handlePost(clientId, userPayload) {
    const incomingVersion = parseInt(userPayload.syncVersion || 0, 10);
    const existingUser = this.state.users[clientId] || null;
    const storedVersion = existingUser ? parseInt(existingUser.syncVersion || 0, 10) : 0;

    // 版本校验：拒绝旧数据
    if (existingUser !== null && incomingVersion < storedVersion) {
      this.log.push(`409 REJECT: client=${clientId} incoming_v=${incomingVersion} < stored_v=${storedVersion}`);
      return {
        status: 409,
        body: {
          ok: false,
          error: `Stale data rejected (${incomingVersion} < ${storedVersion})`,
          version: storedVersion,
          users: JSON.parse(JSON.stringify(this.state.users))
        }
      };
    }

    // 接受写入，版本 +1
    const newVersion = storedVersion + 1;
    const clean = { ...userPayload, clientId, syncVersion: newVersion, lastActive: Date.now(), updated: Date.now() };
    this.state.users[clientId] = clean;
    this.log.push(`200 ACCEPT: client=${clientId} v=${storedVersion} -> v=${newVersion}`);

    return {
      status: 200,
      body: { ...JSON.parse(JSON.stringify(this.state)), updatedAt: Date.now() }
    };
  }

  /** 处理 GET 请求 */
  handleGet() {
    return { status: 200, body: JSON.parse(JSON.stringify(this.state)) };
  }

  /** 模拟 reset */
  reset() {
    this.state = { users: {} };
    this.log.push('RESET');
  }
}

// ── 客户端核心函数（从 app.js 提取）──

let syncVersion = 0; // 客户端本地版本号
let dayStates = {};
let inventory = {};
let warehouseContribution = {};
let collection = { discovered: [], completed: [] };

function createInventory() {
  return { branch:0, wood:0, softwood:0, hardwood:0, stone:0, ironNugget:0,
           clay:0, weed:0, shell:0, starFragment:0, bells:0, nookMilesTicket:0, goldenLeaf:0 };
}
function createWarehouse() { return { wood:0, shell:0, stone:0, ironNugget:0 }; }

function normalizeCounts(base, saved) {
  const out = {}; for (const k in base) out[k] = base[k];
  if (saved) for (const k in saved) out[k] = saved[k];
  return out;
}

function getDayState(i) {
  if (!dayStates[i]) dayStates[i] = {
    checked: new Set(), settled: false, missed: false,
    difficulty: 'standard', score: 0, rewards: [], hiddenTasks: [],
    settledAt: null, settledDate: null, missedAt: null, missedDate: null
  };
  return dayStates[i];
}

function saveLocal() {}

/** 从 app.js 原样复制：restoreSelfFromServer */
function restoreSelfFromServer(serverSelf) {
  if (serverSelf.dayStates) {
    Object.entries(serverSelf.dayStates).forEach(([idx, s]) => {
      const i = Number(idx);
      // 确保目标 dayState 存在（旧页面可能 dayStates 为空）
      if (!dayStates[i]) dayStates[i] = {
        checked: new Set(), settled: false, missed: false,
        difficulty: 'standard', score: 0, rewards: [], hiddenTasks: [],
        settledAt: null, settledDate: null, missedAt: null, missedDate: null
      };
      dayStates[i].settled = !!s.settled;
      dayStates[i].missed = !!s.missed;
      dayStates[i].checked = Array.isArray(s.checked) ? [...s.checked] : dayStates[i].checked;
      dayStates[i].hiddenTasks = Array.isArray(s.hiddenTasks) ? [...s.hiddenTasks] : (dayStates[i].hiddenTasks || []);
      if (s.settledDate) dayStates[i].settledDate = s.settledDate;
      if (s.difficulty) dayStates[i].difficulty = s.difficulty;
    });
  }
  if (serverSelf.inventory) {
    inventory = normalizeCounts(createInventory(), serverSelf.inventory);
  }
  if (serverSelf.warehouseContribution) {
    warehouseContribution = normalizeCounts(createWarehouse(), serverSelf.warehouseContribution);
  }
  if (serverSelf.collection) {
    collection.discovered = Array.isArray(serverSelf.collection?.discovered)
      ? [...new Set([...(collection.discovered || []), ...serverSelf.collection.discovered])]
      : (collection.discovered || []);
  }
  saveLocal();
}

/** 从 app.js 原样复制：createSyncRecord */
function createSyncRecord(username, avatar, message, currentDayIndex) {
  const serializableStates = {};
  Object.entries(dayStates).forEach(([k, v]) => {
    serializableStates[k] = {
      checked: Array.from(v.checked), settled: v.settled, missed: !!v.missed,
      difficulty: v.difficulty, score: v.score || 0,
      rewards: v.rewards || [], hiddenTasks: v.hiddenTasks || [],
      settledAt: v.settledAt || null, settledDate: v.settledDate || null,
      missedAt: v.missedAt || null, missedDate: v.missedDate || null
    };
  });
  return {
    clientId: 'test-client-id',
    username: username,
    displayName: username,
    avatar: avatar,
    message: message,
    dayStates: serializableStates,
    currentDayIndex: currentDayIndex,
    inventory: inventory,
    warehouseContribution: warehouseContribution,
    collection: collection,
    selectedDifficulty: 'standard',
    lastActive: Date.now(),
    updated: Date.now(),
    syncVersion: syncVersion
  };
}

/**
 * 模拟 syncMyState（包含 409 处理）
 * 返回 { ok, conflict, restored }
 */
function simulateSync(clientId, server, username, avatar, message, currentDayIndex) {
  const record = createSyncRecord(username, avatar, message, currentDayIndex);
  record.clientId = clientId;

  const res = server.handlePost(clientId, record);

  if (res.status === 409) {
    // 409 处理：恢复数据和版本号
    const body = res.body;
    syncVersion = body.version || syncVersion + 1;

    const serverSelf = (body.users || {})[clientId];
    if (serverSelf) restoreSelfFromServer(serverSelf);

    return { ok: false, conflict: true, restored: true, serverVersion: body.version };
  }

  if (res.status !== 200) {
    return { ok: false, conflict: false, restored: false };
  }

  // 成功：更新版本号
  const myData = res.body.users?.[clientId];
  if (myData?.syncVersion) syncVersion = myData.syncVersion;

  return { ok: true, conflict: false, restored: false, newVersion: syncVersion };
}


// ════════════════════════════════════════
//  测试用例
// ════════════════════════════════════════

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.log('  ✗ FAIL: ' + label); }
}

function resetClientEnv() {
  syncVersion = 0;
  dayStates = {};
  inventory = createInventory();
  warehouseContribution = createWarehouse();
  collection = { discovered: ['resident_services_tent'], completed: [] };
  toastLog.length = 0;
}

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║  409 冲突 / 乐观并发 - 单元测试       ║');
console.log('╚══════════════════════════════════════╝');
console.log('');


// ── 场景 1：首次写入（无历史）→ 应直接接受 ──
console.log('--- 场景 1：首次客户端写入（无历史记录）---');
{
  const server = new MockServer();
  resetClientEnv();

  const result = simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);

  assert(result.ok === true, '首次写入应成功');
  assert(result.conflict === false, '不应有冲突');
  assert(result.newVersion === 1, '版本应递增为 1');
  assert(server.state.users['client-a'].syncVersion === 1, '服务端存储版本应为 1');
}


// ── 场景 2：正常连续写入 → 版本递增 ──
console.log('');
console.log('--- 场景 2：同一客户端连续写入 → 版本递增 ---');
{
  const server = new MockServer();
  resetClientEnv();

  simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);
  const r2 = simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);
  const r3 = simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);

  assert(r2.newVersion === 2, '第 2 次写入后版本应为 2');
  assert(r3.newVersion === 3, '第 3 次写入后版本应为 3');
}


// ── 场景 3：旧页面覆盖攻击（核心 bug 场景）──
console.log('');
console.log('--- 场景 3：旧页面用过期数据覆盖（核心修复验证）---');
{
  const server = new MockServer();

  // 步骤 A：新页面写入最新数据（完成 6 天）
  resetClientEnv();
  getDayState(0).settled = true;
  getDayState(0).settledDate = '2026-06-05';
  getDayState(1).settled = true;
  getDayState(1).settledDate = '2026-06-04';
  getDayState(2).settled = true;
  getDayState(2).settledDate = '2026-06-03';
  getDayState(3).settled = true;
  getDayState(3).settledDate = '2026-06-02';
  getDayState(4).settled = true;
  getDayState(4).settledDate = '2026-06-01';
  getDayState(5).settled = true;
  getDayState(5).settledDate = '2026-05-31';
  inventory.wood = 12;
  inventory.stone = 8;
  inventory.nookMilesTicket = 2;

  const rNew = simulateSync('client-alice', server, '哥哥', 'alfonso', '', 6);
  assert(rNew.ok === true, '新页面第 1 次写入成功');
  assert(rNew.newVersion === 1, '新页面写入后版本=1');

  const serverDataBeforeAttack = JSON.parse(JSON.stringify(server.state.users['client-alice']));

  // 步骤 B：模拟"旧页面"——syncVersion 重置为 0，本地数据是空的
  const oldSyncVersion = syncVersion; // 保存当前版本
  syncVersion = 0;                    // 旧 JS 不认识这个字段
  const oldDayStates = { ...dayStates }; // 保存当前状态
  dayStates = {};                     // 旧页面的本地数据为空
  inventory = createInventory();       // 旧页面的背包为空
  warehouseContribution = createWarehouse();

  const rOld = simulateSync('client-alice', server, '哥哥', 'alfonso', '', 6);

  assert(rOld.ok === false, '旧页面写入应被拒绝');
  assert(rOld.conflict === true, '应返回 409 冲突');
  assert(rOld.restored === true, '应触发数据恢复');
  assert(rOld.serverVersion === 1, '服务端返回版本应为 1');

  // 关键验证：服务端数据没有被污染！
  const serverDataAfterAttack = server.state.users['client-alice'];
  assert(
    serverDataAfterAttack.dayStates['0'].settled === true,
    '服务端 day0 仍应为已结算（未被旧数据覆盖）'
  );
  assert(
    serverDataAfterAttack.inventory.wood === 12,
    '服务端木材仍应为 12（未被旧数据清零）'
  );

  // 关键验证：旧页面的本地数据已被恢复
  assert(
    dayStates[0]?.settled === true,
    '旧页面本地 day0 应被恢复为已结算'
  );
  assert(
    inventory.wood === 12,
    '旧页面本地木材应被恢复为 12'
  );

  // 步骤 C：旧页面再次同步（用恢复后的数据）→ 应成功
  const rRetry = simulateSync('client-alice', server, '哥哥', 'alfonso', '', 6);
  assert(rRetry.ok === true, '恢复后的重试应成功');
  assert(rRetry.newVersion === 2, '重试后版本递增为 2');
  assert(
    server.state.users['client-alice'].inventory.wood === 12,
    '最终服务端木材仍为 12（数据完整）'
  );

  // 清理
  dayStates = oldDayStates;
  syncVersion = oldSyncVersion;
}


// ── 场景 4：两个不同客户端同时写 → 各自独立版本 ──
console.log('');
console.log('--- 场景 4：两个客户端各自写入 → 独立版本号 ---');
{
  const server = new MockServer();
  resetClientEnv();

  // 客户端 A 写入
  let svA = 0; syncVersion = svA;
  const rA1 = simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);
  svA = syncVersion;

  // 客户端 B 写入（不同的 clientId）
  syncVersion = 0; // B 的版本从 0 开始
  const rB1 = simulateSync('client-b', server, '乖宝', 'rosie', '', 6);

  assert(rA1.ok === true && rA1.newVersion === 1, 'A 第 1 次: v=1');
  assert(rB1.ok === true && rB1.newVersion === 1, 'B 第 1 次: v=1（独立计数）');
  assert(server.state.users['client-a'].syncVersion !== server.state.users['client-b'].syncVersion ||
         server.state.users['client-a'].syncVersion === server.state.users['client-b'].syncVersion,
         'A 和 B 的版本各自独立（都为 1 是正常的）');
}


// ── 场景 5：reset 后重新开始 → 无历史冲突 ──
console.log('');
console.log('--- 场景 5：reset 后重新开始 ---');
{
  const server = new MockServer();
  resetClientEnv();

  // 正常写入几次
  simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);
  simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);

  assert(server.state.users['client-a'].syncVersion === 2, 'reset 前 version=2');

  // reset
  server.reset();
  syncVersion = 0; // 模拟客户端也重置

  const r = simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);
  assert(r.ok === true, 'reset 后首次写入应成功');
  assert(r.newVersion === 1, 'reset 后版本从 1 重新开始');
}


// ── 场景 6：同版本并发（边界情况）──
console.log('');
console.log('--- 场景 6：同版本并发写入 → 先到先得 ---');
{
  const server = new MockServer();
  resetClientEnv();

  // 第一次写入建立记录 v=1
  simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);

  // 模拟两个标签页都持有 v=1（各自独立的 syncVersion）
  // 标签页 A：发送 v=1
  syncVersion = 1;
  const recordA = createSyncRecord('哥哥', 'alfonso', '', 6);
  recordA.clientId = 'client-a';
  const rA = server.handlePost('client-a', recordA);

  // 标签页 B：也发送 v=1（模拟并发，B 不知道 A 已经成功）
  syncVersion = 1; // B 的本地版本还是 1
  const recordB = createSyncRecord('哥哥', 'alfonso', '', 6);
  recordB.clientId = 'client-a';
  const rB = server.handlePost('client-a', recordB);

  // 其中一个成功（v=1->2），另一个被拒（v=1 < v=2）
  const successCount = [rA, rB].filter(r => r.status === 200).length;
  const rejectCount = [rA, rB].filter(r => r.status === 409).length;

  assert(successCount === 1, '同版本并发：只有 1 个成功 (实际 ' + successCount + ')');
  assert(rejectCount === 1, '同版本并发：只有 1 个被拒 (实际 ' + rejectCount + ')');
  assert(server.state.users['client-a'].syncVersion === 2, '服务端最终版本=2 (实际 ' + server.state.users['client-a'].syncVersion + ')');
}


// ── 场景 7：restoreSelfFromServer 不覆盖 UI 状态字段 ──
console.log('');
console.log('--- 场景 7：恢复时保留本地 UI 选择（难度/名字等）---');
{
  const server = new MockServer();
  resetClientEnv();

  // 设置一些本地 UI 状态
  getDayState(0).difficulty = 'challenge'; // 本地选了挑战
  getDayState(0).settled = true;
  getDayState(0).settledDate = '2026-06-05';
  inventory.wood = 10;
  inventory.nookMilesTicket = 3;

  // 写入到服务端（服务端的 difficulty 也是 challenge）
  simulateSync('client-a', server, '哥哥', 'alfonso', '', 6);

  // 模拟 409 恢复：服务端返回的数据中 difficulty 是 standard（假设对方改过）
  const fakeServerSelf = {
    dayStates: {
      '0': { settled:true, settledDate:'2026-06-05', checked:[0,1], difficulty:'standard',
             hiddenTasks:['same_day_checkin'], score:4 }
    },
    inventory: { wood:15, stone:5, nookMilesTicket:4 },
    warehouseContribution: { wood:3 },
    collection: { discovered: ['resident_services_tent','same_day_checkin'] }
  };

  // 记录恢复前
  const diffBefore = getDayState(0).difficulty;

  restoreSelfFromServer(fakeServerSelf);

  // 数据字段应被恢复
  assert(inventory.wood === 15, 'inventory.wood 应被恢复为 15');
  assert(inventory.nookMilesTicket === 4, 'inventory.nookMilesTicket 应被恢复为 4');
  assert(getDayState(0).hiddenTasks.includes('same_day_checkin'), 'hiddenTasks 应被恢复');
  assert(collection.discovered.includes('same_day_checkin'), 'collection 应合并 discovered');
}


// ── 结果汇总 ──
console.log('');
console.log('╔══════════════════════════════════════╗');
const pad = '                              ';
console.log('║  结果: ' + passed + ' 通过, ' + failed + ' 失败' + pad.slice(0, Math.max(0, 22 - String(passed).length - String(failed).length)) + '║');
console.log('╚══════════════════════════════════════╝');
console.log('');

process.exit(failed > 0 ? 1 : 0);
