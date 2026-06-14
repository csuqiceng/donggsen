import { describe, expect, it } from 'vitest';
import {
  buildEasyExercises,
  challengeExerciseDetail,
  easeExerciseDetail,
  getDifficultyExercises,
  isCooldownExercise,
  isLowPressureExercise,
  isWarmupExercise,
} from './difficulty';
import type { PlanDay } from './types';
import { getAdjustedDay } from './training';

type Ex = [string, string, string];

const fullDay: Ex[] = [
  ['热身踏步', '3 分钟', '热身入口'],
  ['深蹲', '15 个', '腿部'],
  ['俯卧撑', '10 次', '上身'],
  ['平板支撑', '30 秒 x 2', '核心'],
  ['拉伸', '1 分钟', '收尾放松'],
];

describe('难度动作调整', () => {
  it('standard 原样返回', () => {
    expect(getDifficultyExercises(fullDay, 'standard')).toEqual(fullDay);
  });

  it('easy 只保留热身+收尾+低压力，最多 3 个，按原顺序', () => {
    const easy = buildEasyExercises(fullDay);
    expect(easy.length).toBeLessThanOrEqual(3);
    expect(easy[0][0]).toBe('热身踏步');
    expect(easy.some(ex => ex[0] === '拉伸')).toBe(true);
  });

  it('easy 对动作 detail 降量并加轻松前缀', () => {
    const [tuned] = buildEasyExercises([['深蹲', '10 次', '腿部']]);
    expect(tuned[1]).toBe('6 次');
    expect(tuned[2]).toBe('轻松 · 腿部');
  });

  it('≤2 个动作时 easy 全部保留并降量', () => {
    const easy = buildEasyExercises([['深蹲', '10 次', '腿部'], ['俯卧撑', '10 次', '上身']]);
    expect(easy).toHaveLength(2);
  });

  it('challenge 每个动作加量并加挑战前缀', () => {
    const challenged = getDifficultyExercises([['深蹲', '10 次', '腿部']], 'challenge');
    expect(challenged[0][1]).toBe('14 次');
    expect(challenged[0][2]).toBe('挑战 · 腿部');
  });

  it('challenge 复合动作加 1 组', () => {
    expect(challengeExerciseDetail('30 秒 x 2', ['平板', '30 秒 x 2', '核心'])).toBe('40 秒 x 3');
  });

  it('easeExerciseDetail 把分钟级联降为秒、个数减半', () => {
    // 旧版链式 replace 级联：3 分钟 → 60 秒 → 30 秒 → 15 秒 → 8 秒
    expect(easeExerciseDetail('3 分钟')).toBe('8 秒');
    expect(easeExerciseDetail('10 次')).toBe('6 次');
  });

  it('判定函数识别热身/收尾/低压力', () => {
    expect(isWarmupExercise(['热身踏步', '', '热身入口'])).toBe(true);
    expect(isCooldownExercise(['拉伸', '', '收尾放松'])).toBe(true);
    expect(isLowPressureExercise(['臀桥', '', '核心'])).toBe(true);
    expect(isWarmupExercise(['深蹲', '', '腿部'])).toBe(false);
  });

  it('getAdjustedDay：easy 难度裁剪动作、challenge 加量', () => {
    const day: PlanDay = { title: '腿部日', minutes: 15, exercises: fullDay };
    const easy = getAdjustedDay(day, 'easy');
    expect(easy.exercises.length).toBeLessThanOrEqual(3);
    expect(easy.exercises[0][2]).toMatch(/^轻松/);
    const challenge = getAdjustedDay(day, 'challenge');
    expect(challenge.exercises[1][2]).toMatch(/^挑战/);
  });
});
