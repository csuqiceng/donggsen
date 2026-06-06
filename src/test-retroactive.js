/**
 * 模拟测试：先结算的人能否正确补发同日登岛奖励
 *
 * 使用方法：node src/test-retroactive.js
 *
 * 场景：
 *   1. 哥哥先结算（此时 peers 里乖宝还没结算）→ 应该拿不到里数券
 *   2. 轮询拉到乖宝的结算数据 → retroactiveHiddenCheck() 应补发
 */

// ── 最小化 Mock ──

const STORAGE_KEY = 'fitness-island-state';
let savedData = null;

// Mock localStorage
const _localStorage = {
  _data: {},
  getItem(key) { return this._data[key] || null; },
  setItem(key, val) { this._data[key] = String(val); },
  removeItem(key) { delete this._data[key]; }
};
if (typeof localStorage === 'undefined') var localStorage = _localStorage;

// Mock DOM（仅用于 app.js 加载不报错）
const _document = {
  getElementById: () => ({
    innerHTML: '', textContent: '',
    classList: { add(){}, remove(){}, toggle(){} },
    style: {}, addEventListener(){}
  }),
  querySelectorAll: () => ({ forEach(){} }),
  querySelector: () => null,
  activeElement: null
};
if (typeof document === 'undefined') var document = _document;
if (typeof window === 'undefined') var window = { location: { reload(){} } };
if (typeof navigator === 'undefined') var navigator = { serviceWorker: { register(){ return Promise.resolve({ catch(){}} ) } } };

// Mock toast 记录
const toastLog = [];
function showToast(msg) {
  toastLog.push(msg);
  console.log('  [toast] ' + msg);
}

// ── 加载 app.js 的核心逻辑（提取关键函数）──

// 先定义所有全局变量（app.js 顶层依赖）
var ROOM_KEY = 'fitness-island-v1';
var SYNC_API = './api/state.php';

var DIFFICULTIES = {
  easy:    { label: '轻松', multiplier: 1 },
  standard:{ label: '标准', multiplier: 2 },
  challenge:{ label: '挑战', multiplier: 3 }
};

var ITEMS = {
  branch:['树枝','\u{1F33F}'], wood:['木材','\u{1FAB5}'], stone:['石头','\u{1FAA8}'],
  ironNugget:['铁矿石','\u{26CF}'], bells:['铃钱','\u{1F514}'],
  nookMilesTicket:['里数券','\u{1F3AB}'], goldenLeaf:['金色树叶','\u{1F342}'],
  starFragment:['星星碎片','\u{2B50}'], bells_bag:['铃钱袋','\u{1F514}']
};

// 全局状态
var plan = null;
var allDays = [];
var currentDayIndex = 0;
var dayStates = {};
var username = '';
var clientId = 'client-alice';
var userAvatar = 'alfonso';
var userMessage = '';
var peers = {};
var inventory = {};
var warehouseContribution = {};
var collection = { discovered: ['resident_services_tent'], completed: [] };
var selectedDifficulty = 'standard';
var syncState = { status: 'ok' };

// ── 从 app.js 提取的关键函数（保持与原代码一致）──

function getDateKey(date) {
  if (!date) date = new Date();
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function getDayState(i) {
  if (!dayStates[i]) dayStates[i] = {
    checked: new Set(), settled: false, missed: false,
    difficulty: selectedDifficulty, score: 0, rewards: [], hiddenTasks: [],
    settledAt: null, settledDate: null, missedAt: null, missedDate: null
  };
  if (!dayStates[i].checked) dayStates[i].checked = new Set();
  if (!dayStates[i].hiddenTasks) dayStates[i].hiddenTasks = [];
  return dayStates[i];
}

function createInventory() {
  return { branch:0, wood:0, softwood:0, hardwood:0, stone:0, ironNugget:0,
           clay:0, weed:0, shell:0, starFragment:0, bells:0, nookMilesTicket:0, goldenLeaf:0 };
}
function createWarehouse() { return { wood:0, shell:0, stone:0, ironNugget:0 }; }

function saveLocal() {}

function normalizeCounts(base, saved) {
  var out = {}, k;
  for (k in base) out[k] = base[k];
  if (saved) for (k in saved) out[k] = saved[k];
  return out;
}

function normalizeRemoteObject(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch(e) { return fallback; } }
  return value;
}

