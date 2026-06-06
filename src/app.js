// ── Constants ──
const ROOM_KEY = 'fitness-island-v1';
const SYNC_API = './api/state.php';
const ANIMALS = ['🐱','🐰','🐻','🦊','🐶','🐨','🐼','🐸','🐵','🐯','🦁','🐮'];
const COLORS = ['#59c9a5','#ef8354','#ffd166','#6c5ce7','#00b894','#e17055','#0984e3','#fdcb6e'];
const AVATARS = [
  { id: 'alfonso', name: 'Alfonso', img: './assets/acnh-avatars/alfonso.png' },
  { id: 'rosie', name: 'Rosie', img: './assets/acnh-avatars/rosie.png' },
  { id: 'gulliver', name: 'Gulliver', img: './assets/acnh-avatars/gulliver.png' },
  { id: 'tom-nook', name: 'Tom Nook', img: './assets/acnh-avatars/tom-nook.png' },
  { id: 'timmy-tommy', name: 'Timmy and Tommy', img: './assets/acnh-avatars/timmy-tommy.png' }
];
const DIFFICULTIES = {
  easy: { label: '轻松', multiplier: 1, hint: '保连续，少一点也算上岛。' },
  standard: { label: '标准', multiplier: 2, hint: '按今天计划完成，奖励稳定。' },
  challenge: { label: '挑战', multiplier: 3, hint: '状态好再选，可能触发稀有彩蛋。' }
};
const ITEMS = {
  branch: ['树枝', '🌿', './assets/acnh-icons/branch.png'],
  wood: ['木材', '🪵', './assets/acnh-icons/wood.png'],
  softwood: ['软木材', '🪵', './assets/acnh-icons/softwood.png'],
  hardwood: ['硬木材', '🪵', './assets/acnh-icons/hardwood.png'],
  stone: ['石头', '🪨', './assets/acnh-icons/stone.png'],
  ironNugget: ['铁矿石', '⛏', './assets/acnh-icons/ironNugget.png'],
  clay: ['黏土', '🧱', './assets/acnh-icons/clay.png'],
  weed: ['杂草', '☘', './assets/acnh-icons/weed.png'],
  shell: ['贝壳', '🐚', './assets/acnh-icons/shell.png'],
  starFragment: ['星星碎片', '⭐', './assets/acnh-icons/starFragment.png'],
  bells: ['铃钱', '🔔', './assets/acnh-icons/bells.png'],
  nookMilesTicket: ['里数券', '🎫', './assets/acnh-icons/nookMilesTicket.png'],
  goldenLeaf: ['金色树叶', '🍂']
};
const BUILDINGS = [
  { id: 'resident_services_tent', name: '服务处帐篷', icon: '⛺', need: 0, metric: 'checkins', x: 49, y: 43, desc: '小基地的入口，记录两个人今天有没有登岛。', reward: '默认开放，负责查看今日状态。' },
  { id: 'storage', name: '收纳仓库', icon: '📦', img: './assets/acnh-icons/storage.png', need: 3, metric: 'checkins', x: 25, y: 34, desc: '把打卡得到的木材、石头和贝壳存进共同仓库。', reward: '累计打卡 3 天后开放仓库进度。' },
  { id: 'nook_stop', name: '狸端机', icon: '🏧', img: './assets/acnh-icons/nookMilesTicket.png', need: 5, metric: 'checkins', x: 70, y: 33, desc: '用连续出现换里数券，适合当作双人同日登岛奖励。', reward: '累计打卡 5 天后开放里数券提示。' },
  { id: 'museum', name: '博物馆', icon: '🏛', img: './assets/acnh-icons/museum.png', need: 10, metric: 'collection', x: 34, y: 66, desc: '收藏材料、建筑和隐藏任务，逐步补齐图鉴。', reward: '图鉴发现 10 项后解锁博物馆。' },
  { id: 'pier', name: '海边码头', icon: '🌊', img: './assets/acnh-icons/shell.png', need: 120, metric: 'minutes', x: 74, y: 73, desc: '训练分钟数累计到一定程度后，海边会出现新的奖励点。', reward: '累计训练 120 分钟后开放码头。' }
];

// ── State ──
let plan = null;
let allDays = [];
let currentDayIndex = 0;
let dayStates = {};
let username = '';
let clientId = getClientId();
let userAvatar = getRandomAvatar();
let userMessage = '';
let peers = {}; // other users' data from shared PHP JSON storage
let syncVersion = 0; // 服务端版本号，用于乐观并发控制
let inventory = createInventory();
let warehouseContribution = createWarehouse();
let collection = { discovered: ['resident_services_tent'], completed: [] };
let activeView = 'today';
let selectedDifficulty = 'standard';
let collectionFilter = 'all';
let queuedBuildUpdates = [];
let syncTimer = null;
let syncState = { status: 'syncing', lastAt: null };

// ── Username ──
function getRandomAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].id;
}

function getAvatarMeta(id) {
  return AVATARS.find(a => a.id === id) || null;
}

function avatarMarkup(id, fallback = '👤') {
  const meta = getAvatarMeta(id);
  return meta ? `<img class="avatar-img" src="${meta.img}" alt="${escapeHtml(meta.name)}">` : escapeHtml(fallback);
}
function getClientId() {
  return crypto?.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const nameOverlay = document.getElementById('nameOverlay');
const nameInput = document.getElementById('nameInput');
const nameBtn = document.getElementById('nameBtn');

nameInput.focus();
nameBtn.addEventListener('click', submitName);
nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitName(); });

async function submitName() {
  const n = nameInput.value.trim();
  if (!n) { nameInput.style.borderColor = 'var(--animal-error-color)'; return; }
  resetUserSessionState();
  username = n;
  nameOverlay.classList.add('hidden');
  document.getElementById('loading').classList.remove('hidden');
  await initApp();
}

document.getElementById('changeName').addEventListener('click', () => {
  nameInput.value = '';
  nameOverlay.classList.remove('hidden');
  setTimeout(() => nameInput.focus(), 100);
});
document.getElementById('avatarBtn')?.addEventListener('click', () => {
  renderAvatarChoices();
  document.getElementById('avatarModal').classList.add('show');
});
document.getElementById('loadingRetryBtn')?.addEventListener('click', () => location.reload());

// ── Init ──
async function initApp() {
  const bar = document.getElementById('loadingBar');
  try {
    bar.style.width = '30%';
    const res = await fetch('plan.json');
    if (!res.ok) throw new Error(res.status);
    bar.style.width = '70%';
    plan = await res.json();
    bar.style.width = '100%';

    flattenDays();
    loadLocal();
    findTodayIndex();

    // Start shared PHP JSON sync
    await pullSelfFromServer();
    syncMyState();
    listenPeers();

    setTimeout(() => {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('app').style.display = '';
      document.getElementById('floatingNav').style.display = '';
      render();
    }, 400);
  } catch (e) {
    bar.style.width = '100%';
    showLoadError(e);
    console.error('Load failed:', e);
  }
}

function resetUserSessionState() {
  clientId = getClientId();
  userAvatar = getRandomAvatar();
  userMessage = '';
  peers = {};
  syncVersion = 0;
  inventory = createInventory();
  warehouseContribution = createWarehouse();
  collection = { discovered: ['resident_services_tent'], completed: [] };
  dayStates = {};
  currentDayIndex = 0;
  activeView = 'today';
  selectedDifficulty = 'standard';
  collectionFilter = 'all';
  queuedBuildUpdates = [];
  syncState = { status: 'syncing', lastAt: null };
}

function showLoadError(error) {
  const box = document.getElementById('loadingError');
  const text = document.getElementById('loadingErrorText');
  if (!box || !text) return;
  const detail = error?.message ? ` (${error.message})` : '';
  text.textContent = `训练计划加载失败${detail}`;
  box.classList.remove('hidden');
}

function flattenDays() {
  allDays = [];
  plan.weeks.forEach((w, wi) => {
    w.days.forEach((d, di) => {
      allDays.push({ ...d, weekIndex: wi, weekTheme: w.theme, weekSignal: w.signal, weekPlant: w.plant || 'sprout', dayInWeek: di });
    });
  });
}

function findTodayIndex() {
  currentDayIndex = getAvailableDayIndex();
}

function getDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayWeekdayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7; // Monday = 0, Sunday = 6
}

function getWeekdayLabel(dayIndex = getTodayWeekdayIndex()) {
  return ['周一','周二','周三','周四','周五','周六','周日'][dayIndex] || '今天';
}

function getWeekStartIndex(weekIndex) {
  return plan.weeks.slice(0, weekIndex).reduce((sum, week) => sum + week.days.length, 0);
}

function isWeekComplete(weekIndex) {
  const week = plan.weeks[weekIndex];
  if (!week) return true;
  const start = getWeekStartIndex(weekIndex);
  return week.days.every((_, dayIndex) => {
    const state = getDayState(start + dayIndex);
    return state.settled || state.missed;
  });
}

function getCurrentTrainingWeekIndex() {
  for (let wi = 0; wi < plan.weeks.length; wi++) {
    if (!isWeekComplete(wi)) return wi;
  }
  return Math.max(0, plan.weeks.length - 1);
}

function findSettledDateIndex(dateKey = getDateKey()) {
  for (let i = 0; i < allDays.length; i++) {
    const state = getDayState(i);
    if ((state.settled && state.settledDate === dateKey) || (state.missed && state.missedDate === dateKey)) return i;
  }
  return -1;
}

function getFirstUnsettledIndex() {
  return getWeekStartIndex(getCurrentTrainingWeekIndex()) + getTodayWeekdayIndex();
}

function getAvailableDayIndex() {
  const todayDoneIndex = findSettledDateIndex();
  return todayDoneIndex >= 0 ? todayDoneIndex : getFirstUnsettledIndex();
}

