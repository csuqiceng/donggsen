import { useEffect, useRef, useState } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';

type Cell = 'X' | 'O' | null;
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const winner = (b: Cell[]): Cell | 'draw' | null => {
  for (const [a,c,d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  return b.every(Boolean) ? 'draw' : null;
};
// 简单 AI：先抢赢，再堵，再中心/角/边
function aiMove(b: Cell[]): number {
  const pick = (p: Cell) => {
    for (const [a,c,d] of LINES) {
      const line = [b[a],b[c],b[d]];
      if (line.filter(x => x === p).length === 2 && line.includes(null)) {
        return [a,c,d][line.indexOf(null)];
      }
    }
    return -1;
  };
  return pick('O') !== -1 ? pick('O') : pick('X') !== -1 ? pick('X') : b[4] === null ? 4 : [0,2,6,8,1,3,5,7].find(i => b[i] === null) ?? -1;
}

export function TicTacToe({ onBack, player }: { onBack: () => void; player: string }) {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [score, setScore] = useState({ w: 0, l: 0, d: 0 });
  const [streak, setStreak] = useState(0);
  const streakRef = useRef(0);
  const res = winner(board);
  const lb = useLeaderboard('ttt', 'desc');

  useEffect(() => {
    if (!res) return;
    if (res === 'X') {
      setScore(s => ({ ...s, w: s.w + 1 }));
      streakRef.current += 1;
      setStreak(streakRef.current);
    } else {
      setScore(s => ({ ...s, l: res === 'O' ? s.l + 1 : s.l, d: res === 'draw' ? s.d + 1 : s.d }));
      if (streakRef.current > 0) lb.submit(streakRef.current, player);
      streakRef.current = 0;
      setStreak(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  const play = (i: number) => {
    if (board[i] || res) return;
    const b1 = [...board]; b1[i] = 'X';
    if (winner(b1)) { setBoard(b1); return; }
    const m = aiMove(b1);
    if (m >= 0) b1[m] = 'O';
    setBoard(b1);
  };
  const reset = () => { setBoard(Array(9).fill(null)); lb.clearRank(); };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">🖌 井字棋</span>
        <span className="pg-score">胜{score.w} 负{score.l} 平{score.d} · 连胜{streak}</span>
      </div>
      <div className="pg-ttt">
        {board.map((v, i) => (
          <button key={i} className={`pg-ttt-cell ${v === 'X' ? 'pg-ttt-x' : v === 'O' ? 'pg-ttt-o' : ''}`} onClick={() => play(i)} disabled={!!v || !!res}>
            {v}
          </button>
        ))}
      </div>
      <div className="pg-sub">{res === 'X' ? '🎉 你赢了！' : res === 'O' ? '😵 你输了' : res === 'draw' ? '🤝 平局' : '你是 X，先手'}</div>
      {res && <button className="pg-btn" onClick={reset}>再来一局</button>}
      <div className="pg-lb-title">🏆 排行榜（最长连胜）</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 连胜" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
