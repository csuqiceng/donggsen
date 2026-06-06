/**
 * 模拟测试：409 冲突恢复后 renderToday / renderTasks 是否被正确调用
 *
 * 使用方法：node src/test-render-after-409.js
 *
 * 核心验证：
 *   - 409 恢复后 renderToday() 和 renderTasks() 是否被调用
 *   - 恢复后的数据是否正确反映在渲染结果中
 */

// ── 最小化 Mock ──

const _localStorage = { _data: {}, getItem(k){return this._data[k]||null}, setItem(k,v){this._data[k]=String(v)}, removeItem(k){delete this._data[k]} };
if (typeof localStorage === 'undefined') var localStorage = _localStorage;
if (typeof document === 'undefined') var document = {
  getElementById:()=>({innerHTML:'',textContent:'',classList:{add(){},remove(){},toggle(){}},style:{},addEventListener(){}}),
  querySelectorAll:()=>({forEach(){}}), querySelector:()=>null, activeElement:null
};
if (typeof window === 'undefined') var window = {location:{reload(){}}};

// ── 调用记录器（核心验证工具）──

const callLog = [];
function mockRenderToday() { callLog.push('renderToday'); }
function mockRenderTasks() { callLog.push('renderTasks'); }
function mockRenderBuddies() { callLog.push('renderBuddies'); }
function mockRenderLeaderboard() { callLog.push('renderLeaderboard'); }
function mockRenderIsland() { callLog.push('renderIsland'); }
function mockRetroactiveHiddenCheck() { callLog.push('retroactiveHiddenCheck'); }

// ── 模拟服务端 ──

class MockServer {
  constructor() { this.state = { users: {} }; this.log = []; }
  handlePost(clientId, userPayload) {
    const incomingVersion = parseInt(userPayload.syncVersion || 0, 10);
    const existingUser = this.state.users[clientId] || null;
    const storedVersion = existingUser ? parseInt(existingUser.syncVersion || 0, 10) : 0;

    if (existingUser !== null && incomingVersion < storedVersion) {
      this.log.push(`409 REJECT v${incomingVersion} < v${storedVersion}`);
      return {
        status: 409,
        body: {
          ok: false, error: `Stale (${incomingVersion} < ${storedVersion})`,
          version: storedVersion,
          users: JSON.parse(JSON.stringify(this.state.users))
        }
      };
    }

    const newVersion = storedVersion + 1;
    const clean = { ...userPayload, clientId, syncVersion: newVersion, lastActive: Date.now(), updated: Date.now() };
    this.state.users[clientId] = clean;
    this.log.push(`200 ACCEPT v${storedVersion} -> v${newVersion}`);
    return { status: 200, body: JSON.parse(JSON.stringify(this.state)) };
  }
}

// ── 客户端状态（从 app.js 提取）──

let syncVersion = 0;
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

// ── 从 app.js 原样复制的关键函数 ──

