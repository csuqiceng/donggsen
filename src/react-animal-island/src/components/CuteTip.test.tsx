// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CuteTip } from './CuteTip';

describe('CuteTip', () => {
  it('渲染提示文本与默认叶子图标', () => {
    render(<CuteTip text="路线已切换" />);
    expect(screen.getByText('路线已切换')).toBeInTheDocument();
    expect(screen.getByText('🍃')).toBeInTheDocument();
  });

  it('支持自定义图标', () => {
    render(<CuteTip text="盖章啦" icon="🐱" />);
    expect(screen.getByText('🐱')).toBeInTheDocument();
  });

  it('空文本不渲染', () => {
    const { container } = render(<CuteTip text="" />);
    expect(container.querySelector('.cute-tip')).toBeNull();
  });
});
