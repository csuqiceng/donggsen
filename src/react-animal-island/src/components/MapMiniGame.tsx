import { useEffect, useRef, useState } from 'react';
import { useLeaderboard } from './phone-games/leaderboard';
import { LeaderboardList } from './phone-games/LeaderboardView';
import './MapMiniGame.css';

// 动森主题翻牌配对：6 对，3×4 网格
const EMOJIS = ['⛺', '🐚', '⭐', '🌼', '🍂', '🎫'];

interface Card { key: number; emoji: string; flipped: boolean; matched: boolean; }

function buildDeck(): Card[] {
  const pool = [...EMOJIS, ...EMOJIS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.map((emoji, i) => ({ key: i, emoji, flipped: false, matched: false }));
}

export function MapMiniGame({ onBack, player }: { onBack: () => void; player: string }) {
  const [cards, setCards] = useState<Card[]>(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [lock, setLock] = useState(false);
  const movesRef = useRef(0);
  const submitted = useRef(false);
  const won = cards.every(c => c.matched);
  const lb = useLeaderboard('match', 'asc');

  useEffect(() => {
    if (won && !submitted.current) { submitted.current = true; lb.submit(movesRef.current, player); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const reset = () => {
    submitted.current = false; movesRef.current = 0;
    setCards(buildDeck()); setFlipped([]); setMoves(0); setLock(false); lb.clearRank();
  };

  const onFlip = (idx: number) => {
    if (lock || cards[idx].flipped || cards[idx].matched) return;
    const next = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(next);
    const pair = [...flipped, idx];
    setFlipped(pair);
    if (pair.length === 2) {
      movesRef.current += 1;
      setMoves(movesRef.current);
      setLock(true);
      const [a, b] = pair;
      if (next[a].emoji === next[b].emoji) {
        window.setTimeout(() => {
          setCards(cs => cs.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
          setFlipped([]);
          setLock(false);
        }, 360);
      } else {
        window.setTimeout(() => {
          setCards(cs => cs.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
          setFlipped([]);
          setLock(false);
        }, 760);
      }
    }
  };

  return (
    <div className="mmg">
      <div className="mmg-head">
        <span className="mmg-title">🏝 岛屿翻牌</span>
        <span className="mmg-moves">{moves} 步</span>
      </div>
      <div className="mmg-grid">
        {cards.map((c, i) => {
          const up = c.flipped || c.matched;
          return (
            <button
              key={c.key}
              type="button"
              className={`mmg-card ${up ? 'up' : ''} ${c.matched ? 'matched' : ''}`}
              onClick={() => onFlip(i)}
              disabled={c.matched}
              aria-label={up ? c.emoji : '未翻开的卡片'}
            >
              <span className="mmg-face">{up ? c.emoji : '❓'}</span>
            </button>
          );
        })}
      </div>
      {won ? (
        <div className="mmg-win">
          <span>🎉 通关！用了 {moves} 步</span>
          <button type="button" className="mmg-again" onClick={reset}>再来一局</button>
        </div>
      ) : (
        <div className="mmg-tip">翻开两张相同的牌配对</div>
      )}
      <div className="pg-lb-title">🏆 排行榜（步数越少越靠前）</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 步" />
      <button type="button" className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
