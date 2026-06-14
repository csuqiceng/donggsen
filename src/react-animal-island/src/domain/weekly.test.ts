import { describe, expect, it } from 'vitest';
import { getWeeklyReviewInsights, normalizeExerciseCategory } from './weekly';
import type { DayState, TrainingPlan } from './types';

describe('normalizeExerciseCategory', () => {
  it('按动作名/标签归类身体部位', () => {
    expect(normalizeExerciseCategory(['深蹲', '10 次', '腿部'])).toBe('腿部');
    expect(normalizeExerciseCategory(['热身踏步', '1 分钟', '热身入口'])).toBe('热身入口');
    expect(normalizeExerciseCategory(['拉伸', '1 分钟', '收尾放松'])).toBe('收尾放松');
    expect(normalizeExerciseCategory(['俯卧撑', '10 次', '上身'])).toBe('上身');
    expect(normalizeExerciseCategory(['平板支撑', '30 秒', '核心'])).toBe('核心');
  });
});

describe('getWeeklyReviewInsights', () => {
  const plan: TrainingPlan = {
    weeks: [{
      theme: '第一周',
      days: [{
        title: '腿部日',
        minutes: 10,
        exercises: [['热身踏步', '1 分钟', '热身入口'], ['深蹲', '10 次', '腿部']],
      }],
    }],
  };

  it('找出完成率最低的部位并给出降量建议', () => {
    const dayStates: Record<string, DayState> = {
      day_0: { settled: true, checked: [true, false], difficulty: 'standard' },
    };
    const insights = getWeeklyReviewInsights(plan, 0, dayStates, 'standard');
    expect(insights).not.toBeNull();
    expect(insights!.weakest.label).toBe('腿部');
    expect(insights!.bestDay.detail).toBe('1/2 个动作');
    expect(insights!.nextAdvice.label).toContain('腿部');
    expect(insights!.nextAdvice.detail).toContain('50%');
  });

  it('高完成率且整周处理完给出挑战建议', () => {
    const dayStates: Record<string, DayState> = {
      day_0: { settled: true, checked: [true, true], difficulty: 'standard' },
    };
    const insights = getWeeklyReviewInsights(plan, 0, dayStates, 'standard');
    expect(insights!.nextAdvice.label).toContain('挑战');
    expect(insights!.nextAdvice.detail).toContain('100%');
  });

  it('没有处理记录返回空提示', () => {
    const insights = getWeeklyReviewInsights(plan, 0, {}, 'standard');
    expect(insights!.bestDay.label).toBe('还没有记录');
  });
});
