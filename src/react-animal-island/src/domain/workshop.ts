// 工坊合成：主动消耗现有材料打造家具 / 房子，成品进背包（计数）。
// 家具用木材类，房子用石头 + 木材。材料来源为每日打卡奖励。
import type { CountMap, LocalUserState } from './types';

export interface CraftRecipe {
  id: string;
  name: string;
  icon: string;
  cost: CountMap;
  category: 'furniture' | 'house';
  desc: string;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  { id: 'furniture', name: '家具', icon: '🪑', cost: { wood: 3 }, category: 'furniture', desc: '用木材打造的家具，可摆放到岛上。' },
  { id: 'house', name: '房子', icon: '🏠', cost: { stone: 5, wood: 10 }, category: 'house', desc: '岛上的小屋，建成后可点击进入。' },
];

export function getRecipe(id: string): CraftRecipe | null {
  return CRAFT_RECIPES.find(recipe => recipe.id === id) || null;
}

export function canCraft(inventory: CountMap, recipe: CraftRecipe): boolean {
  return Object.entries(recipe.cost).every(([key, need]) => (inventory[key] || 0) >= need);
}

export interface CraftResult {
  state: LocalUserState;
  ok: boolean;
  reason?: string;
}

export function craft(state: LocalUserState, recipeId: string): CraftResult {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { state, ok: false, reason: '未知配方' };
  if (!canCraft(state.inventory, recipe)) return { state, ok: false, reason: '材料不足' };
  const inventory: CountMap = { ...state.inventory };
  Object.entries(recipe.cost).forEach(([key, need]) => {
    inventory[key] = Math.max(0, (inventory[key] || 0) - need);
  });
  inventory[recipe.id] = (inventory[recipe.id] || 0) + 1;
  return { state: { ...state, inventory }, ok: true };
}

// 已摆放到岛上的打造品实例（坐标为地图百分比）
export interface PlacedCraft {
  id: string;
  recipeId: string;
  x: number;
  y: number;
  placedAt: number;
}

// 按 seq 自动分配不重叠的坐标（网格排布）
export function craftPosition(seq: number): { x: number; y: number } {
  const col = seq % 4;
  const row = Math.floor(seq / 4) % 3;
  return { x: 35 + col * 9, y: 58 + row * 8 };
}

// ===== 合成台（3×3 无序合成，类似 Minecraft 无序配方）=====
// 9 格，每格为 null 或材料 key；按材料组合（与位置无关）匹配配方。

export type CraftGrid = (string | null)[];

export interface GridRecipe {
  id: string;
  name: string;
  icon: string;
  category: 'furniture' | 'house';
  ingredients: Record<string, number>;
  desc: string;
}

export const GRID_RECIPES: GridRecipe[] = [
  { id: 'wooden_chair', name: '木椅', icon: '🪑', category: 'furniture', ingredients: { wood: 2, softwood: 1 }, desc: '用木材和软木材组合的椅子，放进房子里。' },
  { id: 'wooden_table', name: '木桌', icon: '🍽️', category: 'furniture', ingredients: { wood: 3, hardwood: 1 }, desc: '结实的桌子，硬木材让桌面更稳。' },
  { id: 'bed', name: '小床', icon: '🛏️', category: 'furniture', ingredients: { wood: 2, softwood: 2, weed: 1 }, desc: '软软的小床，杂草填了垫子。' },
  { id: 'fence', name: '木栅栏', icon: '🚧', category: 'furniture', ingredients: { wood: 3, stone: 1 }, desc: '围出院子的小栅栏。' },
  { id: 'flower_pot', name: '花盆', icon: '🪴', category: 'furniture', ingredients: { clay: 2, weed: 1 }, desc: '黏土烧的小花盆，种点杂草。' },
  { id: 'lamp', name: '台灯', icon: '💡', category: 'furniture', ingredients: { ironNugget: 1, wood: 2, clay: 1 }, desc: '铁矿石做的灯座，晚上亮起来。' },
  { id: 'rug', name: '地毯', icon: '🟫', category: 'furniture', ingredients: { weed: 3, shell: 1 }, desc: '杂草编织、贝壳镶边的地毯。' },
  { id: 'shelf', name: '书架', icon: '📚', category: 'furniture', ingredients: { hardwood: 3, wood: 1, ironNugget: 1 }, desc: '硬木材搭的三层书架。' },
  { id: 'house', name: '房子', icon: '🏠', category: 'house', ingredients: { bed: 1, wooden_chair: 2, wooden_table: 1, stone: 2, wood: 2 }, desc: '由小床、椅子和桌子搭起的家，建成后可点击进入。' },
];

function gridIngredients(grid: CraftGrid): Record<string, number> {
  const counts: Record<string, number> = {};
  grid.forEach(key => { if (key) counts[key] = (counts[key] || 0) + 1; });
  return counts;
}

function sameMultiset(a: Record<string, number>, b: Record<string, number>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every(key => a[key] === b[key]);
}

export function matchGridRecipe(grid: CraftGrid): GridRecipe | null {
  const placed = gridIngredients(grid);
  if (!Object.keys(placed).length) return null;
  return GRID_RECIPES.find(recipe => sameMultiset(recipe.ingredients, placed)) || null;
}

export interface GridCraftResult {
  state: LocalUserState;
  ok: boolean;
  recipe?: GridRecipe;
  reason?: string;
}

export function craftFromGrid(state: LocalUserState, grid: CraftGrid): GridCraftResult {
  const recipe = matchGridRecipe(grid);
  if (!recipe) return { state, ok: false, reason: '没有匹配的配方' };
  const hasAll = Object.entries(recipe.ingredients).every(([key, need]) => (state.inventory[key] || 0) >= need);
  if (!hasAll) return { state, ok: false, reason: '材料不足' };
  const inventory: CountMap = { ...state.inventory };
  Object.entries(recipe.ingredients).forEach(([key, need]) => {
    inventory[key] = Math.max(0, (inventory[key] || 0) - need);
  });
  inventory[recipe.id] = (inventory[recipe.id] || 0) + 1;
  return { state: { ...state, inventory }, ok: true, recipe };
}

export interface PlaceResult {
  state: LocalUserState;
  ok: boolean;
  reason?: string;
  patch: { craftPlacement: PlacedCraft };
}

export function placeCraft(state: LocalUserState, recipeId: string, seq: number, now: number): PlaceResult {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { state, ok: false, reason: '未知配方', patch: { craftPlacement: { id: '', recipeId, x: 0, y: 0, placedAt: now } } };
  if ((state.inventory[recipeId] || 0) < 1) return { state, ok: false, reason: '成品不足', patch: { craftPlacement: { id: '', recipeId, x: 0, y: 0, placedAt: now } } };
  const inventory: CountMap = { ...state.inventory, [recipeId]: state.inventory[recipeId] - 1 };
  const pos = craftPosition(seq);
  return {
    state: { ...state, inventory },
    ok: true,
    patch: { craftPlacement: { id: `craft_${now}_${seq}`, recipeId, x: pos.x, y: pos.y, placedAt: now } },
  };
}
