import { useRef, useState } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';

const rnd = () => Math.floor(Math.random() * 98) + 1; // 1..98
const ITEMS = ['🛒', '🎣', '🪑', '🪴', '🖼', '🧸', '🎁', '👟'];

export function HigherLower({ onBack, player }: { onBack: () => void; player: string }) {
  const [cur, setCur] = useState(rnd);
  const [next, setNext] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [item, setItem] = useState(ITEMS[0]);
  const [msg, setMsg] = useState('猜下一件商品：价格更高 or 更低？');
  const streakRef = useRef(0);
  const lb = useLeaderboard('price', 'desc');

  const guess = (higher: boolean) => {
    if (next !== null) return;
    const n = rnd();
    setNext(n);
    const correct = (higher && n > cur) || (!higher && n < cur);
    if (correct) {
      streakRef.current += 1;
      setStreak(streakRef.current);
      setBest(b => Math.max(b, streakRef.current));
      setMsg('✅ 猜对了！');
    } else {
      if (streakRef.current > 0) lb.submit(streakRef.current, player);
      streakRef.current = 0;
      setStreak(0);
      setMsg('❌ 错了，重新开始');
    }
  };
  const again = () => {
    if (next !== null) setCur(next);
    setNext(null);
    setItem(ITEMS[Math.floor(Math.random() * ITEMS.length)]);
    setMsg('猜下一件商品：价格更高 or 更低？');
  };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">🛒 猜价格</span>
        <span className="pg-score">连胜 {streak} · 最高 {best}</span>
      </div>
      <div className="pg-price">{item} {next ?? '?'} <span style={{ fontSize: 16, color: '#94908a' }}>里数</span></div>
      <div className="pg-sub">{msg}</div>
      <div className="pg-hl-row">
        {next === null ? (
          <>
            <button className="pg-btn" onClick={() => guess(true)}>⬆ 更高</button>
            <button className="pg-btn" onClick={() => guess(false)}>⬇ 更低</button>
          </>
        ) : (
          <button className="pg-btn" onClick={again}>下一件</button>
        )}
      </div>
      {next !== null && <div className="pg-sub">上一件：{cur} 里数</div>}
      <div className="pg-lb-title">🏆 排行榜（最长连胜）</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 连胜" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
