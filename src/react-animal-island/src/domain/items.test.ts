import { describe, expect, it } from 'vitest';
import { getItemSource, getItemUse, resolveItemUse, itemUseAction } from './items';

describe('物品使用按钮', () => {
  it('里数券按数量决定可用性', () => {
    expect(itemUseAction('nookMilesTicket', 0)).toEqual({ label: '没有里数券', enabled: false });
    expect(itemUseAction('nookMilesTicket', 2)).toEqual({ label: '使用 1 张查看线索', enabled: true });
  });

  it('铃钱/建设材料引导去岛屿，恒可用', () => {
    expect(itemUseAction('bells', 0)).toEqual({ label: '去岛屿装饰工坊', enabled: true });
    expect(itemUseAction('wood', 0)).toEqual({ label: '去岛屿建设', enabled: true });
    expect(itemUseAction('ironNugget', 0)).toEqual({ label: '去岛屿建设', enabled: true });
  });

  it('星碎/金叶按数量决定可用性', () => {
    expect(itemUseAction('starFragment', 1)).toEqual({ label: '点亮星星地砖', enabled: true });
    expect(itemUseAction('starFragment', 0)).toEqual({ label: '点亮星星地砖', enabled: false });
    expect(itemUseAction('goldenLeaf', 1)).toEqual({ label: '登记金叶奖杯', enabled: true });
  });

  it('其他物品(如黏土/树枝)无使用按钮', () => {
    expect(itemUseAction('clay', 5)).toBeNull();
    expect(itemUseAction('branch', 5)).toBeNull();
  });
});

describe('物品使用效果', () => {
  it('星碎点亮星星地砖图鉴并消耗 1', () => {
    expect(resolveItemUse('starFragment', { starFragment: 1 })).toEqual({ discovery: 'decor_star_tile', consume: 'starFragment' });
    expect(resolveItemUse('starFragment', { starFragment: 0 })).toBeNull();
  });

  it('金叶登记奖杯图鉴并消耗 1', () => {
    expect(resolveItemUse('goldenLeaf', { goldenLeaf: 2 })).toEqual({ discovery: 'trophy_golden_leaf', consume: 'goldenLeaf' });
  });

  it('里数券触发瓶中信线索动作', () => {
    expect(resolveItemUse('nookMilesTicket', { nookMilesTicket: 1 })).toEqual({ action: 'reveal_bottle_clue' });
  });

  it('铃钱与材料引导去岛屿', () => {
    expect(resolveItemUse('bells', {})).toEqual({ action: 'navigate_island' });
    expect(resolveItemUse('wood', {})).toEqual({ action: 'navigate_island' });
  });
});

describe('物品用途文案', () => {
  it('里数券/星碎/金叶有专门文案', () => {
    expect(getItemUse('nookMilesTicket')).toContain('瓶中信额外线索');
    expect(getItemUse('starFragment')).toContain('星星地砖');
    expect(getItemUse('goldenLeaf')).toContain('金叶奖杯');
  });

  it('建设材料进共同仓库', () => {
    expect(getItemUse('wood')).toContain('共同仓库');
  });
});

describe('物品来源文案', () => {
  it('稀有材料与隐藏奖励有专门来源', () => {
    expect(getItemSource('starFragment')).toContain('夜间');
    expect(getItemSource('nookMilesTicket')).toContain('同日登岛');
    expect(getItemSource('goldenLeaf')).toContain('轻松');
  });
});
