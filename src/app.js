// ── Constants ──
const CONFIG = window.FITNESS_ISLAND_CONFIG;
if (!CONFIG) throw new Error('Fitness Island config missing: load config.js before app.js');

const {
  ROOM_KEY,
  SYNC_API,
  ANIMALS,
  COLORS,
  AVATARS,
  DIFFICULTIES,
  TRAINING_REWARD_POOLS,
  PLAN_MODES,
  ITEMS,
  BUILDINGS,
  GIFT_RULES,
  DECOR_ITEMS,
  TROPHIES,
  HIDDEN_QUESTS
} = CONFIG;

// ── State ──
let plan = null;
let allDays = [];
let currentDayIndex = 0;
let dayStates = {};
let username = '';
let clientId = getClientId();
let selfUserKey = '';
let userAvatar = getRandomAvatar();
let userMessage = '';
let peers = {}; // other users' data from shared PHP JSON storage
let syncVersion = 0; // 服务端版本号，用于乐观并发控制
let inventory = createInventory();
let warehouseContribution = createWarehouse();
let collection = { discovered: ['resident_services_tent'], completed: [] };
let giftClaims = {};
let sharedGiftClaims = {};
let wishList = [];
let wishLists = {};
let sharedDecor = {};
let mailboxEntries = [];
let sharedEvents = {};
let activeView = 'today';
let selectedDifficulty = 'standard';
let selectedPlanMode = 'standard';
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
  selfUserKey = '';
  userAvatar = getRandomAvatar();
  userMessage = '';
  peers = {};
  syncVersion = 0;
  inventory = createInventory();
  warehouseContribution = createWarehouse();
  collection = { discovered: ['resident_services_tent'], completed: [] };
  giftClaims = {};
  sharedGiftClaims = {};
  wishList = [];
  wishLists = {};
  sharedDecor = {};
  mailboxEntries = [];
  sharedEvents = {};
  dayStates = {};
  currentDayIndex = 0;
  activeView = 'today';
  selectedDifficulty = 'standard';
  selectedPlanMode = 'standard';
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

function getDifficultyDay(day, difficulty = selectedDifficulty) {
  if (!day) return day;
  const key = DIFFICULTIES[difficulty] ? difficulty : 'standard';
  const diff = DIFFICULTIES[key];
  const exercises = getDifficultyExercises(day.exercises || [], key);
  const baseMinutes = day.minutes || exercises.length * 3;
  const minutes = key === 'easy'
    ? Math.max(3, Math.round(baseMinutes * 0.55))
    : key === 'challenge'
      ? baseMinutes + 6
      : baseMinutes;
  return {
    ...day,
    baseDay: day,
    difficulty: key,
    difficultyLabel: diff.label,
    variantLabel: diff.variantLabel,
    minutes,
    summary: key === 'standard' ? day.summary : `${diff.variantLabel} · ${diff.hint}`,
    rewardProfile: getRewardProfile(key),
    exercises
  };
}

function getDifficultyExercises(exercises, difficulty) {
  const normalized = (exercises || []).map(ex => [...ex]);
  if (difficulty === 'standard') return normalized;
  if (difficulty === 'easy') return buildEasyExercises(normalized);
  if (difficulty === 'challenge') return normalized.map(ex => tuneExercise(ex, 'challenge'));
  return normalized;
}

function buildEasyExercises(exercises) {
  if (!exercises.length) return [];
  if (exercises.length <= 2) return exercises.map(ex => tuneExercise(ex, 'easy'));
  const lowPressure = exercises.filter(isLowPressureExercise);
  const warmup = exercises.find(isWarmupExercise);
  const cooldown = exercises.find(isCooldownExercise);
  const picked = [];
  const add = ex => { if (ex && !picked.includes(ex)) picked.push(ex); };
  add(warmup);
  add(cooldown);
  if (lowPressure.length) {
    lowPressure.slice(0, 2).forEach(add);
  }
  while (picked.length < 2 && picked.length < exercises.length) {
    add(exercises.find(ex => !picked.includes(ex)));
  }
  const trimmed = picked.slice(0, Math.min(3, exercises.length));
  return trimmed.sort((a, b) => exercises.indexOf(a) - exercises.indexOf(b)).map(ex => tuneExercise(ex, 'easy'));
}

function isWarmupExercise(exercise) {
  const text = `${exercise?.[0] || ''} ${exercise?.[2] || ''}`;
  return /热身|激活|踏步|慢走|散步|快走|启动|开合跳|高抬腿|扩胸|肩部环绕|手臂画圈/.test(text);
}

function isCooldownExercise(exercise) {
  const text = `${exercise?.[0] || ''} ${exercise?.[2] || ''}`;
  return /收尾|拉伸|放松|呼吸|舒展|猫牛|坐姿前屈|鸽子|髋部|小腿|肩颈/.test(text);
}

function isLowPressureExercise(exercise) {
  const text = `${exercise?.[0] || ''} ${exercise?.[1] || ''} ${exercise?.[2] || ''}`;
  return /拉伸|放松|激活|靠墙|猫牛|呼吸|踏步|慢走|散步|桥|鸟狗|死虫|臀桥|轻|平板|慢|舒展|热身|肩颈|髋部|小腿/.test(text);
}

function tuneExercise(exercise, difficulty) {
  const next = [...exercise];
  next[1] = difficulty === 'easy' ? easeExerciseDetail(next[1]) : challengeExerciseDetail(next[1], exercise);
  next[2] = difficulty === 'easy' ? `轻松 · ${next[2] || '保连续'}` : `挑战 · ${next[2] || '小幅加量'}`;
  return next;
}

function easeExerciseDetail(detail) {
  let text = String(detail || '');
  text = text
    .replace(/3\s*分钟/g, '60 秒')
    .replace(/2\s*分钟/g, '45 秒')
    .replace(/90\s*秒/g, '30 秒')
    .replace(/60\s*秒/g, '30 秒')
    .replace(/(\d+)\s*秒\s*[x×]\s*(\d+)/g, (_, s, sets) => `${Math.max(8, Math.round(Number(s) * 0.6))} 秒`)
    .replace(/30\s*秒/g, '15 秒')
    .replace(/25\s*秒/g, '12 秒')
    .replace(/20\s*秒/g, '10 秒')
    .replace(/15\s*秒/g, '8 秒')
    .replace(/每侧\s*(\d+)\s*(个|次)/g, (_, n, unit) => `每侧 ${Math.max(4, Math.round(Number(n) * 0.55))} ${unit}`)
    .replace(/(\d+)\s*(个|次)\s*[x×]\s*\d+/g, (_, n, unit) => `${Math.max(4, Math.round(Number(n) * 0.55))} ${unit}`)
    .replace(/15\s*个/g, '8 个')
    .replace(/12\s*个/g, '6 个')
    .replace(/10\s*个/g, '6 个')
    .replace(/8\s*个/g, '5 个')
    .replace(/12\s*次/g, '6 次')
    .replace(/10\s*次/g, '6 次')
    .replace(/8\s*次/g, '5 次');
  return text || '轻量完成';
}

function challengeExerciseDetail(detail, exercise) {
  if (isCooldownExercise(exercise)) return String(detail || '');
  let text = String(detail || '');
  const before = text;
  let matchedCompound = false;
  text = text.replace(/(\d+)\s*秒\s*[x×]\s*(\d+)/g, (m, s, sets) => {
    matchedCompound = true;
    const ns = Math.min(60, Number(s) + 10);
    const nset = Math.min(4, Number(sets) + 1);
    return `${ns} 秒 x ${nset}`;
  });
  if (matchedCompound) return text || '挑战多 1 组';
  text = text.replace(/(\d+)\s*(个|次)\s*[x×]\s*(\d+)/g, (m, n, unit, sets) => {
    matchedCompound = true;
    const nn = Math.min(40, Number(n) + 4);
    const nset = Math.min(4, Number(sets) + 1);
    return `${nn} ${unit} x ${nset}`;
  });
  if (matchedCompound) return text || '挑战多 1 组';
  text = text.replace(/每侧\s*(\d+)\s*(个|次)/g, (m, n, unit) => `每侧 ${Math.min(30, Number(n) + 3)} ${unit}`);
  [
    [/30\s*秒/g, '40 秒'],
    [/25\s*秒/g, '35 秒'],
    [/20\s*秒/g, '30 秒'],
    [/15\s*秒/g, '25 秒'],
    [/15\s*个/g, '18 个'],
    [/12\s*个/g, '16 个'],
    [/10\s*个/g, '14 个'],
    [/8\s*个/g, '12 个'],
    [/12\s*次/g, '16 次'],
    [/10\s*次/g, '14 次'],
    [/8\s*次/g, '12 次']
  ].forEach(([pattern, replacement]) => { text = text.replace(pattern, replacement); });
  if (before === text && !isWarmupExercise(exercise)) text = `${text} · 多 1 组`;
  return text || '挑战多 1 组';
}

function getRewardProfile(difficulty = selectedDifficulty, fullDone = true) {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.standard;
  return {
    pool: diff.rewardPool,
    count: diff.baseRewards + (fullDone ? diff.fullBonus : 0),
    label: `${diff.baseRewards}${fullDone ? `+${diff.fullBonus}` : ''} 份材料`
  };
}

