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

export const DIFFICULTIES: Record<Difficulty, {
  label: string;
  hint: string;
  variantLabel: string;
  multiplier: number;
  rewardPool: string[];
  baseRewards: number;
  fullBonus: number;
  minutesFactor: number;
  bonus: number;
}> = {
  easy: { label: '轻松', hint: '保连续，少一点也算上岛。', variantLabel: '轻量版', multiplier: 1, rewardPool: ['branch', 'weed', 'shell', 'wood'], baseRewards: 1, fullBonus: 0, minutesFactor: 0.55, bonus: 0 },
  standard: { label: '标准', hint: '按今天计划完成，奖励稳定。', variantLabel: '建设版', multiplier: 2, rewardPool: ['wood', 'softwood', 'hardwood', 'stone', 'shell', 'clay'], baseRewards: 2, fullBonus: 1, minutesFactor: 1, bonus: 1 },
  challenge: { label: '挑战', hint: '状态好再选，今天会更累，奖励也更好。', variantLabel: '挑战版', multiplier: 3, rewardPool: ['wood', 'hardwood', 'stone', 'ironNugget', 'clay', 'bells', 'nookMilesTicket'], baseRewards: 3, fullBonus: 1, minutesFactor: 1.25, bonus: 2 },
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
  furniture: { name: '家具', emoji: '🪑' },
  house: { name: '房子', emoji: '🏠' },
  wooden_chair: { name: '木椅', emoji: '🪑', img: '/assets/acnh-icons/wooden_chair.webp' },
  wooden_table: { name: '木桌', emoji: '🍽️', img: '/assets/acnh-icons/wooden_table.webp' },
  bed: { name: '小床', emoji: '🛏️', img: '/assets/acnh-icons/bed.webp' },
  fence: { name: '木栅栏', emoji: '🚧', img: '/assets/acnh-icons/fence.webp' },
  flower_pot: { name: '花盆', emoji: '🪴', img: '/assets/acnh-icons/flower_pot.webp' },
  lamp: { name: '台灯', emoji: '💡', img: '/assets/acnh-icons/lamp.webp' },
  rug: { name: '地毯', emoji: '🟫', img: '/assets/acnh-icons/rug.webp' },
  shelf: { name: '书架', emoji: '📚', img: '/assets/acnh-icons/shelf.webp' },
};

export const REWARD_POOL = ['branch', 'wood', 'softwood', 'hardwood', 'stone', 'clay', 'weed', 'shell'];

export const TRAINING_REWARD_POOLS: Record<string, string[]> = {
  '热身入口': ['branch', 'weed', 'shell'],
  '收尾放松': ['weed', 'shell', 'branch'],
  '腿部': ['wood', 'stone', 'hardwood'],
  '上身': ['softwood', 'hardwood', 'wood'],
  '核心': ['stone', 'clay', 'wood'],
  '后侧': ['wood', 'softwood', 'stone'],
  '全身': ['wood', 'stone', 'clay'],
};

export const BUILDINGS = [
  { id: 'resident_services_tent', name: '服务处帐篷', icon: '⛺', need: 0, metric: 'checkins', coopNeed: 0, x: 42, y: 22, desc: '小基地的入口，记录两个人今天有没有登岛。', reward: '默认开放，负责查看今日状态。' },
  { id: 'workshop', name: '工坊', icon: '🛠', need: 0, metric: 'checkins', coopNeed: 0, x: 25, y: 55, desc: '消耗材料打造家具与房子，成品可摆放到岛上。', reward: '默认开放，主动合成家具与房子。' },
  { id: 'storage', name: '收纳仓库', icon: '📦', need: 3, metric: 'checkins', coopNeed: 1, x: 18, y: 25, desc: '把打卡得到的木材、石头和贝壳存进共同仓库。', reward: '累计打卡 3 天后开放仓库进度。' },
  { id: 'nook_stop', name: '狸端机', icon: '🏧', need: 5, metric: 'checkins', coopNeed: 1, x: 70, y: 28, desc: '用连续出现换里数券，适合当作双人同日登岛奖励。', reward: '累计打卡 5 天后开放里数券提示。' },
  { id: 'museum', name: '博物馆', icon: '🏛', need: 10, metric: 'collection', coopNeed: 2, x: 52, y: 52, desc: '收藏材料、建筑和隐藏任务，逐步补齐图鉴。', reward: '图鉴发现 10 项后解锁博物馆，需要两个人都贡献过。' },
  { id: 'pier', name: '海边码头', icon: '🌊', need: 120, metric: 'minutes', coopNeed: 2, x: 78, y: 62, desc: '训练分钟数累计到一定程度后，海边会出现新的奖励点。', reward: '累计训练 120 分钟后开放码头，需要两个人都登岛过。' },
];

