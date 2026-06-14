import { GIFT_RULES } from './config';
import { deriveUserKey, normalizeName, sanitizeFixedUser } from './compat';
import { getDayKey } from './training';
import type { DayState, GiftClaim, LocalUserState, ServerState, ServerUserRecord } from './types';

export interface Participant {
  userKey: string;
  name: string;
  dayStates: Record<string, DayState>;
  giftClaims: Record<string, GiftClaim | boolean>;
  isMe: boolean;
}

export interface WishEntry {
  item: string;
  ownerKey: string;
  ownerName: string;
  fulfillmentId: string;
}

export function normalizeGiftClaims(saved: unknown): Record<string, GiftClaim> {
  const out: Record<string, GiftClaim> = {};
  if (!saved || typeof saved !== 'object') return out;
  Object.entries(saved as Record<string, unknown>).forEach(([id, raw]) => {
    if (!raw || typeof raw !== 'object') return;
    const claim = raw as Record<string, unknown>;
    const ruleId = String(claim.ruleId || id).split('__')[0];
    if (!GIFT_RULES.some(rule => rule.id === ruleId)) return;
    const status = claim.status === 'redeemed' ? 'redeemed' : 'requested';
    out[id] = {
      id: String(claim.id || id),
      ruleId,
      ownerKey: String(claim.ownerKey || ''),
      ownerName: String(claim.ownerName || ''),
      status,
      requestedAt: Number(claim.requestedAt || 0),
      redeemedAt: Number(claim.redeemedAt || 0),
      redeemedBy: String(claim.redeemedBy || ''),
    };
  });
  return out;
}

type WishLists = Record<string, { ownerKey: string; ownerName: string; items: string[]; updatedAt: number }>;

export function normalizeWishLists(saved: unknown): WishLists {
  const out: WishLists = {};
  if (!saved || typeof saved !== 'object') return out;
  Object.entries(saved as Record<string, unknown>).forEach(([key, raw]) => {
    if (!raw || typeof raw !== 'object') return;
    const entry = raw as Record<string, unknown>;
    const items = Array.isArray(entry.items)
      ? entry.items.map(item => String(item || '').trim()).filter(Boolean).slice(0, 5)
      : [];
    out[key] = {
      ownerKey: String(entry.ownerKey || key),
      ownerName: String(entry.ownerName || '伙伴'),
      items,
      updatedAt: Number(entry.updatedAt || 0),
    };
  });
  return out;
}

export function normalizeWishFulfillments(saved: unknown): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  if (!saved || typeof saved !== 'object') return out;
  Object.entries(saved as Record<string, unknown>).forEach(([id, raw]) => {
    if (!raw || typeof raw !== 'object') return;
    const entry = raw as Record<string, unknown>;
    const item = String(entry.item || '').trim();
    if (!item) return;
    out[String(entry.id || id)] = {
      id: String(entry.id || id),
      item,
      ownerKey: String(entry.ownerKey || ''),
      ownerName: String(entry.ownerName || '伙伴'),
      fulfilledByKey: String(entry.fulfilledByKey || ''),
      fulfilledByName: String(entry.fulfilledByName || '伙伴'),
      fulfilledAt: Number(entry.fulfilledAt || 0),
      status: 'fulfilled',
    };
  });
  return out;
}

export function getSelfUserKey(state: LocalUserState) {
  return deriveUserKey(state.username);
}

export function getParticipants(state: LocalUserState, server: ServerState | null): Participant[] {
  const selfKey = getSelfUserKey(state);
  const peers = Object.values(server?.users || {})
    .filter(user => sanitizeFixedUser(user.displayName || user.username || '') && deriveUserKey(user.displayName || user.username || '') !== selfKey)
    .map(user => toParticipant(user, false));
  return [{
    userKey: selfKey,
    name: state.username,
    dayStates: state.dayStates,
    giftClaims: state.giftClaims,
    isMe: true,
  }, ...peers];
}

export function getGiftClaimId(ruleId: string, userKey: string) {
  return `${ruleId}__${encodeURIComponent(userKey)}`;
}

