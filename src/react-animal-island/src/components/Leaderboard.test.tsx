// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Leaderboard } from './Leaderboard';

describe('Leaderboard', () => {
  it('渲染岛民列表（按打卡天数降序）', () => {
    render(<Leaderboard participants={[
      { name: '哥哥', settledDays: 3, minutes: 30, lastActive: 190000, totalChecked: 5, materials: {}, title: '上岛新星', currentDay: 2 },
      { name: '乖宝', settledDays: 5, minutes: 50, lastActive: 1000, totalChecked: 9, materials: { wood: 2 }, title: '常驻岛民', currentDay: 5 },
    ]} now={200000} />);
    expect(screen.getByText(/哥哥/)).toBeInTheDocument();
    expect(screen.getByText(/乖宝/)).toBeInTheDocument();
  });

  it('没有岛民时显示空状态', () => {
    render(<Leaderboard participants={[]} now={1000} />);
    expect(screen.getByText(/还没有岛民/)).toBeInTheDocument();
  });
});