function hasSettledToday() {
  return findSettledDateIndex() >= 0;
}

function canCheckInDay(index = currentDayIndex) {
  if (hasSettledToday()) return false;
  const state = getDayState(index);
  return index === getAvailableDayIndex() && !state.settled && !state.missed;
}

function isLockedDay(index) {
  return index > getAvailableDayIndex();
}

function getDayState(i) {
  if (!dayStates[i]) dayStates[i] = { checked: new Set(), settled: false, missed: false, difficulty: selectedDifficulty, score: 0, rewards: [], hiddenTasks: [], settledAt: null, settledDate: null, missedAt: null, missedDate: null };
  if (!dayStates[i].checked) dayStates[i].checked = new Set();
  if (!dayStates[i].difficulty) dayStates[i].difficulty = selectedDifficulty;
  if (!dayStates[i].rewards) dayStates[i].rewards = [];
  if (!dayStates[i].hiddenTasks) dayStates[i].hiddenTasks = [];
  if (!('settledDate' in dayStates[i])) dayStates[i].settledDate = null;
  if (!('missed' in dayStates[i])) dayStates[i].missed = false;
  if (!('missedAt' in dayStates[i])) dayStates[i].missedAt = null;
  if (!('missedDate' in dayStates[i])) dayStates[i].missedDate = null;
  return dayStates[i];
}

function createInventory() {
  return { branch: 0, wood: 0, softwood: 0, hardwood: 0, stone: 0, ironNugget: 0, clay: 0, weed: 0, shell: 0, starFragment: 0, bells: 0, nookMilesTicket: 0, goldenLeaf: 0 };
}

function createWarehouse() {
  return { wood: 0, shell: 0, stone: 0, ironNugget: 0 };
}

function normalizeCounts(base, saved) {
  return { ...base, ...(saved || {}) };
}

function discover(id) {
  if (!collection.discovered.includes(id)) collection.discovered.push(id);
}

function addCounts(target, delta) {
  Object.entries(delta).forEach(([k, v]) => { target[k] = (target[k] || 0) + v; });
}

function countSettledStates(states) {
  return Object.values(states || {}).filter(s => s && s.settled).length;
}

function countMinutes(states) {
  let minutes = 0;
  Object.entries(states || {}).forEach(([idx, s]) => {
    if (s && s.settled && allDays[idx]) minutes += allDays[idx].minutes || 0;
  });
  return minutes;
}

// ── Local storage ──
function loadLocal() {
  // Browser persistence is intentionally not used. Server state is the source of truth.
}

function saveLocal() {
  // No-op: avoid uploading stale local browser data after refresh.
}

function createArchivePayload() {
  const out = {};
  for (const [k, v] of Object.entries(dayStates)) {
    out[k] = { checked: [...v.checked], settled: v.settled, missed: !!v.missed, difficulty: v.difficulty || selectedDifficulty, score: v.score || 0, rewards: v.rewards || [], hiddenTasks: v.hiddenTasks || [], settledAt: v.settledAt || null, settledDate: v.settledDate || null, missedAt: v.missedAt || null, missedDate: v.missedDate || null };
  }
  return {
    version: 3,
    app: 'fitness-island',
    exportedAt: new Date().toISOString(),
    username,
    userAvatar,
    userMessage,
    currentDayIndex,
    dayStates: out,
    inventory,
    warehouseContribution,
    collection,
    selectedDifficulty,
    activeView
  };
}

function applyArchivePayload(saved) {
  if (!saved || typeof saved !== 'object') throw new Error('存档格式不正确');
  const savedDays = saved.dayStates || {};
  dayStates = {};
  for (const [k, v] of Object.entries(savedDays)) {
    dayStates[k] = {
      checked: new Set(v.checked || []),
      settled: v.settled || false,
      missed: v.missed || false,
      difficulty: v.difficulty || selectedDifficulty,
      score: v.score || 0,
      rewards: v.rewards || [],
      hiddenTasks: v.hiddenTasks || [],
      settledAt: v.settledAt || null,
      settledDate: v.settledDate || null,
      missedAt: v.missedAt || null,
      missedDate: v.missedDate || null
    };
  }
  currentDayIndex = Number.isInteger(saved.currentDayIndex) ? Math.max(0, Math.min(saved.currentDayIndex, Math.max(0, allDays.length - 1))) : currentDayIndex;
  inventory = normalizeCounts(createInventory(), saved.inventory);
  warehouseContribution = normalizeCounts(createWarehouse(), saved.warehouseContribution);
  collection = { discovered: saved.collection?.discovered || ['resident_services_tent'], completed: saved.collection?.completed || [] };
  selectedDifficulty = saved.selectedDifficulty || 'standard';
  if (saved.userAvatar && getAvatarMeta(saved.userAvatar)) {
    userAvatar = saved.userAvatar;
  }
  if (typeof saved.userMessage === 'string') {
    userMessage = saved.userMessage.slice(0, 40);
  }
  activeView = saved.activeView || 'today';
}

// ── Shared PHP JSON sync ──
function getSerializableStates() {
  const out = {};
  for (const [k, v] of Object.entries(dayStates)) {
    out[k] = { checked: [...v.checked], settled: v.settled, missed: !!v.missed, difficulty: v.difficulty || selectedDifficulty, score: v.score || 0, rewards: v.rewards || [], hiddenTasks: v.hiddenTasks || [], settledAt: v.settledAt || null, settledDate: v.settledDate || null, missedAt: v.missedAt || null, missedDate: v.missedDate || null };
  }
  return out;
}

function createSyncRecord() {
  return {
    clientId: clientId,
    username: username,
    displayName: username,
    avatar: userAvatar,
    message: userMessage,
    dayStates: getSerializableStates(),
    currentDayIndex: currentDayIndex,
    inventory: inventory,
    warehouseContribution: warehouseContribution,
    collection: collection,
    selectedDifficulty: selectedDifficulty,
    lastActive: Date.now(),
    updated: Date.now(),
    syncVersion: syncVersion
  };
}

async function syncMyState() {
  if (!username) return;
  try {
    setSyncStatus('syncing');
    const res = await fetch(SYNC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ room: ROOM_KEY, user: createSyncRecord() })
    });
    if (res.status === 409) {
      // 服务端拒绝：数据过旧，读取最新版本并恢复自己的数据
      let body;
      try { body = await res.json(); } catch (jsonErr) {
        console.warn('409 response JSON parse failed:', jsonErr);
        await recoverConflictFromServer();
        return;
      }
      recoverConflictPayload(body);
      return;
    }
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const body = await res.json();
    // 更新自己的版本号（服务端会 +1 后返回）
    const myData = findSelfRecord(body.users || {});
    if (myData?.syncVersion) syncVersion = myData.syncVersion;
    applySharedState(body);
    setSyncStatus('ok');
  } catch (err) {
    setSyncStatus('fail');
    console.warn('Sync failed:', err);
  }
}

async function pullSelfFromServer() {
  if (!username) return;
  try {
    const res = await fetch(`${SYNC_API}?room=${encodeURIComponent(ROOM_KEY)}&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const body = await res.json();
    const serverSelf = findSelfRecord(body.users || {});
    if (serverSelf) {
      syncVersion = getConflictVersion(body, serverSelf);
      restoreSelfFromServer(serverSelf);
      if (serverSelf.avatar && getAvatarMeta(serverSelf.avatar)) userAvatar = serverSelf.avatar;
      if (typeof serverSelf.message === 'string') userMessage = serverSelf.message.slice(0, 40);
      selectedDifficulty = serverSelf.selectedDifficulty || selectedDifficulty;
      currentDayIndex = Number.isInteger(serverSelf.currentDayIndex) ? serverSelf.currentDayIndex : currentDayIndex;
    }
    applySharedState(body);
    findTodayIndex();
  } catch (err) {
    setSyncStatus('fail');
    console.warn('Initial self fetch failed:', err);
  }
}

function recoverConflictPayload(payload) {
  const serverSelf = findSelfRecord(payload?.users || {});
  if (serverSelf) {
    syncVersion = getConflictVersion(payload, serverSelf);
    restoreSelfFromServer(serverSelf);
  }
  applySharedState(payload);
  findTodayIndex();
  render();
  setSyncStatus(serverSelf ? 'ok' : 'fail');
}

function getConflictVersion(payload, serverSelf) {
  const payloadVersion = Number(payload?.version || 0);
  const selfVersion = Number(serverSelf?.syncVersion || 0);
  return Math.max(
    syncVersion,
    Number.isFinite(payloadVersion) ? payloadVersion : 0,
    Number.isFinite(selfVersion) ? selfVersion : 0
  );
}

async function recoverConflictFromServer() {
  try {
    const res = await fetch(`${SYNC_API}?room=${encodeURIComponent(ROOM_KEY)}&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`sync ${res.status}`);
    let body;
    try { body = await res.json(); } catch (jsonErr) {
      console.warn('Conflict recovery JSON parse failed:', jsonErr);
      setSyncStatus('fail');
      return;
    }
    recoverConflictPayload(body);
  } catch (err) {
    setSyncStatus('fail');
    console.warn('Conflict recovery fetch failed:', err);
  }
}

function listenPeers() {
  fetchSharedState();
  if (!syncTimer) syncTimer = setInterval(fetchSharedState, 8000);
}

