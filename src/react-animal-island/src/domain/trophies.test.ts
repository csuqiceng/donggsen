import { describe, expect, it } from 'vitest';
import { getTrophyEntries, getTrophyProgress, type TrophyContext } from './trophies';

function ctx(over: Partial<TrophyContext> = {}): TrophyContext {
  return {
    settledDays: 0,
    warehouseTotal: 0,
    discovered: [],
    starFragment: 0,
    wishPickProgress: 0,
    hasRedeemedGift: false,
    ...over,
  };
}

describe('奖杯进度', () => {
  it('first_checkin 封顶 1', () => {
    expect(getTrophyProgress('first_checkin', ctx({ settledDays: 0 }))).toEqual({ value: 0, target: 1 });
    expect(getTrophyProgress('first_checkin', ctx({ settledDays: 5 }))).toEqual({ value: 1, target: 1 });
  });

  it('steady_three 封顶 3，resident_seven 封顶 7', () => {
    expect(getTrophyProgress('steady_three', ctx({ settledDays: 2 }))).toEqual({ value: 2, target: 3 });
    expect(getTrophyProgress('steady_three', ctx({ settledDays: 5 }))).toEqual({ value: 3, target: 3 });
    expect(getTrophyProgress('resident_seven', ctx({ settledDays: 9 }))).toEqual({ value: 7, target: 7 });
  });

  it('builder 封顶 20', () => {
    expect(getTrophyProgress('builder', ctx({ warehouseTotal: 10 }))).toEqual({ value: 10, target: 20 });
    expect(getTrophyProgress('builder', ctx({ warehouseTotal: 25 }))).toEqual({ value: 20, target: 20 });
  });

  it('challenge_three 用 wish_pick 进度封顶 3', () => {
    expect(getTrophyProgress('challenge_three', ctx({ wishPickProgress: 1 }))).toEqual({ value: 1, target: 3 });
    expect(getTrophyProgress('challenge_three', ctx({ wishPickProgress: 5 }))).toEqual({ value: 3, target: 3 });
  });

  it('same_day 依赖 same_day_checkin 发现', () => {
    expect(getTrophyProgress('same_day', ctx({ discovered: ['same_day_checkin'] }))).toEqual({ value: 1, target: 1 });
    expect(getTrophyProgress('same_day', ctx())).toEqual({ value: 0, target: 1 });
  });

  it('gift_postman 依赖已兑现礼物', () => {
    expect(getTrophyProgress('gift_postman', ctx({ hasRedeemedGift: true }))).toEqual({ value: 1, target: 1 });
  });

  it('star_collector 依赖星碎或 night_star 发现', () => {
    expect(getTrophyProgress('star_collector', ctx({ starFragment: 1 }))).toEqual({ value: 1, target: 1 });
    expect(getTrophyProgress('star_collector', ctx({ discovered: ['night_star'] }))).toEqual({ value: 1, target: 1 });
    expect(getTrophyProgress('star_collector', ctx())).toEqual({ value: 0, target: 1 });
  });

  it('getTrophyEntries 返回全部 8 个奖杯并标注 found', () => {
    const entries = getTrophyEntries(ctx({
      settledDays: 7,
      warehouseTotal: 20,
      wishPickProgress: 3,
      hasRedeemedGift: true,
      discovered: ['same_day_checkin', 'night_star'],
    }));
    expect(entries).toHaveLength(8);
    expect(entries.filter(e => e.found)).toHaveLength(8);
  });
});
