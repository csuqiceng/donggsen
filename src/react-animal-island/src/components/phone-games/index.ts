import type { FC } from 'react';
import './index.css';
import { SnapGame } from './SnapGame';
import { TapRush } from './TapRush';
import { SlidingPuzzle } from './SlidingPuzzle';
import { TimingBar } from './TimingBar';
import { HigherLower } from './HigherLower';
import { SimonSays } from './SimonSays';
import { TicTacToe } from './TicTacToe';
import { FlappyGame } from './FlappyGame';
import { MapMiniGame } from '../MapMiniGame';

export type GameProps = { onBack: () => void; player: string };

/** 第 1 页 APP id → 小游戏 */
export const GAMES: Record<string, FC<GameProps>> = {
  camera: SnapGame,        // 📷 抓拍小动物
  miles: TapRush,          // 🎫 狂点里数
  critterpedia: SlidingPuzzle, // 🦋 数字拼图
  diy: TimingBar,          // 🔨 卡准星
  shopping: HigherLower,   // 🛒 猜价格
  custom: SimonSays,       // 🎨 记忆色块
  design: TicTacToe,       // 🖌 井字棋
  map: MapMiniGame,        // 🗺 岛屿翻牌
  chat: FlappyGame,        // 💬 动森小鸟
};
