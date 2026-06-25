import { describe, expect, it } from 'vitest';
import { computeLoginStreak, getLoginReward } from './login';

describe('computeLoginStreak', () => {
  it('首次登录 streak=1，无里程碑', () => {
    const r = computeLoginStreak({ lastLoginDate: undefined, loginStreak: 0, todayKey: '2026-06-24' });
    expect(r.loginStreak).toBe(1);
    expect(r.lastLoginDate).toBe('2026-06-24');
    expect(r.justLoggedIn).toBe(true);
    expect(r.milestone).toBeNull();
  });

  it('昨天登录过 → streak+1', () => {
    const r = computeLoginStreak({ lastLoginDate: '2026-06-23', loginStreak: 2, todayKey: '2026-06-24' });
    expect(r.loginStreak).toBe(3);
    expect(r.justLoggedIn).toBe(true);
    expect(r.milestone).toBe(3); // 命中 3 天里程碑
  });

  it('今天已登录过 → 不重复递增', () => {
    const r = computeLoginStreak({ lastLoginDate: '2026-06-24', loginStreak: 3, todayKey: '2026-06-24' });
    expect(r.loginStreak).toBe(3);
    expect(r.justLoggedIn).toBe(false);
    expect(r.milestone).toBeNull();
  });

  it('断签超过一天 → 重置为 1', () => {
    const r = computeLoginStreak({ lastLoginDate: '2026-06-20', loginStreak: 5, todayKey: '2026-06-24' });
    expect(r.loginStreak).toBe(1);
    expect(r.milestone).toBeNull();
  });

  it('命中 7 天里程碑', () => {
    const r = computeLoginStreak({ lastLoginDate: '2026-06-23', loginStreak: 6, todayKey: '2026-06-24' });
    expect(r.loginStreak).toBe(7);
    expect(r.milestone).toBe(7);
  });

  it('跨月正确计算天数差', () => {
    // 5/31 → 6/1 应为连续（差 1 天）
    const r = computeLoginStreak({ lastLoginDate: '2026-05-31', loginStreak: 1, todayKey: '2026-06-01' });
    expect(r.loginStreak).toBe(2);
  });
});

describe('getLoginReward', () => {
  it('里程碑 3/7/14/30 各有奖励', () => {
    expect(getLoginReward(3)).not.toBeNull();
    expect(getLoginReward(7)).not.toBeNull();
    expect(getLoginReward(14)).not.toBeNull();
    expect(getLoginReward(30)).not.toBeNull();
  });
  it('非里程碑无奖励', () => {
    expect(getLoginReward(2)).toBeNull();
    expect(getLoginReward(5)).toBeNull();
  });
  it('7 天奖励比 3 天丰厚', () => {
    const r3 = getLoginReward(3)!;
    const r7 = getLoginReward(7)!;
    expect(r7.amount).toBeGreaterThan(r3.amount);
  });
});
