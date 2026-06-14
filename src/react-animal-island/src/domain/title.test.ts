import { describe, expect, it } from 'vitest';
import { getUserTitle, type TitleContext } from './title';

function ctx(over: Partial<TitleContext> = {}): TitleContext {
  return { settledDays: 0, challengeFull: 0, warehouseTotal: 0, discovered: [], ...over };
}

describe('用户称号', () => {
  it('仓库贡献≥20 为建设代表（最高优先级）', () => {
    expect(getUserTitle(ctx({ warehouseTotal: 20, discovered: ['same_day_checkin'], challengeFull: 5 }))).toBe('建设代表');
  });

  it('同日登岛为同日岛民', () => {
    expect(getUserTitle(ctx({ discovered: ['same_day_checkin'] }))).toBe('同日岛民');
  });

  it('挑战完整3次为挑战岛民', () => {
    expect(getUserTitle(ctx({ challengeFull: 3 }))).toBe('挑战岛民');
  });

  it('累计7次为常驻岛民', () => {
    expect(getUserTitle(ctx({ settledDays: 7 }))).toBe('常驻岛民');
  });

  it('累计3次为上岛新星', () => {
    expect(getUserTitle(ctx({ settledDays: 3 }))).toBe('上岛新星');
  });

  it('新人为新岛民', () => {
    expect(getUserTitle(ctx())).toBe('新岛民');
  });
});
