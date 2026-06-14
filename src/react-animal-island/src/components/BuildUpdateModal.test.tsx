// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuildUpdateModal } from './BuildUpdateModal';

describe('BuildUpdateModal', () => {
  it('渲染建筑升级变化', () => {
    render(<BuildUpdateModal updates={[{ id: 'storage', name: '收纳仓库', from: '建设中', to: '建成' }]} onClose={() => {}} />);
    expect(screen.getByText('收纳仓库')).toBeInTheDocument();
    expect(screen.getByText('建设中 → 建成')).toBeInTheDocument();
  });

  it('无更新时不渲染', () => {
    const { container } = render(<BuildUpdateModal updates={[]} onClose={() => {}} />);
    expect(container.querySelector('.build-update')).toBeNull();
  });

  it('点击关闭按钮触发 onClose', () => {
    const onClose = vi.fn();
    render(<BuildUpdateModal updates={[{ id: 'storage', name: '收纳仓库', from: '建设中', to: '建成' }]} onClose={onClose} />);
    screen.getByRole('button', { name: /知道了/ }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
