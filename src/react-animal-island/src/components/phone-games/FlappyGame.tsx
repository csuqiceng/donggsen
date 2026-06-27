import { useEffect, useReducer, useRef } from 'react';
import { useLeaderboard } from './leaderboard';
import { LeaderboardList } from './LeaderboardView';
import './FlappyGame.css';

// 动森小鸟：点屏扇翅膀，穿过管道缝隙
const W = 320;
const H = 360;
const BIRD_X = 66;
const BIRD_R = 13;
const GRAVITY = 0.32;
const FLAP = -5.4;
const SPEED = 2.4;
const PIPE_W = 50;
const GAP = 128;
const SPAWN_GAP = 170;

interface Pipe { x: number; gapTop: number; scored: boolean; }

function freshPipes(): Pipe[] {
  return [{ x: W + 40, gapTop: randGap(), scored: false }];
}
const randGap = () => 40 + Math.floor(Math.random() * (H - GAP - 80));

export function FlappyGame({ onBack, player }: { onBack: () => void; player: string }) {
  const g = useRef({ birdY: H / 2, vy: 0, pipes: [] as Pipe[], score: 0, running: false, over: false });
  const loop = useRef<number | null>(null);
  const [, force] = useReducer(x => x + 1, 0);
  const lb = useLeaderboard('flappy', 'desc');

  const tick = () => {
    const s = g.current;
    if (!s.running) return;
    s.vy += GRAVITY;
    s.birdY += s.vy;
    s.pipes.forEach(p => (p.x -= SPEED));
    // 生成新管道
    if (s.pipes.length === 0 || s.pipes[s.pipes.length - 1].x < W - SPAWN_GAP) {
      s.pipes.push({ x: W + 20, gapTop: randGap(), scored: false });
    }
    // 移除出界 + 计分
    s.pipes = s.pipes.filter(p => p.x + PIPE_W > -10);
    for (const p of s.pipes) {
      if (!p.scored && p.x + PIPE_W < BIRD_X) { p.scored = true; s.score += 1; }
    }
    // 碰撞
    const hit =
      s.birdY - BIRD_R < 0 || s.birdY + BIRD_R > H ||
      s.pipes.some(p =>
        BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W &&
        (s.birdY - BIRD_R < p.gapTop || s.birdY + BIRD_R > p.gapTop + GAP)
      );
    if (hit) {
      s.running = false; s.over = true;
      if (loop.current) window.clearInterval(loop.current);
      lb.submit(s.score, player);
    }
    force();
  };

  const start = () => {
    g.current = { birdY: H / 2, vy: 0, pipes: freshPipes(), score: 0, running: true, over: false };
    if (loop.current) window.clearInterval(loop.current);
    loop.current = window.setInterval(tick, 32);
    force();
  };
  const flap = () => {
    if (g.current.over) return;
    if (!g.current.running) { start(); return; }
    g.current.vy = FLAP;
  };
  useEffect(() => () => { if (loop.current) window.clearInterval(loop.current); }, []);

  const s = g.current;
  return (
    <div className="pg">
      <div className="pg-head">
        <span className="pg-title">💬 动森小鸟</span>
        <span className="pg-score">{s.score} 分</span>
      </div>
      <div className="pg-flappy" onPointerDown={flap}>
        {s.pipes.map((p, i) => (
          <div key={i} className="pg-flappy-pipe" style={{ left: p.x, width: PIPE_W }}>
            <div style={{ height: p.gapTop }} />
            <div style={{ height: H - p.gapTop - GAP, marginTop: GAP }} />
          </div>
        ))}
        <div
          className="pg-flappy-bird"
          style={{ left: BIRD_X - BIRD_R, top: s.birdY - BIRD_R, transform: `rotate(${Math.max(-30, Math.min(70, s.vy * 6))}deg)` }}
        >
          🐦
        </div>
        {!s.running && !s.over && <div className="pg-flappy-msg">点屏开始<br />扇翅膀穿缝隙</div>}
        {s.over && (
          <div className="pg-flappy-msg">
            💥 撞了！{s.score} 分
            <button className="pg-btn" onClick={e => { e.stopPropagation(); start(); }}>再来</button>
          </div>
        )}
      </div>
      <div className="pg-sub">点屏幕 = 扇翅膀</div>
      <div className="pg-lb-title">🏆 排行榜</div>
      <LeaderboardList entries={lb.lb} rank={lb.rank} unit=" 分" />
      <button className="phone-game-back" onClick={onBack}>← 返回手机</button>
    </div>
  );
}