async function fetchSharedState() {
  try {
    const res = await fetch(`${SYNC_API}?room=${encodeURIComponent(ROOM_KEY)}&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`sync ${res.status}`);
    applySharedState(await res.json());
    setSyncStatus('ok');
  } catch (err) {
    setSyncStatus('fail');
    console.warn('Fetch shared state failed:', err);
  }
}

function setSyncStatus(status) {
  syncState = { status, lastAt: status === 'ok' ? Date.now() : syncState.lastAt };
  renderSyncStatus();
}

function normalizeRemoteObject(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isSelfRecord(id, data) {
  if (!data) return false;
  if (id === clientId || data.clientId === clientId) return true;
  return normalizeName(data.displayName || data.username) === normalizeName(username);
}

function findSelfRecord(users) {
  return Object.entries(users || {}).find(([id, data]) => isSelfRecord(id, data))?.[1] || null;
}

function applySharedState(payload) {
  const users = payload?.users || {};
  const nextPeers = {};
  Object.entries(users).forEach(([id, data]) => {
    if (!data || isSelfRecord(id, data)) return;
    nextPeers[id] = {
      name: data.displayName || data.username || id,
      avatar: data.avatar || '',
      message: typeof data.message === 'string' ? data.message.slice(0, 40) : '',
      dayStates: normalizeRemoteObject(data.dayStates, {}),
      currentDayIndex: data.currentDayIndex || 0,
      inventory: normalizeCounts(createInventory(), normalizeRemoteObject(data.inventory, {})),
      warehouseContribution: normalizeCounts(createWarehouse(), normalizeRemoteObject(data.warehouseContribution, {})),
      collection: normalizeRemoteObject(data.collection, { discovered: [], completed: [] }),
      selectedDifficulty: data.selectedDifficulty || 'standard',
      lastActive: data.lastActive || 0
    };
  });
  peers = nextPeers;
  // 跟踪自己的版本号
  const myServerData = findSelfRecord(payload?.users || {});
  if (myServerData?.syncVersion) syncVersion = myServerData.syncVersion;
  renderBuddies();
  renderLeaderboard();
  renderIsland();
  retroactiveHiddenCheck();
}

// ── 从服务端恢复自己的数据（409 冲突时调用）──
function restoreSelfFromServer(serverSelf) {
  // 只恢复关键字段，保留本地 UI 状态（名字、头像、难度选择等）
  if (serverSelf.dayStates) {
    Object.entries(serverSelf.dayStates).forEach(([idx, s]) => {
      const i = Number(idx);
      // 确保目标 dayState 存在（旧页面可能 dayStates 为空）
      if (!dayStates[i]) {
        dayStates[i] = {
          checked: new Set(), settled: false, missed: false,
          difficulty: selectedDifficulty, score: 0, rewards: [], hiddenTasks: [],
          settledAt: null, settledDate: null, missedAt: null, missedDate: null
        };
      }
      dayStates[i].settled = !!s.settled;
      dayStates[i].missed = !!s.missed;
      dayStates[i].checked = new Set(Array.isArray(s.checked) ? s.checked : []);
      dayStates[i].hiddenTasks = Array.isArray(s.hiddenTasks) ? [...s.hiddenTasks] : (dayStates[i].hiddenTasks || []);
      if (s.settledDate) dayStates[i].settledDate = s.settledDate;
      if (s.missedAt) dayStates[i].missedAt = s.missedAt;
      if (s.missedDate) dayStates[i].missedDate = s.missedDate;
      if (s.settledAt) dayStates[i].settledAt = s.settledAt;
      if (Number.isFinite(Number(s.score))) dayStates[i].score = Number(s.score) || 0;
      if (Array.isArray(s.rewards)) dayStates[i].rewards = [...s.rewards];
      if (s.difficulty) dayStates[i].difficulty = s.difficulty;
    });
  }
  if (serverSelf.inventory) {
    inventory = normalizeCounts(createInventory(), normalizeRemoteObject(serverSelf.inventory, {}));
  }
  if (serverSelf.warehouseContribution) {
    warehouseContribution = normalizeCounts(createWarehouse(), normalizeRemoteObject(serverSelf.warehouseContribution, {}));
  }
  if (serverSelf.collection) {
    collection.discovered = Array.isArray(serverSelf.collection?.discovered)
      ? [...new Set([...(collection.discovered || []), ...serverSelf.collection.discovered])]
      : (collection.discovered || []);
  }
  saveLocal();
}

// ── 回溯检查：结算时对方数据还未到达，补发隐藏任务奖励 ──
function retroactiveHiddenCheck() {
  const todayKey = getDateKey();
  // 找到今天已结算的 dayState
  let todayIndex = -1, todayState = null;
  for (let i = 0; i < allDays.length; i++) {
    const s = getDayState(i);
    if ((s.settled && s.settledDate === todayKey) || (s.missed && s.missedDate === todayKey)) {
      todayIndex = i; todayState = s; break;
    }
  }
  if (!todayState || !todayState.settled) return; // 今天没结算，不需要回溯
  if (todayState.hiddenTasks.includes('same_day_checkin')) return; // 已经拿到了

  // 检查现在是否满足同日登岛条件
  if (!hasPeerSettledToday()) return;

  // 补发奖励
  todayState.hiddenTasks.push('same_day_checkin');
  inventory.nookMilesTicket = (inventory.nookMilesTicket || 0) + 1;
  if (!collection.discovered.includes('same_day_checkin')) collection.discovered.push('same_day_checkin');
  saveLocal();
  showToast('双人同日登岛！补发里数券 x1');
}

// ── Render ──
function render() {
  const day = allDays[currentDayIndex];
  const state = getDayState(currentDayIndex);

  document.getElementById('userAvatar').innerHTML = avatarMarkup(userAvatar, '🏝');
  document.getElementById('userDisplayName').textContent = username;
  document.getElementById('heroDate').textContent = formatDate();
  document.getElementById('heroPrompt').textContent = day.summary || '';
  document.getElementById('heroMinutes').textContent = `${day.minutes || 0} 分钟`;
  document.getElementById('heroPhase').textContent = day.phase || '';
  document.getElementById('heroAnimal').textContent = '';
  document.getElementById('heroAnimal').setAttribute('aria-label', ANIMALS[currentDayIndex % ANIMALS.length]);

  const total = day.exercises.length;
  const done = state.checked.size;
  document.getElementById('progressFill').style.width = (total > 0 ? done / total * 100 : 0) + '%';
  document.getElementById('progressCount').textContent = `${done}/${total}`;

  renderRoute(day);
  renderTasks(day, state);
  renderCompleteStrip(day, state);
  renderDifficulty(day, state);
  renderBaseOverview(day, state);
  renderSyncStatus();
  renderMessageBoard();
  renderAvatarChoices();
  renderReview(day);
  renderArchive();
  renderBuddies();
  renderLeaderboard();
  renderCoopGoals();
  renderActivityFeed();
  renderIsland();
  renderInventory();
  renderCollection();
  renderView();
}

function formatDate() {
  const d = new Date();
  const w = ['日','一','二','三','四','五','六'];
  return `${d.getFullYear()} 年 ${d.getMonth()+1} 月 ${d.getDate()} 日 周${w[d.getDay()]}`;
}

function renderSyncStatus() {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  el.classList.remove('ok', 'fail');
  if (syncState.status === 'ok') {
    el.classList.add('ok');
    el.textContent = syncState.lastAt ? `已同步 ${formatShortTime(syncState.lastAt)}` : '已同步';
  } else if (syncState.status === 'fail') {
    el.classList.add('fail');
    el.textContent = '同步失败';
  } else {
    el.textContent = '同步中';
  }
}

function formatShortTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function renderMessageBoard() {
  const input = document.getElementById('messageInput');
  const list = document.getElementById('messageList');
  if (!input || !list) return;
  if (document.activeElement !== input) input.value = userMessage;
  const notes = [{ name: username, avatar: userAvatar, message: userMessage }].concat(
    Object.values(peers).map(p => ({ name: p.name || '伙伴', avatar: p.avatar || '', message: p.message || '' }))
  ).filter(note => note.message);
  list.innerHTML = notes.length ? notes.map(note => `
    <div class="message-note">${avatarMarkup(note.avatar, '🏝')}<strong>${escapeHtml(note.name)}</strong><span>${escapeHtml(note.message)}</span></div>
  `).join('') : '<div class="message-note"><span>还没有留言</span></div>';
}

function renderAvatarChoices() {
  const grid = document.getElementById('avatarChoices');
  if (!grid) return;
  grid.innerHTML = AVATARS.map(avatar => `
    <button class="avatar-choice ${avatar.id === userAvatar ? 'active' : ''}" type="button" data-avatar="${avatar.id}" aria-label="${avatar.name}">
      ${avatarMarkup(avatar.id)}
    </button>
  `).join('');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function getGlobalIndex(wi, di) {
  let idx = 0;
  for (let i = 0; i < wi; i++) idx += plan.weeks[i].days.length;
  return idx + di;
}

function renderRoute(day) {
  const wi = day.weekIndex;
  const week = plan.weeks[wi];
  document.getElementById('routeWeek').textContent = `第 ${wi+1} 周 · ${week.theme}`;
  document.getElementById('routePill').textContent = week.signal || week.theme;
  const c = document.getElementById('routeNodes');
  c.innerHTML = '';
  week.days.forEach((d, di) => {
    const gi = getGlobalIndex(wi, di);
    const n = document.createElement('div');
    n.className = 'route-node';
    n.dataset.day = ['一','二','三','四','五','六','日'][di] || String(di + 1);
    n.dataset.weekday = getWeekdayLabel(di);
    const isCurrent = gi === currentDayIndex;
    const ds = getDayState(gi);
    const locked = isLockedDay(gi);
    if (isCurrent) n.classList.add('selected','today');
    if (locked) n.classList.add('locked');
    if (ds.missed) n.classList.add('rested');
    if (ds.settled && ds.checked.size === d.exercises.length) n.classList.add('done');
    else if (ds.settled) n.classList.add('appeared');
    else if (gi < currentDayIndex && !ds.settled) n.classList.add('late');
    n.textContent = di + 1;
    n.setAttribute('aria-label', `${week.theme} ${getWeekdayLabel(di)} ${d.title}${locked ? '，未开放' : ''}`);
    n.addEventListener('click', () => {
      if (locked) { showToast(`今天只能打卡${getWeekdayLabel()}`); return; }
      if (gi !== getAvailableDayIndex()) { showDayDetail(gi); return; }
      currentDayIndex = gi;
      render();
      window.scrollTo({top:0,behavior:'smooth'});
    });
    c.appendChild(n);
  });
}

function renderTasks(day, state) {
  document.getElementById('taskTitle').textContent = day.title || '今日训练';
  const list = document.getElementById('taskList');
  list.innerHTML = '';
  const editable = canCheckInDay(currentDayIndex);
  day.exercises.forEach((ex, i) => {
    const card = document.createElement('div');
    card.className = 'task-card' + (state.checked.has(i) ? ' checked' : '') + (!editable && !state.settled ? ' locked' : '');
    const cb = document.createElement('div');
    cb.className = 'task-checkbox'; cb.textContent = '✓';
    cb.setAttribute('aria-disabled', String(!editable || state.settled));
    cb.addEventListener('click', () => toggleTask(i));
    const info = document.createElement('div');
    info.className = 'task-info';
    info.innerHTML = `<div class="task-name">${ex[0]}</div><div class="task-detail">${ex[1]}</div><div class="task-note">${ex[2]}</div>`;
    card.appendChild(cb); card.appendChild(info);
    list.appendChild(card);
  });
}

function toggleTask(i) {
  const state = getDayState(currentDayIndex);
  if (state.settled || state.missed) return;
  if (!canCheckInDay(currentDayIndex)) {
    showToast(hasSettledToday() ? '今天已经盖章，明天再继续' : `今天只能打卡${getWeekdayLabel()}`);
    return;
  }
  if (state.checked.has(i)) state.checked.delete(i); else state.checked.add(i);
  saveLocal();
  syncMyState();
  render();
}

function renderCompleteStrip(day, state) {
  const strip = document.getElementById('completeStrip');
  const btn = document.getElementById('completeBtn');
  const restBtn = document.getElementById('restDayBtn');
  const total = day.exercises.length;
  const done = state.checked.size;
  const editable = canCheckInDay(currentDayIndex);
  strip.classList.remove('settled', 'locked');
  btn.disabled = !editable && !state.settled;
  if (state.settled) { strip.classList.add('settled'); btn.textContent = state.settledDate === getDateKey() ? '今天已完成' : '已记录'; }
  else if (state.missed) { strip.classList.add('locked'); btn.textContent = '今天休息中'; }
  else if (!editable) { strip.classList.add('locked'); btn.textContent = hasSettledToday() ? '明天再继续' : `仅限${getWeekdayLabel()}`; }
  else if (done === 0) btn.textContent = '完成今天';
  else if (done >= total) btn.textContent = '完成今天';
  else btn.textContent = '今天到这';
  if (restBtn) restBtn.disabled = !editable || state.settled || state.missed;
}

function renderDifficulty(day, state) {
  const currentDifficulty = state.difficulty || selectedDifficulty;
  document.querySelectorAll('#difficultySelector .difficulty-btn').forEach(btn => {
    const isActive = btn.dataset.difficulty === currentDifficulty;
    btn.classList.toggle('active', isActive);
    btn.disabled = !!state.settled || !canCheckInDay(currentDayIndex);
  });
  const diff = DIFFICULTIES[currentDifficulty] || DIFFICULTIES.standard;
  const fullScore = (day.exercises.length || 0) * diff.multiplier;
  const preview = document.getElementById('rewardPreview');
  preview.innerHTML = `<div class="reward-line"><span>${diff.label}奖励</span><span>${fullScore} 积分 · ${diff.multiplier} 份材料</span></div>`;
  document.getElementById('hiddenQuestHint').textContent = getHiddenQuestHint(currentDifficulty, day);
}

function renderBaseOverview(day, state) {
  const el = document.getElementById('baseOverview');
  if (!el || !allDays.length) return;
  const total = day.exercises.length || 0;
  const done = state.checked.size;
  const todayDone = state.settled;
  const peerDone = hasPeerSettledToday();
  const warehouse = getSharedWarehouse();
  const next = getNextUnlockTarget();
  const hidden = getHiddenQuestStatuses(day, state).slice(0, 4);
  el.innerHTML = `
    <div class="base-overview-head">
      <div>
        <div class="base-overview-title">基地总览</div>
        <div class="base-overview-sub">${next ? `下个目标：${next.name} ${next.value}/${next.need}` : '小基地核心设施已开放'}</div>
      </div>
      <button class="collection-tab" type="button" id="overviewIslandBtn">看岛</button>
    </div>
    <div class="base-overview-grid">
      <div class="base-tile ${todayDone ? 'good' : ''}"><strong>${todayDone ? '今日已盖章' : `今日 ${done}/${total}`}</strong><span>${todayDone ? '训练记录已进入小基地' : '完成后会结算材料和铃钱'}</span></div>
      <div class="base-tile ${peerDone && todayDone ? 'good' : peerDone ? 'warn' : ''}"><strong>${peerDone && todayDone ? '双人同日' : peerDone ? '伙伴已登岛' : '等待伙伴'}</strong><span>${peerDone && todayDone ? '里数券气泡会出现在岛上' : '两人同日可触发合作奖励'}</span></div>
      <div class="base-tile"><strong>${sumCounts(warehouse)} 份材料</strong><span>${formatMaterialSummary(warehouse)}</span></div>
      <div class="base-tile ${next && next.pct >= 80 ? 'warn' : ''}"><strong>${next ? `${next.pct}%` : '100%'}</strong><span>${next ? `${next.name} 建设进度` : '当前目标已完成'}</span></div>
    </div>
    <div class="hidden-status-list">${hidden.map(renderHiddenStatus).join('')}</div>`;
  document.getElementById('overviewIslandBtn')?.addEventListener('click', () => {
    activeView = 'island';
    saveLocal();
    renderView();
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
}

function getNextUnlockTarget() {
  const metrics = getCoopMetrics();
  const warehouse = getSharedWarehouse();
  const targets = BUILDINGS.map(building => ({ building, status: getBuildingStatus(building, metrics, warehouse) }))
    .filter(({ building, status }) => building.need > 0 && !status.unlocked)
    .sort((a, b) => b.status.pct - a.status.pct);
  if (!targets.length) return null;
  const { building, status } = targets[0];
  return { name: building.name, value: status.value, need: building.need, pct: status.pct };
}

function formatMaterialSummary(warehouse) {
  const entries = Object.entries(warehouse || {}).filter(([, value]) => Number(value) > 0).slice(0, 3);
  if (!entries.length) return '仓库还在等第一份材料';
  return entries.map(([key, value]) => `${ITEMS[key]?.[0] || key} ${value}`).join(' · ');
}

function getHiddenQuestStatuses(day, state) {
  const hour = new Date().getHours();
  const difficulty = state.difficulty || selectedDifficulty;
  const fullDone = state.checked.size >= (day.exercises.length || 0);
  return [
    { id: 'starFragment', name: '夜海星光', found: collection.discovered.includes('starFragment'), ready: hour >= 20 || hour < 5, clue: '夜色落下后，海边有时会闪一下。' },
    { id: 'same_day_checkin', name: '同日登岛', found: collection.discovered.includes('same_day_checkin'), ready: hasPeerSettledToday(), clue: '两位岛民同一天盖章，码头会送来船票。' },
    { id: 'bells_bag', name: '铃钱袋', found: collection.discovered.includes('bells_bag'), ready: difficulty === 'challenge' && fullDone, clue: '状态很好时走完整条挑战路线，铃声会更响。' },
    { id: 'goldenLeaf', name: '金色树叶', found: collection.discovered.includes('goldenLeaf'), ready: difficulty === 'easy' && countRecentDifficulty('easy') >= 2, clue: '轻轻地连续出现几天，树叶可能变成金色。' },
    { id: 'museum_entry', name: '博物馆条目', found: collection.discovered.includes('museum_entry'), ready: !!day.review && fullDone, clue: '复盘日完整盖章，博物馆会添一条记录。' }
  ];
}

function renderHiddenStatus(item) {
  const cls = item.found ? 'found' : item.ready ? 'ready' : '';
  const label = item.found ? '已触发' : item.ready ? '今日可试' : '线索';
  return `<div class="hidden-status ${cls}"><span>${item.name}</span><small>${label}</small></div>`;
}

function getHiddenQuestHint(difficulty, day) {
  if (day.review) return '周复盘日完成后，博物馆会新增一条图鉴记录。';
  if (difficulty === 'challenge') return '挑战完整完成时，可能获得铃钱袋。';
  if (difficulty === 'easy') return '轻松难度连续 3 天，会发现一片金色树叶。';
  return '如果两个人今天都登岛，服务处会送出里数券。';
}

// ── Buddies ──
function renderBuddies() {
  const list = document.getElementById('buddyList');
  const entries = Object.entries(peers);
  if (entries.length === 0) {
    list.innerHTML = `<div class="buddy-empty">还没有看到训练伙伴。确认两边打开同一个页面和网络可访问，房间：${ROOM_KEY}</div>`;
    return;
  }
  list.innerHTML = '';
  entries.forEach(([id, p], idx) => {
    const name = p.name || id;
    const color = COLORS[(idx + 1) % COLORS.length];
    const isOnline = (Date.now() - (p.lastActive || 0)) < 120000; // 2 min
    const ds = p.dayStates || {};
    const ci = p.currentDayIndex || 0;
    let settledDays = 0;
    allDays.forEach((d, i) => { if (ds[i] && ds[i].settled) settledDays++; });
    const currentDay = allDays[ci] || allDays[0];
    const currentDs = ds[ci] || { checked: [], settled: false };
    const checkedCount = (currentDs.checked || []).length;
    const exTotal = currentDay.exercises.length;
    const pct = exTotal > 0 ? Math.round(checkedCount / exTotal * 100) : 0;

    let statusText = '还没有开始';
    if (currentDs.settled && checkedCount === exTotal) statusText = '✓ 今天已完成';
    else if (currentDs.settled) statusText = `今天到这 (${checkedCount}/${exTotal})`;
    else if (checkedCount > 0) statusText = `训练中 (${checkedCount}/${exTotal})`;
    else if (ci > 0) statusText = `第 ${ci + 1} 天`;

    const card = document.createElement('div');
    card.className = 'buddy-card';
    card.innerHTML = `
      <div class="buddy-avatar" style="background:${color}">${avatarMarkup(p.avatar, name.charAt(0).toUpperCase())}</div>
      <div class="buddy-info">
        <div class="buddy-name">${escapeHtml(name)} ${isOnline ? '<span class="online-dot"></span>' : '<span class="offline-dot"></span>'}</div>
        <div class="buddy-status">${statusText} · 累计 ${settledDays} 天</div>
        ${p.message ? `<div class="buddy-message">${escapeHtml(p.message)}</div>` : ''}
        <div class="buddy-progress"><div class="buddy-progress-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    list.appendChild(card);
  });
}

