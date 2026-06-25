import { describe, expect, it } from 'vitest';
import { GIFT_RULES } from './config';
import {
  createGiftRedeemPatch,
  createGiftRequest,
  createWishFulfillment,
  getGiftClaimId,
  getGiftProgress,
  getOwnWishList,
  getPeerWishEntries,
  normalizeGiftClaims,
  updateWishList,
} from './gifts';
import { createInitialState } from './training';
import type { ServerState } from './types';

describe('gift domain compatibility', () => {
  it('normalizes old shared gift claims', () => {
    const claims = normalizeGiftClaims({
      milk_tea__name_x: { ruleId: 'milk_tea', ownerKey: 'name_x', ownerName: '哥哥', status: 'redeemed', requestedAt: 1, redeemedAt: 2 },
      bad: true,
    });

    expect(claims.milk_tea__name_x).toMatchObject({ ruleId: 'milk_tea', status: 'redeemed', ownerName: '哥哥' });
    expect(claims.bad).toBeUndefined();
  });

  it('computes progress for personal and shared gift rules', () => {
    const state = createInitialState('哥哥');
    state.currentDayIndex = 4;
    state.dayStates = {
      day_0: { settled: true, checked: [true] },
      day_1: { settled: true, checked: [true] },
      day_2: { settled: true, checked: [true] },
    };
    const peer = createInitialState('乖宝');
    peer.dayStates = {
      day_1: { settled: true, checked: [true] },
      day_3: { settled: true, checked: [true] },
    };
    const server = { ok: true, users: { peer: { displayName: '乖宝', userKey: 'name_peer', dayStates: peer.dayStates } } } satisfies ServerState;

    expect(getGiftProgress('milk_tea', state, server)).toEqual({ value: 3, target: 3 });
    expect(getGiftProgress('dinner_together', state, server)).toEqual({ value: 1, target: 2 });
    expect(getGiftProgress('weekend_gift', state, server)).toEqual({ value: 5, target: 8 });
  });

  it('computes progress for old welcome-back and base-decor gift rules', () => {
    const state = createInitialState('哥哥');
    state.dayStates = {
      day_0: { settled: true, rest: true, missed: true, checked: [false] },
      day_1: { settled: true, checked: [true] },
    };
    state.warehouseContribution = { wood: 12, stone: 8 };
    const server = {
      ok: true,
      users: {
        peer: { displayName: '乖宝', userKey: 'name_peer', warehouseContribution: { shell: 10 } },
      },
    } satisfies ServerState;

    expect(getGiftProgress('welcome_back', state, server)).toEqual({ value: 1, target: 1 });
    expect(getGiftProgress('base_decor', state, server)).toEqual({ value: 30, target: 30 });
  });

  it('creates old-compatible gift request and redeem patches', () => {
    const state = createInitialState('哥哥');
    state.dayStates = {
      day_0: { settled: true, checked: [true] },
      day_1: { settled: true, checked: [true] },
      day_2: { settled: true, checked: [true] },
    };
    const result = createGiftRequest(state, 'milk_tea', null, 1000);
    const claimId = getGiftClaimId('milk_tea', result.claim.ownerKey || '');

    expect(result.claim).toMatchObject({ id: claimId, ruleId: 'milk_tea', status: 'requested', requestedAt: 1000 });
    expect(result.nextState.giftClaims.milk_tea).toMatchObject({ status: 'requested', requestedAt: 1000 });
    expect(result.nextState.collection.discovered).toContain('gift_milk_tea');

    const redeem = createGiftRedeemPatch({ ...result.claim, ownerKey: 'name_peer', ownerName: '乖宝' }, state, 2000);
    expect(redeem.claim).toMatchObject({ status: 'redeemed', redeemedAt: 2000, redeemedBy: '哥哥' });
  });

  it('keeps wish lists and fulfillment ids compatible with the old app', () => {
    const state = createInitialState('哥哥');
    const server: ServerState = {
      ok: true,
      shared: {
        wishLists: {
          name_peer: { ownerKey: 'name_peer', ownerName: '乖宝', items: ['手写卡片'], updatedAt: 1 },
        },
        wishFulfillments: {},
      },
    };

    expect(getOwnWishList(server, state)).toEqual([]);
    expect(updateWishList(['奶茶', '奶茶', '  '], '小蛋糕')).toEqual(['奶茶', '小蛋糕']);
    const [entry] = getPeerWishEntries(server, state);
    const fulfillment = createWishFulfillment(entry, state, 3000);

    expect(entry.item).toBe('手写卡片');
    expect(fulfillment).toMatchObject({ item: '手写卡片', ownerKey: 'name_peer', fulfilledByName: '哥哥', status: 'fulfilled' });
    expect(GIFT_RULES.some(rule => rule.id === 'wish_pick')).toBe(true);
    expect(GIFT_RULES.some(rule => rule.id === 'welcome_back')).toBe(true);
    expect(GIFT_RULES.some(rule => rule.id === 'base_decor')).toBe(true);
  });

  it('keeps old gift rule scope and description metadata for museum/details', () => {
    const dinner = GIFT_RULES.find(rule => rule.id === 'dinner_together');
    const milkTea = GIFT_RULES.find(rule => rule.id === 'milk_tea');

    expect(dinner).toMatchObject({ scope: 'coop', desc: '两个人同一天都登岛后解锁。' });
    expect(milkTea).toMatchObject({ scope: 'personal', desc: '连续出现的小奖励。' });
    expect(GIFT_RULES.every(rule => typeof rule.desc === 'string' && rule.desc.length > 0)).toBe(true);
  });
});
