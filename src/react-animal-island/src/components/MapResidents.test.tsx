// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MapResidents } from './MapResidents';

describe('MapResidents', () => {
  it('渲染居民头像点', () => {
    render(<MapResidents residents={[
      { name: '哥哥', avatar: 'rosie', x: 45, y: 58 },
      { name: '乖宝', avatar: 'alfonso', x: 55, y: 58 },
    ]} />);
    const points = screen.getAllByTestId('map-resident');
    expect(points).toHaveLength(2);
    expect(points[0]).toHaveTextContent('哥哥');
    expect(points[1]).toHaveTextContent('乖宝');
  });

  it('无居民不渲染', () => {
    const { container } = render(<MapResidents residents={[]} />);
    expect(container.querySelectorAll('[data-testid="map-resident"]')).toHaveLength(0);
  });
});
