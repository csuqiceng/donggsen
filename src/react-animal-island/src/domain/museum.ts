import { GIFT_RULES, HIDDEN_QUESTS, ITEMS, TROPHIES } from './config';
import { getItemSource, getItemUse } from './items';

export type MuseumRoomId = 'special' | 'hidden' | 'gift' | 'trophy';

export interface MuseumExhibit {
  id: string;
  room: MuseumRoomId;
  name: string;
  source: string;
  use: string;
  found: boolean;
  progressValue: number;
  progressTarget: number;
}

export interface MuseumContext {
  inventory: Record<string, number>;
  discovered: string[];
  giftProgress: (ruleId: string) => { value: number; target: number };
  trophyProgress: (id: string) => { value: number; target: number };
}

export const MUSEUM_ROOMS: Array<{ id: MuseumRoomId; name: string; icon: string }> = [
  { id: 'special', name: '特殊物品展厅', icon: '⭐' },
  { id: 'hidden', name: '隐藏传闻展厅', icon: '🔑' },
  { id: 'gift', name: '真实礼物展厅', icon: '🎁' },
  { id: 'trophy', name: '奖杯展厅', icon: '🏆' },
];

export function getMuseumExhibits(ctx: MuseumContext): MuseumExhibit[] {
  const special = (['ironNugget', 'clay', 'starFragment', 'nookMilesTicket', 'goldenLeaf'] as const)
    .filter(key => ITEMS[key])
    .map(key => {
      const found = (ctx.inventory[key] || 0) > 0 || ctx.discovered.includes(key);
      return {
        id: `museum_item_${key}`,
        room: 'special' as const,
        name: ITEMS[key].name,
        source: getItemSource(key),
        use: getItemUse(key),
        found,
        progressValue: found ? 1 : 0,
        progressTarget: 1,
      };
    });

  const hidden = HIDDEN_QUESTS
    .filter(quest => quest.tier !== '普通')
    .map(quest => {
      const found = ctx.discovered.includes(quest.id);
      return {
        id: `museum_hidden_${quest.id}`,
        room: 'hidden' as const,
        name: quest.name,
        source: quest.source,
        use: quest.use,
        found,
        progressValue: found ? 1 : 0,
        progressTarget: 1,
      };
    });

  const gifts = GIFT_RULES.map(rule => {
    const progress = ctx.giftProgress(rule.id);
    return {
      id: `museum_gift_${rule.id}`,
      room: 'gift' as const,
      name: rule.title,
      source: rule.target,
      use: rule.desc,
      found: ctx.discovered.includes(`gift_${rule.id}`),
      progressValue: progress.value,
      progressTarget: progress.target,
    };
  });

  const trophies = TROPHIES.map(trophy => {
    const progress = ctx.trophyProgress(trophy.id);
    return {
      id: `museum_trophy_${trophy.id}`,
      room: 'trophy' as const,
      name: trophy.name,
      source: trophy.desc,
      use: '登记到博物馆奖杯记录。',
      found: progress.value >= progress.target,
      progressValue: progress.value,
      progressTarget: progress.target,
    };
  });

  // 与旧版 app.js:2455-2460 对齐：铃钱袋 / 金叶奖杯登记 / 4 个节日条目（曾存在于图鉴）
  const extraDefs: Array<{ id: string; room: MuseumRoomId; name: string; icon?: string; source: string; use: string }> = [
    { id: 'bells_bag', room: 'special', name: '铃钱袋', source: '挑战难度完整完成。', use: '获得额外铃钱。' },
    { id: 'trophy_golden_leaf', room: 'trophy', name: '金叶奖杯登记', source: '在背包中使用金色树叶。', use: '登记到博物馆奖杯记录。' },
    { id: 'festival_new_year', room: 'hidden', name: '新年烟花', source: '新年当天打卡。', use: '节日限定记录。' },
    { id: 'festival_valentine', room: 'hidden', name: '心意巧克力', source: '情人节当天打卡。', use: '节日限定记录。' },
    { id: 'festival_halloween', room: 'hidden', name: '南瓜灯', source: '万圣夜当天打卡。', use: '节日限定记录。' },
    { id: 'festival_toy_day', room: 'hidden', name: '玩具日包裹', source: '玩具日当天打卡。', use: '节日限定记录。' },
  ];
  const extra = extraDefs.map(def => {
    const found = ctx.discovered.includes(def.id);
    return {
      id: `museum_extra_${def.id}`,
      room: def.room,
      name: def.name,
      source: def.source,
      use: def.use,
      found,
      progressValue: found ? 1 : 0,
      progressTarget: 1,
    };
  });

  return [...special, ...hidden, ...gifts, ...trophies, ...extra];
}

export function getMuseumRooms(ctx: MuseumContext) {
  const exhibits = getMuseumExhibits(ctx);
  return MUSEUM_ROOMS.map(room => {
    const entries = exhibits.filter(exhibit => exhibit.room === room.id);
    const found = entries.filter(exhibit => exhibit.found).length;
    const total = entries.length || 1;
    return { ...room, found, total: entries.length, pct: Math.round((found / total) * 100) };
  });
}
