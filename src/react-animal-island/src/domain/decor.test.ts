import { describe, expect, it } from 'vitest';
import { createInitialState } from './training';
import { canAffordDecor, createDecorPlacement, formatDecorCost, normalizeDecor } from './decor';

describe('decor domain compatibility', () => {
  it('normalizes old shared decor records', () => {
    const decor = normalizeDecor({
      flower_sign: { ownerKey: 'name_a', ownerName: '哥哥', placedAt: 1 },
      unknown: { ownerName: 'x' },
    });

    expect(decor.flower_sign).toMatchObject({ id: 'flower_sign', ownerName: '哥哥', placedAt: 1 });
    expect(decor.unknown).toBeUndefined();
  });

  it('checks cost and creates old-compatible decor patch', () => {
    const state = createInitialState('哥哥');
    state.inventory = { wood: 2, weed: 2 };

    expect(canAffordDecor('flower_sign', state.inventory)).toBe(true);
    expect(formatDecorCost('flower_sign', state.inventory)).toContain('木材 2/1');

    const result = createDecorPlacement(state, null, 'flower_sign', 1000);
    expect(result.nextState.inventory).toMatchObject({ wood: 1, weed: 0 });
    expect(result.nextState.collection.discovered).toContain('decor_flower_sign');
    expect(result.patch).toEqual({ id: 'flower_sign', placedAt: 1000 });
  });
});
