import type { ScoreEntry } from './leaderboard';

export function LeaderboardList({ entries, rank, unit }: { entries: ScoreEntry[]; rank: number; unit?: string }) {
  if (!entries.length) {
    return <div className="pg-lb-empty">还没有记录，玩一局上榜吧</div>;
  }
  return (
    <ol className="pg-lb">
      {entries.map((e, i) => (
        <li key={e.ts} className={i === rank ? 'me' : ''}>
          <span className="pg-lb-no">{i + 1}</span>
          <span className="pg-lb-name">{e.name}</span>
          <span className="pg-lb-score">{e.score}{unit}</span>
        </li>
      ))}
    </ol>
  );
}
