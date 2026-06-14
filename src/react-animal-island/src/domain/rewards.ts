import { DIFFICULTIES, TRAINING_REWARD_POOLS } from './config';
import type { Difficulty, PlanDay } from './types';

export function getAllowedRewardsForDifficulty(difficulty: Difficulty): string[] {
  if (difficulty === 'easy') return ['branch', 'weed', 'shell', 'wood', 'softwood', 'stone'];
  if (difficulty === 'challenge') return ['wood', 'softwood', 'hardwood', 'stone', 'ironNugget', 'clay', 'bells', 'nookMilesTicket'];
  return ['wood', 'softwood', 'hardwood', 'stone', 'shell', 'clay'];
}

export function getTrainingRewardPool(day: PlanDay | null): string[] {
  if (!day?.exercises?.length) return TRAINING_REWARD_POOLS['全身'];
  const counts: Record<string, number> = {};
  day.exercises.forEach(exercise => {
    const category = exercise[2] || '';
    counts[category] = (counts[category] || 0) + 1;
  });
  const ranked = Object.entries(counts)
    .filter(([category]) => category !== '热身入口' && category !== '收尾放松')
    .sort((a, b) => b[1] - a[1]);
  const primary = ranked[0]?.[0] || (counts['收尾放松'] ? '收尾放松' : '热身入口');
  const secondary = ranked[1]?.[0];
  return [
    ...(TRAINING_REWARD_POOLS[primary] || TRAINING_REWARD_POOLS['全身']),
    ...(secondary ? TRAINING_REWARD_POOLS[secondary] || [] : []),
  ];
}

export function buildRewardPoolForDay(difficulty: Difficulty, day: PlanDay | null): string[] {
  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.standard;
  const diffPool = diff.rewardPool.length ? diff.rewardPool : DIFFICULTIES.standard.rewardPool;
  const themePool = getTrainingRewardPool(day);
  const merged = [...themePool, ...diffPool];
  const allowed = getAllowedRewardsForDifficulty(difficulty);
  const filtered = merged.filter(item => allowed.includes(item));
  return [...new Set(filtered.length ? filtered : diffPool)];
}

export function chooseRewards(difficulty: Difficulty, count: number, seed: number, day: PlanDay | null): string[] {
  const pool = buildRewardPoolForDay(difficulty, day);
  const rewards: string[] = [];
  for (let i = 0; i < count; i += 1) rewards.push(pool[(seed + i) % pool.length]);
  return rewards;
}

export function getBellsRewardValue(score: number): number {
  return Math.max(500, score * 100);
}

export function rewardCounts(rewards: string[], score: number): Record<string, number> {
  const out: Record<string, number> = { bells: score * 100 };
  rewards.forEach(reward => {
    if (reward === 'bells') out.bells += getBellsRewardValue(score);
    else out[reward] = (out[reward] || 0) + 1;
  });
  return out;
}

export function computeRewardScore(difficulty: Difficulty, checkedCount: number): number {
  return checkedCount * DIFFICULTIES[difficulty].multiplier;
}

export function computeMaterialCount(difficulty: Difficulty, fullDone: boolean): number {
  const diff = DIFFICULTIES[difficulty];
  return diff.baseRewards + (fullDone ? diff.fullBonus : 0);
}

export function warehouseCounts(rewards: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const stashable = ['wood', 'shell', 'stone', 'ironNugget'];
  rewards.forEach(reward => {
    if (stashable.includes(reward)) out[reward] = (out[reward] || 0) + 1;
  });
  return out;
}