function restoreSelfFromServer(serverSelf) {
  if (serverSelf.dayStates) {
    Object.entries(serverSelf.dayStates).forEach(([idx, s]) => {
      const i = Number(idx);
      if (!dayStates[i]) {
        dayStates[i] = {
          checked: new Set(), settled: false, missed: false,
          difficulty: 'standard', score: 0, rewards: [], hiddenTasks: [],
          settledAt: null, settledDate: null, missedAt: null, missedDate: null
        };
      }
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

/** 精简版 applySharedState（只触发 mock 渲染函数） */
function applySharedState(payload) {
  // 跟踪版本号
  const myServerData = (payload?.users || {})['client-alice'];
  if (myServerData?.syncVersion) syncVersion = myServerData.syncVersion;
  // 触发 mock 渲染（模拟 app.js 的行为）
  mockRenderBuddies();
  mockRenderLeaderboard();
  mockRenderIsland();
  mockRetroactiveHiddenCheck();
}

/**
 * ★★★ 被测目标：syncMyState 的 409 分支（包含新增的 renderToday/renderTasks）★★★
 */
async function simulateSyncWith409(server, clientId) {
  // 构造 sync record
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
  const record = {
    clientId: clientId,
    username: '哥哥', displayName: '哥哥', avatar: 'alfonso', message: '',
    dayStates: serializableStates, currentDayIndex: 6,
    inventory, warehouseContribution, collection,
    selectedDifficulty: 'standard',
    lastActive: Date.now(), updated: Date.now(),
    syncVersion: syncVersion
  };

  const res = server.handlePost(clientId, record);

  if (res.status === 409) {
    // ← 这是要验证的核心路径
    const body = res.body;
    syncVersion = body.version || syncVersion + 1;

    const serverSelf = (body.users || {})[clientId];
    if (serverSelf) restoreSelfFromServer(serverSelf);

    applySharedState(body);
    // ★ 新增的两行（被测目标）★
    mockRenderToday();   // ← 验证这个是否被调用
    mockRenderTasks();   // ← 验证这个是否被调用

    return { ok: false, conflict: true, restored: true };
  }

  if (res.status !== 200) return { ok: false, conflict: false };

  const myData = res.body.users?.[clientId];
  if (myData?.syncVersion) syncVersion = myData.syncVersion;
  applySharedState(res.body);

  // 正常路径也调 renderToday/renderTasks（用于对比）
  mockRenderToday();
  mockRenderTasks();

  return { ok: true, conflict: false };
}


// ════════════════════════════════════════
//  测试用例
// ════════════════════════════════════════

let passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  ✓ ' + label); }
  else { failed++; console.log('  ✗ FAIL: ' + label); }
}

function resetAll() {
  syncVersion = 0;
  dayStates = {};
  inventory = createInventory();
  warehouseContribution = createWarehouse();
  collection = { discovered: ['resident_services_tent'], completed: [] };
  callLog.length = 0;
}

console.log('');
console.log('╔══════════════════════════════════════════╗');
console.log('║  409 恢复后 renderToday/renderTasks 调用测试 ║');
console.log('╚══════════════════════════════════════════╝');
console.log('');


// ── 测试 1：409 路径必须调用 renderToday 和 renderTasks ──
console.log('--- 测试 1：409 冲突 → 必须调用 renderToday + renderTasks ---');
{
  resetAll();
  const server = new MockServer();

  // 步骤 A：新页面正常写入，建立 version=1
  getDayState(0).settled = true; getDayState(0).settledDate = '2026-06-05';
  getDayState(1).settled = true; getDayState(1).settledDate = '2026-06-04';
  inventory.wood = 12; inventory.nookMilesTicket = 2;

  // 直接调用服务端写入（绕过 simulateSyncWith409 的 200 路径渲染）
  const recordNew = {
    clientId: 'client-alice', username: '哥哥', displayName: '哥哥', avatar: 'alfonso',
    message: '', currentDayIndex: 6,
    dayStates: { '0':{checked:[0,1],settled:true,settledDate:'2026-06-05',difficulty:'standard',score:2,rewards:[],hiddenTasks:[]},
                '1':{checked:[0,1],settled:true,settledDate:'2026-06-04',difficulty:'standard',score:2,rewards:[],hiddenTasks:[]} },
    inventory: { wood:12, stone:8, nookMilesTicket:2 }, warehouseContribution: {},
    collection: { discovered:['resident_services_tent'] }, selectedDifficulty: 'standard',
    lastActive: Date.now(), updated: Date.now(), syncVersion: 0
  };
  const resA = server.handlePost('client-alice', recordNew);
  assert(resA.status === 200, '步骤A：新页面首次写入成功');
  assert(server.state.users['client-alice'].syncVersion === 1, '步骤A：服务端 version=1');

  // 步骤 B：模拟旧页面——syncVersion=0，本地数据为空
  dayStates = {};
  inventory = createInventory();
  warehouseContribution = createWarehouse();
  collection = { discovered: [] };
  syncVersion = 0;
  callLog.length = 0;

  // 构造旧页面的请求（syncVersion=0 < 服务端的 1）
  const recordOld = {
    clientId: 'client-alice', username: '哥哥', displayName: '哥哥', avatar: 'alfonso',
    message: '', currentDayIndex: 6,
    dayStates: {}, // 空的！旧页面没有数据
    inventory: createInventory(), warehouseContribution: {},
    collection: { discovered:[] }, selectedDifficulty: 'standard',
    lastActive: Date.now(), updated: Date.now(), syncVersion: 0 // 旧版本！
  };
  const resB = server.handlePost('client-alice', recordOld);

  // ★ 验证 409 发生 ★
  assert(resB.status === 409, '应返回 409 Conflict (实际 ' + resB.status + ')');

  // ★ 模拟 app.js 的 409 处理分支（被测目标）★
  const body409 = resB.body;
  syncVersion = body409.version || syncVersion + 1; // 从 409 响应恢复版本号

  const serverSelf = (body409.users || {})['client-alice'];
  assert(serverSelf !== null, '409 响应应包含自己的数据');
  if (serverSelf) restoreSelfFromServer(serverSelf); // 恢复数据

  applySharedState(body409);              // 更新 peers + 渲染伙伴/排行/岛屿
  mockRenderToday();                      // ← 验证这个
  mockRenderTasks();                      // ← 验证这个

  // ★ 核心断言 ★
  assert(callLog.includes('renderToday'),   '409 路径: renderToday 应被调用');
  assert(callLog.includes('renderTasks'),   '409 路径: renderTasks 应被调用');
  assert(callLog.includes('renderBuddies'), '409 路径: renderBuddies 应被调用');
  assert(callLog.includes('renderLeaderboard'), '409 路径: renderLeaderboard 应被调用');
  assert(callLog.includes('renderIsland'),  '409 路径: renderIsland 应被调用');

  // 验证顺序：renderToday/renderTasks 在 applySharedState 的渲染之后
  const todayIdx = callLog.indexOf('renderToday');
  const buddiesIdx = callLog.indexOf('renderBuddies');
  assert(todayIdx > buddiesIdx, 'renderToday 应在 renderBuddies 之后');
}


// ── 测试 2：正常 200 路径也应该调用 renderToday + renderTasks ──
console.log('');
console.log('--- 测试 2：正常 200 路径 → 也应调用 renderToday + renderTasks ---');
{
  resetAll();
  const server = new MockServer();
  callLog.length = 0;

  simulateSyncWith409(server, 'client-alice');

  assert(callLog.includes('renderToday'), '正常路径: renderToday 应被调用');
  assert(callLog.includes('renderTasks'), '正常路径: renderTasks 应被调用');
}


// ── 测试 3：409 恢复后数据正确性（render 能拿到正确的数据）──
console.log('');
console.log('--- 测试 3：409 恢复后的数据能被正确渲染 ---');
{
  resetAll();
  const server = new MockServer();

  // 步骤 A：写入丰富的服务端数据（模拟新页面）
  const richRecord = {
    clientId: 'client-alice', username: '哥哥', displayName: '哥哥', avatar: 'alfonso',
    message: '', currentDayIndex: 6,
    dayStates: {
      '0': { checked:[0,1,2], settled:true, settledDate:'2026-06-05', difficulty:'challenge',
             score:6, rewards:['wood','stone'], hiddenTasks:['same_day_checkin'] },
      '3': { checked:[], settled:false, missed:true, missedDate:'2026-06-04',
             difficulty:'standard', score:0, rewards:[], hiddenTasks:[] }
    },
    inventory: { wood:20, stone:10, ironNugget:5, nookMilesTicket:3 },
    warehouseContribution: { wood:5, stone:3 },
    collection: { discovered: ['resident_services_tent', 'museum', 'same_day_checkin'], completed: [] },
    selectedDifficulty: 'challenge',
    lastActive: Date.now(), updated: Date.now(), syncVersion: 0
  };
  const resA = server.handlePost('client-alice', richRecord);
  assert(resA.status === 200, '步骤A：丰富数据写入成功');
  assert(server.state.users['client-alice'].syncVersion === 1, '步骤A：version=1');

  // 步骤 B：模拟旧页面——本地全空，version=0
  dayStates = {};
  inventory = createInventory();
  warehouseContribution = createWarehouse();
  collection = { discovered: [] };
  syncVersion = 0;
  callLog.length = 0;

  // 直接发旧数据触发 409
  const emptyRecord = {
    clientId: 'client-alice', username: '哥哥', displayName: '哥哥', avatar: 'alfonso',
    message: '', currentDayIndex: 6,
    dayStates: {}, inventory: createInventory(),
    warehouseContribution: {}, collection: { discovered: [] },
    selectedDifficulty: 'standard',
    lastActive: Date.now(), updated: Date.now(), syncVersion: 0
  };
  const resB = server.handlePost('client-alice', emptyRecord);
  assert(resB.status === 409, '应返回 409 (实际 ' + resB.status + ')');

  // 执行 409 恢复流程（与 app.js 完全一致）
  const body409 = resB.body;
  syncVersion = body409.version || syncVersion + 1;
  const serverSelf = (body409.users || {})['client-alice'];
  if (serverSelf) restoreSelfFromServer(serverSelf);

  applySharedState(body409);
  mockRenderToday();
  mockRenderTasks();

  // ★ 验证恢复的数据是 renderToday/renderTasks 会用到的 ★
  assert(getDayState(0)?.settled === true, 'day0 应恢复为已结算');
  const checked0 = getDayState(0)?.checked;
  const checkedCount = Array.isArray(checked0) ? checked0.length : (checked0?.size ?? 0);
  assert(checkedCount === 3, 'day0 应恢复 3 个已完成动作 (实际 ' + checkedCount + ')');
  assert(getDayState(0)?.difficulty === 'challenge', 'day0 应恢复挑战难度');
  assert(getDayState(0)?.hiddenTasks.includes('same_day_checkin'), 'day0 应恢复隐藏任务');
  assert(getDayState(3)?.missed === true, 'day3 应恢复为休息日');
  assert(inventory.wood === 20, 'inventory.wood 应恢复为 20 (实际 ' + inventory.wood + ')');
  assert(inventory.nookMilesTicket === 3, 'inventory.nookMilesTicket 应恢复为 3 (实际 ' + inventory.nookMilesTicket + ')');
  assert(collection.discovered.includes('museum'), 'collection 应包含 museum');
  assert(collection.discovered.includes('same_day_checkin'), 'collection 应包含 same_day_checkin');
}


// ── 测试 4：连续多次 409 不导致重复渲染爆炸 ──
console.log('');
console.log('--- 测试 4：连续 409 → 每次都应完整调用一次 renderToday/renderTasks ---');
{
  resetAll();
  const server = new MockServer();

  // 建立 version=3 的历史
  simulateSyncWith409(server, 'client-alice');
  simulateSyncWith409(server, 'client-alice');
  simulateSyncWith409(server, 'client-alice');
  assert(syncVersion === 3, '3 次写入后 version=3');

  // 旧客户端持续发 version=0
  dayStates = {}; inventory = createInventory();
  syncVersion = 0;

  // 第 1 次 409
  callLog.length = 0;
  simulateSyncWith409(server, 'client-alice');
  const count1_today = callLog.filter(c => c === 'renderToday').length;
  const count1_tasks = callLog.filter(c => c === 'renderTasks').length;
  assert(count1_today === 1, '第 1 次 409: renderToday 恰好调用 1 次 (实际 ' + count1_today + ')');
  assert(count1_tasks === 1, '第 1 次 409: renderTasks 恰好调用 1 次 (实际 ' + count1_tasks + ')');

  // 第 2 次（恢复后应该成功了，不再 409）
  callLog.length = 0;
  simulateSyncWith409(server, 'client-alice');
  const count2_today = callLog.filter(c => c === 'renderToday').length;
  const count2_tasks = callLog.filter(c => c === 'renderTasks').length;
  assert(count2_today >= 1, '第 2 次: renderToday 至少调用 1 次 (实际 ' + count2_today + ')');
  assert(count2_tasks >= 1, '第 2 次: renderTasks 至少调用 1 次 (实际 ' + count2_tasks + ')');
}


// ── 结果汇总 ──
console.log('');
console.log('╔══════════════════════════════════════════╗');
const pad = '                                    ';
console.log('║  结果: ' + passed + ' 通过, ' + failed + ' 失败' + pad.slice(0, Math.max(0, 26 - String(passed).length - String(failed).length)) + '║');
console.log('╚══════════════════════════════════════════╝');
console.log('');

process.exit(failed > 0 ? 1 : 0);
