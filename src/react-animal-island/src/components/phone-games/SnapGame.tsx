import { useEffect, useRef, useState } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';

const ANIMALS = ['🦋', '🐞', '🐸', '🐚', '🐟', '🐠', '🦀', '🐙', '🐝'];

export function SnapGame({ onBack, player }: { onBack: () => void; player: string }) {
  const [pos, setPos] = useState(-1);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(20);
  const [over, setOver] = useState(false);
  const scoreRef = useRef(0);
  const lb = useLeaderboard('snap', 'desc');

  useEffect(() => {
    const tick = window.setInterval(() => setPos(Math.floor(Math.random() * 9)), 850);
    const clock = window.setInterval(() => setTime(t => {
      if (t <= 1) { setOver(true); lb.submit(scoreRef.current, player); return 0; }
      return t - 1;
    }), 1000);
    return () => { window.clearInterval(tick); window.clearInterval(clock); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snap = (i: number) => {
    if (over || i !== pos) return;
    scoreRef.current += 1;
    setScore(scoreRef.current);
    setPos(Math.floor(Math.random() * 9));
  };
  const reset = () => { scoreRef.current = 0; setScore(0); setTime(20); setOver(false); lb.clearRank(); setPos(Math.floor(Math.random() * 9)); };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">📷 抓拍小动物</span>
        <span className="pg-score">{score} 分 · {time}s</span>
      </div>
      {over ? (
        <>
          <div className="pg-big">🎉 抓到 {score} 只</div>
          <button className="pg-btn" onClick={reset}>再来一局</button>
        </>
      ) : (
        <div className="pg-snap-grid">
          {Array.from({ length: 9 }, (_, i) => (
            <button key={i} className={`pg-snap-cell ${i === pos ? 'has' : ''}`} onClick={() => snap(i)}>
              {i === pos ? ANIMALS[Math.floor(Math.random() * ANIMALS.length)] : ''}
            </button>
          ))}
        </div>
      )}
      <div className="pg-lb-title">🏆 排行榜</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 只" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
