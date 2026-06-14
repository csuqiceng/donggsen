// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AvatarPicker } from './AvatarPicker';
import { AVATARS } from '../domain/config';

describe('AvatarPicker', () => {
  it('渲染全部头像并点击选择', () => {
    const onSelect = vi.fn();
    render(<AvatarPicker avatars={AVATARS} selected="rosie" onSelect={onSelect} />);
    expect(screen.getAllByRole('button')).toHaveLength(AVATARS.length);
    screen.getByAltText('Alfonso').click();
    expect(onSelect).toHaveBeenCalledWith('alfonso');
  });
});
