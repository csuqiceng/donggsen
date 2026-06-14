import { DECOR_ITEMS, ITEMS } from './config';
import type { CountMap, LocalUserState, ServerState } from './types';

export interface DecorRecord {
  id: string;
  ownerKey: string;
  ownerName: string;
  placedAt: number;
  updatedAt?: number;
}

export function normalizeDecor(saved: unknown): Record<string, DecorRecord> {
  const out: Record<string, DecorRecord> = {};
  if (!saved || typeof saved !== 'object') return out;
  Object.entries(saved as Record<string, unknown>).forEach(([id, raw]) => {
    const meta = DECOR_ITEMS.find(item => item.id === id || item.id === (raw as { id?: unknown } | null)?.id);
    if (!meta || !raw || typeof raw !== 'object') return;
    const item = raw as Record<string, unknown>;
    out[meta.id] = {
      id: meta.id,
      ownerKey: String(item.ownerKey || ''),
      ownerName: String(item.ownerName || ''),
      placedAt: Number(item.placedAt || item.updatedAt || 0),
      updatedAt: Number(item.updatedAt || item.placedAt || 0),
    };
  });
  return out;
}

export function canAffordDecor(id: string, inventory: CountMap) {
  const item = DECOR_ITEMS.find(decor => decor.id === id);
  if (!item) return false;
  return Object.entries(item.cost).every(([key, value]) => (inventory[key] || 0) >= value);
}

export function isDecorPlaced(id: string, server: ServerState | null) {
  return Boolean(normalizeDecor(server?.shared?.decor)[id]);
}

export function formatDecorCost(id: string, inventory: CountMap) {
  const item = DECOR_ITEMS.find(decor => decor.id === id);
  if (!item) return '';
  return Object.entries(item.cost)
    .map(([key, value]) => `${ITEMS[key]?.name || key} ${inventory[key] || 0}/${value}`)
    .join(' · ');
}

export function createDecorPlacement(state: LocalUserState, server: ServerState | null, id: string, now = Date.now()) {
  const item = DECOR_ITEMS.find(decor => decor.id === id);
  if (!item) throw new Error('装饰不存在');
  if (isDecorPlaced(id, server)) throw new Error('装饰已经放置');
  if (!canAffordDecor(id, state.inventory)) throw new Error('材料不足');
  const inventory = { ...state.inventory };
  Object.entries(item.cost).forEach(([key, value]) => {
    inventory[key] = Math.max(0, (inventory[key] || 0) - value);
  });
  return {
    nextState: {
      ...state,
      inventory,
      collection: {
        ...state.collection,
        discovered: state.collection.discovered.includes(`decor_${id}`) ? state.collection.discovered : [...state.collection.discovered, `decor_${id}`],
      },
    },
    patch: { id, placedAt: now },
  };
}
