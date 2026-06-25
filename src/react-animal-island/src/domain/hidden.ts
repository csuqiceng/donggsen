import type { Difficulty, PlanDay } from './types';

export interface HiddenContext {
  difficulty: Difficulty;
  day: PlanDay;
  fullDone: boolean;
  hour: number;
  countFullDifficulty: (difficulty: Difficulty) => number;
  hasPeerSettledToday: () => boolean;
  hasPeerSettledTodayWithDifficulty: (difficulty: Difficulty, requireFull: boolean) => boolean;
  discovered: string[];
}

export function detectHiddenTasks(ctx: HiddenContext): string[] {
  const tasks: string[] = [];
  const { difficulty, day, fullDone, hour } = ctx;
  if (hour >= 20 || hour < 5) tasks.push('night_star');
  if (difficulty === 'challenge' && fullDone) tasks.push('bells_bag');
  if (day.review && fullDone) tasks.push('museum_entry');
  if (difficulty === 'easy' && fullDone && ctx.countFullDifficulty('easy') >= 3) tasks.push('goldenLeaf');
  if (difficulty === 'easy' && fullDone && ctx.countFullDifficulty('easy') >= 7) tasks.push('golden_resident_card');
  if (difficulty === 'standard' && fullDone && ctx.countFullDifficulty('standard') >= 5) tasks.push('steady_builder');
  if (difficulty === 'challenge' && fullDone && ctx.countFullDifficulty('challenge') >= 3) tasks.push('challenge_islander');
  if (difficulty === 'standard' && fullDone && ctx.hasPeerSettledTodayWithDifficulty('standard', true)) tasks.push('coop_wood_sign');
  if (difficulty === 'challenge' && fullDone && (hour >= 20 || hour < 5) && ctx.countFullDifficulty('challenge') >= 2) tasks.push('observatory_permit');
  if (difficulty === 'challenge' && fullDone && ctx.hasPeerSettledTodayWithDifficulty('challenge', true)) tasks.push('secret_pier_parcel');
  if (ctx.hasPeerSettledToday()) tasks.push('same_day_checkin');
  return [...new Set(tasks)].filter(id => !ctx.discovered.includes(id));
}

export function applyHiddenTaskEffects(tasks: string[]): {
  inventoryDelta: Record<string, number>;
  warehouseDelta: Record<string, number>;
  discoveries: string[];
} {
  const inventoryDelta: Record<string, number> = {};
  const warehouseDelta: Record<string, number> = {};
  const discoveries: string[] = [];
  const addInv = (key: string, n: number) => { inventoryDelta[key] = (inventoryDelta[key] || 0) + n; };
  const addWh = (key: string, n: number) => { warehouseDelta[key] = (warehouseDelta[key] || 0) + n; };
  tasks.forEach(id => {
    if (id === 'goldenLeaf') addInv('goldenLeaf', 1);
    if (id === 'golden_resident_card') addInv('goldenLeaf', 1);
    if (id === 'same_day_checkin') addInv('nookMilesTicket', 1);
    if (id === 'night_star') addInv('starFragment', 1);
    if (id === 'bells_bag') addInv('bells', 1000);
    if (id === 'steady_builder') addWh('wood', 3);
    if (id === 'challenge_islander') discoveries.push('gift_wish_pick');
    if (id === 'coop_wood_sign') discoveries.push('decor_flower_sign');
    if (id === 'observatory_permit') discoveries.push('decor_star_tile');
    if (id === 'secret_pier_parcel') discoveries.push('gift_weekend_gift');
  });
  return { inventoryDelta, warehouseDelta, discoveries };
}

export interface RetroactiveContext {
  todaySettled: boolean;
  todayDifficulty: Difficulty;
  todayFullDone: boolean;
  hasPeerSettledToday: () => boolean;
  hasPeerSettledTodayWithDifficulty: (difficulty: Difficulty, requireFull: boolean) => boolean;
  alreadyDiscovered: string[];
}

export function retroactiveHiddenCheck(ctx: RetroactiveContext): string[] {
  if (!ctx.todaySettled) return [];
  const candidates: string[] = [];
  if (ctx.hasPeerSettledToday()) candidates.push('same_day_checkin');
  if (ctx.todayDifficulty === 'standard' && ctx.todayFullDone && ctx.hasPeerSettledTodayWithDifficulty('standard', true)) candidates.push('coop_wood_sign');
  if (ctx.todayDifficulty === 'challenge' && ctx.todayFullDone && ctx.hasPeerSettledTodayWithDifficulty('challenge', true)) candidates.push('secret_pier_parcel');
  return [...new Set(candidates)].filter(id => !ctx.alreadyDiscovered.includes(id));
}

// 当日隐藏任务聚合提示文案（与旧版 app.js getHiddenQuestHint 对齐）
export function getHiddenQuestHint(difficulty: Difficulty, day: PlanDay): string {
  if (day.review) return '周复盘日完成后，博物馆会新增一条图鉴记录。';
  if (difficulty === 'challenge') return '挑战完整完成会提高稀有隐藏和真实礼物资格。';
  if (difficulty === 'easy') return '轻松完整累计出现，会触发金色树叶和金色岛民证。';
  return '标准完整完成最稳定，双人同日标准会解锁合作木牌。';
}
