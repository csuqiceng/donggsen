import { AVATARS, ITEMS } from '../domain/config';
import { isOnline, sumCounts } from '../domain/leaderboard';
import type { CountMap } from '../domain/types';

export interface Participant {
  name: string;
  avatar?: string;
  settledDays: number;
  minutes: number;
  lastActive: number;
  totalChecked: number;
  materials: CountMap;
  title: string;
  currentDay: number;
  isMe?: boolean;
}

function avatarImg(id?: string): string | undefined {
  if (!id) return undefined;
  return AVATARS.find(item => item.id === id)?.img;
}

export function Leaderboard({ participants, now }: { participants: Participant[]; now: number }) {
  if (!participants.length) return <p className="muted">还没有岛民登岛。</p>;
  const sorted = [...participants]
    .map(p => ({ ...p, score: p.settledDays * 10 + p.totalChecked }))
    .sort((a, b) => b.score - a.score);
  const medals = ['gold', 'silver', 'bronze'] as const;
  return (
    <div className="lb-list">
      {sorted.map((p, index) => {
        const rankClass = index < 3 ? medals[index] : 'normal';
        const img = avatarImg(p.avatar);
        const online = isOnline(p.lastActive, now);
        const chips = Object.entries(p.materials || {}).filter(([, value]) => Number(value) > 0);
        return (
          <div className="lb-row" key={p.name}>
            {index < 3 && img ? (
              <img className="lb-avatar" src={img} alt={p.name} />
            ) : (
              <div className={`lb-rank ${rankClass}`}>{index + 1}</div>
            )}
            <div className="lb-info">
              <div className="lb-name">
                {p.name}{p.isMe ? ' (我)' : ''} · {p.title}
                {online && <span className="online-dot" />}
              </div>
              <div className="lb-stats">完成 {p.settledDays} 天 · 仓库贡献 {sumCounts(p.materials)} · 第 {p.currentDay + 1} 天</div>
              <div className="contribution-materials">
                {chips.length ? chips.map(([key, value]) => (
                  <span className="contribution-chip" key={key}>{ITEMS[key]?.name || key} {value}</span>
                )) : <span className="contribution-chip">还没有入库材料</span>}
              </div>
            </div>
            <div className="lb-score">
              <div className="lb-score-num">{p.score}</div>
              <div className="lb-score-label">积分</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