// ── Leaderboard ──
function renderLeaderboard() {
  const body = document.getElementById('weeklyContributionBody') || document.getElementById('leaderboardBody');
  const rows = [];

  // Add me
  let mySettled = 0, myChecked = 0, myScore = 0;
  allDays.forEach((d, i) => {
    const s = getDayState(i);
    if (s.checked.size > 0) myChecked += s.checked.size;
    if (s.settled) mySettled++;
    myScore += s.score || 0;
  });
  rows.push({ name: username, isMe: true, avatar: userAvatar, settledDays: mySettled, totalChecked: myChecked, totalScore: myScore, currentDay: currentDayIndex, lastActive: Date.now(), warehouse: sumCounts(warehouseContribution), materials: warehouseContribution });

  // Add peers
  Object.entries(peers).forEach(([id, p]) => {
    const ds = p.dayStates || {};
    let settled = 0, checked = 0, score = 0;
    allDays.forEach((d, i) => {
      if (ds[i]) {
        checked += (ds[i].checked || []).length;
        if (ds[i].settled) settled++;
        score += ds[i].score || 0;
      }
    });
    rows.push({ name: p.name || id, isMe: false, avatar: p.avatar || '', settledDays: settled, totalChecked: checked, totalScore: score, currentDay: p.currentDayIndex || 0, lastActive: p.lastActive || 0, warehouse: sumCounts(p.warehouseContribution || {}), materials: p.warehouseContribution || {} });
  });

  const rankings = rows.map(r => ({
    ...r, score: r.totalScore || (r.settledDays * 10 + r.totalChecked)
  })).sort((a, b) => b.score - a.score);

  const rankClasses = ['gold','silver','bronze'];
  body.innerHTML = '';
  rankings.forEach((r, i) => {
    const rc = i < 3 ? rankClasses[i] : 'normal';
    const isMe = r.isMe;
    const isOnline = (Date.now() - r.lastActive) < 120000;
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.style.background = isMe ? 'rgba(89,201,165,0.06)' : '';
    row.style.borderRadius = 'var(--animal-radius-base)';
    row.style.padding = '10px 8px';
    const avatarMeta = getAvatarMeta(r.avatar);
    const rankEl = (i < 3 && avatarMeta)
      ? `<img class="lb-avatar" src="${avatarMeta.img}" alt="${escapeHtml(r.name)}" />`
      : `<div class="lb-rank ${rc}">${i + 1}</div>`;
    row.innerHTML = `
      ${rankEl}
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(r.name)} ${isMe ? '(我)' : ''} ${isOnline ? '<span class="online-dot" style="display:inline-block;vertical-align:middle"></span>' : ''}</div>
        <div class="lb-stats">完成 ${r.settledDays} 天 · 仓库贡献 ${r.warehouse || 0} · 第 ${r.currentDay + 1} 天</div>
        <div class="contribution-materials">${formatMaterialChips(r.materials)}</div>
      </div>
      <div class="lb-score">
        <div class="lb-score-num">${r.score}</div>
        <div class="lb-score-label">积分</div>
      </div>`;
    body.appendChild(row);
  });
}

