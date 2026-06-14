import { describe, expect, it } from 'vitest';
import {
  buildRewardPoolForDay,
  chooseRewards,
  computeMaterialCount,
  computeRewardScore,
  getAllowedRewardsForDifficulty,
  getTrainingRewardPool,
  rewardCounts,
  warehouseCounts,
} from './rewards';
import type { PlanDay } from './types';

const legDay: PlanDay = {
  title: '腿部日',
  minutes: 12,
  exercises: [
    ['热身', '1 分钟', '热身入口'],
    ['深蹲', '10 次', '腿部'],
    ['弓步', '8 次', '腿部'],
    ['拉伸', '1 分钟', '收尾放松'],
  ],
};

describe('奖励系统', () => {
  it('按难度返回允许的奖励白名单', () => {
    expect(getAllowedRewardsForDifficulty('easy')).toEqual(['branch', 'weed', 'shell', 'wood', 'softwood', 'stone']);
    expect(getAllowedRewardsForDifficulty('standard')).toEqual(['wood', 'softwood', 'hardwood', 'stone', 'shell', 'clay']);
    expect(getAllowedRewardsForDifficulty('challenge')).toEqual(['wood', 'softwood', 'hardwood', 'stone', 'ironNugget', 'clay', 'bells', 'nookMilesTicket']);
  });

  it('按训练部位取主次两个部位池合并', () => {
    expect(getTrainingRewardPool(legDay)).toEqual(['wood', 'stone', 'hardwood']);
  });

  it('没有动作时回落到全身池', () => {
    expect(getTrainingRewardPool({ title: '空', exercises: [] } as PlanDay)).toEqual(['wood', 'stone', 'clay']);
  });

  it('合并部位池与难度池，过滤到允许列表并去重', () => {
    expect(buildRewardPoolForDay('standard', legDay)).toEqual(['wood', 'stone', 'hardwood', 'softwood', 'shell', 'clay']);
  });

  it('challenge 腿部日池子含稀有材料与铃钱', () => {
    const pool = buildRewardPoolForDay('challenge', legDay);
    expect(pool).toContain('ironNugget');
    expect(pool).toContain('bells');
  });

  it('按种子确定性地选出指定数量的奖励', () => {
    expect(chooseRewards('standard', 3, 0, legDay)).toEqual(['wood', 'stone', 'hardwood']);
  });

  it('奖励计数：基础铃钱=分数×100，材料各 +1', () => {
    expect(rewardCounts(['wood', 'stone'], 4)).toEqual({ bells: 400, wood: 1, stone: 1 });
  });

  it('铃钱奖励额外叠加 getBellsRewardValue', () => {
    // base 400 + max(500, 4*100)=500
    expect(rewardCounts(['bells'], 4).bells).toBe(900);
  });

  it('分数=勾选数×难度倍率', () => {
    expect(computeRewardScore('standard', 3)).toBe(6);
    expect(computeRewardScore('easy', 2)).toBe(2);
    expect(computeRewardScore('challenge', 2)).toBe(6);
  });

  it('材料数=baseRewards+完整加成', () => {
    expect(computeMaterialCount('standard', true)).toBe(3);
    expect(computeMaterialCount('standard', false)).toBe(2);
    expect(computeMaterialCount('easy', true)).toBe(1);
    expect(computeMaterialCount('challenge', true)).toBe(4);
  });

  it('仓库计数只统计建设类材料(木材/贝壳/石头/铁矿)', () => {
    expect(warehouseCounts(['wood', 'stone', 'hardwood', 'bells', 'shell'])).toEqual({ wood: 1, stone: 1, shell: 1 });
  });
});
