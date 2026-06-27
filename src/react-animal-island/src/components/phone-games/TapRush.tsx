import { useEffect, useRef, useState } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';

export function TapRush({ onBack, player }: { onBack: () => void; player: string }) {
  const [count, setCount] = useState(0);
  const [time, setTime] = useState(10);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const countRef = useRef(0);
  const clock = useRef<number | null>(null);
  const lb = useLeaderboard('tap', 'desc');

  const start = () => {
    countRef.current = 0; setCount(0); setTime(10); setDone(false); setRunning(true); lb.clearRank();
    clock.current = window.setInterval(() => setTime(t => {
      if (t <= 1) { setRunning(false); setDone(true); if (clock.current) window.clearInterval(clock.current); lb.submit(countRef.current, player); return 0; }
      return t - 1;
    }), 1000);
  };
  useEffect(() => () => { if (clock.current) window.clearInterval(clock.current); }, []);

  const tap = () => { if (!running) return; countRef.current += 1; setCount(countRef.current); };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">🎫 狂点里数</span>
        <span className="pg-score">{count} · {time}s</span>
      </div>
      {done ? (
        <>
          <div className="pg-big">🎉 {count} 下 / 10 秒</div>
          <div className="pg-sub">{(count / 10).toFixed(1)} 下/秒</div>
          <button className="pg-btn" onClick={start}>再来一局</button>
        </>
      ) : (
        <>
          <button className="pg-tap-btn" disabled={!running} onClick={tap}>
            {running ? '点我！' : '准备'}
          </button>
          {!running && <button className="pg-btn" onClick={start}>开始（10 秒）</button>}
        </>
      )}
      <div className="pg-lb-title">🏆 排行榜</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 下" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
