import type { Difficulty, FixedUserName, PlanMode } from './types';

export const ROOM_KEY = 'fitness-island-v1';
export const SYNC_API = '/api/state.php';
export const PLAN_URL = '/plan.json';
export const FIXED_USERS: FixedUserName[] = ['哥哥', '乖宝'];

export const AVATARS = [
  { id: 'alfonso', name: 'Alfonso', img: '/assets/acnh-avatars/alfonso.png' },
  { id: 'rosie', name: 'Rosie', img: '/assets/acnh-avatars/rosie.png' },
  { id: 'gulliver', name: 'Gulliver', img: '/assets/acnh-avatars/gulliver.png' },
  { id: 'isabelle', name: 'Isabelle', img: '/assets/acnh-avatars/isabelle.png' },
  { id: 'tom-nook', name: 'Tom Nook', img: '/assets/acnh-avatars/tom-nook.png' },
  { id: 'timmy-tommy', name: 'Timmy and Tommy', img: '/assets/acnh-avatars/timmy-tommy.png' },
];

export const DIFFICULTIES: Record<Difficulty, { label: string; hint: string; minutesFactor: number; bonus: number }> = {
  easy: { label: '轻松', hint: '保连续，少一点也算上岛。', minutesFactor: 0.55, bonus: 0 },
  standard: { label: '标准', hint: '按今天计划完成，奖励稳定。', minutesFactor: 1, bonus: 1 },
  challenge: { label: '挑战', hint: '状态好再选，今天会更累，奖励也更好。', minutesFactor: 1.25, bonus: 2 },
};

export const PLAN_MODES: Record<PlanMode, { label: string; hint: string; bonus: number }> = {
  recovery: { label: '恢复路线', hint: '只守住出现，适合状态一般的日子。', bonus: 0 },
  standard: { label: '建设路线', hint: '奖励偏向材料，推进小基地建设。', bonus: 1 },
  power: { label: '探险路线', hint: '奖励更多，也更适合寻找隐藏线索。', bonus: 2 },
};

export const ITEMS: Record<string, { name: string; emoji: string; img?: string }> = {
  branch: { name: '树枝', emoji: '🌿', img: '/assets/acnh-icons/branch.png' },
  wood: { name: '木材', emoji: '🪵', img: '/assets/acnh-icons/wood.png' },
  softwood: { name: '软木材', emoji: '🪵', img: '/assets/acnh-icons/softwood.png' },
  hardwood: { name: '硬木材', emoji: '🪵', img: '/assets/acnh-icons/hardwood.png' },
  stone: { name: '石头', emoji: '🪨', img: '/assets/acnh-icons/stone.png' },
  ironNugget: { name: '铁矿石', emoji: '⛏', img: '/assets/acnh-icons/ironNugget.png' },
  clay: { name: '黏土', emoji: '🧱', img: '/assets/acnh-icons/clay.png' },
  weed: { name: '杂草', emoji: '☘', img: '/assets/acnh-icons/weed.png' },
  shell: { name: '贝壳', emoji: '🐚', img: '/assets/acnh-icons/shell.png' },
  starFragment: { name: '星星碎片', emoji: '⭐', img: '/assets/acnh-icons/starFragment.png' },
  bells: { name: '铃钱', emoji: '🔔', img: '/assets/acnh-icons/bells.png' },
  nookMilesTicket: { name: '里数券', emoji: '🎫', img: '/assets/acnh-icons/nookMilesTicket.png' },
  goldenLeaf: { name: '金色树叶', emoji: '🍂' },
};

export const REWARD_POOL = ['branch', 'wood', 'softwood', 'hardwood', 'stone', 'clay', 'weed', 'shell'];

