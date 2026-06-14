// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Leaderboard } from './Leaderboard';

describe('Leaderboard', () => {
  it('按打卡天数降序渲染，在线岛民标注 data-online', () => {
    render(<Leaderboard participants={[
      { name: '哥哥', settledDays: 3, minutes: 30, lastActive: 190000 },
      { name: '乖宝', settledDays: 5, minutes: 50, lastActive: 1000 },
    ]} now={200000} />);

    const rows = screen.getAllByTestId('lb-row');
    expect(rows[0]).toHaveTextContent('乖宝');
    expect(rows[1]).toHaveTextContent('哥哥');
    expect(rows[0]).toHaveAttribute('data-online', 'false');
    expect(rows[1]).toHaveAttribute('data-online', 'true');
  });

  it('没有岛民时显示空状态', () => {
    render(<Leaderboard participants={[]} now={1000} />);
    expect(screen.getByText(/还没有岛民/)).toBeInTheDocument();
  });
});
