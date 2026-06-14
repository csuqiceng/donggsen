// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarPicker } from './AvatarPicker';
import { AVATARS } from '../domain/config';

describe('AvatarPicker', () => {
  it('渲染全部头像并点击选择', () => {
    const onSelect = vi.fn();
    render(<AvatarPicker avatars={AVATARS} selected="rosie" onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(AVATARS.length);
    fireEvent.click(screen.getByAltText('Alfonso'));
    expect(onSelect).toHaveBeenCalledWith('alfonso');
  });

  it('选中头像标注 aria-pressed', () => {
    render(<AvatarPicker avatars={AVATARS} selected="rosie" onSelect={() => {}} />);
    expect(screen.getByAltText('Rosie').closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByAltText('Alfonso').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
