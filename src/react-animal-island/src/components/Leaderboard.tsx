import { isOnline } from '../domain/leaderboard';

interface Participant {
  name: string;
  avatar?: string;
  settledDays: number;
  minutes: number;
  lastActive: number;
}

export function Leaderboard({ participants, now }: { participants: Participant[]; now: number }) {
  if (!participants.length) return <p className="muted">还没有岛民登岛。</p>;
  const sorted = [...participants].sort((a, b) => b.settledDays - a.settledDays || b.minutes - a.minutes);
  return (
    <ol className="leaderboard">
      {sorted.map((participant, index) => (
        <li key={participant.name} data-testid="lb-row" data-online={isOnline(participant.lastActive, now) ? 'true' : 'false'}>
          <span className="lb-rank">{index + 1}</span>
          <span className="lb-name">{participant.name}</span>
          <span className="lb-days">{participant.settledDays} 天 · {participant.minutes} 分</span>
          <span className="lb-dot" />
        </li>
      ))}
    </ol>
  );
}
