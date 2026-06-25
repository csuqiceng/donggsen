import { describe, expect, it } from 'vitest';
import {
  applyArchivePayload,
  createArchiveRows,
  createArchivePayload,
  createDayDetail,
  createTrainingExportText,
} from './archive';
import { createInitialState } from './training';
import type { TrainingPlan } from './types';

const plan: TrainingPlan = {
  weeks: [
    {
      theme: '唤醒周',
      signal: '今天来岛上走走。',
      days: [
        { title: '唤醒身体', minutes: 12, exercises: [['原地踏步', '2 分钟', '热身入口'], ['靠墙静蹲', '15 秒 × 2', '腿部']] },
        { title: '轻松建设', minutes: 10, exercises: [['散步', '5 分钟', '热身入口']] },
      ],
    },
  ],
};

describe('archive compatibility', () => {
  it('导出旧版兼容的 version 3 存档结构', () => {
    const state = {
      ...createInitialState('哥哥'),
      avatar: 'rosie',
      currentDayIndex: 1,
      inventory: { wood: 2 },
      warehouseContribution: { wood: 1 },
      collection: { discovered: ['resident_services_tent', 'wood'], completed: [] },
      giftClaims: { milk_tea: { ruleId: 'milk_tea', status: 'requested' as const } },
      dayStates: {
        day_0: { checked: [true, false], settled: true, difficulty: 'standard' as const, planMode: 'standard' as const, rewards: ['wood'], minutes: 12 },
      },
    };

    const payload = createArchivePayload(state, 'gift');

    expect(payload).toMatchObject({
      version: 3,
      app: 'fitness-island',
      username: '哥哥',
      userAvatar: 'rosie',
      currentDayIndex: 1,
      inventory: { wood: 2 },
      warehouseContribution: { wood: 1 },
      collection: { discovered: ['resident_services_tent', 'wood'], completed: [] },
      giftClaims: { milk_tea: { ruleId: 'milk_tea', status: 'requested' } },
      selectedDifficulty: 'standard',
      selectedPlanMode: 'standard',
      activeView: 'gift',
    });
    expect(payload.dayStates.day_0.checked).toEqual([true, false]);
  });

  it('导入旧版存档时会夹紧当前日期并保留可识别字段', () => {
    const base = createInitialState('乖宝');
    const next = applyArchivePayload(base, {
      version: 3,
      app: 'fitness-island',
      userAvatar: 'isabelle',
      currentDayIndex: 99,
      selectedDifficulty: 'challenge',
      selectedPlanMode: 'power',
      inventory: { bells: 8, unknown: 3 },
      warehouseContribution: { stone: 2 },
      collection: { discovered: ['resident_services_tent', 'stone'], completed: ['stone'] },
      giftClaims: { dinner_together: { ruleId: 'dinner_together', status: 'redeemed' } },
      dayStates: {
        day_0: { checked: [true], settled: true, rest: false, rewards: ['stone'], minutes: 10 },
      },
    }, 2);

    expect(next.currentDayIndex).toBe(1);
    expect(next.avatar).toBe('isabelle');
    expect(next.selectedDifficulty).toBe('challenge');
    expect(next.selectedPlanMode).toBe('power');
    expect(next.inventory).toEqual({ bells: 8 });
    expect(next.warehouseContribution).toEqual({ stone: 2 });
    expect(next.collection.discovered).toContain('stone');
    expect(next.giftClaims.dinner_together).toMatchObject({ status: 'redeemed' });
    expect(next.dayStates.day_0.checked).toEqual([true]);
  });

  it('生成训练数据文本和 30 天归档行', () => {
    const state = {
      ...createInitialState('哥哥'),
      dayStates: {
        day_0: { checked: [true, true], settled: true, rewards: ['wood'], minutes: 12 },
        day_1: { checked: [], rest: true },
      },
    };

    const text = createTrainingExportText(plan, state);
    const rows = createArchiveRows(plan, state);

    expect(text).toContain('# 动森训练岛 - Agent 训练数据');
    expect(text).toContain('Day 1 唤醒身体: ✓ 完成');
    expect(text).toContain('✓ 原地踏步 | 2 分钟 | 热身入口');
    expect(rows[0]).toMatchObject({ index: 0, title: '唤醒身体', status: 'done', minutes: 12 });
    expect(rows[1]).toMatchObject({ index: 1, title: '轻松建设', status: 'rest', minutes: 10 });
  });

  it('生成当天详情文本，兼容旧奖励字段', () => {
    const state = createInitialState('哥哥');
    const detail = createDayDetail(plan.weeks[0].days[0], {
      checked: [true, false],
      settled: true,
      difficulty: 'easy',
      planMode: 'recovery',
      rewards: ['wood'],
      minutes: 8,
    }, state);

    expect(detail.title).toBe('唤醒身体');
    expect(detail.lines).toContain('状态：今天到这 1/2');
    expect(detail.lines).toContain('难度：轻松');
    expect(detail.lines).toContain('路线：恢复路线');
    expect(detail.lines).toContain('奖励：木材');
  });
});