function sumCounts(obj) {
  return Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

function formatMaterialChips(materials) {
  const entries = Object.entries(materials || {}).filter(([, value]) => Number(value) > 0);
  if (!entries.length) return '<span class="contribution-chip">还没有入库材料</span>';
  return entries.map(([key, value]) => `<span class="contribution-chip">${ITEMS[key]?.[0] || key} ${value}</span>`).join('');
}

function getParticipants() {
  return [
    { name: username, avatar: userAvatar, dayStates, warehouseContribution, collection, isMe: true },
    ...Object.values(peers).map(p => ({ name: p.name || '伙伴', avatar: p.avatar || '', dayStates: p.dayStates || {}, warehouseContribution: p.warehouseContribution || {}, collection: p.collection || {}, isMe: false }))
  ];
}

function getCurrentWeekRange() {
  const wi = allDays[currentDayIndex]?.weekIndex || 0;
  const start = getWeekStartIndex(wi);
  const count = plan.weeks[wi]?.days.length || 7;
  return { wi, start, end: start + count - 1 };
}

function countWeekSettled(states, range = getCurrentWeekRange()) {
  let count = 0;
  for (let i = range.start; i <= range.end; i++) if (states?.[i]?.settled) count++;
  return count;
}

function countSameDayCheckins(range = getCurrentWeekRange()) {
  let count = 0;
  for (let i = range.start; i <= range.end; i++) {
    const mine = getDayState(i).settled;
    const peer = Object.values(peers).some(p => p.dayStates?.[i]?.settled);
    if (mine && peer) count++;
  }
  return count;
}

function renderCoopGoals() {
  const lead = document.getElementById('coopGoal');
  const list = document.getElementById('coopGoalList');
  if (!lead || !list) return;
  const range = getCurrentWeekRange();
  const participants = getParticipants();
  const weeklyCheckins = participants.reduce((sum, p) => sum + countWeekSettled(p.dayStates, range), 0);
  const sameDay = countSameDayCheckins(range);
  const warehouseTotal = sumCounts(getSharedWarehouse());
  const goals = [
    { label: '本周合计登岛', value: weeklyCheckins, target: 8, reward: '服务处贴纸' },
    { label: '双人同日登岛', value: sameDay, target: 2, reward: '里数券气泡' },
    { label: '共同仓库材料', value: warehouseTotal, target: 20, reward: '仓库装饰' }
  ];
  const done = goals.filter(g => g.value >= g.target).length;
  lead.textContent = done ? `共同目标完成 ${done}/${goals.length}` : '本周一起给小岛供能';
  list.innerHTML = goals.map(g => {
    const pct = Math.min(100, Math.round(g.value / g.target * 100));
    return `<div class="coop-goal-item">
      <div class="coop-goal-line"><span>${g.label}</span><span>${g.value}/${g.target} · ${g.reward}</span></div>
      <div class="coop-goal-bar"><div class="coop-goal-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function renderActivityFeed() {
  const el = document.getElementById('activityFeed');
  if (!el) return;
  const items = [];
  const today = getDateKey();
  getParticipants().forEach(p => {
    const todayState = Object.values(p.dayStates || {}).find(s => s && s.settled && s.settledDate === today);
    if (todayState) items.push(`${escapeHtml(p.name)} 今天已登岛`);
    const materialCount = sumCounts(p.warehouseContribution || {});
    if (materialCount > 0) items.push(`${escapeHtml(p.name)} 已贡献 ${materialCount} 份仓库材料`);
  });
  if (hasPeerSettledToday() && getDayState(currentDayIndex).settled) items.unshift('双人同日登岛，码头送来里数券');
  const next = getNextUnlockTarget();
  if (next) items.push(`${next.name} 建设进度 ${next.value}/${next.need}`);
  el.innerHTML = items.slice(0, 5).map(item => `<div class="activity-item">${item}</div>`).join('');
}

function iconMarkup(metaOrIcon, fallback = '') {
  if (Array.isArray(metaOrIcon)) {
    const [label, emoji, img] = metaOrIcon;
    return img ? `<img class="acnh-icon" src="${img}" alt="${label}">` : (emoji || fallback);
  }
  if (metaOrIcon && metaOrIcon.img) return `<img class="acnh-icon" src="${metaOrIcon.img}" alt="${metaOrIcon.name}">`;
  return metaOrIcon?.icon || fallback;
}

function renderIsland() {
  const map = document.getElementById('islandMap');
  const wh = document.getElementById('warehouseGrid');
  if (!map || !wh || !allDays.length) return;
  const metrics = getCoopMetrics();
  const stats = document.getElementById('islandStats');
  if (stats) {
    stats.innerHTML = `
      <div class="island-stat"><strong>${metrics.checkins}</strong><span>打卡天数</span></div>
      <div class="island-stat"><strong>${metrics.minutes}</strong><span>训练分钟</span></div>
      <div class="island-stat"><strong>${metrics.collection}</strong><span>图鉴发现</span></div>`;
  }
  map.innerHTML = '';
  [
    ['map-tree', '18%', '22%'], ['map-tree', '78%', '22%'], ['map-tree', '20%', '74%'],
    ['map-tree', '62%', '63%'], ['map-rock', '58%', '24%'], ['map-rock', '16%', '55%'],
    ['map-bridge', '', '']
  ].forEach(([cls, left, top]) => {
    const deco = document.createElement('span');
    deco.className = cls;
    if (left) deco.style.left = left;
    if (top) deco.style.top = top;
    map.appendChild(deco);
  });
  if (hasPeerSettledToday() && getDayState(currentDayIndex).settled) {
    const bubble = document.createElement('div');
    bubble.className = 'coop-bubble';
    bubble.innerHTML = `${iconMarkup(ITEMS.nookMilesTicket)} <span>双人同日登岛 · 里数券</span>`;
    map.appendChild(bubble);
  }
  const bottle = document.createElement('button');
  bottle.type = 'button';
  bottle.className = 'bottle-point';
  bottle.textContent = '💌';
  bottle.setAttribute('aria-label', '瓶中信隐藏任务线索');
  bottle.addEventListener('click', showBottleHints);
  map.appendChild(bottle);
  renderMapResidents(map);
  const warehouse = getSharedWarehouse();
  BUILDINGS.forEach(building => {
    const status = getBuildingStatus(building, metrics, warehouse);
    const stage = getBuildingStage(status);
    const { value, unlocked, pct } = status;
    if (unlocked) discover(building.id);
    const point = document.createElement('button');
    point.type = 'button';
    point.className = `map-point ${unlocked ? 'unlocked' : 'locked'} ${!unlocked && pct >= 80 ? 'almost' : ''} ${stage.className}`;
    point.style.setProperty('--x', `${building.x}%`);
    point.style.setProperty('--y', `${building.y}%`);
    point.setAttribute('aria-label', `${building.name}，${unlocked ? '已解锁' : '建设中'}，进度 ${value}/${building.need || value}`);
    point.innerHTML = `
      <span class="map-point-status">${getBuildingStatusLabel(status)}</span>
      <span class="map-point-icon">${iconMarkup(building)}</span>
      <span class="map-point-label">${building.name}</span>
      <span class="map-point-stage">${stage.label}</span>
      <span class="map-point-progress"><span style="width:${pct}%"></span></span>`;
    point.addEventListener('click', () => showIslandPoint(building, status));
    map.appendChild(point);
  });
  wh.innerHTML = '';
  Object.entries(warehouse).forEach(([key, value]) => {
    const chip = document.createElement('div');
    chip.className = 'warehouse-chip';
    chip.textContent = `${ITEMS[key]?.[0] || key} ${value}`;
    wh.appendChild(chip);
  });
}

function getBuildingStatus(building, metrics, warehouse = getSharedWarehouse()) {
  const value = building.metric === 'checkins' ? metrics.checkins : building.metric === 'minutes' ? metrics.minutes : metrics.collection;
  const need = building.need || value || 1;
  const unlocked = value >= building.need;
  const pct = building.need ? Math.min(100, Math.round(value / building.need * 100)) : 100;
  const material = getMaterialReadiness(building.id, warehouse);
  return { value, need, unlocked, pct, materialPct: material.pct, materialText: material.text };
}

function getBuildingStatusLabel(status) {
  if (status.unlocked) return '已开放';
  if (status.pct >= 80) return '快完成';
  return '建设中';
}

function getBuildingStage(status) {
  if (status.unlocked) return { label: '完成', className: 'stage-built' };
  const buildPct = Math.max(status.pct, status.materialPct || 0);
  if (buildPct >= 70) return { label: '小屋', className: 'stage-frame' };
  if (buildPct >= 30) return { label: '帐篷', className: 'stage-frame' };
  return { label: '地基', className: 'stage-foundation' };
}

function getMaterialReadiness(id, warehouse) {
  const needs = {
    storage: { wood: 2, stone: 1 },
    nook_stop: { wood: 2, ironNugget: 1 },
    museum: { stone: 2, shell: 2 },
    pier: { wood: 3, shell: 2 }
  }[id];
  if (!needs) return { pct: 100, text: '材料已备齐。' };
  const parts = Object.entries(needs).map(([key, need]) => {
    const have = warehouse[key] || 0;
    return { key, have, need, pct: Math.min(1, have / need) };
  });
  const pct = Math.round(parts.reduce((sum, p) => sum + p.pct, 0) / parts.length * 100);
  const text = parts.map(p => `${ITEMS[p.key]?.[0] || p.key} ${p.have}/${p.need}`).join(' · ');
  return { pct, text };
}

function getRemainingText(building, status) {
  if (status.unlocked) return '已经开放，可以查看。';
  const rest = Math.max(0, building.need - status.value);
  if (building.metric === 'checkins') return `还差 ${rest} 次打卡。`;
  if (building.metric === 'minutes') return `还差 ${rest} 分钟训练。`;
  return `还差 ${rest} 个图鉴发现。`;
}

function metricLabel(metric) {
  if (metric === 'checkins') return '双人累计打卡';
  if (metric === 'minutes') return '累计训练分钟';
  return '图鉴发现数量';
}

function showIslandPoint(building, status) {
  const modal = document.getElementById('islandPointModal');
  document.getElementById('islandDetailIcon').innerHTML = iconMarkup(building);
  document.getElementById('islandDetailTitle').textContent = building.name;
  const stage = getBuildingStage(status);
  document.getElementById('islandDetailMeta').innerHTML = `${getBuildingStatusLabel(status)} · ${stage.label}阶段 · ${metricLabel(building.metric)}<br>${building.desc}<br>${building.reward}<br>${getRemainingText(building, status)}<br>共同材料：${status.materialText}`;
  document.getElementById('islandDetailFill').style.width = `${status.pct}%`;
  document.getElementById('islandDetailCount').textContent = building.need ? `进度 ${status.value}/${building.need}` : '进度 100%';
  modal.classList.add('show');
}

function getBuildStageSnapshot() {
  const metrics = getCoopMetrics();
  const warehouse = getSharedWarehouse();
  const out = {};
  BUILDINGS.forEach(building => {
    const status = getBuildingStatus(building, metrics, warehouse);
    out[building.id] = { name: building.name, stage: getBuildingStage(status).label, pct: status.pct };
  });
  return out;
}

function diffBuildStages(before, after) {
  return Object.entries(after).filter(([id, next]) => {
    const prev = before[id];
    return prev && (prev.stage !== next.stage || (!prev.pct || 0) < 100 && next.pct === 100);
  }).map(([id, next]) => ({ id, from: before[id].stage, to: next.stage, name: next.name }));
}

function showBuildUpdateModal(updates) {
  if (!updates || !updates.length) return;
  document.getElementById('buildUpdateBody').innerHTML = updates.map(u => `${u.name}：${u.from} → ${u.to}`).join('<br>');
  document.getElementById('buildUpdateModal').classList.add('show');
}

function renderMapResidents(map) {
  const residents = [{ name: username, avatar: userAvatar, x: 45, y: 58, color: COLORS[0] }];
  Object.values(peers).slice(0, 1).forEach((p, idx) => residents.push({ name: p.name || '伙伴', avatar: p.avatar || '', x: 55 + idx * 8, y: 58, color: COLORS[(idx + 1) % COLORS.length] }));
  residents.forEach(r => {
    if (!r.name) return;
    const node = document.createElement('div');
    node.className = 'map-resident';
    node.style.setProperty('--x', `${r.x}%`);
    node.style.setProperty('--y', `${r.y}%`);
    node.innerHTML = `<div class="resident-avatar" style="background:${r.color}">${avatarMarkup(r.avatar, escapeHtml(r.name.charAt(0).toUpperCase()))}</div><div class="resident-name">${escapeHtml(r.name)}</div>`;
    map.appendChild(node);
  });
}

function showBottleHints() {
  const day = allDays[currentDayIndex] || allDays[0];
  const state = getDayState(currentDayIndex);
  const clues = getHiddenQuestStatuses(day, state);
  document.getElementById('bottleHintBody').innerHTML = `<div class="bottle-clues">${clues.map(c => {
    const cls = c.found ? 'found' : c.ready ? 'ready' : '';
    const label = c.found ? '已触发' : c.ready ? '今日可尝试' : '线索';
    return `<div class="bottle-clue ${cls}">${label} · ${c.clue}</div>`;
  }).join('')}</div>`;
  document.getElementById('bottleModal').classList.add('show');
}

function getCoopMetrics() {
  let checkins = countSettledStates(dayStates);
  let minutes = countMinutes(dayStates);
  let collectionCount = collection.discovered.length;
  Object.values(peers).forEach(p => {
    checkins += countSettledStates(p.dayStates || {});
    minutes += countMinutes(p.dayStates || {});
    collectionCount += (p.collection?.discovered || []).length;
  });
  return { checkins, minutes, collection: collectionCount };
}

function getSharedWarehouse() {
  const out = createWarehouse();
  addCounts(out, warehouseContribution);
  Object.values(peers).forEach(p => addCounts(out, p.warehouseContribution || {}));
  return out;
}

function renderInventory() {
  const grid = document.getElementById('inventoryGrid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.entries(ITEMS).forEach(([key, meta]) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `<div class="item-top"><div><div class="item-name">${meta[0]}</div><div class="item-meta">${key}</div></div><div class="item-icon">${iconMarkup(meta)}</div></div><div class="item-count">${inventory[key] || 0}</div><div class="item-source">${getItemSource(key)}</div>`;
    card.addEventListener('click', () => showItemDetail(key));
    grid.appendChild(card);
  });
}

function renderCollection() {
  const grid = document.getElementById('collectionGrid');
  if (!grid) return;
  const entries = [
    ...Object.entries(ITEMS).map(([id, meta]) => ({ id, name: meta[0], icon: meta[1], img: meta[2], type: '材料' })),
    ...BUILDINGS.map(b => ({ id: b.id, name: b.name, icon: b.icon, img: b.img, type: '建筑' })),
    { id: 'same_day_checkin', name: '双人同日登岛', icon: '🎫', type: '隐藏任务' },
    { id: 'museum_entry', name: '博物馆图鉴条目', icon: '🏛', type: '隐藏任务' },
    { id: 'bells_bag', name: '铃钱袋', icon: '🔔', type: '隐藏任务' }
  ];
  grid.innerHTML = '';
  entries.filter(entry => collectionFilter === 'all' || entry.type === collectionFilter).forEach(entry => {
    const found = collection.discovered.includes(entry.id);
    const card = document.createElement('div');
    card.className = 'collection-card' + (found ? ' discovered' : '');
    card.innerHTML = `<div class="collection-top"><div><div class="collection-name">${found ? entry.name : '???'}</div><div class="collection-meta">${entry.type}</div></div><div class="collection-icon">${found ? iconMarkup(entry, entry.icon) : '？'}</div></div><span class="collection-status">${found ? '已发现' : '未发现'}</span>`;
    grid.appendChild(card);
  });
  document.querySelectorAll('#collectionTabs .collection-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === collectionFilter));
}

function getItemSource(key) {
  const sources = {
    branch: '轻松难度常见奖励，可作为小基地启动材料。',
    wood: '标准训练奖励，也会计入共同仓库。',
    softwood: '标准训练奖励，用来建设岛上设施。',
    hardwood: '标准训练奖励，适合积累到仓库。',
    stone: '标准训练奖励，也会计入共同仓库。',
    ironNugget: '挑战难度奖励，稀有建设材料。',
    clay: '挑战难度奖励，适合后续扩建。',
    weed: '轻松难度奖励，保连续时也会出现。',
    shell: '标准训练奖励，和海边码头相关。',
    starFragment: '夜间打卡隐藏奖励。',
    bells: '每次结算按积分获得。',
    nookMilesTicket: '双人同日登岛或挑战奖励。',
    goldenLeaf: '连续轻松难度隐藏奖励。'
  };
  return sources[key] || '来自训练结算或隐藏任务。';
}

function showItemDetail(key) {
  const meta = ITEMS[key];
  if (!meta) return;
  document.getElementById('itemDetailIcon').innerHTML = iconMarkup(meta);
  document.getElementById('itemDetailTitle').textContent = meta[0];
  document.getElementById('itemDetailMeta').innerHTML = `当前数量：${inventory[key] || 0}<br>${getItemSource(key)}<br>${getItemUse(key)}`;
  document.getElementById('itemDetailModal').classList.add('show');
}

function getItemUse(key) {
  if (['wood','stone','shell','ironNugget'].includes(key)) return '用途：可进入共同仓库，推进小基地建设。';
  if (key === 'bells') return '用途：作为每次训练结算的积分化奖励。';
  if (key === 'nookMilesTicket') return '用途：标记双人合作或挑战完成。';
  if (key === 'starFragment') return '用途：记录夜间隐藏任务。';
  return '用途：补齐图鉴，作为训练出现的纪念。';
}

function showDayDetail(index) {
  const day = allDays[index];
  if (!day) return;
  const state = getDayState(index);
  const total = day.exercises.length || 0;
  const done = state.checked.size;
  const diff = DIFFICULTIES[state.difficulty || selectedDifficulty] || DIFFICULTIES.standard;
  let status = '未记录';
  if (state.missed) status = '今天休息';
  else if (state.settled && done >= total) status = '完整完成';
  else if (state.settled) status = `今天到这 ${done}/${total}`;
  const rewards = (state.rewards || []).map(key => ITEMS[key]?.[0] || key).join('、') || '无';
  const hidden = (state.hiddenTasks || []).map(key => ITEMS[key]?.[0] || key).join('、') || '无';
  const actions = day.exercises.map((ex, i) => `${state.checked.has(i) ? '✓' : '○'} ${ex[0]} · ${ex[1]}`).join('<br>');
  document.getElementById('dayDetailTitle').textContent = `${getWeekdayLabel(day.dayInWeek)} · ${day.title}`;
  document.getElementById('dayDetailMeta').innerHTML = `
    状态：${status}<br>
    难度：${diff.label}<br>
    分数：${state.score || 0}<br>
    奖励：${rewards}<br>
    隐藏：${hidden}<br>
    <br>${actions}
  `;
  document.getElementById('dayDetailModal').classList.add('show');
}

function renderView() {
  document.querySelectorAll('.app-view').forEach(v => v.classList.toggle('active', v.id === `view${activeView.charAt(0).toUpperCase()}${activeView.slice(1)}`));
  document.querySelectorAll('.floating-nav .nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === activeView));
}

// ── Review ──
function renderReview(day) {
  const section = document.getElementById('reviewSection');
  if (!day.review) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  const body = document.getElementById('reviewBody');
  body.innerHTML = '';
  const wi = day.weekIndex;
  const week = plan.weeks[wi];
  const dayCount = week.days.length;
  let appeared = 0, fullDone = 0;
  const chips = [];
  for (let di = 0; di < dayCount; di++) {
    const gi = getGlobalIndex(wi, di);
    const ds = getDayState(gi);
    const d = week.days[di];
    if (ds.settled && ds.checked.size === d.exercises.length) { fullDone++; appeared++; chips.push('<span class="review-chip done"></span>'); }
    else if (ds.settled) { appeared++; chips.push('<span class="review-chip appeared"></span>'); }
    else if (ds.missed) { chips.push('<span class="review-chip rest"></span>'); }
    else { chips.push('<span class="review-chip missed"></span>'); }
  }
  const rows = [
    ['周期', `第 ${wi+1} 周 · ${week.theme}`, dayCount + ' 天'],
    ['出现', `${appeared}/${dayCount} 天`, appeared >= dayCount ? '✓' : '继续'],
    ['完成', `${fullDone}/${dayCount} 天`, chips.join('')],
    ['最稳', '—', '记录后填写'],
    ['最弱', '—', '记录后填写'],
    ['连续', `${calcStreak()} 天`, ''],
  ];
  rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>`; body.appendChild(tr); });
}

function calcStreak() {
  let s = 0;
  for (let i = allDays.length - 1; i >= 0; i--) { if (getDayState(i).settled) s++; else if (!getDayState(i).missed) break; }
  return s;
}

// ── Archive ──
function renderArchive() {
  const content = document.getElementById('archiveContent');
  content.innerHTML = '';
  plan.weeks.forEach((week, wi) => {
    const wd = document.createElement('div');
    wd.className = 'archive-week';
    wd.innerHTML = `<div class="archive-week-title">第 ${wi+1} 周 · ${week.theme}</div>`;
    week.days.forEach((d, di) => {
      const gi = getGlobalIndex(wi, di);
      const ds = getDayState(gi);
      let cls = 'pending';
      if (ds.settled && ds.checked.size === d.exercises.length) cls = 'done';
      else if (ds.settled) cls = 'appeared';
      else if (ds.missed) cls = 'rest';
      else if (gi < currentDayIndex) cls = 'missed';
      const row = document.createElement('div');
      row.className = 'archive-day-row';
      row.innerHTML = `<div class="archive-day-num ${cls}">${di+1}</div><span>${d.title}</span><span style="margin-left:auto;color:var(--animal-text-color-muted);font-size:12px">${d.minutes || 0}min</span>`;
      row.addEventListener('click', () => showDayDetail(gi));
      wd.appendChild(row);
    });
    content.appendChild(wd);
  });
}

function applySettlementRewards(state, day) {
  const difficulty = state.difficulty || selectedDifficulty;
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.standard;
  const total = day.exercises.length;
  const fullDone = state.checked.size >= total;
  const base = Math.max(1, state.checked.size);
  const score = base * diff.multiplier;
  const materialCount = fullDone ? diff.multiplier : 1;
  const rewards = chooseRewards(difficulty, materialCount);
  const hiddenTasks = detectHiddenTasks(difficulty, day, fullDone);

  state.difficulty = difficulty;
  state.score = score;
  state.rewards = rewards;
  state.hiddenTasks = hiddenTasks;
  state.settledAt = Date.now();

  addCounts(inventory, rewardCounts(rewards, score));
  addCounts(warehouseContribution, warehouseCounts(rewards));
  rewards.concat(hiddenTasks).forEach(discover);
  discover(difficulty);
}

function chooseRewards(difficulty, count) {
  const pools = {
    easy: ['branch', 'wood', 'weed'],
    standard: ['wood', 'softwood', 'hardwood', 'shell', 'stone'],
    challenge: ['ironNugget', 'clay', 'starFragment', 'nookMilesTicket']
  };
  const pool = pools[difficulty] || pools.standard;
  const rewards = [];
  for (let i = 0; i < count; i++) rewards.push(pool[(currentDayIndex + i) % pool.length]);
  return rewards;
}

function rewardCounts(rewards, score) {
  const out = { bells: score * 100 };
  rewards.forEach(r => { out[r] = (out[r] || 0) + 1; });
  return out;
}

function warehouseCounts(rewards) {
  const out = {};
  rewards.forEach(r => { if (['wood','shell','stone','ironNugget'].includes(r)) out[r] = (out[r] || 0) + 1; });
  return out;
}

function detectHiddenTasks(difficulty, day, fullDone) {
  const tasks = [];
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 5) tasks.push('starFragment');
  if (difficulty === 'challenge' && fullDone) tasks.push('bells_bag');
  if (day.review && fullDone) tasks.push('museum_entry');
  if (difficulty === 'easy' && countRecentDifficulty('easy') >= 2) tasks.push('goldenLeaf');
  if (hasPeerSettledToday()) tasks.push('same_day_checkin');
  tasks.forEach(t => {
    if (t === 'goldenLeaf') inventory.goldenLeaf = (inventory.goldenLeaf || 0) + 1;
    if (t === 'same_day_checkin') inventory.nookMilesTicket = (inventory.nookMilesTicket || 0) + 1;
    if (t === 'starFragment') inventory.starFragment = (inventory.starFragment || 0) + 1;
    if (t === 'bells_bag') inventory.bells = (inventory.bells || 0) + 1000;
  });
  return tasks;
}