function getSerializableStates() {
  var out = {}, k, v;
  for (k in dayStates) {
    v = dayStates[k];
    out[k] = {
      checked: Array.from(v.checked), settled: v.settled, missed: !!v.missed,
      difficulty: v.difficulty || selectedDifficulty, score: v.score || 0,
      rewards: v.rewards || [], hiddenTasks: v.hiddenTasks || [],
      settledAt: v.settledAt || null, settledDate: v.settledDate || null,
      missedAt: v.missedAt || null, missedDate: v.missedDate || null
    };
  }
  return out;
}

function hasPeerSettledToday() {
  var today = getDateKey();
  var keys = Object.keys(peers), i, j, ds;
  for (i = 0; i < keys.length; i++) {
    var p = peers[keys[i]];
    var pds = p.dayStates || {};
    var dsKeys = Object.keys(pds);
    for (j = 0; j < dsKeys.length; j++) {
      ds = pds[dsKeys[j]];
      if (ds && ds.settled && ds.settledDate === today) return true;
    }
    var s = pds[currentDayIndex];
    if (s && s.settled) return true;
  }
  return false;
}

function applySettlementRewards(state, day) {
  var difficulty = state.difficulty || selectedDifficulty;
  var diff = DIFFICULTIES[difficulty] || DIFFICULTIES.standard;
  var total = day.exercises.length;
  var fullDone = state.checked.size >= total;
  var base = Math.max(1, state.checked.size);
  var score = base * diff.multiplier;
  state.difficulty = difficulty;
  state.score = score;
  state.settledAt = Date.now();

  // 简化版 detectHiddenTasks（只测 same_day_checkin）
  var hiddenTasks = [];
  if (hasPeerSettledToday()) hiddenTasks.push('same_day_checkin');

  state.rewards = ['wood', 'stone'];
  state.hiddenTasks = hiddenTasks;

  if (hiddenTasks.indexOf('same_day_checkin') !== -1) {
    inventory.nookMilesTicket = (inventory.nookMilesTicket || 0) + 1;
    if (collection.discovered.indexOf('same_day_checkin') === -1)
      collection.discovered.push('same_day_checkin');
  }
}

function handleSettle() {
  var state = getDayState(currentDayIndex);
  if (state.settled || state.missed) return;
  var day = allDays[currentDayIndex];
  var total = day.exercises.length;
  if (state.checked.size === 0) {
    for (var i = 0; i < total; i++) state.checked.add(i);
  }
  state.difficulty = state.difficulty || selectedDifficulty;
  state.settled = true;
  state.settledDate = getDateKey();
  applySettlementRewards(state, day);
  saveLocal();
}

// ★★★ 被测目标函数：从 app.js 原样复制 ★★★
function retroactiveHiddenCheck() {
  var todayKey = getDateKey();
  var todayIndex = -1, todayState = null, i, s;
  for (i = 0; i < allDays.length; i++) {
    s = getDayState(i);
    if ((s.settled && s.settledDate === todayKey) || (s.missed && s.missedDate === todayKey)) {
      todayIndex = i; todayState = s; break;
    }
  }
  if (!todayState || !todayState.settled) return;
  if (todayState.hiddenTasks.indexOf('same_day_checkin') !== -1) return;
  if (!hasPeerSettledToday()) return;

  todayState.hiddenTasks.push('same_day_checkin');
  inventory.nookMilesTicket = (inventory.nookMilesTicket || 0) + 1;
  if (collection.discovered.indexOf('same_day_checkin') === -1)
    collection.discovered.push('same_day_checkin');
  saveLocal();
  showToast('\u53CC\u4EBA\u540C\u65E5\u767B\u5C9F\uFF01\u8865\u53D1\u91CC\u6570\u5238 x1');
}

