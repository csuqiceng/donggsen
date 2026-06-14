import { describe, expect, it } from 'vitest';
import { calcStreak, canCheckInDay, createInitialState, flattenPlanDays, formatTodayDate, getAvailableDayIndex, getDateKey, hasSettledToday, isLockedDay, settleToday, toggleTask } from './training';
import type { TrainingPlan } from './types';

const plan: TrainingPlan = {
  weeks: [{
    theme: '第一周',
    signal: '启动',
    days: [{
      title: 'Day 1',
      minutes: 12,
      exercises: [['热身', '1 分钟', '热身入口'], ['深蹲', '10 次', '腿部'], ['拉伸', '1 分钟', '收尾放松']],
    }],
  }],
};

describe('训练状态', () => {
  it('把旧 plan.json 周结构展平成可渲染天列表', () => {
    const days = flattenPlanDays(plan);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ title: 'Day 1', weekIndex: 0, dayInWeek: 0, weekTheme: '第一周' });
  });

  it('任务勾选不会改变旧 dayStates 的 key 结构', () => {
    const state = createInitialState('哥哥');
    const next = toggleTask(state, 'day_0', 1, 3);
    expect(next.dayStates.day_0.checked).toEqual([false, true, false]);
  });

  it('结算当天会写入奖励、背包、仓库和图鉴', () => {
    const state = createInitialState('乖宝');
    const checked = toggleTask(toggleTask(toggleTask(state, 'day_0', 0, 3), 'day_0', 1, 3), 'day_0', 2, 3);
    const settled = settleToday(checked, 'day_0', flattenPlanDays(plan)[0]);

    expect(settled.dayStates.day_0.settled).toBe(true);
    // standard 腿部日完整完成：奖励池 [wood,stone,hardwood,softwood,shell,clay]，取前 3
    expect(settled.dayStates.day_0.rewards).toEqual(['wood', 'stone', 'hardwood']);
    expect(settled.inventory.wood).toBe(1);
    expect(settled.inventory.bells).toBe(600); // 分数 6 (3 勾 × 倍率 2) × 100
    expect(settled.warehouseContribution.wood).toBe(1);
    expect(settled.collection.discovered).toContain('wood');
    expect(settled.dayStates.day_0.settledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('按周几选择旧版可打卡日，周日进入第 7 天', () => {
    const state = createInitialState('哥哥');
    const planWithWeek: TrainingPlan = {
      weeks: [{
        theme: '出现',
        days: Array.from({ length: 7 }, (_, index) => ({
          title: `Day ${index + 1}`,
          minutes: 6,
          exercises: [['出现', '1 分钟', '入口']],
        })),
      }],
    };

    expect(getAvailableDayIndex(planWithWeek, state, new Date('2026-06-14T12:00:00'))).toBe(6);
  });

  it('格式化旧版 hero 日期文案', () => {
    expect(formatTodayDate(new Date('2026-06-14T12:00:00'))).toBe('2026 年 6 月 14 日 周日');
  });

  it('calcStreak 从最后一天往前数连续 settled，遇到未处理天中断', () => {
    expect(calcStreak({ day_0: { settled: true }, day_1: { settled: true }, day_2: { settled: true } }, 3)).toBe(3);
    // 最后一天未处理 → 立即中断
    expect(calcStreak({ day_0: { settled: true }, day_1: { settled: true } }, 3)).toBe(0);
    // 中间未处理：从后数 1 个后中断
    expect(calcStreak({ day_0: { settled: true }, day_2: { settled: true } }, 3)).toBe(1);
  });

  it('weekday lock：只能打卡今天对应的天，今天已结算则不可再打卡', () => {
    const planWithWeek: TrainingPlan = {
      weeks: [{
        theme: '出现',
        days: Array.from({ length: 7 }, (_, index) => ({
          title: `Day ${index + 1}`,
          minutes: 6,
          exercises: [['出现', '1 分钟', '入口']],
        })),
      }],
    };
    const state = createInitialState('哥哥');
    const today = new Date('2026-06-14T12:00:00'); // 周日 → available 6

    expect(canCheckInDay(6, planWithWeek, state, today)).toBe(true);
    expect(canCheckInDay(3, planWithWeek, state, today)).toBe(false);
    expect(isLockedDay(6, planWithWeek, state, today)).toBe(false);

    const settledToday = { ...state, dayStates: { day_6: { settled: true, settledDate: getDateKey(today) } } };
    expect(hasSettledToday(settledToday.dayStates, getDateKey(today))).toBe(true);
    expect(canCheckInDay(6, planWithWeek, settledToday, today)).toBe(false);
  });
});