function countRecentDifficulty(difficulty) {
  let count = 0;
  for (let i = Math.max(0, currentDayIndex - 2); i <= currentDayIndex; i++) {
    const s = getDayState(i);
    if (s.settled && s.difficulty === difficulty) count++;
  }
  return count;
}

function hasPeerSettledToday() {
  const today = getDateKey();
  return Object.values(peers).some(p => {
    if (Object.values(p.dayStates || {}).some(s => s && s.settled && s.settledDate === today)) return true;
    const s = p.dayStates?.[currentDayIndex];
    return s && s.settled;
  });
}

// ── Actions ──
function handleSettle() {
  const state = getDayState(currentDayIndex);
  if (state.settled || state.missed) return;
  if (!canCheckInDay(currentDayIndex)) {
    showToast(hasSettledToday() ? '今天已经盖章，明天再继续' : `今天只能打卡${getWeekdayLabel()}`);
    return;
  }
  const day = allDays[currentDayIndex];
  const total = day.exercises.length;
  const beforeStages = getBuildStageSnapshot();
  if (state.checked.size === 0) { for (let i = 0; i < total; i++) state.checked.add(i); }
  state.difficulty = state.difficulty || selectedDifficulty;
  state.settled = true;
  state.settledDate = getDateKey();
  applySettlementRewards(state, day);
  const buildUpdates = diffBuildStages(beforeStages, getBuildStageSnapshot());
  queuedBuildUpdates = buildUpdates;
  saveLocal();
  syncMyState();
  if (state.checked.size === total) showRewardModal(state);
  else {
    showToast('今天到这，已结算');
    setTimeout(() => showBuildUpdateModal(queuedBuildUpdates), 700);
  }
  currentDayIndex = getAvailableDayIndex();
  render();
}