// applySharedState 的精简版（只保留 peer 更新 + 触发回溯检查）
function applySharedState(payload) {
  var users = (payload && payload.users) || {};
  var nextPeers = {};
  var ukeys = Object.keys(users), id, data;
  for (var ui = 0; ui < ukeys.length; ui++) {
    id = ukeys[ui];
    data = users[id];
    if (!data || id === clientId || data.clientId === clientId) continue;
    nextPeers[id] = {
      name: data.displayName || data.username || id,
      avatar: data.avatar || '',
      dayStates: normalizeRemoteObject(data.dayStates, {}),
      currentDayIndex: data.currentDayIndex || 0,
      lastActive: data.lastActive || 0
    };
  }
  peers = nextPeers;
  retroactiveHiddenCheck();
}


// ════════════════════════════════════════
//  测试用例
// ════════════════════════════════════════

var passed = 0, failed = 0;
function assert(condition, label) {
  if (condition) { passed++; console.log('  \u2713 ' + label); }
  else { failed++; console.log('  \u2717 FAIL: ' + label); }
}

function resetTestEnv() {
  plan = {
    weeks: [{ theme:'出现', days:[
      { type:'A 训练', title:'唤醒身体', phase:'出现', minutes:10, review:false,
        exercises:[['原地踏步','2 分钟','热身'],['靠墙静蹲','15 秒 x 2','腿部激活']] },
      { type:'B 训练', title:'找到节奏', phase:'出现', minutes:10, review:false,
        exercises:[['原地踏步','3 分钟','热身'],['跪姿俯卧撑','5 个 x 2','上身激活']] },
    ]}]
  };
  allDays = [];
  var wi, di;
  for (wi = 0; wi < plan.weeks.length; wi++) {
    for (di = 0; di < plan.weeks[wi].days.length; di++) {
      var d = plan.weeks[wi].days[di];
      allDays.push({ type:d.type, title:d.title, phase:d.phase, minutes:d.minutes, review:d.review,
                     exercises:d.exercises, weekIndex:wi, weekTheme:plan.weeks[wi].theme, dayInWeek:di });
    }
  }
  currentDayIndex = 0;
  dayStates = {};
  inventory = createInventory();
  warehouseContribution = createWarehouse();
  collection = { discovered: ['resident_services_tent'], completed: [] };
  peers = {};
  clientId = 'client-alice';
  toastLog.length = 0;
}

console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║  回溯补发奖励 - 单元测试              ║');
console.log('╚══════════════════════════════════════╝');
console.log('');


// ── 测试 1：双方都未结算，不应触发 ──
console.log('--- 测试 1：双方都未结算 ---');
resetTestEnv();
retroactiveHiddenCheck();
assert(inventory.nookMilesTicket === 0, '无人结算时不应给奖励');
assert(toastLog.length === 0, '不应弹 toast');


// ── 测试 2：哥哥先结算，乖宝还未结算（模拟原始 bug 场景）──
console.log('');
console.log('--- 测试 2：哥哥先结算，乖宝还未结算（peers 为空）---');
resetTestEnv();
handleSettle();

assert(getDayState(0).settled === true, '哥哥已结算');
assert(getDayState(0).hiddenTasks.indexOf('same_day_checkin') === -1,
       '先结算时 peers 为空 -> 不应拿到同日登岛奖励（复现 bug）');
assert(inventory.nookMilesTicket === 0, '里数券应为 0');

var ticketsBefore = inventory.nookMilesTicket;


// ── 测试 3：轮询拉到乖宝的结算数据 -> 应补发 ──
console.log('');
console.log('--- 测试 3：轮询收到乖宝的结算数据 -> 补发触发 ---');
applySharedState({
  users: {
    'client-bob': {
      clientId: 'client-bob',
      displayName: '\u4E56\u5B9D',
      avatar: 'rosie',
      dayStates: {
        '0': { checked:[0,1], settled:true, settledDate:getDateKey(), difficulty:'standard',
               score:2, rewards:['wood'], hiddenTasks:['same_day_checkin'] }
      },
      currentDayIndex: 0,
      lastActive: Date.now()
    }
  }
});