export function getGiftProgress(ruleId: string, state: LocalUserState, server: ServerState | null, participant = getParticipants(state, server)[0]) {
  const range = getCurrentWeekRange(state.currentDayIndex);
  if (ruleId === 'milk_tea') return { value: countSettledStates(participant.dayStates), target: 3 };
  if (ruleId === 'dinner_together') return { value: countSameDayCheckins(state, server, range), target: 2 };
  if (ruleId === 'weekend_gift') {
    return { value: getParticipants(state, server).reduce((sum, item) => sum + countWeekSettled(item.dayStates, range), 0), target: 8 };
  }
  if (ruleId === 'wish_pick') return { value: countChallengeCompletions(participant.dayStates), target: 3 };
  if (ruleId === 'welcome_back') return { value: hasReturnedAfterRest(participant.dayStates) ? 1 : 0, target: 1 };
  if (ruleId === 'base_decor') return { value: sumWarehouse(state, server), target: 30 };
  return { value: 0, target: 1 };
}

export function createGiftRequest(state: LocalUserState, ruleId: string, server: ServerState | null, now = Date.now()) {
  const rule = GIFT_RULES.find(item => item.id === ruleId);
  if (!rule) throw new Error('礼物规则不存在');
  const progress = getGiftProgress(ruleId, state, server);
  if (progress.value < progress.target) throw new Error('礼物还未解锁');
  const ownerKey = getSelfUserKey(state);
  const claim: GiftClaim = {
    id: getGiftClaimId(ruleId, ownerKey),
    ruleId,
    ownerKey,
    ownerName: state.username,
    status: 'requested',
    requestedAt: now,
    redeemedAt: 0,
    redeemedBy: '',
  };
  const nextState: LocalUserState = {
    ...state,
    giftClaims: { ...state.giftClaims, [ruleId]: { status: 'requested', requestedAt: now, redeemedAt: 0, redeemedBy: '' } },
    collection: addDiscovery(state, `gift_${ruleId}`),
  };
  return { nextState, claim };
}

export function createGiftRedeemPatch(claim: GiftClaim, state: LocalUserState, now = Date.now()) {
  if (!claim.id || !claim.ruleId || claim.status !== 'requested') throw new Error('包裹不能兑现');
  if (claim.ownerKey === getSelfUserKey(state)) throw new Error('不能兑现自己的包裹');
  const updated: GiftClaim = {
    ...claim,
    status: 'redeemed',
    redeemedAt: now,
    redeemedBy: state.username,
  };
  return {
    nextState: { ...state, collection: addDiscovery(state, `gift_${claim.ruleId}`) },
    claim: updated,
  };
}

export function getOwnWishList(server: ServerState | null, state: LocalUserState): string[] {
  return normalizeWishLists(server?.shared?.wishLists)[getSelfUserKey(state)]?.items || [];
}

export function updateWishList(current: string[], nextItem?: string, removeIndex?: number): string[] {
  const cleaned = current.map(item => String(item || '').trim().slice(0, 40)).filter(Boolean);
  if (typeof removeIndex === 'number') return cleaned.filter((_, index) => index !== removeIndex);
  const value = String(nextItem || '').trim().slice(0, 40);
  if (!value) return [...new Set(cleaned)].slice(0, 5);
  return [...new Set([...cleaned, value])].slice(0, 5);
}

export function getPeerWishEntries(server: ServerState | null, state: LocalUserState): WishEntry[] {
  const selfKey = getSelfUserKey(state);
  const fulfillments = normalizeWishFulfillments(server?.shared?.wishFulfillments);
  return Object.entries(normalizeWishLists(server?.shared?.wishLists))
    .filter(([key, entry]) => key !== selfKey && entry.items?.length)
    .flatMap(([, entry]) => entry.items.map(item => ({
      item,
      ownerKey: entry.ownerKey || '',
      ownerName: entry.ownerName || '伙伴',
      fulfillmentId: getWishFulfillmentId(entry.ownerKey || '', item),
    })))
    .filter(entry => !fulfillments[entry.fulfillmentId]);
}

export function createWishFulfillment(entry: WishEntry, state: LocalUserState, now = Date.now()) {
  return {
    id: entry.fulfillmentId,
    item: entry.item,
    ownerKey: entry.ownerKey,
    ownerName: entry.ownerName,
    fulfilledByKey: getSelfUserKey(state),
    fulfilledByName: state.username,
    fulfilledAt: now,
    status: 'fulfilled',
  };
}

