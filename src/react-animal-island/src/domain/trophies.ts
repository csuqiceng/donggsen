import { TROPHIES } from './config';

export interface TrophyContext {
  settledDays: number;
  warehouseTotal: number;
  discovered: string[];
  starFragment: number;
  wishPickProgress: number;
  hasRedeemedGift: boolean;
}

export function getTrophyProgress(id: string, ctx: TrophyContext): { value: number; target: number } {
  if (id === 'first_checkin') return { value: Math.min(1, ctx.settledDays), target: 1 };
  if (id === 'steady_three') return { value: Math.min(3, ctx.settledDays), target: 3 };
  if (id === 'resident_seven') return { value: Math.min(7, ctx.settledDays), target: 7 };
  if (id === 'same_day') return { value: ctx.discovered.includes('same_day_checkin') ? 1 : 0, target: 1 };
  if (id === 'builder') return { value: Math.min(20, ctx.warehouseTotal), target: 20 };
  if (id === 'challenge_three') return { value: Math.min(3, ctx.wishPickProgress), target: 3 };
  if (id === 'gift_postman') return { value: ctx.hasRedeemedGift ? 1 : 0, target: 1 };
  if (id === 'star_collector') return { value: ctx.starFragment > 0 || ctx.discovered.includes('night_star') ? 1 : 0, target: 1 };
  return { value: 0, target: 1 };
}

export function getTrophyEntries(ctx: TrophyContext) {
  return TROPHIES.map(trophy => {
    const progress = getTrophyProgress(trophy.id, ctx);
    return { ...trophy, ...progress, found: progress.value >= progress.target };
  });
}
