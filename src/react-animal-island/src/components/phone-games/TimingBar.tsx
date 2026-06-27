import { useEffect, useRef, useState } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';

export function TimingBar({ onBack, player }: { onBack: () => void; player: string }) {
  const [mark, setMark] = useState(0);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('把红标停在绿色区域');
  const [done, setDone] = useState(false);
  const dir = useRef(1);
  const raf = useRef<number | null>(null);
  const lb = useLeaderboard('timing', 'desc');

  useEffect(() => {
    let pos = 0; dir.current = 1;
    const loop = () => {
      pos += dir.current * 1.6;
      if (pos >= 100) { pos = 100; dir.current = -1; }
      if (pos <= 0) { pos = 0; dir.current = 1; }
      setMark(pos);
      raf.current = window.setTimeout(loop, 16);
    };
    loop();
    return () => { if (raf.current) window.clearTimeout(raf.current); };
  }, [round, done]);

  const stop = () => {
    if (done) return;
    if (raf.current) { window.clearTimeout(raf.current); raf.current = null; }
    const hit = mark >= 42 && mark <= 58;
    const next = score + (hit ? 1 : 0);
    setScore(next);
    setMsg(hit ? '✅ 卡住了！' : '❌ 差一点');
    if (round >= 5) { setDone(true); lb.submit(next, player); return; }
    window.setTimeout(() => { setRound(r => r + 1); setMsg('把红标停在绿色区域'); }, 700);
  };
  const reset = () => { setRound(1); setScore(0); setDone(false); setMsg('把红标停在绿色区域'); lb.clearRank(); };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">🔨 卡准星</span>
        <span className="pg-score">{score}/{round > 5 ? 5 : round} 轮</span>
      </div>
      {done ? (
        <>
          <div className="pg-big">🎉 命中 {score}/5</div>
          <button className="pg-btn" onClick={reset}>再来一局</button>
        </>
      ) : (
        <>
          <div className="pg-bar-wrap">
            <div className="pg-bar">
              <div className="pg-bar-zone" />
              <div className="pg-bar-mark" style={{ left: `calc(${mark}% - 3px)` }} />
            </div>
          </div>
          <div className="pg-sub">{msg}</div>
          <button className="pg-btn" onClick={stop}>停！</button>
        </>
      )}
      <div className="pg-lb-title">🏆 排行榜</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit="/5" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
