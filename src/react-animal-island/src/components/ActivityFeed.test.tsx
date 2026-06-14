// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityFeed } from './ActivityFeed';

describe('ActivityFeed', () => {
  it('渲染活动项列表', () => {
    render(<ActivityFeed items={['哥哥 今天已登岛', '双人同日登岛，码头送来里数券']} />);
    const items = screen.getAllByTestId('activity-item');
    expect(items).toHaveLength(2);
    expect(screen.getByText('哥哥 今天已登岛')).toBeInTheDocument();
  });

  it('无活动显示空状态', () => {
    render(<ActivityFeed items={[]} />);
    expect(screen.getByText(/暂无活动/)).toBeInTheDocument();
  });
});
