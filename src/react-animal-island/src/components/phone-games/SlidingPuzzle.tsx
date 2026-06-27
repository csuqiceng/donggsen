import { useEffect, useRef, useState } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';

function build(): number[] {
  // 随机可解洗牌：从已解状态做若干次合法移动
  let board = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let blank = 8;
  let prev = -1;
  for (let n = 0; n < 80; n++) {
    const neighbors = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => i !== prev && i !== blank && adj(i, blank));
    const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
    [board[blank], board[pick]] = [board[pick], board[blank]];
    prev = blank; blank = pick;
  }
  return board;
}
const adj = (a: number, b: number) => {
  const ra = Math.floor(a / 3), ca = a % 3, rb = Math.floor(b / 3), cb = b % 3;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
};

export function SlidingPuzzle({ onBack, player }: { onBack: () => void; player: string }) {
  const [board, setBoard] = useState<number[]>(build);
  const [moves, setMoves] = useState(0);
  const solved = board.every((v, i) => (i === 8 ? v === 0 : v === i + 1));
  const movesRef = useRef(0);
  const submitted = useRef(false);
  const lb = useLeaderboard('puzzle', 'asc');

  useEffect(() => {
    if (solved && movesRef.current > 0 && !submitted.current) {
      submitted.current = true;
      lb.submit(movesRef.current, player);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const move = (i: number) => {
    const blank = board.indexOf(0);
    if (!adj(i, blank)) return;
    const next = [...board];
    [next[i], next[blank]] = [next[blank], next[i]];
    setBoard(next);
    movesRef.current += 1;
    setMoves(movesRef.current);
  };
  const reset = () => { submitted.current = false; movesRef.current = 0; setBoard(build()); setMoves(0); lb.clearRank(); };

  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">🦋 数字拼图</span>
        <span className="pg-score">{moves} 步</span>
      </div>
      {solved ? (
        <>
          <div className="pg-big">🎉 {moves} 步完成！</div>
          <button className="pg-btn" onClick={reset}>再来一局</button>
        </>
      ) : (
        <div className="pg-puzzle">
          {board.map((v, i) => (
            <button key={i} className={`pg-puzzle-tile ${v === 0 ? 'blank' : ''}`} onClick={() => v !== 0 && move(i)} disabled={v === 0}>
              {v === 0 ? '' : v}
            </button>
          ))}
        </div>
      )}
      <div className="pg-lb-title">🏆 排行榜（步数越少越靠前）</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 步" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
