// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageField } from './MessageField';

describe('MessageField', () => {
  it('显示当前留言并提交', () => {
    const onSubmit = vi.fn();
    render(<MessageField value="岛民留言" onChange={() => {}} onSubmit={onSubmit} maxLength={20} />);
    expect(screen.getByDisplayValue('岛民留言')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '保存留言' }));
    expect(onSubmit).toHaveBeenCalledWith('岛民留言');
  });

  it('输入触发 onChange', () => {
    const onChange = vi.fn();
    render(<MessageField value="" onChange={onChange} onSubmit={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/岛民留言/), { target: { value: '新内容' } });
    expect(onChange).toHaveBeenCalledWith('新内容');
  });
});