export function getGiftHistory(_state: LocalUserState, server: ServerState | null) {
  const sharedClaims = normalizeGiftClaims(server?.shared?.giftClaims);
  const entries = Object.values(sharedClaims)
    .filter(claim => claim.status === 'redeemed')
    .map(claim => ({
      id: claim.id || `${claim.ruleId}-${claim.redeemedAt}`,
      name: claim.ownerName || '伙伴',
      title: GIFT_RULES.find(rule => rule.id === claim.ruleId)?.title || claim.ruleId || '礼物',
      at: claim.redeemedAt || claim.requestedAt || 0,
    }));
  Object.values(normalizeWishFulfillments(server?.shared?.wishFulfillments)).forEach(entry => {
    entries.push({
      id: String(entry.id),
      name: String(entry.fulfilledByName || '伙伴'),
      title: `实现心愿：${entry.item}`,
      at: Number(entry.fulfilledAt || 0),
    });
  });
  return entries.sort((a, b) => b.at - a.at).slice(0, 6);
}

function toParticipant(user: ServerUserRecord, isMe: boolean): Participant {
  const name = user.displayName || user.username || '伙伴';
  return {
    userKey: user.userKey || deriveUserKey(name),
    name,
    dayStates: user.dayStates || {},
    giftClaims: user.giftClaims || {},
    isMe,
  };
}

function getCurrentWeekRange(currentDayIndex: number) {
  const start = Math.floor(Math.max(0, currentDayIndex) / 7) * 7;
  return { start, end: start + 6 };
}

function countSameDayCheckins(state: LocalUserState, server: ServerState | null, range: { start: number; end: number }) {
  const peers = getParticipants(state, server).filter(participant => !participant.isMe);
  let count = 0;
  for (let index = range.start; index <= range.end; index += 1) {
    const mine = getDayState(state.dayStates, index)?.settled;
    const peer = peers.some(participant => getDayState(participant.dayStates, index)?.settled);
    if (mine && peer) count += 1;
  }
  return count;
}

function countSettledStates(states: Record<string, DayState>) {
  return Object.values(states || {}).filter(state => state?.settled).length;
}

function countWeekSettled(states: Record<string, DayState>, range: { start: number; end: number }) {
  let count = 0;
  for (let index = range.start; index <= range.end; index += 1) {
    if (getDayState(states, index)?.settled) count += 1;
  }
  return count;
}

function countChallengeCompletions(states: Record<string, DayState>) {
  return Object.values(states || {}).filter(state => {
    const checked = Array.isArray(state.checked) ? state.checked.filter(Boolean).length : 0;
    return state.settled && state.difficulty === 'challenge' && checked > 0 && checked === (state.checked?.length || 0);
  }).length;
}

function hasReturnedAfterRest(states: Record<string, DayState>) {
  let sawRest = false;
  return Object.entries(states || {})
    .sort(([a], [b]) => getStateIndex(a) - getStateIndex(b))
    .some(([, state]) => {
      if (state?.rest || state?.missed) sawRest = true;
      return sawRest && Boolean(state?.settled && !state.rest && !state.missed);
    });
}

function sumWarehouse(state: LocalUserState, server: ServerState | null) {
  const total = (source?: Record<string, number>) => Object.values(source || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return total(state.warehouseContribution) + Object.values(server?.users || {}).reduce((sum, user) => sum + total(user.warehouseContribution), 0);
}

function getStateIndex(key: string) {
  const match = key.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getDayState(states: Record<string, DayState>, index: number) {
  return states[getDayKey(index)] || states[String(index)];
}

function getWishFulfillmentId(ownerKey: string, item: string) {
  return `wish_${makeShortHash(ownerKey)}_${makeShortHash(normalizeName(item))}`;
}

function makeShortHash(value: string) {
  let hash = 5381;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function addDiscovery(state: LocalUserState, id: string) {
  return {
    ...state.collection,
    discovered: state.collection.discovered.includes(id) ? state.collection.discovered : [...state.collection.discovered, id],
  };
}