function handleRestDay() {
  const state = getDayState(currentDayIndex);
  if (state.settled || state.missed) return;
  if (!canCheckInDay(currentDayIndex)) {
    showToast(hasSettledToday() ? '今天已经记录，明天再继续' : `只能记录${getWeekdayLabel()}`);
    return;
  }
  state.checked = new Set();
  state.difficulty = state.difficulty || selectedDifficulty;
  state.missed = true;
  state.missedAt = Date.now();
  state.missedDate = getDateKey();
  state.score = 0;
  state.rewards = [];
  state.hiddenTasks = [];
  saveLocal();
  syncMyState();
  showToast('今天休息已记录');
  currentDayIndex = getAvailableDayIndex();
  render();
}

function showRewardModal(state) {
  const diff = DIFFICULTIES[state?.difficulty || selectedDifficulty] || DIFFICULTIES.standard;
  const title = document.querySelector('#rewardModal .reward-title');
  if (title) title.textContent = `盖章啦 · ${diff.label} +${state?.score || 0}`;
  const list = document.getElementById('rewardList');
  if (list) {
    const rewardItems = rewardCounts(state?.rewards || [], state?.score || 0);
    const hiddenItems = {};
    (state?.hiddenTasks || []).forEach(id => { hiddenItems[id] = (hiddenItems[id] || 0) + 1; });
    const entries = Object.entries({...rewardItems, ...hiddenItems}).filter(([, count]) => count > 0);
    list.innerHTML = entries.length ? entries.map(([key, count]) => {
      const meta = ITEMS[key] || { name: key, icon: '？' };
      const name = Array.isArray(meta) ? meta[0] : meta.name;
      return `<span class="reward-chip">${iconMarkup(meta)}<span>${name} x${count}</span></span>`;
    }).join('') : '<span class="reward-chip">今天已记录</span>';
  }
  document.getElementById('rewardModal').classList.add('show');
}
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }

