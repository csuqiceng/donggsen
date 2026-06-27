import { describe, expect, it } from 'vitest';
import { placeRoomFurniture, ROOM_GRID } from './room';
import type { LocalUserState } from './types';

function stateWith(inventory: Record<string, number>, roomFurniture: LocalUserState['roomFurniture'] = []): LocalUserState {
  return {
    clientId: 'c', username: '哥哥', avatar: 'rosie', syncVersion: 0, currentDayIndex: 0,
    selectedDifficulty: 'standard', selectedPlanMode: 'standard', dayStates: {},
    inventory, warehouseContribution: {}, collection: { discovered: [], completed: [] }, giftClaims: {},
    roomFurniture,
  };
}

describe('room', () => {
  it('ROOM_GRID 给出房间尺寸', () => {
    expect(ROOM_GRID.size).toBeGreaterThan(0);
  });

  it('placeRoomFurniture：消耗 1 件成品并记录坐标', () => {
    const before = stateWith({ wooden_chair: 2 });
    const result = placeRoomFurniture(before, 'wooden_chair', 1, 2);
    expect(result.ok).toBe(true);
    expect(result.state.inventory.wooden_chair).toBe(1);
    expect(result.state.roomFurniture).toHaveLength(1);
    expect(result.state.roomFurniture[0]).toMatchObject({ recipeId: 'wooden_chair', tx: 1, ty: 2 });
  });

  it('成品不足：失败不改变状态', () => {
    const before = stateWith({ wooden_chair: 0 });
    const result = placeRoomFurniture(before, 'wooden_chair', 0, 0);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(before);
  });

  it('坐标越界：失败', () => {
    const before = stateWith({ wooden_chair: 1 });
    const result = placeRoomFurniture(before, 'wooden_chair', ROOM_GRID.size, 0);
    expect(result.ok).toBe(false);
  });
});
