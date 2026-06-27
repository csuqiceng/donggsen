import { useState } from 'react';

export interface ScoreEntry { name: string; score: number; ts: number; }
export type Order = 'desc' | 'asc';

const N = 8;
const KEY = (gameId: string) => `phone-game-lb:${gameId}`;

export function loadScores(gameId: string): ScoreEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY(gameId)) || '[]'); } catch { return []; }
}

/** 插入一条成绩，排序后保留前 N，返回新榜单与本条名次（-1 = 未上榜） */
export function submitScore(gameId: string, name: string, score: number, order: Order): { list: ScoreEntry[]; rank: number } {
  const entry: ScoreEntry = { name: name?.trim() || '岛民', score, ts: Date.now() };
  const list = [...loadScores(gameId), entry].sort((a, b) => (order === 'desc' ? b.score - a.score : a.score - b.score)).slice(0, N);
  const rank = list.findIndex(e => e.ts === entry.ts);
  try { localStorage.setItem(KEY(gameId), JSON.stringify(list)); } catch { /* ignore */ }
  return { list, rank };
}

/** 游戏内排行榜：submit(score,name) 在结束瞬间调用一次 */
export function useLeaderboard(gameId: string, order: Order) {
  const [lb, setLb] = useState<ScoreEntry[]>(() => loadScores(gameId));
  const [rank, setRank] = useState(-1);
  const submit = (score: number, name: string) => {
    const { list, rank } = submitScore(gameId, name, score, order);
    setLb(list); setRank(rank);
  };
  const clearRank = () => setRank(-1);
  return { lb, rank, submit, clearRank };
}
