import { describe, expect, it } from 'vitest';
import { getMuseumExhibits, getMuseumRooms, type MuseumContext } from './museum';

function ctx(over: Partial<MuseumContext> = {}): MuseumContext {
  return {
    inventory: {},
    discovered: [],
    giftProgress: () => ({ value: 0, target: 1 }),
    trophyProgress: () => ({ value: 0, target: 1 }),
    ...over,
  };
}

describe('博物馆展品', () => {
  it('按 4 房间生成展品：特殊6 + 隐藏10 + 礼物6 + 奖杯9（含铃钱袋/金叶奖杯/4节日）', () => {
    const exhibits = getMuseumExhibits(ctx());
    expect(exhibits.filter(e => e.room === 'special')).toHaveLength(6);
    expect(exhibits.filter(e => e.room === 'hidden')).toHaveLength(10);
    expect(exhibits.filter(e => e.room === 'gift')).toHaveLength(6);
    expect(exhibits.filter(e => e.room === 'trophy')).toHaveLength(9);
  });

  it('extra 条目按 discovered 判定 found（铃钱袋/节日）', () => {
    const exhibits = getMuseumExhibits(ctx({ discovered: ['bells_bag', 'festival_new_year'] }));
    expect(exhibits.find(e => e.id === 'museum_extra_bells_bag')?.found).toBe(true);
    expect(exhibits.find(e => e.id === 'museum_extra_festival_new_year')?.found).toBe(true);
    expect(exhibits.find(e => e.id === 'museum_extra_festival_halloween')?.found).toBe(false);
  });

  it('special 展品按持有或发现判定 found', () => {
    const exhibits = getMuseumExhibits(ctx({ inventory: { ironNugget: 1 }, discovered: ['starFragment'] }));
    expect(exhibits.find(e => e.id === 'museum_item_ironNugget')?.found).toBe(true);
    expect(exhibits.find(e => e.id === 'museum_item_starFragment')?.found).toBe(true);
    expect(exhibits.find(e => e.id === 'museum_item_clay')?.found).toBe(false);
  });

  it('hidden 展品只收非普通隐藏传闻', () => {
    const exhibits = getMuseumExhibits(ctx({ discovered: ['steady_builder'] }));
    expect(exhibits.find(e => e.id === 'museum_hidden_steady_builder')?.found).toBe(true);
  });

  it('gift 展品用 giftProgress 算进度', () => {
    const exhibits = getMuseumExhibits(ctx({ giftProgress: id => id === 'milk_tea' ? { value: 3, target: 3 } : { value: 0, target: 1 } }));
    const milk = exhibits.find(e => e.id === 'museum_gift_milk_tea');
    expect(milk?.progressValue).toBe(3);
    expect(milk?.progressTarget).toBe(3);
  });

  it('trophy 展品按 trophyProgress 判定 found', () => {
    const exhibits = getMuseumExhibits(ctx({ trophyProgress: id => id === 'first_checkin' ? { value: 1, target: 1 } : { value: 0, target: 1 } }));
    expect(exhibits.find(e => e.id === 'museum_trophy_first_checkin')?.found).toBe(true);
    expect(exhibits.find(e => e.id === 'museum_trophy_builder')?.found).toBe(false);
  });
});

describe('博物馆房间', () => {
  it('返回 4 房间及各自统计', () => {
    const rooms = getMuseumRooms(ctx());
    expect(rooms.map(r => r.id)).toEqual(['special', 'hidden', 'gift', 'trophy']);
    expect(rooms.find(r => r.id === 'trophy')?.total).toBe(9);
  });
});
