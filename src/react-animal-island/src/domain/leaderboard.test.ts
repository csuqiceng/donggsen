import { describe, expect, it } from 'vitest';
import { isOnline } from './leaderboard';

describe('在线状态', () => {
  it('2 分钟内活跃为在线', () => {
    expect(isOnline(1000, 61000)).toBe(true);
    expect(isOnline(1000, 121000)).toBe(false);
    expect(isOnline(0, 1000)).toBe(false);
  });
});