export const GIFT_RULES = [
  { id: 'milk_tea', title: '奶茶券', icon: '🧋', scope: 'personal', desc: '连续出现的小奖励。', target: '个人完成 3 次打卡。' },
  { id: 'dinner_together', title: '一起吃饭券', icon: '🍲', scope: 'coop', desc: '两个人同一天都登岛后解锁。', target: '双人同日登岛 2 次。' },
  { id: 'weekend_gift', title: '周末小礼物', icon: '🎁', scope: 'coop', desc: '一周稳定出现的包裹。', target: '本周两人合计完成 8 次。' },
  { id: 'wish_pick', title: '任选心愿一次', icon: '🌟', scope: 'personal', desc: '挑战状态很好时使用。', target: '挑战难度完整完成 3 次。' },
  { id: 'welcome_back', title: '欢迎回岛礼', icon: '🌈', scope: 'personal', desc: '休息后回来也值得被看见。', target: '休息记录后再次完成一次。' },
  { id: 'base_decor', title: '小基地装修礼', icon: '🏡', scope: 'coop', desc: '共同仓库材料换一个真实小装饰。', target: '共同仓库材料达到 30。' },
];

export const HIDDEN_QUESTS = [
  { id: 'night_star', name: '夜海星光', icon: '⭐', tier: '普通', source: '20:00 后或 05:00 前完成训练。', use: '奖励星星碎片，可点亮星星地砖。' },
  { id: 'same_day_checkin', name: '同日登岛', icon: '🎫', tier: '普通', source: '两个人同一天都完成打卡。', use: '奖励里数券，用于瓶中信额外线索。' },
  { id: 'goldenLeaf', name: '金色树叶', icon: '🍂', tier: '普通', source: '轻松难度完整完成累计 3 次。', use: '登记金叶奖杯，也代表低压力连续出现。' },
  { id: 'museum_entry', name: '博物馆图鉴条目', icon: '🏛', tier: '普通', source: '周复盘日完整完成。', use: '补齐博物馆展柜。' },
  { id: 'steady_builder', name: '稳定建设', icon: '🔨', tier: '稀有', source: '标准难度完整完成累计 5 次。', use: '给共同仓库补 3 份木材，推进小基地建设。' },
  { id: 'challenge_islander', name: '挑战岛民', icon: '💪', tier: '稀有', source: '挑战难度完整完成累计 3 次。', use: '解锁真实礼物“任选心愿一次”的资格。' },
  { id: 'coop_wood_sign', name: '双人建设日', icon: '🪧', tier: '稀有', source: '两个人同一天都选择标准并完整完成。', use: '解锁合作木牌装饰图鉴。' },
  { id: 'observatory_permit', name: '观星台许可', icon: '🌌', tier: '传说', source: '夜间挑战完整完成累计 2 次。', use: '点亮观星台线索和星星地砖装饰。' },
  { id: 'secret_pier_parcel', name: '秘密码头包裹', icon: '📦', tier: '传说', source: '两个人同日挑战完整完成。', use: '解锁礼物码头高级包裹记录。' },
  { id: 'golden_resident_card', name: '金色岛民证', icon: '🪪', tier: '传说', source: '轻松难度完整完成累计 7 次。', use: '登记金色岛民证奖杯和头像框线索。' },
  { id: 'bottle_extra_clue', name: '瓶中信加急线索', icon: '💌', tier: '普通', source: '使用 1 张里数券查看额外线索。', use: '让里数券成为探索隐藏任务的入口。' },
];

export const DECOR_ITEMS = [
  { id: 'flower_sign', name: '花丛告示牌', icon: '🌼', cost: { wood: 1, weed: 2 }, x: 36, y: 49, desc: '给服务处旁边立一个小标记。' },
  { id: 'shell_lamp', name: '贝壳灯', icon: '🐚', cost: { shell: 2, stone: 1 }, x: 80, y: 62, desc: '晚上在海边亮起来。' },
  { id: 'camp_chair', name: '露营椅', icon: '🪑', cost: { wood: 2, softwood: 1 }, x: 43, y: 70, desc: '两个人的小基地休息点。' },
  { id: 'star_tile', name: '星星地砖', icon: '⭐', cost: { starFragment: 1, stone: 1 }, x: 57, y: 37, desc: '夜间彩蛋留下的闪光。' },
];

export const TROPHIES = [
  { id: 'first_checkin', name: '初次登岛', icon: '🏝', target: 1, desc: '完成 1 次打卡。' },
  { id: 'steady_three', name: '连续居民', icon: '🌱', target: 3, desc: '累计完成 3 次打卡。' },
  { id: 'resident_seven', name: '常驻岛民', icon: '🏡', target: 7, desc: '累计完成 7 次打卡。' },
  { id: 'same_day', name: '同日登岛', icon: '🎫', target: 1, desc: '触发双人同日登岛。' },
  { id: 'builder', name: '建设代表', icon: '🔨', target: 20, desc: '仓库贡献 20 份材料。' },
  { id: 'challenge_three', name: '挑战岛民', icon: '💪', target: 3, desc: '挑战难度完整完成 3 次。' },
  { id: 'gift_postman', name: '礼物邮差', icon: '🎁', target: 1, desc: '兑现 1 次真实礼物。' },
  { id: 'star_collector', name: '星夜收藏家', icon: '⭐', target: 1, desc: '获得星星碎片。' },
];
