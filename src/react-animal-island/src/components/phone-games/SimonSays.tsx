import { useEffect, useRef, useState } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';

const PADS = [
  { c: '#fc736d', n: 0 },
  { c: '#42a5f5', n: 1 },
  { c: '#f7cd67', n: 2 },
  { c: '#8ac68a', n: 3 },
];

export function SimonSays({ onBack, player }: { onBack: () => void; player: string }) {
  const [seq, setSeq] = useState<number[]>([]);
  const [input, setInput] = useState<number[]>([]);
  const [lit, setLit] = useState(-1);
  const [phase, setPhase] = useState<'idle' | 'show' | 'input' | 'over'>('idle');
  const [round, setRound] = useState(0);
  const showTimer = useRef<number | null>(null);
  const lb = useLeaderboard('simon', 'desc');

  const playSeq = (s: number[]) => {
    setPhase('show');
    setInput([]);
    let i = 0;
    const step = () => {
      if (i >= s.length) { setLit(-1); setPhase('input'); return; }
      setLit(s[i]);
      showTimer.current = window.setTimeout(() => {
        setLit(-1);
        showTimer.current = window.setTimeout(() => { i++; step(); }, 220);
      }, 480);
    };
    step();
  };

  const start = () => {
    const s = [Math.floor(Math.random() * 4)];
    setSeq(s); setRound(1); lb.clearRank(); playSeq(s);
  };
  useEffect(() => () => { if (showTimer.current) window.clearTimeout(showTimer.current); }, []);

  const tap = (n: number) => {
    if (phase !== 'input') return;
    const ni = [...input, n];
    setInput(ni);
    if (seq[ni.length - 1] !== n) { setPhase('over'); lb.submit(seq.length - 1, player); return; }
    if (ni.length === seq.length) {
      const next = [...seq, Math.floor(Math.random() * 4)];
      setSeq(next); setRound(round + 1);
      window.setTimeout(() => playSeq(next), 650);
    }
  };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">🎨 记忆色块</span>
        <span className="pg-score">第 {round} 轮</span>
      </div>
      <div className="pg-simon">
        {PADS.map(p => (
          <button
            key={p.n}
            className={`pg-simon-pad ${lit === p.n ? 'lit' : ''}`}
            style={{ background: p.c }}
            onClick={() => tap(p.n)}
            aria-label={`色块 ${p.n + 1}`}
          />
        ))}
      </div>
      <div className="pg-sub">
        {phase === 'idle' && '记住亮起的顺序，再原样点一遍'}
        {phase === 'show' && '👀 看顺序…'}
        {phase === 'input' && '👉 该你了'}
        {phase === 'over' && `❌ 错了！你过了 ${round - 1} 轮`}
      </div>
      {(phase === 'idle' || phase === 'over') && <button className="pg-btn" onClick={start}>{phase === 'over' ? '再来一局' : '开始'}</button>}
      <div className="pg-lb-title">🏆 排行榜</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 轮" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
