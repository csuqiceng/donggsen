import { describe, expect, it } from 'vitest';
import { buildWeeklyEvent, getWeeklyEventId, getWeeklySettlementStatus } from './settlement';

describe('getWeeklySettlementStatus', () => {
  it('已结算不允许', () => {
    expect(getWeeklySettlementStatus({ todayWeekday: 6, sundaySettled: true, sundayMissed: false, alreadySettled: true }).allowed).toBe(false);
  });
  it('非周日不允许', () => {
    expect(getWeeklySettlementStatus({ todayWeekday: 2, sundaySettled: true, sundayMissed: false, alreadySettled: false }).allowed).toBe(false);
  });
  it('周日未处理不允许', () => {
    expect(getWeeklySettlementStatus({ todayWeekday: 6, sundaySettled: false, sundayMissed: false, alreadySettled: false }).allowed).toBe(false);
  });
  it('周日已打卡允许', () => {
    expect(getWeeklySettlementStatus({ todayWeekday: 6, sundaySettled: true, sundayMissed: false, alreadySettled: false }).allowed).toBe(true);
  });
  it('周日休息也允许', () => {
    expect(getWeeklySettlementStatus({ todayWeekday: 6, sundaySettled: false, sundayMissed: true, alreadySettled: false }).allowed).toBe(true);
  });
});

describe('buildWeeklyEvent', () => {
  const insights = { bestDay: { label: '周一·腿部日', detail: '' }, weakest: { label: '腿部', detail: '' }, nextAdvice: { label: '保持', detail: '' } };

  it('生成周结算事件', () => {
    const event = buildWeeklyEvent({ weekIndex: 0, yearMonth: '2026-06', weeklyCheckins: 8, sameDay: 2, warehouseTotal: 20, insights, now: 1000 });
    expect(event.id).toBe('weekly_0_2026-06');
    expect(event.type).toBe('weekly');
    expect(event.title).toBe('第 1 周结算');
    expect(event.summary).toContain('8 次');
    expect(event.summary).toContain('周一·腿部日');
    expect(event.summary).toContain('保持');
    expect(event.createdAt).toBe(1000);
  });
});

describe('getWeeklyEventId', () => {
  it('按周序号与年月生成稳定 id', () => {
    expect(getWeeklyEventId(2, '2026-06')).toBe('weekly_2_2026-06');
  });
});