assert(inventory.nookMilesTicket > ticketsBefore,
       '里数券应增加 (' + ticketsBefore + ' -> ' + inventory.nookMilesTicket + ')');
assert(getDayState(0).hiddenTasks.indexOf('same_day_checkin') !== -1,
       'hiddenTasks 应包含 same_day_checkin');
assert(collection.discovered.indexOf('same_day_checkin') !== -1,
       '图鉴应发现 same_day_checkin');
assert(toastLog.some(function(t){ return t.indexOf('\u8865\u53D1') !== -1; }),
       '应弹出补发 toast: "' + toastLog[toastLog.length-1] + '"');


// ── 测试 4：重复轮询不应重复补发 ──
console.log('');
console.log('--- 测试 4：再次轮询同一数据 -> 不应重复补发 ---');
var ticketsBefore2 = inventory.nookMilesTicket;
toastLog.length = 0;

applySharedState({
  users: {
    'client-bob': {
      clientId: 'client-bob',
      displayName: '\u4E56\u5B9D',
      avatar: 'rosie',
      dayStates: {
        '0': { checked:[0,1], settled:true, settledDate:getDateKey(), difficulty:'standard',
               score:2, rewards:['wood'], hiddenTasks:['same_day_checkin'] }
      },
      currentDayIndex: 0,
      lastActive: Date.now()
    }
  }
});

assert(inventory.nookMilesTicket === ticketsBefore2,
       '里数券不应再增加 (仍为 ' + inventory.nookMilesTicket + ')');
assert(toastLog.length === 0, '不应再次弹 toast（防重复机制生效）');


// ── 测试 5：哥哥休息日，即使对方结算了也不补发 ──
console.log('');
console.log('--- 测试 5：哥哥选"今天休息"，乖宝结算了 -> 不补发 ---');
resetTestEnv();
var restState = getDayState(0);
restState.checked = new Set();
restState.missed = true;
restState.missedDate = getDateKey();

applySharedState({
  users: {
    'client-bob': {
      clientId: 'client-bob',
      displayName: '\u4E56\u5B9D',
      avatar: 'rosie',
      dayStates: {
        '0': { checked:[0,1], settled:true, settledDate:getDateKey(), difficulty:'standard',
               score:2, rewards:['wood'], hiddenTasks:['same_day_checkin'] }
      },
      currentDayIndex: 0,
      lastActive: Date.now()
    }
  }
});

assert(inventory.nookMilesTicket === 0, '休息日不应补发里数券');
assert(toastLog.length === 0, '不应弹 toast');


// ── 测试 6：乖宝先结算，哥哥后结算（反向场景）──
console.log('');
console.log('--- 测试 6：乖宝先结算，哥哥后结算（反向）---');
resetTestEnv();
clientId = 'client-bob';
username = '\u4E56\u5B9D';

peers = {
  'client-alice': {
    name: '\u54E5\u54E5',
    avatar: 'alfonso',
    dayStates: {
      '0': { checked:[0,1], settled:true, settledDate:getDateKey(), difficulty:'standard',
             score:2, rewards:['wood'], hiddenTasks:[] }
    },
    currentDayIndex: 0,
    lastActive: Date.now()
  }
};

handleSettle();
var bobTicketsAfterSettle = inventory.nookMilesTicket;

assert(getDayState(0).hiddenTasks.indexOf('same_day_checkin') !== -1,
       '后结算者应直接拿到同日登岛奖励');
assert(bobTicketsAfterSettle >= 1, '后结算者里数券 >= 1 (实际: ' + bobTicketsAfterSettle + ')');


// ── 结果汇总 ──
console.log('');
console.log('╔══════════════════════════════════════╗');
var pad = '                              ';
console.log('║  结果: ' + passed + ' 通过, ' + failed + ' 失败' + pad.slice(0, Math.max(0, 22 - String(passed).length - String(failed).length)) + '║');
console.log('╚══════════════════════════════════════╝');
console.log('');

process.exit(failed > 0 ? 1 : 0);
