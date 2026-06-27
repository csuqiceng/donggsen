import { FIXED_USERS } from './config';
import type { CountMap, LocalUserState, MailboxEntry, ServerUserRecord, SharedPatch, SyncPayload } from './types';

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function sanitizeFixedUser(name: string): '哥哥' | '乖宝' | null {
  const normalized = normalizeName(name);
  return FIXED_USERS.find(user => normalizeName(user) === normalized) ?? null;
}

export function deriveUserKey(name: string): string {
  return `name_${sha256(normalizeName(name)).slice(0, 24)}`;
}

function sha256(value: string): string {
  // Browser WebCrypto is async. This small SHA-256 implementation keeps tests and render paths synchronous.
  const rightRotate = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const maxWord = 2 ** 32;
  const bytes = Array.from(new TextEncoder().encode(value));
  const words: number[] = [];
  const bitLength = bytes.length * 8;
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] || 0) << 24) |
      ((bytes[i + 1] || 0) << 16) |
      ((bytes[i + 2] || 0) << 8) |
      (bytes[i + 3] || 0),
    );
  }
  words.push(Math.floor(bitLength / maxWord));
  words.push(bitLength);

  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(7, w[i - 15]) ^ rightRotate(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(17, w[i - 2]) ^ rightRotate(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(6, e) ^ rightRotate(11, e) ^ rightRotate(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(2, a) ^ rightRotate(13, a) ^ rightRotate(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  return hash.map(h => (h >>> 0).toString(16).padStart(8, '0')).join('');
}

export function normalizeCounts(value: unknown): CountMap {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, count]) => [key, Math.max(0, Number(count) || 0)] as const)
    .filter(([, count]) => count > 0));
}

export function normalizeMailbox(value: unknown): MailboxEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
      return {
        id: String(item.id || `mail_${index}`),
        authorKey: typeof item.authorKey === 'string' ? item.authorKey : '',
        authorName: String(item.authorName || item.name || '岛民').slice(0, 20),
        text: String(item.text || item.message || '').trim().slice(0, 80),
        createdAt: Number(item.createdAt || 0),
      };
    })
    .filter(entry => entry.text)
    .slice(-20);
}

export function restoreUserFromServer(serverSelf: ServerUserRecord | null | undefined): Partial<LocalUserState> {
  if (!serverSelf) return {};
  return {
    syncVersion: Number(serverSelf.syncVersion || 0),
    currentDayIndex: Number(serverSelf.currentDayIndex || 0),
    selectedDifficulty: serverSelf.selectedDifficulty || 'standard',
    selectedPlanMode: serverSelf.selectedPlanMode || 'standard',
    dayStates: serverSelf.dayStates || {},
    inventory: normalizeCounts(serverSelf.inventory),
    warehouseContribution: normalizeCounts(serverSelf.warehouseContribution),
    collection: {
      discovered: Array.isArray(serverSelf.collection?.discovered) ? serverSelf.collection.discovered : ['resident_services_tent'],
      completed: Array.isArray(serverSelf.collection?.completed) ? serverSelf.collection.completed : [],
    },
    giftClaims: serverSelf.giftClaims || {},
    avatar: serverSelf.avatar || 'rosie',
    message: serverSelf.message,
    lastLoginDate: serverSelf.lastLoginDate,
    loginStreak: serverSelf.loginStreak ? Number(serverSelf.loginStreak) : undefined,
    roomFurniture: Array.isArray(serverSelf.roomFurniture) ? serverSelf.roomFurniture.filter(f => f && typeof f === 'object') : [],
  };
}

export function buildUserPayload(state: LocalUserState, shared?: SharedPatch | null): SyncPayload {
  const user: ServerUserRecord = {
    clientId: state.clientId,
    username: state.username,
    displayName: state.username,
    avatar: state.avatar,
    message: state.message ?? '',
    dayStates: state.dayStates,
    currentDayIndex: state.currentDayIndex,
    inventory: state.inventory,
    warehouseContribution: state.warehouseContribution,
    collection: state.collection,
    selectedDifficulty: state.selectedDifficulty,
    selectedPlanMode: state.selectedPlanMode,
    giftClaims: state.giftClaims,
    syncVersion: state.syncVersion,
    lastLoginDate: state.lastLoginDate,
    loginStreak: state.loginStreak,
    roomFurniture: state.roomFurniture,
  };
  return shared ? { user, shared } : { user };
}

export function findSelfRecord(users: Record<string, ServerUserRecord> | undefined, username: string): ServerUserRecord | null {
  const expectedKey = deriveUserKey(username);
  return users?.[expectedKey] ?? Object.values(users || {}).find(user => normalizeName(user.displayName || user.username || '') === normalizeName(username)) ?? null;
}