function trimCheckedToExerciseCount(state, total) {
  if (!state?.checked) return;
  state.checked = new Set([...state.checked].filter(index => Number(index) < total));
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

function getWeekEndIndex(weekIndex) {
  const week = plan.weeks[weekIndex];
  if (!week) return Math.max(0, allDays.length - 1);
  return Math.min(getWeekStartIndex(weekIndex) + week.days.length - 1, Math.max(0, allDays.length - 1));
}

function getClampedDayIndex(index) {
  const max = Math.max(0, allDays.length - 1);
  return Math.max(0, Math.min(Number.isInteger(index) ? index : 0, max));
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
  const weekIndex = getCurrentTrainingWeekIndex();
  return getClampedDayIndex(Math.min(getWeekStartIndex(weekIndex) + getTodayWeekdayIndex(), getWeekEndIndex(weekIndex)));
}

function getAvailableDayIndex() {
  const todayDoneIndex = findSettledDateIndex();
  return getClampedDayIndex(todayDoneIndex >= 0 ? todayDoneIndex : getFirstUnsettledIndex());
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
  if (!dayStates[i].planMode) dayStates[i].planMode = selectedPlanMode;
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

function normalizeGiftClaims(saved) {
  const out = {};
  Object.entries(saved || {}).forEach(([id, claim]) => {
    const ruleId = String(claim?.ruleId || id).split('__')[0];
    if (!GIFT_RULES.some(rule => rule.id === ruleId) || !claim || typeof claim !== 'object') return;
    out[id] = {
      id: String(claim.id || id),
      ruleId,
      ownerKey: String(claim.ownerKey || ''),
      ownerName: String(claim.ownerName || ''),
      status: ['requested', 'redeemed'].includes(claim.status) ? claim.status : 'requested',
      requestedAt: Number(claim.requestedAt || 0),
      redeemedAt: Number(claim.redeemedAt || 0),
      redeemedBy: String(claim.redeemedBy || ''),
      updatedAt: Number(claim.updatedAt || claim.redeemedAt || claim.requestedAt || 0)
    };
  });
  return out;
}

function normalizeWishLists(saved) {
  const out = {};
  Object.entries(saved || {}).forEach(([key, entry]) => {
    if (!entry || typeof entry !== 'object') return;
    const items = Array.isArray(entry.items)
      ? entry.items.map(item => String(item || '').trim()).filter(Boolean).slice(0, 5)
      : [];
    out[key] = {
      ownerKey: String(entry.ownerKey || key),
      ownerName: String(entry.ownerName || '伙伴'),
      items,
      updatedAt: Number(entry.updatedAt || 0)
    };
  });
  return out;
}

function normalizeDecor(saved) {
  const out = {};
  Object.entries(saved || {}).forEach(([id, item]) => {
    const meta = DECOR_ITEMS.find(d => d.id === id || d.id === item?.id);
    if (!meta || !item || typeof item !== 'object') return;
    out[meta.id] = {
      id: meta.id,
      ownerKey: String(item.ownerKey || ''),
      ownerName: String(item.ownerName || ''),
      placedAt: Number(item.placedAt || item.updatedAt || 0),
      updatedAt: Number(item.updatedAt || item.placedAt || 0)
    };
  });
  return out;
}

function normalizeMailbox(saved) {
  return (Array.isArray(saved) ? saved : []).map(entry => ({
    id: String(entry?.id || ''),
    authorKey: String(entry?.authorKey || ''),
    authorName: String(entry?.authorName || '伙伴'),
    text: String(entry?.text || '').slice(0, 80),
    createdAt: Number(entry?.createdAt || 0)
  })).filter(entry => entry.text).slice(-20);
}

function normalizeSharedEvents(saved) {
  const out = {};
  Object.entries(saved || {}).forEach(([id, event]) => {
    if (!event || typeof event !== 'object') return;
    out[id] = {
      id: String(event.id || id),
      type: String(event.type || 'weekly'),
      title: String(event.title || '周结算'),
      summary: String(event.summary || '').slice(0, 180),
      createdBy: String(event.createdBy || ''),
      createdAt: Number(event.createdAt || 0)
    };
  });
  return out;
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
    if (s && s.settled && allDays[idx]) {
      const day = getDifficultyDay(allDays[idx], s.difficulty || selectedDifficulty);
      minutes += day?.minutes || 0;
    }
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
    out[k] = { checked: [...v.checked], settled: v.settled, missed: !!v.missed, difficulty: v.difficulty || selectedDifficulty, planMode: v.planMode || selectedPlanMode, score: v.score || 0, rewards: v.rewards || [], hiddenTasks: v.hiddenTasks || [], settledAt: v.settledAt || null, settledDate: v.settledDate || null, missedAt: v.missedAt || null, missedDate: v.missedDate || null };
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
    giftClaims,
    sharedGiftClaims,
    wishList,
    sharedDecor,
    selectedDifficulty,
    selectedPlanMode,
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
      planMode: v.planMode || selectedPlanMode,
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
  giftClaims = normalizeGiftClaims(saved.giftClaims);
  sharedGiftClaims = normalizeGiftClaims(saved.sharedGiftClaims);
  wishList = Array.isArray(saved.wishList) ? saved.wishList.map(item => String(item || '').trim()).filter(Boolean).slice(0, 5) : [];
  sharedDecor = normalizeDecor(saved.sharedDecor);
  selectedDifficulty = saved.selectedDifficulty || 'standard';
  selectedPlanMode = saved.selectedPlanMode || 'standard';
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
    out[k] = { checked: [...v.checked], settled: v.settled, missed: !!v.missed, difficulty: v.difficulty || selectedDifficulty, planMode: v.planMode || selectedPlanMode, score: v.score || 0, rewards: v.rewards || [], hiddenTasks: v.hiddenTasks || [], settledAt: v.settledAt || null, settledDate: v.settledDate || null, missedAt: v.missedAt || null, missedDate: v.missedDate || null };
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
    giftClaims: giftClaims,
    selectedDifficulty: selectedDifficulty,
    selectedPlanMode: selectedPlanMode,
    lastActive: Date.now(),
    updated: Date.now(),
    syncVersion: syncVersion
  };
}

async function syncMyState(sharedPatch = null) {
  if (!username) return false;
  try {
    setSyncStatus('syncing');
    const payload = { room: ROOM_KEY, user: createSyncRecord() };
    if (sharedPatch && typeof sharedPatch === 'object') payload.shared = sharedPatch;
    const res = await fetch(SYNC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload)
    });
    if (res.status === 409) {
      // 服务端拒绝：数据过旧，读取最新版本并恢复自己的数据
      let body;
      try { body = await res.json(); } catch (jsonErr) {
        console.warn('409 response JSON parse failed:', jsonErr);
        return await recoverConflictFromServer(sharedPatch);
      }
      const recovered = recoverConflictPayload(body);
      if (recovered && sharedPatch) return await retrySharedPatchAfterConflict(sharedPatch);
      return recovered;
    }
    if (!res.ok) throw new Error(`sync ${res.status}`);
    const body = await res.json();
    // 更新自己的版本号（服务端会 +1 后返回）
    const myData = findSelfRecord(body.users || {});
    if (myData?.syncVersion) syncVersion = myData.syncVersion;
    if (myData?.userKey) selfUserKey = myData.userKey;
    applySharedState(body);
    setSyncStatus('ok');
    return true;
  } catch (err) {
    setSyncStatus('fail');
    console.warn('Sync failed:', err);
    return false;
  }
}

async function syncSharedPatch(patch) {
  if (!(await ensureStableUserKey())) return false;
  return await syncMyState(patch);
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
      if (serverSelf.userKey) selfUserKey = serverSelf.userKey;
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
    if (serverSelf.userKey) selfUserKey = serverSelf.userKey;
    restoreSelfFromServer(serverSelf);
  }
  applySharedState(payload);
  findTodayIndex();
  render();
  setSyncStatus(serverSelf ? 'ok' : 'fail');
  return !!serverSelf;
}

async function retrySharedPatchAfterConflict(sharedPatch) {
  if (!sharedPatch) return false;
  try {
    const retryPayload = { room: ROOM_KEY, user: createSyncRecord(), shared: sharedPatch };
    const res = await fetch(SYNC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(retryPayload)
    });
    if (!res.ok) throw new Error(`sync retry ${res.status}`);
    const body = await res.json();
    const myData = findSelfRecord(body.users || {});
    if (myData?.syncVersion) syncVersion = myData.syncVersion;
    if (myData?.userKey) selfUserKey = myData.userKey;
    applySharedState(body);
    setSyncStatus('ok');
    return true;
  } catch (err) {
    setSyncStatus('fail');
    console.warn('Shared patch retry failed:', err);
    return false;
  }
}

