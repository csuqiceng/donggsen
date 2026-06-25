import { describe, expect, it } from 'vitest';
import { CRAFT_RECIPES, canCraft, craft, getRecipe, placeCraft, GRID_RECIPES, matchGridRecipe, craftFromGrid } from './workshop';
import type { LocalUserState } from './types';

function stateWith(inventory: Record<string, number>): LocalUserState {
  return {
    clientId: 'c', username: '哥哥', avatar: 'rosie', syncVersion: 0, currentDayIndex: 0,
    selectedDifficulty: 'standard', selectedPlanMode: 'standard', dayStates: {},
    inventory, warehouseContribution: {}, collection: { discovered: [], completed: [] }, giftClaims: {},
  };
}

describe('workshop 配方', () => {
  it('包含家具与房子两类', () => {
    const cats = new Set(CRAFT_RECIPES.map(r => r.category));
    expect(cats.has('furniture')).toBe(true);
    expect(cats.has('house')).toBe(true);
  });
  it('房子配方消耗石头与木材', () => {
    const house = getRecipe('house');
    expect(house).not.toBeNull();
    expect(house!.cost.stone).toBeGreaterThan(0);
    expect(house!.cost.wood).toBeGreaterThan(0);
  });
});

describe('canCraft', () => {
  it('材料足够返回 true', () => {
    const r = getRecipe('house')!;
    expect(canCraft(stateWith({ stone: 5, wood: 10 }).inventory, r)).toBe(true);
  });
  it('材料不足返回 false', () => {
    const r = getRecipe('house')!;
    expect(canCraft(stateWith({ stone: 2, wood: 10 }).inventory, r)).toBe(false);
  });
});

describe('craft', () => {
  it('成功：扣除材料并 +1 成品到背包', () => {
    const r = getRecipe('house')!;
    const before = stateWith({ stone: 5, wood: 10 });
    const result = craft(before, 'house');
    expect(result.ok).toBe(true);
    expect(result.state.inventory.stone).toBe(0);
    expect(result.state.inventory.wood).toBe(0);
    expect(result.state.inventory.house).toBe(1);
  });
  it('材料不足：失败且不改变状态', () => {
    const before = stateWith({ stone: 1, wood: 10 });
    const result = craft(before, 'house');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('材料');
    expect(result.state).toBe(before); // 原状态不变
  });
  it('未知配方失败', () => {
    const result = craft(stateWith({ wood: 99 }), 'nope');
    expect(result.ok).toBe(false);
  });
  it('可多次合成家具累计计数', () => {
    const r = getRecipe('furniture')!; // 假设存在 furniture 配方
    let s = stateWith({ wood: r.cost.wood * 3 });
    s = craft(s, 'furniture').state;
    s = craft(s, 'furniture').state;
    expect(s.inventory.furniture).toBe(2);
  });
});

describe('placeCraft', () => {
  it('成功：消耗 1 个成品并返回带坐标的实例 patch', () => {
    const before = stateWith({ furniture: 2 });
    const result = placeCraft(before, 'furniture', 0, 1000);
    expect(result.ok).toBe(true);
    expect(result.state.inventory.furniture).toBe(1);
    expect(result.patch.craftPlacement.recipeId).toBe('furniture');
    expect(typeof result.patch.craftPlacement.x).toBe('number');
    expect(typeof result.patch.craftPlacement.y).toBe('number');
    expect(result.patch.craftPlacement.placedAt).toBe(1000);
  });
  it('成品不足：失败且不改变状态', () => {
    const before = stateWith({ furniture: 0 });
    const result = placeCraft(before, 'furniture', 0, 1000);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(before);
  });
  it('不同 seq 给出不同坐标（避免重叠）', () => {
    const s = stateWith({ furniture: 10 });
    const a = placeCraft(s, 'furniture', 0, 1).patch.craftPlacement;
    const b = placeCraft(s, 'furniture', 1, 2).patch.craftPlacement;
    expect(`${a.x},${a.y}`).not.toBe(`${b.x},${b.y}`);
  });
  it('未知配方失败', () => {
    const result = placeCraft(stateWith({ nope: 1 }), 'nope', 0, 1);
    expect(result.ok).toBe(false);
  });
});

describe('合成台 grid', () => {
  it('GRID_RECIPES 含多输入家具与房子', () => {
    const chair = GRID_RECIPES.find(r => r.id === 'wooden_chair');
    expect(chair).toBeTruthy();
    expect(Object.keys(chair!.ingredients).length).toBeGreaterThanOrEqual(2); // 多物品组合
    expect(GRID_RECIPES.some(r => r.category === 'house')).toBe(true);
  });

  it('matchGridRecipe：材料组合匹配某配方（与格子位置无关）', () => {
    // 木椅 = wood2 + softwood1，放在任意格子都应匹配
    const grid = [null, 'wood', null, 'wood', 'softwood', null, null, null, null];
    expect(matchGridRecipe(grid)?.id).toBe('wooden_chair');
  });

  it('matchGridRecipe：组合不匹配任何配方返回 null', () => {
    expect(matchGridRecipe(['wood', null, null, null, null, null, null, null, null])).toBeNull();
  });

  it('craftFromGrid：匹配且材料足够 → 扣材料 +1 成品', () => {
    const grid = [null, 'wood', null, 'wood', 'softwood', null, null, null, null];
    const before = stateWith({ wood: 5, softwood: 2 });
    const result = craftFromGrid(before, grid);
    expect(result.ok).toBe(true);
    expect(result.recipe?.id).toBe('wooden_chair');
    expect(result.state.inventory.wood).toBe(3); // -2
    expect(result.state.inventory.softwood).toBe(1); // -1
    expect(result.state.inventory.wooden_chair).toBe(1);
  });

  it('craftFromGrid：匹配但材料不足 → 失败不改变状态', () => {
    const grid = [null, 'wood', null, 'wood', 'softwood', null, null, null, null];
    const before = stateWith({ wood: 1, softwood: 1 });
    const result = craftFromGrid(before, grid);
    expect(result.ok).toBe(false);
    expect(result.state).toBe(before);
  });

  it('craftFromGrid：空格子/无匹配 → 失败', () => {
    const result = craftFromGrid(stateWith({ wood: 9 }), [null, null, null, null, null, null, null, null, null]);
    expect(result.ok).toBe(false);
  });
});

