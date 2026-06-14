import { describe, expect, it } from 'vitest';
import { applyHiddenTaskEffects, detectHiddenTasks, retroactiveHiddenCheck, type HiddenContext, type RetroactiveContext } from './hidden';
import type { PlanDay } from './types';

function ctx(over: Partial<HiddenContext>): HiddenContext {
  return {
    difficulty: 'standard',
    day: { title: 'd', exercises: [] } as PlanDay,
    fullDone: false,
    hour: 12,
    countFullDifficulty: () => 0,
    hasPeerSettledToday: () => false,
    hasPeerSettledTodayWithDifficulty: () => false,
    discovered: [],
    ...over,
  };
}

describe('隐藏任务触发', () => {
  it('夜间(≥20 或 <5)触发 night_star', () => {
    expect(detectHiddenTasks(ctx({ hour: 21 }))).toContain('night_star');
    expect(detectHiddenTasks(ctx({ hour: 4 }))).toContain('night_star');
    expect(detectHiddenTasks(ctx({ hour: 12 }))).not.toContain('night_star');
  });

  it('挑战完整完成触发 bells_bag', () => {
    expect(detectHiddenTasks(ctx({ difficulty: 'challenge', fullDone: true }))).toContain('bells_bag');
  });

  it('轻松完整 3 次触发 goldenLeaf，7 次额外触发 golden_resident_card', () => {
    expect(detectHiddenTasks(ctx({ difficulty: 'easy', fullDone: true, countFullDifficulty: () => 3 }))).toContain('goldenLeaf');
    expect(detectHiddenTasks(ctx({ difficulty: 'easy', fullDone: true, countFullDifficulty: () => 7 }))).toContain('golden_resident_card');
  });

  it('标准完整 5 次触发 steady_builder', () => {
    expect(detectHiddenTasks(ctx({ difficulty: 'standard', fullDone: true, countFullDifficulty: () => 5 }))).toContain('steady_builder');
  });

  it('挑战完整 3 次触发 challenge_islander', () => {
    expect(detectHiddenTasks(ctx({ difficulty: 'challenge', fullDone: true, countFullDifficulty: () => 3 }))).toContain('challenge_islander');
  });

  it('标准 + 同伴标准完整触发 coop_wood_sign', () => {
    expect(detectHiddenTasks(ctx({ difficulty: 'standard', fullDone: true, hasPeerSettledTodayWithDifficulty: () => true }))).toContain('coop_wood_sign');
  });

  it('夜间挑战完整 2 次触发 observatory_permit', () => {
    expect(detectHiddenTasks(ctx({ difficulty: 'challenge', fullDone: true, hour: 21, countFullDifficulty: () => 2 }))).toContain('observatory_permit');
  });

  it('挑战 + 同伴挑战完整触发 secret_pier_parcel', () => {
    expect(detectHiddenTasks(ctx({ difficulty: 'challenge', fullDone: true, hasPeerSettledTodayWithDifficulty: () => true }))).toContain('secret_pier_parcel');
  });

  it('同伴今天结算触发 same_day_checkin', () => {
    expect(detectHiddenTasks(ctx({ hasPeerSettledToday: () => true }))).toContain('same_day_checkin');
  });

  it('已发现的任务不重复返回', () => {
    expect(detectHiddenTasks(ctx({ hour: 21, discovered: ['night_star'] }))).not.toContain('night_star');
  });
});

describe('隐藏任务奖励效果', () => {
  it('night_star 给星星碎片，bells_bag 给 1000 铃钱', () => {
    expect(applyHiddenTaskEffects(['night_star', 'bells_bag']).inventoryDelta).toEqual({ starFragment: 1, bells: 1000 });
  });

  it('steady_builder 给仓库 3 木材', () => {
    expect(applyHiddenTaskEffects(['steady_builder']).warehouseDelta).toEqual({ wood: 3 });
  });

  it('challenge_islander 解锁 gift_wish_pick 图鉴', () => {
    expect(applyHiddenTaskEffects(['challenge_islander']).discoveries).toContain('gift_wish_pick');
  });

  it('observatory_permit 解锁星星地砖图鉴', () => {
    expect(applyHiddenTaskEffects(['observatory_permit']).discoveries).toContain('decor_star_tile');
  });
});

function rc(over: Partial<RetroactiveContext>): RetroactiveContext {
  return {
    todaySettled: false,
    todayDifficulty: 'standard',
    todayFullDone: false,
    hasPeerSettledToday: () => false,
    hasPeerSettledTodayWithDifficulty: () => false,
    alreadyDiscovered: [],
    ...over,
  };
}

describe('追溯补发隐藏', () => {
  it('今天未结算不追溯', () => {
    expect(retroactiveHiddenCheck(rc({ todaySettled: false }))).toEqual([]);
  });

  it('同伴今天结算补发 same_day_checkin', () => {
    expect(retroactiveHiddenCheck(rc({ todaySettled: true, hasPeerSettledToday: () => true }))).toEqual(['same_day_checkin']);
  });

  it('standard 完整 + 同伴 standard 完整补发 coop_wood_sign', () => {
    expect(retroactiveHiddenCheck(rc({
      todaySettled: true,
      todayDifficulty: 'standard',
      todayFullDone: true,
      hasPeerSettledToday: () => true,
      hasPeerSettledTodayWithDifficulty: () => true,
    }))).toEqual(['same_day_checkin', 'coop_wood_sign']);
  });

  it('challenge 完整 + 同伴 challenge 完整补发 secret_pier_parcel', () => {
    expect(retroactiveHiddenCheck(rc({
      todaySettled: true,
      todayDifficulty: 'challenge',
      todayFullDone: true,
      hasPeerSettledToday: () => true,
      hasPeerSettledTodayWithDifficulty: () => true,
    }))).toEqual(['same_day_checkin', 'secret_pier_parcel']);
  });

  it('已发现的不重复补发', () => {
    expect(retroactiveHiddenCheck(rc({ todaySettled: true, hasPeerSettledToday: () => true, alreadyDiscovered: ['same_day_checkin'] }))).toEqual([]);
  });
});