async function ensureStableUserKey() {
  if (selfUserKey) return true;
  await pullSelfFromServer();
  if (selfUserKey) return true;
  await syncMyState();
  return !!selfUserKey;
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

async function recoverConflictFromServer(sharedPatch = null) {
  try {
    const res = await fetch(`${SYNC_API}?room=${encodeURIComponent(ROOM_KEY)}&t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`sync ${res.status}`);
    let body;
    try { body = await res.json(); } catch (jsonErr) {
      console.warn('Conflict recovery JSON parse failed:', jsonErr);
      setSyncStatus('fail');
      return false;
    }
    const recovered = recoverConflictPayload(body);
    if (recovered && sharedPatch) return await retrySharedPatchAfterConflict(sharedPatch);
    return recovered;
  } catch (err) {
    setSyncStatus('fail');
    console.warn('Conflict recovery fetch failed:', err);
    return false;
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

function getSelfUserKey(users = null) {
  const serverSelf = users ? findSelfRecord(users) : null;
  if (serverSelf?.userKey) selfUserKey = serverSelf.userKey;
  if (selfUserKey) return selfUserKey;
  return serverSelf?.userKey || `name_${encodeURIComponent(normalizeName(username))}`;
}

function getParticipantKey(participant) {
  if (participant?.userKey) return participant.userKey;
  return `name_${encodeURIComponent(normalizeName(participant?.name || username))}`;
}

function getGiftClaimId(ruleId, participant = getParticipants()[0]) {
  return `${ruleId}__${encodeURIComponent(getParticipantKey(participant))}`;
}

function applySharedState(payload) {
  const users = payload?.users || {};
  const shared = normalizeRemoteObject(payload?.shared, {});
  sharedGiftClaims = normalizeGiftClaims(normalizeRemoteObject(shared.giftClaims, {}));
  wishLists = normalizeWishLists(normalizeRemoteObject(shared.wishLists, {}));
  sharedDecor = normalizeDecor(normalizeRemoteObject(shared.decor, {}));
  mailboxEntries = normalizeMailbox(normalizeRemoteObject(shared.mailbox, []));
  sharedEvents = normalizeSharedEvents(normalizeRemoteObject(shared.events, {}));
  const selfKey = getSelfUserKey(users);
  if (wishLists[selfKey]) wishList = [...wishLists[selfKey].items];
  const nextPeers = {};
  Object.entries(users).forEach(([id, data]) => {
    if (!data || isSelfRecord(id, data)) return;
    nextPeers[id] = {
      userKey: data.userKey || id,
      name: data.displayName || data.username || id,
      avatar: data.avatar || '',
      message: typeof data.message === 'string' ? data.message.slice(0, 40) : '',
      dayStates: normalizeRemoteObject(data.dayStates, {}),
      currentDayIndex: data.currentDayIndex || 0,
      inventory: normalizeCounts(createInventory(), normalizeRemoteObject(data.inventory, {})),
      warehouseContribution: normalizeCounts(createWarehouse(), normalizeRemoteObject(data.warehouseContribution, {})),
      collection: normalizeRemoteObject(data.collection, { discovered: [], completed: [] }),
      giftClaims: normalizeGiftClaims(normalizeRemoteObject(data.giftClaims, {})),
      selectedDifficulty: data.selectedDifficulty || 'standard',
      selectedPlanMode: data.selectedPlanMode || 'standard',
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
  renderGiftDock();
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
      if (s.planMode) dayStates[i].planMode = s.planMode;
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
  giftClaims = normalizeGiftClaims(serverSelf.giftClaims);
  selectedPlanMode = serverSelf.selectedPlanMode || selectedPlanMode;
  saveLocal();
}

// ── 回溯检查：结算时对方数据还未到达，补发隐藏任务奖励 ──
async function retroactiveHiddenCheck() {
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

  const fullDone = isStateFullDone(todayState, todayIndex);
  const candidates = [];
  if (hasPeerSettledToday()) candidates.push('same_day_checkin');
  if (todayState.difficulty === 'standard' && fullDone && hasPeerSettledTodayWithDifficulty('standard', true)) candidates.push('coop_wood_sign');
  if (todayState.difficulty === 'challenge' && fullDone && hasPeerSettledTodayWithDifficulty('challenge', true)) candidates.push('secret_pier_parcel');
  const newTasks = [...new Set(candidates)].filter(id => !todayState.hiddenTasks.includes(id) && !collection.discovered.includes(id));
  if (!newTasks.length) return;

  const rollback = createArchivePayload();
  newTasks.forEach(id => {
    todayState.hiddenTasks.push(id);
    applyHiddenTaskEffect(id);
    discover(id);
  });
  saveLocal();
  const synced = await syncMyState();
  if (!synced) {
    applyArchivePayload(rollback);
    render();
    return;
  }
  const names = newTasks.map(id => getDiscoveryMeta(id).name).join('、');
  showToast(`补发隐藏：${names}`);
}

// ── Render ──
function render() {
  currentDayIndex = getClampedDayIndex(currentDayIndex);
  let baseDay = allDays[currentDayIndex];
  let state = getDayState(currentDayIndex);
  let day = getDifficultyDay(baseDay, state.difficulty || selectedDifficulty);
  if (!day) {
    currentDayIndex = getClampedDayIndex(currentDayIndex);
    baseDay = allDays[currentDayIndex];
    state = getDayState(currentDayIndex);
    day = getDifficultyDay(baseDay, state.difficulty || selectedDifficulty);
  }
  if (!day) return;
  trimCheckedToExerciseCount(state, day.exercises.length);

  document.getElementById('userAvatar').innerHTML = avatarMarkup(userAvatar, '🏝');
  document.getElementById('userDisplayName').textContent = `${username} · ${getUserTitle({ dayStates, warehouseContribution, collection, isMe: true })}`;
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

  renderRoute(baseDay);
  renderTasks(day, state);
  renderCompleteStrip(day, state);
  renderDifficulty(day, state);
  renderBaseOverview(day, state);
  renderSyncStatus();
  renderMessageBoard();
  renderAvatarChoices();
  renderReview(baseDay);
  renderArchive();
  renderBuddies();
  renderLeaderboard();
  renderCoopGoals();
  renderActivityFeed();
  renderGiftDock();
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
  const legacyNotes = [{ name: username, avatar: userAvatar, message: userMessage, createdAt: 0 }].concat(
    Object.values(peers).map(p => ({ name: p.name || '伙伴', avatar: p.avatar || '', message: p.message || '', createdAt: 0 }))
  ).filter(note => note.message);
  const history = mailboxEntries.map(entry => ({
    name: entry.authorName,
    avatar: getAvatarForName(entry.authorName),
    message: entry.text,
    createdAt: entry.createdAt
  }));
  const notes = [...history, ...legacyNotes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8);
  list.innerHTML = notes.length ? notes.map(note => `
    <div class="message-note">${avatarMarkup(note.avatar, '🏝')}<strong>${escapeHtml(note.name)}</strong><span>${escapeHtml(note.message)}</span>${note.createdAt ? `<small>${formatShortDate(note.createdAt)}</small>` : ''}</div>
  `).join('') : '<div class="message-note"><span>还没有留言</span></div>';
}

function getAvatarForName(name) {
  if (normalizeName(name) === normalizeName(username)) return userAvatar;
  return Object.values(peers).find(p => normalizeName(p.name) === normalizeName(name))?.avatar || '';
}

function renderAvatarChoices() {
  const grid = document.getElementById('avatarChoices');
  if (!grid) return;
  grid.innerHTML = AVATARS.map(avatar => `
    <button class="avatar-choice ${avatar.id === userAvatar ? 'active' : ''}" type="button" data-avatar="${avatar.id}" aria-label="${avatar.name}">
      ${avatarMarkup(avatar.id)}
      <span class="avatar-choice-check" aria-hidden="true">✓</span>
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
    const routeDay = getDifficultyDay(d, ds.difficulty || selectedDifficulty);
    if (ds.settled && ds.checked.size >= routeDay.exercises.length) n.classList.add('done');
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
  const profile = getRewardProfile(currentDifficulty, true);
  const fullScore = (day.exercises.length || 0) * diff.multiplier;
  const previewRewards = chooseRewards(currentDifficulty, profile.count, currentDayIndex, day)
    .map(key => ITEMS[key]?.[0] || key)
    .join(' · ');
  const preview = document.getElementById('rewardPreview');
  preview.innerHTML = `
    <div class="reward-line"><span>今日内容</span><span>${day.exercises.length} 个动作 · ${diff.variantLabel}</span></div>
    <div class="reward-line"><span>${diff.label}奖励</span><span>${fullScore} 积分 · ${profile.count} 份材料</span></div>
    <div class="reward-line"><span>奖励预览</span><span>${previewRewards}</span></div>`;
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
  const festival = getFestivalToday();
  const statuses = HIDDEN_QUESTS.map(quest => ({
    ...quest,
    found: collection.discovered.includes(quest.id),
    ready: isHiddenQuestReady(quest.id, { day, state, difficulty, fullDone, hour })
  }));
  if (festival) statuses.push({ id: festival.id, name: festival.name, tier: '普通', found: collection.discovered.includes(festival.id), ready: state.settled, clue: `今天岛上有${festival.name}的传闻。` });
  return statuses;
}

function isHiddenQuestReady(id, context) {
  const { day, state, difficulty, fullDone, hour } = context;
  if (id === 'night_star') return hour >= 20 || hour < 5;
  if (id === 'same_day_checkin') return hasPeerSettledToday();
  if (id === 'goldenLeaf') return difficulty === 'easy' && fullDone && countFullDifficulty('easy') >= 3;
  if (id === 'museum_entry') return !!day.review && fullDone;
  if (id === 'steady_builder') return difficulty === 'standard' && fullDone && countFullDifficulty('standard') >= 5;
  if (id === 'challenge_islander') return difficulty === 'challenge' && fullDone && countFullDifficulty('challenge') >= 3;
  if (id === 'coop_wood_sign') return difficulty === 'standard' && fullDone && hasPeerSettledTodayWithDifficulty('standard', true);
  if (id === 'observatory_permit') return difficulty === 'challenge' && fullDone && (hour >= 20 || hour < 5) && countFullDifficulty('challenge') >= 2;
  if (id === 'secret_pier_parcel') return difficulty === 'challenge' && fullDone && hasPeerSettledTodayWithDifficulty('challenge', true);
  if (id === 'golden_resident_card') return difficulty === 'easy' && fullDone && countFullDifficulty('easy') >= 7;
  if (id === 'bottle_extra_clue') return (inventory.nookMilesTicket || 0) > 0;
  return false;
}

function renderHiddenStatus(item) {
  const cls = item.found ? 'found' : item.ready ? 'ready' : '';
  const label = item.found ? `已触发 · ${item.tier || '隐藏'}` : item.ready ? `今日可试 · ${item.tier || '隐藏'}` : `${item.tier || '隐藏'}线索`;
  return `<div class="hidden-status ${cls}"><span>${item.found ? item.name : item.tier === '传说' ? '???' : item.name}</span><small>${label}</small></div>`;
}

function getHiddenQuestHint(difficulty, day) {
  if (day.review) return '周复盘日完成后，博物馆会新增一条图鉴记录。';
  if (difficulty === 'challenge') return '挑战完整完成会提高稀有隐藏和真实礼物资格。';
  if (difficulty === 'easy') return '轻松完整累计出现，会触发金色树叶和金色岛民证。';
  return '标准完整完成最稳定，双人同日标准会解锁合作木牌。';
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
    const currentDs = ds[ci] || { checked: [], settled: false };
    const currentDay = getDifficultyDay(allDays[ci] || allDays[0], currentDs.difficulty || p.selectedDifficulty || 'standard');
    const checkedCount = getCheckedCount(currentDs);
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
        <div class="buddy-name">${escapeHtml(name)} · ${escapeHtml(getUserTitle(p))} ${isOnline ? '<span class="online-dot"></span>' : '<span class="offline-dot"></span>'}</div>
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
  rows.push({ name: username, isMe: true, avatar: userAvatar, settledDays: mySettled, totalChecked: myChecked, totalScore: myScore, currentDay: currentDayIndex, lastActive: Date.now(), warehouse: sumCounts(warehouseContribution), materials: warehouseContribution, title: getUserTitle({ dayStates, warehouseContribution, collection }) });

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
    rows.push({ name: p.name || id, isMe: false, avatar: p.avatar || '', settledDays: settled, totalChecked: checked, totalScore: score, currentDay: p.currentDayIndex || 0, lastActive: p.lastActive || 0, warehouse: sumCounts(p.warehouseContribution || {}), materials: p.warehouseContribution || {}, title: getUserTitle(p) });
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
        <div class="lb-name">${escapeHtml(r.name)} ${isMe ? '(我)' : ''} · ${escapeHtml(r.title || getUserTitle({ dayStates, warehouseContribution, collection }))} ${isOnline ? '<span class="online-dot" style="display:inline-block;vertical-align:middle"></span>' : ''}</div>
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
    { userKey: getSelfUserKey(), name: username, avatar: userAvatar, dayStates, warehouseContribution, collection, giftClaims, isMe: true },
    ...Object.values(peers).map(p => ({ userKey: p.userKey || '', name: p.name || '伙伴', avatar: p.avatar || '', dayStates: p.dayStates || {}, warehouseContribution: p.warehouseContribution || {}, collection: p.collection || {}, giftClaims: p.giftClaims || {}, isMe: false }))
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

function getGiftProgress(rule, participant = getParticipants()[0]) {
  const states = participant.dayStates || {};
  const range = getCurrentWeekRange();
  if (rule.id === 'milk_tea') {
    return { value: countSettledStates(states), target: 3 };
  }
  if (rule.id === 'dinner_together') {
    return { value: countSameDayCheckins(range), target: 2 };
  }
  if (rule.id === 'weekend_gift') {
    const value = getParticipants().reduce((sum, p) => sum + countWeekSettled(p.dayStates, range), 0);
    return { value, target: 8 };
  }
  if (rule.id === 'wish_pick') {
    const value = Object.values(states || {}).filter((s, index) => {
      const day = allDays[index];
      const total = getDifficultyDay(day, s?.difficulty || 'challenge')?.exercises?.length || 0;
      const checked = Array.isArray(s?.checked) ? s.checked.length : s?.checked?.size || 0;
      return s?.settled && s.difficulty === 'challenge' && checked >= total;
    }).length;
    return { value, target: 3 };
  }
  if (rule.id === 'welcome_back') {
    let sawRest = false;
    let returned = false;
    Object.keys(states || {}).map(Number).sort((a, b) => a - b).forEach(index => {
      const s = states[index];
      if (s?.missed) sawRest = true;
      if (sawRest && s?.settled) returned = true;
    });
    return { value: returned ? 1 : 0, target: 1 };
  }
  if (rule.id === 'base_decor') {
    return { value: sumCounts(getSharedWarehouse()), target: 30 };
  }
  return { value: 0, target: 1 };
}

function isGiftUnlocked(rule, participant = getParticipants()[0]) {
  const progress = getGiftProgress(rule, participant);
  return progress.value >= progress.target;
}

function renderGiftCard(rule, participant, isMine) {
  const progress = getGiftProgress(rule, participant);
  const unlocked = progress.value >= progress.target;
  const claimId = getGiftClaimId(rule.id, participant);
  const claim = sharedGiftClaims[claimId] || (participant.isMe ? giftClaims[rule.id] : participant.giftClaims?.[rule.id]) || null;
  const pct = Math.min(100, Math.round(progress.value / progress.target * 100));
  let action = `<button class="gift-action" type="button" disabled>${unlocked ? '可申请' : '未解锁'}</button>`;
  if (isMine && unlocked && !claim) action = `<button class="gift-action" type="button" data-gift-request="${rule.id}">申请兑换</button>`;
  else if (claim?.status === 'requested' && isMine) action = '<button class="gift-action pending" type="button" disabled>等待对方兑现</button>';
  else if (claim?.status === 'requested') action = `<button class="gift-action" type="button" data-gift-redeem="${escapeHtml(claimId)}">确认兑现</button>`;
  else if (claim?.status === 'redeemed') action = '<button class="gift-action done" type="button" disabled>已兑现</button>';
  return `<div class="gift-card ${unlocked ? 'unlocked' : 'locked'}">
    <div class="gift-top"><span class="gift-icon">${rule.icon}</span><div><strong>${escapeHtml(rule.title)}</strong><small>${escapeHtml(rule.scope === 'coop' ? '双人奖励' : '个人奖励')}</small></div></div>
    <p>${escapeHtml(rule.desc)}</p>
    <div class="gift-target">${escapeHtml(rule.target)}</div>
    <div class="gift-bar"><span style="width:${pct}%"></span></div>
    <div class="gift-foot"><span>${progress.value}/${progress.target}</span>${action}</div>
  </div>`;
}

function getWishGiftEntries() {
  const selfKey = getSelfUserKey();
  return Object.entries(wishLists).filter(([key, entry]) => key !== selfKey && entry.items?.length)
    .flatMap(([, entry]) => entry.items.map(item => ({
      item,
      ownerName: entry.ownerName || '伙伴'
    })));
}

function renderWishGiftCards() {
  const entries = getWishGiftEntries();
  return entries.map((entry, index) => `<div class="gift-card wish-gift-card">
    <div class="gift-top"><span class="gift-icon">🎟</span><div><strong>${escapeHtml(entry.item)}</strong><small>${escapeHtml(`${entry.ownerName}的心愿`)}</small></div></div>
    <p>这是对方写下的心愿，兑换真实礼物时可以照着准备。</p>
    <div class="gift-target">心愿 ${index + 1}/${entries.length}</div>
    <div class="gift-bar"><span style="width:100%"></span></div>
    <div class="gift-foot"><span>心愿清单</span><button class="gift-action pending" type="button" disabled>对方想要</button></div>
  </div>`);
}

function renderGiftDock() {
  const dock = document.getElementById('giftDock');
  const peerDock = document.getElementById('giftPeerDock');
  const history = document.getElementById('giftHistory');
  if (!dock || !peerDock || !history) return;
  const me = getParticipants()[0];
  dock.innerHTML = [
    ...renderWishGiftCards(),
    ...GIFT_RULES.map(rule => renderGiftCard(rule, me, true))
  ].join('');
  renderWishPanel();
  const selfKey = getSelfUserKey();
  const peerCards = Object.entries(sharedGiftClaims).filter(([, claim]) => {
    return claim?.status === 'requested' && claim.ownerKey !== selfKey;
  }).map(([, claim]) => {
    const rule = GIFT_RULES.find(r => r.id === claim.ruleId);
    if (!rule) return '';
    const peer = Object.values(peers).find(p => p.userKey === claim.ownerKey || normalizeName(p.name) === normalizeName(claim.ownerName));
    const participant = {
      userKey: claim.ownerKey,
      name: claim.ownerName || peer?.name || '伙伴',
      dayStates: peer?.dayStates || {},
      warehouseContribution: peer?.warehouseContribution || {},
      collection: peer?.collection || {},
      giftClaims: peer?.giftClaims || {},
      isMe: false
    };
    return renderGiftCard(rule, participant, false);
  }).filter(Boolean);
  peerDock.innerHTML = peerCards.length ? peerCards.join('') : '<div class="gift-empty">暂时没有待兑现包裹</div>';
  const redeemed = [];
  getParticipants().forEach(p => {
    const claims = { ...(p.isMe ? giftClaims : p.giftClaims || {}) };
    GIFT_RULES.forEach(rule => {
      const sharedClaim = sharedGiftClaims[getGiftClaimId(rule.id, p)];
      if (sharedClaim) claims[rule.id] = sharedClaim;
    });
    Object.entries(claims).forEach(([id, claim]) => {
      if (claim.status !== 'redeemed') return;
      const rule = GIFT_RULES.find(r => r.id === (claim.ruleId || id));
      if (rule) redeemed.push({ name: p.name, title: rule.title, at: claim.redeemedAt || claim.requestedAt || 0 });
    });
  });
  redeemed.sort((a, b) => b.at - a.at);
  history.innerHTML = redeemed.length
    ? redeemed.slice(0, 6).map(item => `<div class="gift-history-item"><span>${escapeHtml(item.name)} · ${escapeHtml(item.title)}</span><small>${formatShortDate(item.at)}</small></div>`).join('')
    : '<div class="gift-empty">兑现后会留下记录</div>';
}

function renderWishPanel() {
  const list = document.getElementById('wishList');
  const peerList = document.getElementById('wishPeerList');
  if (!list || !peerList) return;
  list.innerHTML = '';
  peerList.innerHTML = '';
}

function mirrorOwnWishList() {
  const selfKey = getSelfUserKey();
  wishLists[selfKey] = {
    ownerKey: selfKey,
    ownerName: username,
    items: [...wishList],
    updatedAt: Date.now()
  };
}

function formatShortDate(ts) {
  if (!ts) return '刚刚';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function handleGiftRequest(ruleId) {
  if (!(await ensureStableUserKey())) { showToast('同步身份中，请稍后再试'); return; }
  const rule = GIFT_RULES.find(r => r.id === ruleId);
  const me = getParticipants()[0];
  const claimId = getGiftClaimId(ruleId, me);
  if (!rule || sharedGiftClaims[claimId] || giftClaims[ruleId] || !isGiftUnlocked(rule)) return;
  const claim = { id: claimId, ruleId, ownerKey: getParticipantKey(me), ownerName: username, status: 'requested', requestedAt: Date.now(), redeemedAt: 0, redeemedBy: '' };
  sharedGiftClaims[claimId] = claim;
  giftClaims[ruleId] = { status: 'requested', requestedAt: claim.requestedAt, redeemedAt: 0, redeemedBy: '' };
  discover(`gift_${ruleId}`);
  saveLocal();
  await syncSharedPatch({ giftClaim: claim });
  renderGiftDock();
  renderCollection();
  showToast(`${rule.title} 已放进码头包裹`);
}

async function handleGiftRedeem(claimId) {
  const claim = sharedGiftClaims[claimId];
  const rule = GIFT_RULES.find(r => r.id === claim?.ruleId);
  if (!claim || claim.status !== 'requested' || !rule) return;
  sharedGiftClaims[claimId].status = 'redeemed';
  sharedGiftClaims[claimId].redeemedAt = Date.now();
  sharedGiftClaims[claimId].redeemedBy = username;
  const updated = { ...sharedGiftClaims[claimId] };
  discover(`gift_${rule.id}`);
  saveLocal();
  await syncSharedPatch({ giftClaim: updated });
  renderGiftDock();
  renderCollection();
  showToast(`${rule.title} 已记录兑现`);
}

async function handleWishAdd() {
  const input = document.getElementById('wishInput');
  const value = (input?.value || '').trim().slice(0, 40);
  if (!value) return;
  if (!(await ensureStableUserKey())) { showToast('同步身份中，请稍后再试'); return; }
  wishList = [...new Set([...wishList, value])].slice(0, 5);
  mirrorOwnWishList();
  if (input) input.value = '';
  renderGiftDock();
  await syncSharedPatch({ wishList });
  showToast('心愿已放进码头');
}

async function handleWishRemove(index) {
  if (!(await ensureStableUserKey())) { showToast('同步身份中，请稍后再试'); return; }
  wishList = wishList.filter((_, i) => i !== index);
  mirrorOwnWishList();
  renderGiftDock();
  await syncSharedPatch({ wishList });
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
  renderWeeklyEvents(weeklyCheckins, sameDay, warehouseTotal);
}

function renderWeeklyEvents(weeklyCheckins = 0, sameDay = 0, warehouseTotal = 0) {
  const list = document.getElementById('weeklyEventList');
  const btn = document.getElementById('weeklySettleBtn');
  if (!list || !btn) return;
  const currentId = getWeeklyEventId();
  const status = getWeeklySettlementStatus();
  btn.disabled = !status.allowed;
  btn.textContent = status.label;
  btn.title = status.reason;
  btn.dataset.weeklyCheckins = String(weeklyCheckins);
  btn.dataset.sameDay = String(sameDay);
  btn.dataset.warehouseTotal = String(warehouseTotal);
  const events = Object.values(sharedEvents).filter(e => e.type === 'weekly').sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  list.innerHTML = events.length
    ? events.map(e => `<div class="weekly-event"><strong>${escapeHtml(e.title)}</strong><span>${escapeHtml(e.summary)}</span><small>${formatShortDate(e.createdAt)}</small></div>`).join('')
    : '<div class="gift-empty">本周结算后会出现公告</div>';
}

function getWeeklyEventId() {
  const range = getCurrentWeekRange();
  return `weekly_${range.wi}_${getDateKey().slice(0, 7)}`;
}

function getWeeklySettlementStatus() {
  const range = getCurrentWeekRange();
  const currentId = getWeeklyEventId();
  if (sharedEvents[currentId]) return { allowed: false, label: '本周已结算', reason: '这一周已经生成过结算公告。' };
  if (getTodayWeekdayIndex() !== 6) return { allowed: false, label: '周日完成后结算', reason: '周一到周六不能提前生成周结算。' };
  const sundayIndex = Math.min(range.end, range.start + 6);
  const sundayState = getDayState(sundayIndex);
  if (!sundayState.settled && !sundayState.missed) return { allowed: false, label: '先完成今天', reason: '周日需要先打卡或记录休息。' };
  return { allowed: true, label: '生成本周结算', reason: '周日已处理，可以生成完整周结算。' };
}

async function handleWeeklySettlement() {
  if (!(await ensureStableUserKey())) { showToast('同步身份中，请稍后再试'); return; }
  const status = getWeeklySettlementStatus();
  if (!status.allowed) {
    showToast(status.reason);
    renderCoopGoals();
    return;
  }
  const range = getCurrentWeekRange();
  const participants = getParticipants();
  const weeklyCheckins = participants.reduce((sum, p) => sum + countWeekSettled(p.dayStates, range), 0);
  const sameDay = countSameDayCheckins(range);
  const warehouseTotal = sumCounts(getSharedWarehouse());
  const insights = getWeeklyReviewInsights(range.wi);
  const event = {
    id: getWeeklyEventId(),
    type: 'weekly',
    title: `第 ${range.wi + 1} 周结算`,
    summary: `本周合计登岛 ${weeklyCheckins} 次，同日 ${sameDay} 次，仓库 ${warehouseTotal} 份。最稳：${insights.bestDay.label}；最弱：${insights.weakest.label}；建议：${insights.nextAdvice.label}`,
    createdAt: Date.now()
  };
  const ok = await syncSharedPatch({ weeklyEvent: event });
  if (!ok) {
    showToast('周结算同步失败，请稍后再试');
    renderCoopGoals();
    return;
  }
  sharedEvents[event.id] = { ...event, createdBy: username };
  renderCoopGoals();
  showToast('周结算公告已贴到贡献页');
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
    const giftCount = Object.values(p.isMe ? giftClaims : p.giftClaims || {}).filter(claim => claim.status === 'redeemed').length;
    if (giftCount > 0) items.push(`${escapeHtml(p.name)} 已兑现 ${giftCount} 张礼物券`);
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

function getDiscoveryMeta(id) {
  const hidden = HIDDEN_QUESTS.find(q => q.id === id);
  if (hidden) return hidden;
  const collectionEntry = getCollectionEntries().find(entry => entry.id === id);
  if (collectionEntry) return collectionEntry;
  const item = ITEMS[id];
  if (item) return { id, name: item[0], icon: item[1], img: item[2] };
  return { id, name: id, icon: '？' };
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
  renderPlacedDecor(map);
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
  renderDecorWorkshop();
}

function renderPlacedDecor(map) {
  Object.keys(sharedDecor).forEach(id => {
    const meta = DECOR_ITEMS.find(item => item.id === id);
    if (!meta) return;
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'decor-point';
    node.style.setProperty('--x', `${meta.x}%`);
    node.style.setProperty('--y', `${meta.y}%`);
    node.setAttribute('aria-label', `${meta.name}，由 ${sharedDecor[id].ownerName || '伙伴'} 放置`);
    node.innerHTML = `<span>${meta.icon}</span>`;
    node.addEventListener('click', () => showToast(`${meta.name} · ${sharedDecor[id].ownerName || '伙伴'} 放置`));
    map.appendChild(node);
  });
}

function renderDecorWorkshop() {
  const grid = document.getElementById('decorGrid');
  if (!grid) return;
  grid.innerHTML = DECOR_ITEMS.map(item => {
    const placed = !!sharedDecor[item.id];
    const ready = canAffordDecor(item);
    return `<div class="decor-card ${placed ? 'placed' : ''}">
      <div class="decor-main"><span class="decor-icon">${item.icon}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.desc)}</small></div></div>
      <div class="decor-cost">${formatDecorCost(item.cost)}</div>
      <button class="decor-btn" type="button" data-decor-place="${item.id}" ${placed || !ready ? 'disabled' : ''}>${placed ? '已放置' : ready ? '放置' : '材料不足'}</button>
    </div>`;
  }).join('');
}

function formatDecorCost(cost) {
  return Object.entries(cost || {}).map(([key, value]) => `${ITEMS[key]?.[0] || key} ${inventory[key] || 0}/${value}`).join(' · ');
}

function canAffordDecor(item) {
  return Object.entries(item.cost || {}).every(([key, value]) => (inventory[key] || 0) >= value);
}

async function handlePlaceDecor(id) {
  if (!(await ensureStableUserKey())) { showToast('同步身份中，请稍后再试'); return; }
  const item = DECOR_ITEMS.find(d => d.id === id);
  if (!item || sharedDecor[id] || !canAffordDecor(item)) return;
  Object.entries(item.cost || {}).forEach(([key, value]) => {
    inventory[key] = Math.max(0, (inventory[key] || 0) - value);
  });
  const placed = { id, ownerName: username, ownerKey: getSelfUserKey(), placedAt: Date.now() };
  sharedDecor[id] = placed;
  discover(`decor_${id}`);
  saveLocal();
  await syncSharedPatch({ decorItem: placed });
  render();
  showToast(`${item.name} 已放到岛上`);
}

function getBuildingStatus(building, metrics, warehouse = getSharedWarehouse()) {
  const value = building.metric === 'checkins' ? metrics.checkins : building.metric === 'minutes' ? metrics.minutes : metrics.collection;
  const need = building.need || value || 1;
  const coopCount = getContributorCount();
  const coopReady = coopCount >= (building.coopNeed || 0);
  const unlocked = value >= building.need && coopReady;
  const pct = building.need ? Math.min(100, Math.round(value / building.need * 100)) : 100;
  const material = getMaterialReadiness(building.id, warehouse);
  return { value, need, unlocked, pct, materialPct: material.pct, materialText: material.text, coopCount, coopNeed: building.coopNeed || 0, coopReady };
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
  if (!status.coopReady) return `还需要 ${status.coopNeed} 人参与建设，当前 ${status.coopCount}/${status.coopNeed}。`;
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
  if (building.id === 'museum') {
    showMuseumTrophies(building, status);
    return;
  }
  const modal = document.getElementById('islandPointModal');
  document.getElementById('islandDetailIcon').innerHTML = iconMarkup(building);
  document.getElementById('islandDetailTitle').textContent = building.name;
  const stage = getBuildingStage(status);
  document.getElementById('islandDetailMeta').innerHTML = `${getBuildingStatusLabel(status)} · ${stage.label}阶段 · ${metricLabel(building.metric)}<br>${building.desc}<br>${building.reward}<br>${getRemainingText(building, status)}<br>协作人数：${status.coopCount}/${status.coopNeed || 0}<br>共同材料：${status.materialText}`;
  document.getElementById('islandDetailFill').style.width = `${status.pct}%`;
  document.getElementById('islandDetailCount').textContent = building.need ? `进度 ${status.value}/${building.need}` : '进度 100%';
  modal.classList.add('show');
}

function showMuseumTrophies(building, status) {
  const modal = document.getElementById('islandPointModal');
  document.getElementById('islandDetailIcon').innerHTML = iconMarkup(building);
  document.getElementById('islandDetailTitle').textContent = '博物馆馆藏';
  renderMuseumModalBody('all');
  document.getElementById('islandDetailFill').style.width = `${status.pct}%`;
  document.getElementById('islandDetailCount').textContent = `博物馆建设 ${status.value}/${status.need}`;
  modal.classList.add('show');
}

function renderMuseumModalBody(activeRoom = 'all') {
  const rooms = getMuseumRooms();
  const exhibits = getMuseumExhibits();
  const visible = activeRoom === 'all' ? exhibits : exhibits.filter(exhibit => exhibit.room === activeRoom);
  const doneCount = exhibits.filter(exhibit => exhibit.found).length;
  const total = exhibits.length || 1;
  document.getElementById('islandDetailMeta').innerHTML = `
    <p class="museum-sub">这里只收藏稀有物品、隐藏传闻、真实礼物和奖杯。</p>
    <div class="museum-room-grid museum-modal-rooms">
      <button class="museum-room ${activeRoom === 'all' ? 'active' : ''}" type="button" data-museum-room="all">
        <span class="museum-room-icon">🏛</span>
        <span class="museum-room-name">全部馆藏</span>
        <span class="museum-room-count">${doneCount}/${exhibits.length}</span>
        <span class="museum-room-bar"><span style="width:${Math.round(doneCount / total * 100)}%"></span></span>
      </button>
      ${rooms.map(room => `
        <button class="museum-room ${activeRoom === room.id ? 'active' : ''}" type="button" data-museum-room="${room.id}">
          <span class="museum-room-icon">${room.iconHtml}</span>
          <span class="museum-room-name">${room.name}</span>
          <span class="museum-room-count">${room.found}/${room.total}</span>
          <span class="museum-room-bar"><span style="width:${room.pct}%"></span></span>
        </button>`).join('')}
    </div>
    <div class="museum-cabinet">${visible.map(renderMuseumExhibit).join('')}</div>
    <div class="museum-footnote">已入馆 <strong>${doneCount}</strong> / ${exhibits.length} 件稀有馆藏</div>`;
  document.querySelectorAll('#islandPointModal [data-museum-room]').forEach(btn => {
    btn.addEventListener('click', () => renderMuseumModalBody(btn.dataset.museumRoom || 'all'));
  });
  document.querySelectorAll('#islandPointModal [data-museum-entry]').forEach(btn => {
    btn.addEventListener('click', () => showMuseumEntryDetail(btn.dataset.museumEntry));
  });
}

function getMuseumRooms() {
  const exhibits = getMuseumExhibits();
  const roomDefs = [
    { id: 'special', name: '特殊物品展厅', iconHtml: iconMarkup(ITEMS.starFragment) },
    { id: 'hidden', name: '隐藏传闻展厅', iconHtml: '🔑' },
    { id: 'gift', name: '真实礼物展厅', iconHtml: '🎁' },
    { id: 'trophy', name: '奖杯展厅', iconHtml: '🏆' }
  ];
  return roomDefs.map(room => {
    const roomEntries = exhibits.filter(exhibit => exhibit.room === room.id);
    const found = roomEntries.filter(exhibit => exhibit.found).length;
    const total = roomEntries.length || 1;
    return { ...room, found, total: roomEntries.length, pct: Math.round(found / total * 100) };
  });
}

function getMuseumExhibits() {
  const specialItems = ['ironNugget', 'clay', 'starFragment', 'nookMilesTicket', 'goldenLeaf']
    .filter(key => ITEMS[key])
    .map(key => ({
      id: `museum_item_${key}`,
      room: 'special',
      name: ITEMS[key][0],
      iconHtml: iconMarkup(ITEMS[key]),
      source: getItemSource(key),
      use: getItemUse(key),
      found: (inventory[key] || 0) > 0 || collection.discovered.includes(key),
      progressValue: Math.min(1, (inventory[key] || 0) > 0 || collection.discovered.includes(key) ? 1 : 0),
      progressTarget: 1
    }));
  const hidden = HIDDEN_QUESTS
    .filter(quest => quest.tier !== '普通')
    .map(quest => ({
      id: `museum_hidden_${quest.id}`,
      room: 'hidden',
      name: quest.name,
      iconHtml: iconMarkup(quest, quest.icon),
      source: quest.source,
      use: quest.use,
      found: collection.discovered.includes(quest.id),
      progressValue: collection.discovered.includes(quest.id) ? 1 : 0,
      progressTarget: 1
    }));
  const gifts = GIFT_RULES.map(rule => ({
    id: `museum_gift_${rule.id}`,
    room: 'gift',
    name: rule.title,
    iconHtml: iconMarkup(rule, rule.icon),
    source: rule.target,
    use: rule.desc,
    found: collection.discovered.includes(`gift_${rule.id}`),
    progressValue: getGiftProgress(rule).value,
    progressTarget: getGiftProgress(rule).target
  }));
  const trophies = TROPHIES.map(trophy => {
    const progress = getTrophyProgress(trophy.id);
    return {
      id: `museum_trophy_${trophy.id}`,
      room: 'trophy',
      name: trophy.name,
      iconHtml: trophy.icon,
      source: trophy.desc,
      use: '登记到博物馆奖杯记录。',
      found: progress.value >= progress.target,
      progressValue: progress.value,
      progressTarget: progress.target
    };
  });
  return [...specialItems, ...hidden, ...gifts, ...trophies];
}

function renderMuseumExhibit(exhibit) {
  const pct = Math.min(100, Math.round((exhibit.progressValue / Math.max(1, exhibit.progressTarget)) * 100));
  const iconHtml = exhibit.found ? exhibit.iconHtml : '<span class="museum-case-mystery">?</span>';
  const progressTag = exhibit.found ? '<span class="done-tag">已入馆</span>' : `<span>${exhibit.progressValue}/${exhibit.progressTarget}</span>`;
  return `<button class="museum-case ${exhibit.found ? 'done' : ''}" type="button" data-museum-entry="${escapeHtml(exhibit.id)}">
    <span class="museum-case-icon">${iconHtml}</span>
    <span class="museum-case-body">
      <span class="museum-case-name">${escapeHtml(exhibit.found ? exhibit.name : '???')}</span>
      <span class="museum-case-bar"><span class="museum-case-bar-fill" style="width:${pct}%"></span></span>
      <span class="museum-case-progress">${progressTag}</span>
    </span>
  </button>`;
}

function showMuseumEntryDetail(id) {
  const exhibit = getMuseumExhibits().find(item => item.id === id);
  if (!exhibit) return;
  document.getElementById('itemDetailIcon').innerHTML = exhibit.found ? exhibit.iconHtml : '？';
  document.getElementById('itemDetailTitle').textContent = exhibit.found ? exhibit.name : '未入馆展品';
  document.getElementById('itemDetailMeta').innerHTML = `
    类型：博物馆馆藏<br>
    状态：${exhibit.found ? '已入馆' : '未入馆'}<br>
    进度：${exhibit.progressValue}/${exhibit.progressTarget}<br>
    来源：${escapeHtml(exhibit.source || '继续训练和探索岛屿。')}<br>
    用途：${escapeHtml(exhibit.use || '作为稀有馆藏纪念。')}
  `;
  configureItemUseButton(null);
  document.getElementById('itemDetailModal').classList.add('show');
}

function getTrophyProgress(id) {
  if (id === 'first_checkin') return { value: Math.min(1, countSettledStates(dayStates)), target: 1 };
  if (id === 'steady_three') return { value: Math.min(3, countSettledStates(dayStates)), target: 3 };
  if (id === 'resident_seven') return { value: Math.min(7, countSettledStates(dayStates)), target: 7 };
  if (id === 'same_day') return { value: collection.discovered.includes('same_day_checkin') ? 1 : 0, target: 1 };
  if (id === 'builder') return { value: Math.min(20, sumCounts(warehouseContribution)), target: 20 };
  if (id === 'challenge_three') return { value: Math.min(3, getGiftProgress(GIFT_RULES.find(rule => rule.id === 'wish_pick')).value), target: 3 };
  if (id === 'gift_postman') return { value: Object.values(sharedGiftClaims).some(claim => claim.status === 'redeemed') ? 1 : 0, target: 1 };
  if (id === 'star_collector') return { value: (inventory.starFragment || 0) > 0 || collection.discovered.includes('night_star') ? 1 : 0, target: 1 };
  return { value: 0, target: 1 };
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
  const baseDay = allDays[currentDayIndex] || allDays[0];
  const state = getDayState(currentDayIndex);
  const day = getDifficultyDay(baseDay, state.difficulty || selectedDifficulty);
  const clues = getHiddenQuestStatuses(day, state);
  const discoveredHidden = HIDDEN_QUESTS.filter(q => collection.discovered.includes(q.id)).length;
  document.getElementById('bottleHintBody').innerHTML = `<div class="bottle-clues">${clues.map(c => {
    const cls = c.found ? 'found' : c.ready ? 'ready' : '';
    let clue = c.clue;
    if (c.tier === '传说' && !c.found && discoveredHidden < 3) clue = '???';
    const label = c.found ? `已触发` : c.ready ? `今日可试` : `未触发`;
    const tier = c.tier || '隐藏';
    const name = c.found ? c.name : c.tier === '传说' ? '???' : c.name;
    return `<div class="bottle-clue ${cls}"><span class="bottle-clue-tier">${escapeHtml(tier)}</span><span class="bottle-clue-name">${escapeHtml(name)}</span><div class="bottle-clue-body">${escapeHtml(label)} · ${escapeHtml(clue)}</div></div>`;
  }).join('')}</div>`;
  const btn = document.getElementById('bottleUseTicketBtn');
  if (btn) {
    btn.disabled = (inventory.nookMilesTicket || 0) <= 0;
    btn.textContent = (inventory.nookMilesTicket || 0) > 0 ? '使用里数券再看一条' : '没有里数券';
  }
  document.getElementById('bottleModal').classList.add('show');
}

async function revealExtraBottleClue() {
  if ((inventory.nookMilesTicket || 0) <= 0) {
    showToast('里数券不足');
    return;
  }
  const rollback = createArchivePayload();
  inventory.nookMilesTicket -= 1;
  discover('bottle_extra_clue');
  saveLocal();
  const synced = await syncMyState();
  if (!synced) {
    applyArchivePayload(rollback);
    showToast('同步失败，里数券还没有使用');
    renderInventory();
    renderCollection();
    return;
  }
  const extra = [
    '稀有线索：标准完整完成几次后，仓库会补木材。',
    '稀有线索：挑战完整累计几次后，心愿会被码头记录。',
    '传说线索：夜里挑战完整完成，星星会记住你。',
    '传说线索：两个人同日挑战完整完成，码头会靠岸。'
  ][(currentDayIndex + (inventory.nookMilesTicket || 0)) % 4];
  const body = document.getElementById('bottleHintBody');
  if (body) body.innerHTML += `<div class="bottle-clue ready">里数券线索 · ${escapeHtml(extra)}</div>`;
  showToast('里数券已使用');
  renderInventory();
  renderCollection();
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

function getContributorCount() {
  return getParticipants().filter(p => countSettledStates(p.dayStates || {}) > 0 || sumCounts(p.warehouseContribution || {}) > 0).length;
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
  const entries = getCollectionEntries();
  grid.innerHTML = '';
  entries.filter(entry => collectionFilter === 'all' || entry.type === collectionFilter).forEach(entry => {
    const found = collection.discovered.includes(entry.id);
    const card = document.createElement('div');
    const lockedHidden = !found && entry.type === '隐藏任务';
    card.className = 'collection-card' + (found ? ' discovered' : '') + (lockedHidden ? ' locked' : '');
    card.setAttribute('data-collection-id', entry.id);
    const metaText = entry.type === '隐藏任务' && entry.tier ? `${entry.type} · ${entry.tier}` : entry.type;
    card.innerHTML = `<div class="collection-top"><div><div class="collection-name">${found ? entry.name : '???'}</div><div class="collection-meta">${metaText}</div></div><div class="collection-icon">${found ? iconMarkup(entry, entry.icon) : '？'}</div></div><span class="collection-status">${found ? '已发现' : '未发现'}</span>`;
    if (!lockedHidden) card.addEventListener('click', () => showCollectionDetail(entry.id));
    grid.appendChild(card);
  });
  document.querySelectorAll('#collectionTabs .collection-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === collectionFilter));
}

function getCollectionEntries() {
  return [
    ...Object.entries(ITEMS).map(([id, meta]) => ({ id, name: meta[0], icon: meta[1], img: meta[2], type: '材料', source: getItemSource(id), use: getItemUse(id) })),
    ...BUILDINGS.map(b => ({ id: b.id, name: b.name, icon: b.icon, img: b.img, type: '建筑', source: b.desc, use: b.reward })),
    ...DECOR_ITEMS.map(d => ({ id: `decor_${d.id}`, name: d.name, icon: d.icon, type: '建筑', source: d.desc, use: `放置成本：${Object.entries(d.cost).map(([key, value]) => `${ITEMS[key]?.[0] || key} ${value}`).join(' · ')}` })),
    ...GIFT_RULES.map(g => ({ id: `gift_${g.id}`, name: g.title, icon: g.icon, type: '真实礼物', source: g.target, use: g.desc })),
    ...HIDDEN_QUESTS.map(q => ({ ...q, type: '隐藏任务' })),
    { id: 'bells_bag', name: '铃钱袋', icon: '🔔', tier: '普通', type: '隐藏任务', source: '挑战难度完整完成。', use: '获得额外铃钱。' },
    { id: 'trophy_golden_leaf', name: '金叶奖杯登记', icon: '🍂', tier: '普通', type: '隐藏任务', source: '在背包中使用金色树叶。', use: '登记到博物馆奖杯记录。' },
    { id: 'festival_new_year', name: '新年烟花', icon: '🎆', type: '隐藏任务', source: '新年当天打卡。', use: '节日限定记录。' },
    { id: 'festival_valentine', name: '心意巧克力', icon: '💝', type: '隐藏任务', source: '情人节当天打卡。', use: '节日限定记录。' },
    { id: 'festival_halloween', name: '南瓜灯', icon: '🎃', type: '隐藏任务', source: '万圣夜当天打卡。', use: '节日限定记录。' },
    { id: 'festival_toy_day', name: '玩具日包裹', icon: '🎁', type: '隐藏任务', source: '玩具日当天打卡。', use: '节日限定记录。' }
  ];
}

function showCollectionDetail(id) {
  const entry = getCollectionEntries().find(item => item.id === id);
  if (!entry) return;
  const found = collection.discovered.includes(entry.id);
  if (!found && entry.type === '隐藏任务') return;
  document.getElementById('itemDetailIcon').innerHTML = found ? iconMarkup(entry, entry.icon) : '？';
  document.getElementById('itemDetailTitle').textContent = found ? entry.name : '未发现项目';
  document.getElementById('itemDetailMeta').innerHTML = `
    类型：${entry.type}<br>
    ${entry.tier ? `层级：${entry.tier}<br>` : ''}
    状态：${found ? '已发现' : '未发现'}<br>
    来源：${escapeHtml(entry.source || '继续训练和探索岛屿。')}<br>
    用途：${escapeHtml(entry.use || '补齐图鉴记录。')}
  `;
  configureItemUseButton(null);
  document.getElementById('itemDetailModal').classList.add('show');
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
  configureItemUseButton(key);
  document.getElementById('itemDetailModal').classList.add('show');
}

function configureItemUseButton(key) {
  const btn = document.getElementById('itemUseBtn');
  if (!btn) return;
  btn.dataset.item = key || '';
  const action = key ? useItemAction(key) : null;
  if (!action) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  btn.textContent = action.label;
  btn.disabled = !action.enabled;
}

function useItemAction(key) {
  const count = inventory[key] || 0;
  if (key === 'nookMilesTicket') return { label: '使用 1 张查看线索', enabled: count > 0 };
  if (key === 'bells') return { label: '去岛屿装饰工坊', enabled: true };
  if (['wood','stone','shell','ironNugget','softwood','hardwood','weed'].includes(key)) return { label: '去岛屿建设', enabled: true };
  if (key === 'starFragment') return { label: '点亮星星地砖', enabled: count > 0 };
  if (key === 'goldenLeaf') return { label: '登记金叶奖杯', enabled: count > 0 };
  return null;
}

async function handleUseItem(key) {
  if (!key) return;
  if (key === 'nookMilesTicket') {
    await revealExtraBottleClue();
    return;
  }
  if (key === 'starFragment') {
    if ((inventory.starFragment || 0) <= 0) return;
    const rollback = createArchivePayload();
    discover('decor_star_tile');
    saveLocal();
    const synced = await syncMyState();
    if (!synced) {
      applyArchivePayload(rollback);
      showToast('同步失败，星星碎片还没有使用');
      renderCollection();
      return;
    }
    showToast('星星地砖图鉴已点亮');
    renderCollection();
    return;
  }
  if (key === 'goldenLeaf') {
    if ((inventory.goldenLeaf || 0) <= 0) return;
    const rollback = createArchivePayload();
    discover('trophy_golden_leaf');
    saveLocal();
    const synced = await syncMyState();
    if (!synced) {
      applyArchivePayload(rollback);
      showToast('同步失败，金色树叶还没有登记');
      renderCollection();
      return;
    }
    showToast('金色树叶已登记到博物馆');
    renderCollection();
    return;
  }
  activeView = 'island';
  document.getElementById('itemDetailModal').classList.remove('show');
  renderView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getItemUse(key) {
  if (['wood','stone','shell','ironNugget'].includes(key)) return '用途：可进入共同仓库，推进小基地建设。';
  if (key === 'bells') return '用途：作为每次训练结算的积分化奖励，也可前往岛屿装饰工坊。';
  if (key === 'nookMilesTicket') return '用途：查看瓶中信额外线索，探索隐藏任务。';
  if (key === 'starFragment') return '用途：记录夜间隐藏任务，可点亮星星地砖。';
  if (key === 'goldenLeaf') return '用途：登记金叶奖杯，推进博物馆收藏。';
  return '用途：补齐图鉴，作为训练出现的纪念。';
}

function showDayDetail(index) {
  const baseDay = allDays[index];
  if (!baseDay) return;
  const state = getDayState(index);
  const day = getDifficultyDay(baseDay, state.difficulty || selectedDifficulty);
  const total = day.exercises.length || 0;
  const done = state.checked.size;
  const diff = DIFFICULTIES[state.difficulty || selectedDifficulty] || DIFFICULTIES.standard;
  let status = '未记录';
  if (state.missed) status = '今天休息';
  else if (state.settled && done >= total) status = '完整完成';
  else if (state.settled) status = `今天到这 ${done}/${total}`;
  const rewards = (state.rewards || []).map(key => ITEMS[key]?.[0] || key).join('、') || '无';
  const hidden = (state.hiddenTasks || []).map(key => getDiscoveryMeta(key).name || key).join('、') || '无';
  const legacyMode = state.planMode && state.planMode !== 'standard' ? (PLAN_MODES[state.planMode]?.label || state.planMode) : '';
  const actions = day.exercises.map((ex, i) => `${state.checked.has(i) ? '✓' : '○'} ${ex[0]} · ${ex[1]}`).join('<br>');
  document.getElementById('dayDetailTitle').textContent = `${getWeekdayLabel(day.dayInWeek)} · ${day.title}`;
  document.getElementById('dayDetailMeta').innerHTML = `
    状态：${status}<br>
    难度：${diff.label}<br>
    今日内容：${day.variantLabel}<br>
    ${legacyMode ? `旧路线：${legacyMode}<br>` : ''}
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
    const d = getDifficultyDay(week.days[di], ds.difficulty || selectedDifficulty);
    if (ds.settled && ds.checked.size >= d.exercises.length) { fullDone++; appeared++; chips.push('<span class="review-chip done"></span>'); }
    else if (ds.settled) { appeared++; chips.push('<span class="review-chip appeared"></span>'); }
    else if (ds.missed) { chips.push('<span class="review-chip rest"></span>'); }
    else { chips.push('<span class="review-chip missed"></span>'); }
  }
  const insights = getWeeklyReviewInsights(wi);
  const rows = [
    ['周期', `第 ${wi+1} 周 · ${week.theme}`, dayCount + ' 天'],
    ['出现', `${appeared}/${dayCount} 天`, appeared >= dayCount ? '✓' : '继续'],
    ['完成', `${fullDone}/${dayCount} 天`, chips.join('')],
    ['最稳', insights.bestDay.label, insights.bestDay.detail],
    ['最弱', insights.weakest.label, insights.weakest.detail],
    ['下周建议', insights.nextAdvice.label, insights.nextAdvice.detail],
    ['连续', `${calcStreak()} 天`, ''],
  ];
  rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td>`; body.appendChild(tr); });
}

function getWeeklyReviewInsights(weekIndex) {
  const week = plan.weeks[weekIndex];
  const dayStats = [];
  const categoryStats = {};
  let handledDays = 0;
  let totalChecked = 0;
  let totalExercises = 0;
  week.days.forEach((day, dayInWeek) => {
    const gi = getGlobalIndex(weekIndex, dayInWeek);
    const state = getDayState(gi);
    if (!state.settled && !state.missed) return;
    handledDays++;
    const variantDay = getDifficultyDay(day, state.difficulty || selectedDifficulty);
    const exercises = variantDay.exercises || [];
    const checkedCount = state.settled ? state.checked.size : 0;
    totalChecked += checkedCount;
    totalExercises += exercises.length;
    dayStats.push({
      label: `${getWeekdayLabel(dayInWeek)} · ${day.title}`,
      checked: checkedCount,
      total: exercises.length,
      settled: !!state.settled,
      missed: !!state.missed,
      pct: exercises.length ? checkedCount / exercises.length : 0
    });
    exercises.forEach((exercise, index) => {
      const category = normalizeExerciseCategory(exercise);
      if (!categoryStats[category]) categoryStats[category] = { checked: 0, total: 0 };
      categoryStats[category].total += 1;
      if (state.settled && state.checked.has(index)) categoryStats[category].checked += 1;
    });
  });
  const best = dayStats
    .filter(item => item.settled)
    .sort((a, b) => b.pct - a.pct || b.checked - a.checked)[0];
  const weakestEntry = Object.entries(categoryStats)
    .filter(([, stat]) => stat.total > 0)
    .map(([name, stat]) => ({ name, ...stat, pct: stat.checked / stat.total }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total)[0];
  const completionRate = totalExercises ? totalChecked / totalExercises : 0;
  const bestDay = best
    ? { label: best.label, detail: `${best.checked}/${best.total} 个动作` }
    : { label: '还没有记录', detail: '完成一次后会自动分析' };
  const weakest = weakestEntry
    ? { label: weakestEntry.name, detail: `${weakestEntry.checked}/${weakestEntry.total} 次完成` }
    : { label: '暂无', detail: '记录更多动作后会出现趋势' };
  let advice = '下周先守住出现，不急着加量';
  if (handledDays >= week.days.length && completionRate >= 0.85) advice = '下周可以尝试多一次挑战难度';
  else if (weakestEntry && weakestEntry.pct < 0.5) advice = `下周把“${weakestEntry.name}”降一点量，先做完`;
  else if (completionRate >= 0.65) advice = '下周保持标准难度，优先稳定完成';
  return {
    bestDay,
    weakest,
    nextAdvice: { label: advice, detail: `${Math.round(completionRate * 100)}% 完成率` }
  };
}

function normalizeExerciseCategory(exercise) {
  const tag = String(exercise?.[2] || '').trim();
  const name = String(exercise?.[0] || '').trim();
  const text = `${name} ${tag}`;
  if (/热身|踏步|慢走|散步|开合跳|高抬腿|扩胸|肩部环绕|手臂画圈/.test(text)) return '热身入口';
  if (/收尾|放松|拉伸|猫牛|坐姿前屈|鸽子|髋部|小腿|肩颈/.test(text)) return '收尾放松';
  if (/腿|下肢|单腿|深蹲|弓步|静蹲/.test(text)) return '腿部';
  if (/上身|俯卧撑|推/.test(text)) return '上身';
  if (/核心|腹|平板|侧桥|死虫|鸟狗|俄罗斯|自行车|登山者|抬腿/.test(text)) return '核心';
  if (/后侧|臀|超人/.test(text)) return '后侧';
  return tag || String(exercise?.[0] || '其他');
}

function calcStreak() {
  let s = 0;
  for (let i = allDays.length - 1; i >= 0; i--) { if (getDayState(i).settled) s++; else if (!getDayState(i).missed) break; }
  return s;
}

function getUserTitle(participant) {
  const states = participant.dayStates || {};
  const settled = countSettledStates(states);
  const challengeFull = Object.values(states).filter((s, index) => {
    const total = getDifficultyDay(allDays[index], s?.difficulty || 'challenge')?.exercises?.length || 0;
    const checked = Array.isArray(s?.checked) ? s.checked.length : s?.checked?.size || 0;
    return s?.settled && s.difficulty === 'challenge' && checked >= total;
  }).length;
  if (sumCounts(participant.warehouseContribution || {}) >= 20) return '建设代表';
  if ((participant.collection?.discovered || []).includes('same_day_checkin')) return '同日岛民';
  if (challengeFull >= 3) return '挑战岛民';
  if (settled >= 7) return '常驻岛民';
  if (settled >= 3) return '上岛新星';
  return '新岛民';
}

function getFestivalToday() {
  const md = getDateKey().slice(5);
  const table = {
    '01-01': { id: 'festival_new_year', name: '新年烟花', reward: 'nookMilesTicket', text: '新年登岛，码头送来一张里数券。' },
    '02-14': { id: 'festival_valentine', name: '心意巧克力', reward: 'bells', text: '今天的留言板适合放一颗心意。' },
    '10-31': { id: 'festival_halloween', name: '南瓜灯', reward: 'clay', text: '万圣夜的小基地多了一点装饰材料。' },
    '12-25': { id: 'festival_toy_day', name: '玩具日包裹', reward: 'starFragment', text: '玩具日包裹落到岛上。' }
  };
  return table[md] || null;
}

function applyFestivalBonus(options = {}) {
  const { notify = true } = options;
  const festival = getFestivalToday();
  const state = getDayState(currentDayIndex);
  if (!festival || !state.settled || collection.discovered.includes(festival.id)) return null;
  collection.discovered.push(festival.id);
  inventory[festival.reward] = (inventory[festival.reward] || 0) + 1;
  if (notify) showToast(`${festival.name}：${festival.text}`);
  return festival;
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
      const archiveDay = getDifficultyDay(d, ds.difficulty || selectedDifficulty);
      if (ds.settled && ds.checked.size >= archiveDay.exercises.length) cls = 'done';
      else if (ds.settled) cls = 'appeared';
      else if (ds.missed) cls = 'rest';
      else if (gi < currentDayIndex) cls = 'missed';
      const row = document.createElement('div');
      row.className = 'archive-day-row';
      row.innerHTML = `<div class="archive-day-num ${cls}">${di+1}</div><span>${d.title}</span><span style="margin-left:auto;color:var(--animal-text-color-muted);font-size:12px">${archiveDay.minutes || 0}min</span>`;
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
  const materialCount = diff.baseRewards + (fullDone ? diff.fullBonus : 0);
  const rewards = chooseRewards(difficulty, materialCount, currentDayIndex, day);
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
  applyFestivalBonus({ notify: false });
}

function chooseRewards(difficulty, count, seed = currentDayIndex, day = null) {
  const pool = buildRewardPoolForDay(difficulty, day);
  const rewards = [];
  for (let i = 0; i < count; i++) rewards.push(pool[(seed + i) % pool.length]);
  return rewards;
}

function buildRewardPoolForDay(difficulty, day = null) {
  const diffPool = (DIFFICULTIES[difficulty] || DIFFICULTIES.standard).rewardPool || DIFFICULTIES.standard.rewardPool;
  const themePool = getTrainingRewardPool(day);
  const merged = [...themePool, ...diffPool];
  const allowed = getAllowedRewardsForDifficulty(difficulty);
  const filtered = merged.filter(item => allowed.includes(item));
  return [...new Set(filtered.length ? filtered : diffPool)];
}

function getTrainingRewardPool(day = null) {
  if (!day?.exercises?.length) return TRAINING_REWARD_POOLS['全身'];
  const counts = {};
  day.exercises.forEach(exercise => {
    const category = normalizeExerciseCategory(exercise);
    counts[category] = (counts[category] || 0) + 1;
  });
  const ranked = Object.entries(counts)
    .filter(([category]) => category !== '热身入口' && category !== '收尾放松')
    .sort((a, b) => b[1] - a[1]);
  const primary = ranked[0]?.[0] || (counts['收尾放松'] ? '收尾放松' : '热身入口');
  const secondary = ranked[1]?.[0];
  return [
    ...(TRAINING_REWARD_POOLS[primary] || TRAINING_REWARD_POOLS['全身']),
    ...(secondary ? TRAINING_REWARD_POOLS[secondary] || [] : [])
  ];
}

function getAllowedRewardsForDifficulty(difficulty) {
  if (difficulty === 'easy') return ['branch', 'weed', 'shell', 'wood', 'softwood', 'stone'];
  if (difficulty === 'challenge') return ['wood', 'softwood', 'hardwood', 'stone', 'ironNugget', 'clay', 'bells', 'nookMilesTicket'];
  return ['wood', 'softwood', 'hardwood', 'stone', 'shell', 'clay'];
}

function rewardCounts(rewards, score) {
  const out = { bells: score * 100 };
  rewards.forEach(r => {
    switch (r) {
      case 'bells':
        out.bells += getBellsRewardValue(score);
        break;
      default:
        out[r] = (out[r] || 0) + 1;
    }
  });
  return out;
}

function getBellsRewardValue(score) {
  return Math.max(500, score * 100);
}

function warehouseCounts(rewards) {
  const out = {};
  rewards.forEach(r => { if (['wood','shell','stone','ironNugget'].includes(r)) out[r] = (out[r] || 0) + 1; });
  return out;
}

function detectHiddenTasks(difficulty, day, fullDone) {
  const tasks = [];
  const hour = new Date().getHours();
  if (hour >= 20 || hour < 5) tasks.push('night_star');
  if (difficulty === 'challenge' && fullDone) tasks.push('bells_bag');
  if (day.review && fullDone) tasks.push('museum_entry');
  if (difficulty === 'easy' && fullDone && countFullDifficulty('easy') >= 3) tasks.push('goldenLeaf');
  if (difficulty === 'easy' && fullDone && countFullDifficulty('easy') >= 7) tasks.push('golden_resident_card');
  if (difficulty === 'standard' && fullDone && countFullDifficulty('standard') >= 5) tasks.push('steady_builder');
  if (difficulty === 'challenge' && fullDone && countFullDifficulty('challenge') >= 3) tasks.push('challenge_islander');
  if (difficulty === 'standard' && fullDone && hasPeerSettledTodayWithDifficulty('standard', true)) tasks.push('coop_wood_sign');
  if (difficulty === 'challenge' && fullDone && (hour >= 20 || hour < 5) && countFullDifficulty('challenge') >= 2) tasks.push('observatory_permit');
  if (difficulty === 'challenge' && fullDone && hasPeerSettledTodayWithDifficulty('challenge', true)) tasks.push('secret_pier_parcel');
  if (hasPeerSettledToday()) tasks.push('same_day_checkin');
  const uniqueTasks = [...new Set(tasks)].filter(id => !collection.discovered.includes(id));
  uniqueTasks.forEach(applyHiddenTaskEffect);
  return uniqueTasks;
}

function applyHiddenTaskEffect(id) {
  if (id === 'goldenLeaf') inventory.goldenLeaf = (inventory.goldenLeaf || 0) + 1;
  if (id === 'golden_resident_card') inventory.goldenLeaf = (inventory.goldenLeaf || 0) + 1;
  if (id === 'same_day_checkin') inventory.nookMilesTicket = (inventory.nookMilesTicket || 0) + 1;
  if (id === 'night_star') inventory.starFragment = (inventory.starFragment || 0) + 1;
  if (id === 'bells_bag') inventory.bells = (inventory.bells || 0) + 1000;
  if (id === 'steady_builder') addCounts(warehouseContribution, { wood: 3 });
  if (id === 'challenge_islander') discover('gift_wish_pick');
  if (id === 'coop_wood_sign') discover('decor_flower_sign');
  if (id === 'observatory_permit') discover('decor_star_tile');
  if (id === 'secret_pier_parcel') discover('gift_weekend_gift');
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

function getCheckedCount(state) {
  return Array.isArray(state?.checked) ? state.checked.length : state?.checked?.size || 0;
}

function isStateFullDone(state, index) {
  const day = getDifficultyDay(allDays[index], state?.difficulty || selectedDifficulty);
  const total = day?.exercises?.length || 0;
  return !!state?.settled && total > 0 && getCheckedCount(state) >= total;
}

function countFullDifficulty(difficulty, states = dayStates) {
  return Object.entries(states || {}).filter(([index, state]) => state?.difficulty === difficulty && isStateFullDone(state, Number(index))).length;
}

function hasPeerSettledTodayWithDifficulty(difficulty, requireFull = false) {
  const today = getDateKey();
  return Object.values(peers).some(peer => Object.entries(peer.dayStates || {}).some(([index, state]) => {
    if (!state?.settled || state.difficulty !== difficulty) return false;
    const sameDate = state.settledDate ? state.settledDate === today : Number(index) === currentDayIndex;
    if (!sameDate) return false;
    return !requireFull || isStateFullDone(state, Number(index));
  }));
}

// ── Actions ──
async function handleSettle() {
  const rollback = createArchivePayload();
  const state = getDayState(currentDayIndex);
  if (state.settled || state.missed) return;
  if (!canCheckInDay(currentDayIndex)) {
    showToast(hasSettledToday() ? '今天已经盖章，明天再继续' : `今天只能打卡${getWeekdayLabel()}`);
    return;
  }
  state.difficulty = state.difficulty || selectedDifficulty;
  const day = getDifficultyDay(allDays[currentDayIndex], state.difficulty);
  if (!day) {
    showToast('今天的训练计划不存在，请刷新后重试');
    return;
  }
  const total = day.exercises.length;
  const beforeStages = getBuildStageSnapshot();
  if (state.checked.size === 0) { for (let i = 0; i < total; i++) state.checked.add(i); }
  trimCheckedToExerciseCount(state, total);
  state.settled = true;
  state.settledDate = getDateKey();
  applySettlementRewards(state, day);
  const buildUpdates = diffBuildStages(beforeStages, getBuildStageSnapshot());
  queuedBuildUpdates = buildUpdates;
  saveLocal();
  const synced = await syncMyState();
  if (!synced) {
    applyArchivePayload(rollback);
    queuedBuildUpdates = [];
    showToast('同步失败，今天还没有保存，请稍后重试');
    render();
    return;
  }
  if (state.checked.size === total) showRewardModal(state);
  else {
    showToast('今天到这，已结算');
    setTimeout(() => showBuildUpdateModal(queuedBuildUpdates), 700);
  }
  currentDayIndex = getAvailableDayIndex();
  render();
}

async function handleRestDay() {
  const rollback = createArchivePayload();
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
  const synced = await syncMyState();
  if (!synced) {
    applyArchivePayload(rollback);
    showToast('同步失败，休息记录还没有保存');
    render();
    return;
  }
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
      const meta = ITEMS[key] || getDiscoveryMeta(key);
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
    trimCheckedToExerciseCount(state, getDifficultyDay(allDays[currentDayIndex], selectedDifficulty).exercises.length);
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
document.getElementById('itemUseBtn')?.addEventListener('click', e => handleUseItem(e.currentTarget.dataset.item));
document.getElementById('dayDetailBtn').addEventListener('click', () => document.getElementById('dayDetailModal').classList.remove('show'));
document.getElementById('dayDetailModal').addEventListener('click', e => { if (e.target === e.currentTarget) document.getElementById('dayDetailModal').classList.remove('show'); });
document.getElementById('bottleBtn').addEventListener('click', () => document.getElementById('bottleModal').classList.remove('show'));
document.getElementById('bottleUseTicketBtn')?.addEventListener('click', revealExtraBottleClue);
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
document.getElementById('messageSaveBtn').addEventListener('click', async () => {
  const rollback = createArchivePayload();
  const previousMessage = userMessage;
  const input = document.getElementById('messageInput');
  userMessage = (input.value || '').trim().slice(0, 40);
  saveLocal();
  const patch = userMessage ? { mailboxEntry: { id: `mail_${Date.now()}_${clientId.slice(0, 6)}`, text: userMessage, createdAt: Date.now() } } : null;
  const ok = await syncMyState(patch);
  if (!ok) {
    applyArchivePayload(rollback);
    userMessage = previousMessage;
    if (input) input.value = previousMessage;
    renderMessageBoard();
    showToast('留言同步失败，请稍后再试');
    return;
  }
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

document.getElementById('giftDock')?.addEventListener('click', e => {
  const requestBtn = e.target.closest('[data-gift-request]');
  if (requestBtn) {
    handleGiftRequest(requestBtn.dataset.giftRequest);
    return;
  }
  const redeemBtn = e.target.closest('[data-gift-redeem]');
  if (redeemBtn) handleGiftRedeem(redeemBtn.dataset.giftRedeem);
});
document.getElementById('giftPeerDock')?.addEventListener('click', e => {
  const redeemBtn = e.target.closest('[data-gift-redeem]');
  if (redeemBtn) handleGiftRedeem(redeemBtn.dataset.giftRedeem);
});
document.getElementById('wishAddBtn')?.addEventListener('click', handleWishAdd);
document.getElementById('wishInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') handleWishAdd();
});
document.getElementById('wishList')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-wish-remove]');
  if (btn) handleWishRemove(Number(btn.dataset.wishRemove));
});
document.getElementById('decorGrid')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-decor-place]');
  if (btn) handlePlaceDecor(btn.dataset.decorPlace);
});
document.getElementById('weeklySettleBtn')?.addEventListener('click', handleWeeklySettlement);

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
  reader.onload = async () => {
    const rollback = createArchivePayload();
    try {
      const payload = JSON.parse(String(reader.result || ''));
      applyArchivePayload(payload);
      findTodayIndex();
      saveLocal();
      const synced = await syncMyState();
      if (!synced) {
        applyArchivePayload(rollback);
        render();
        showToast('存档同步失败，已恢复原状态');
        return;
      }
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
