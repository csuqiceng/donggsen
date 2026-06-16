const STASHABLE = ['wood', 'stone', 'shell', 'ironNugget', 'softwood', 'hardwood', 'weed'];

export function useItemAction(key: string, count: number): { label: string; enabled: boolean } | null {
  if (key === 'nookMilesTicket') return { label: count > 0 ? '使用 1 张查看线索' : '没有里数券', enabled: count > 0 };
  if (key === 'bells') return { label: '去岛屿装饰工坊', enabled: true };
  if (STASHABLE.includes(key)) return { label: '去岛屿建设', enabled: true };
  if (key === 'starFragment') return { label: '点亮星星地砖', enabled: count > 0 };
  if (key === 'goldenLeaf') return { label: '登记金叶奖杯', enabled: count > 0 };
  return null;
}

export interface ItemUseResult {
  discovery?: string;
  consume?: string;
  action?: 'reveal_bottle_clue' | 'navigate_island';
}

export function useItem(key: string, inventory: Record<string, number>): ItemUseResult | null {
  const count = (key && inventory[key]) || 0;
  if (key === 'nookMilesTicket') return { action: 'reveal_bottle_clue' };
  if (key === 'starFragment') return count > 0 ? { discovery: 'decor_star_tile', consume: 'starFragment' } : null;
  if (key === 'goldenLeaf') return count > 0 ? { discovery: 'trophy_golden_leaf', consume: 'goldenLeaf' } : null;
  if (key === 'bells' || STASHABLE.includes(key)) return { action: 'navigate_island' };
  return null;
}

export function getItemUse(key: string): string {
  if (['wood', 'stone', 'shell', 'ironNugget'].includes(key)) return '用途：可进入共同仓库，推进小基地建设。';
  if (key === 'bells') return '用途：作为每次训练结算的积分化奖励，也可前往岛屿装饰工坊。';
  if (key === 'nookMilesTicket') return '用途：查看瓶中信额外线索，探索隐藏任务。';
  if (key === 'starFragment') return '用途：记录夜间隐藏任务，可点亮星星地砖。';
  if (key === 'goldenLeaf') return '用途：登记金叶奖杯，推进博物馆收藏。';
  return '用途：补齐图鉴，作为训练出现的纪念。';
}

const ITEM_SOURCES: Record<string, string> = {
  branch: '轻松难度常见奖励，可作为小基地启动材料。',
  wood: '标准训练奖励，也会计入共同仓库。',
  softwood: '标准训练奖励，用来建设岛上设施。',
  hardwood: '标准训练奖励，适合积累到仓库。',
  stone: '标准训练奖励，也会计入共同仓库。',
  ironNugget: '挑战难度奖励，稀有建设材料。',
  clay: '挑战难度奖励，适合后续扩建。',
  weed: '轻松难度奖励，保连续时也会出现。',
  shell: '标准训练奖励，和海边码头相关。',
  starFragment: '夜间打卡隐藏奖励。',
  bells: '每次结算按积分获得。',
  nookMilesTicket: '双人同日登岛或挑战奖励。',
  goldenLeaf: '连续轻松难度隐藏奖励。',
};

export function getItemSource(key: string): string {
  return ITEM_SOURCES[key] || '来自训练结算或隐藏任务。';
}
