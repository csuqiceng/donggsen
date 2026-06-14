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
      use: '训练成果可以变成真实的小礼物。',
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

  return [...special, ...hidden, ...gifts, ...trophies];
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
