import { describe, expect, it } from 'vitest';
import { applyFestivalBonus, getFestivalToday } from './festival';

describe('节日系统', () => {
  it('按月日返回今日节日', () => {
    expect(getFestivalToday(new Date(2026, 0, 1))?.id).toBe('festival_new_year');
    expect(getFestivalToday(new Date(2026, 0, 1))?.reward).toBe('nookMilesTicket');
    expect(getFestivalToday(new Date(2026, 1, 14))?.id).toBe('festival_valentine');
    expect(getFestivalToday(new Date(2026, 9, 31))?.id).toBe('festival_halloween');
    expect(getFestivalToday(new Date(2026, 11, 25))?.id).toBe('festival_toy_day');
  });

  it('普通日子无节日', () => {
    expect(getFestivalToday(new Date(2026, 6, 1))).toBeNull();
  });

  it('未结算时不发放节日奖励', () => {
    const festival = getFestivalToday(new Date(2026, 0, 1));
    expect(applyFestivalBonus(festival, false, [])).toBeNull();
  });

  it('已发现的节日不重复发放', () => {
    const festival = getFestivalToday(new Date(2026, 0, 1));
    expect(applyFestivalBonus(festival, true, ['festival_new_year'])).toBeNull();
  });

  it('结算后首次发放节日奖励与发现', () => {
    const festival = getFestivalToday(new Date(2026, 0, 1));
    expect(applyFestivalBonus(festival, true, [])).toEqual({ discovery: 'festival_new_year', reward: 'nookMilesTicket' });
  });
});