document.querySelectorAll('#difficultySelector .difficulty-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const state = getDayState(currentDayIndex);
    if (state.settled) return;
    if (!canCheckInDay(currentDayIndex)) {
      showToast(hasSettledToday() ? '今天已经盖章，明天再继续' : `只能选择${getWeekdayLabel()}路线的难度`);
      return;
    }
    selectedDifficulty = btn.dataset.difficulty || 'standard';
    state.difficulty = selectedDifficulty;
    saveLocal();
    syncMyState();
    render();
  });
});

document.getElementById('completeBtn').addEventListener('click', handleSettle);
document.getElementById('completeStrip').addEventListener('click', e => { if (e.target.id !== 'completeBtn') handleSettle(); });
document.getElementById('restDayBtn').addEventListener('click', handleRestDay);
document.getElementById('rewardBtn').addEventListener('click', () => {
  document.getElementById('rewardModal').classList.remove('show');
  setTimeout(() => showBuildUpdateModal(queuedBuildUpdates), 220);
});
document.getElementById('rewardModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    document.getElementById('rewardModal').classList.remove('show');
    setTimeout(() => showBuildUpdateModal(queuedBuildUpdates), 220);
  }
});
document.getElementById('islandDetailBtn').addEventListener('click', () => document.getElementById('islandPointModal').classList.remove('show'));
document.getElementById('islandPointModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('islandPointModal').classList.remove('show'); });
document.getElementById('itemDetailBtn').addEventListener('click', () => document.getElementById('itemDetailModal').classList.remove('show'));
document.getElementById('itemDetailModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('itemDetailModal').classList.remove('show'); });
document.getElementById('dayDetailBtn').addEventListener('click', () => document.getElementById('dayDetailModal').classList.remove('show'));
document.getElementById('dayDetailModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('dayDetailModal').classList.remove('show'); });
document.getElementById('bottleBtn').addEventListener('click', () => document.getElementById('bottleModal').classList.remove('show'));
document.getElementById('bottleModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('bottleModal').classList.remove('show'); });
document.getElementById('buildUpdateBtn').addEventListener('click', () => {
  document.getElementById('buildUpdateModal').classList.remove('show');
  activeView = 'island';
  saveLocal();
  renderView();
  window.scrollTo({top: 0, behavior: 'smooth'});
});
document.getElementById('buildUpdateModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('buildUpdateModal').classList.remove('show'); });
document.getElementById('avatarCloseBtn').addEventListener('click', () => document.getElementById('avatarModal').classList.remove('show'));
document.getElementById('avatarModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) document.getElementById('avatarModal').classList.remove('show');
});
document.getElementById('avatarChoices').addEventListener('click', e => {
  const btn = e.target.closest('.avatar-choice');
  if (!btn) return;
  const next = btn.dataset.avatar;
  if (!getAvatarMeta(next)) return;
  userAvatar = next;
  saveLocal();
  syncMyState();
  render();
});
document.getElementById('messageSaveBtn').addEventListener('click', () => {
  const input = document.getElementById('messageInput');
  userMessage = (input.value || '').trim().slice(0, 40);
  saveLocal();
  syncMyState();
  renderMessageBoard();
  showToast(userMessage ? '留言已贴上' : '留言已清空');
});
document.getElementById('messageInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('messageSaveBtn').click();
});
document.querySelectorAll('#collectionTabs .collection-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    collectionFilter = btn.dataset.filter || 'all';
    renderCollection();
  });
});

document.querySelectorAll('.floating-nav .nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeView = btn.dataset.view || 'today';
    saveLocal();
    renderView();
    window.scrollTo({top:0,behavior:'smooth'});
  });
});

document.getElementById('archiveToggle').addEventListener('click', function() {
  const body = document.getElementById('archiveBody');
  const expanded = this.getAttribute('aria-expanded') === 'true';
  this.setAttribute('aria-expanded', !expanded);
  body.classList.toggle('open', !expanded);
});

function openExportModal() {
  const lines = ['# 动森训练岛 - Agent 训练数据', ''];
  plan.weeks.forEach((week, wi) => {
    lines.push(`## 第 ${wi+1} 周 · ${week.theme}`);
    lines.push(`信号: ${week.signal}`);
    week.days.forEach((d, di) => {
      const gi = getGlobalIndex(wi, di);
      const ds = getDayState(gi);
      const status = ds.settled ? (ds.checked.size === d.exercises.length ? '✓ 完成' : `◐ ${ds.checked.size}/${d.exercises.length}`) : '○ 未完成';
      lines.push(`- Day ${di+1} ${d.title}: ${status} (${d.minutes}min)`);
      d.exercises.forEach((ex, ei) => { lines.push(`  ${ds.checked.has(ei) ? '✓' : '○'} ${ex[0]} | ${ex[1]} | ${ex[2]}`); });
    });
    lines.push('');
  });
  document.getElementById('exportText').value = lines.join('\n');
  document.getElementById('exportModal').classList.add('show');
}

document.getElementById('heroExportBtn').addEventListener('click', openExportModal);
document.getElementById('navRanking').addEventListener('dblclick', openExportModal);
document.getElementById('exportCopyBtn').addEventListener('click', () => {
  const ta = document.getElementById('exportText');
  ta.select();
  navigator.clipboard.writeText(ta.value).then(() => { showToast('已复制到剪贴板'); document.getElementById('exportModal').classList.remove('show'); }).catch(() => { document.execCommand('copy'); showToast('已复制'); document.getElementById('exportModal').classList.remove('show'); });
});
document.getElementById('archiveExportBtn').addEventListener('click', () => {
  const payload = createArchivePayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = URL.createObjectURL(blob);
  a.download = `fitness-island-save-${date}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
  showToast('存档已导出');
});
document.getElementById('archiveImportBtn').addEventListener('click', () => document.getElementById('archiveImportInput').click());
document.getElementById('archiveImportInput').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || ''));
      applyArchivePayload(payload);
      findTodayIndex();
      saveLocal();
      syncMyState();
      render();
      document.getElementById('exportModal').classList.remove('show');
      showToast('存档已导入');
    } catch (err) {
      showToast('存档导入失败');
    } finally {
      e.target.value = '';
    }
  };
  reader.readAsText(file, 'utf-8');
});
document.getElementById('exportModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('exportModal').classList.remove('show'); });