export const BUILDINGS = [
  { id: 'resident_services_tent', name: '服务处帐篷', icon: '⛺', need: 0, metric: 'checkins', coopNeed: 0, x: 28, y: 45, desc: '小基地的入口，记录两个人今天有没有登岛。', reward: '默认开放，负责查看今日状态。' },
  { id: 'storage', name: '收纳仓库', icon: '📦', need: 3, metric: 'checkins', coopNeed: 1, x: 22, y: 30, desc: '把打卡得到的木材、石头和贝壳存进共同仓库。', reward: '累计打卡 3 天后开放仓库进度。' },
  { id: 'nook_stop', name: '狸端机', icon: '🏧', need: 5, metric: 'checkins', coopNeed: 1, x: 72, y: 34, desc: '用连续出现换里数券，适合当作双人同日登岛奖励。', reward: '累计打卡 5 天后开放里数券提示。' },
  { id: 'museum', name: '博物馆', icon: '🏛', need: 10, metric: 'collection', coopNeed: 2, x: 64, y: 65, desc: '收藏材料、建筑和隐藏任务，逐步补齐图鉴。', reward: '图鉴发现 10 项后解锁博物馆，需要两个人都贡献过。' },
  { id: 'pier', name: '海边码头', icon: '🌊', need: 120, metric: 'minutes', coopNeed: 2, x: 80, y: 78, desc: '训练分钟数累计到一定程度后，海边会出现新的奖励点。', reward: '累计训练 120 分钟后开放码头，需要两个人都登岛过。' },
];

export const GIFT_RULES = [
  { id: 'milk_tea', title: '奶茶券', icon: '🧋', target: '个人完成 3 次打卡。' },
  { id: 'dinner_together', title: '一起吃饭券', icon: '🍲', target: '双人同日登岛 2 次。' },
  { id: 'weekend_gift', title: '周末小礼物', icon: '🎁', target: '本周两人合计完成 8 次。' },
  { id: 'wish_pick', title: '任选心愿一次', icon: '🌟', target: '挑战难度完整完成 3 次。' },
  { id: 'welcome_back', title: '欢迎回岛礼', icon: '🌈', target: '休息记录后再次完成一次。' },
  { id: 'base_decor', title: '小基地装修礼', icon: '🏡', target: '共同仓库材料达到 30。' },
];

export const HIDDEN_QUESTS = [
  { id: 'night_star', name: '夜海星光', icon: '🌌', tier: '普通', source: '晚上 20 点后完成一次训练。', use: '点亮星星碎片和夜间图鉴。' },
  { id: 'same_day_checkin', name: '同日登岛', icon: '🤝', tier: '普通', source: '两个人同一天都完成打卡。', use: '触发双人同日奖励。' },
  { id: 'golden_leaf', name: '金色树叶', icon: '🍂', tier: '普通', source: '轻松难度完整完成。', use: '登记金色树叶纪念。' },
  { id: 'museum_entry', name: '博物馆图鉴条目', icon: '🏛', tier: '普通', source: '周复盘日完整完成。', use: '推进博物馆馆藏。' },
  { id: 'steady_builder', name: '稳定建设者', icon: '🧰', tier: '稀有', source: '共同仓库持续积累材料。', use: '补充小基地建设记录。' },
  { id: 'challenge_islander', name: '挑战岛民', icon: '💪', tier: '稀有', source: '挑战难度完整完成累计 3 次。', use: '解锁真实礼物“任选心愿一次”的资格。' },
];

export const DECOR_ITEMS = [
  { id: 'flower_sign', name: '花丛告示牌', icon: '🌼', cost: { wood: 1, weed: 2 }, x: 36, y: 49, desc: '给服务处旁边立一个小标记。' },
  { id: 'shell_lamp', name: '贝壳灯', icon: '🐚', cost: { shell: 2, stone: 1 }, x: 80, y: 62, desc: '晚上在海边亮起来。' },
  { id: 'camp_chair', name: '露营椅', icon: '🪑', cost: { wood: 2, softwood: 1 }, x: 43, y: 70, desc: '两个人的小基地休息点。' },
  { id: 'star_tile', name: '星星地砖', icon: '⭐', cost: { starFragment: 1, stone: 1 }, x: 57, y: 37, desc: '夜间彩蛋留下的闪光。' },
];
