import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushUserState } from './api';
import { createInitialState } from './training';
import { deriveUserKey } from './compat';

const baseState = createInitialState('哥哥');
const selfKey = deriveUserKey('哥哥');
let originalFetch: typeof globalThis.fetch;

beforeEach(() => { originalFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = originalFetch; });

function mockFetch(responder: (call: number) => { status: number; body: unknown }) {
  let calls = 0;
  const fn = vi.fn(async () => {
    calls += 1;
    const { status, body } = responder(calls);
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
  });
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
  return () => calls;
}

describe('pushUserState 共享补丁冲突重试', () => {
  it('409 冲突且带 shared 时，用恢复后的状态重试一次并成功', async () => {
    const getCalls = mockFetch(call => call === 1
      ? { status: 409, body: { ok: false, error: 'Stale data rejected', version: 5, users: { [selfKey]: { syncVersion: 5, displayName: '哥哥' } } } }
      : { status: 200, body: { ok: true, version: 6, users: { [selfKey]: { syncVersion: 6, displayName: '哥哥' } }, shared: {} } });

    const result = await pushUserState(baseState, { mailboxEntry: { id: 'mail_1', text: 'hi', createdAt: 1 } });
    expect(getCalls()).toBe(2);
    expect(result.conflict).toBe(false);
  });

  it('409 冲突无 shared 时不重试，返回 conflict', async () => {
    const getCalls = mockFetch(() => ({ status: 409, body: { ok: false, error: 'Stale', users: { [selfKey]: { syncVersion: 5, displayName: '哥哥' } } } }));
    const result = await pushUserState(baseState, null);
    expect(getCalls()).toBe(1);
    expect(result.conflict).toBe(true);
  });

  it('重试仍 409 时返回 conflict', async () => {
    const getCalls = mockFetch(() => ({ status: 409, body: { ok: false, error: 'Stale', users: { [selfKey]: { syncVersion: 5, displayName: '哥哥' } } } }));
    const result = await pushUserState(baseState, { mailboxEntry: { id: 'mail_2', text: 'yo', createdAt: 2 } });
    expect(getCalls()).toBe(2);
    expect(result.conflict).toBe(true);
  });

  it('首次成功不重试', async () => {
    const getCalls = mockFetch(() => ({ status: 200, body: { ok: true, users: { [selfKey]: { syncVersion: 1, displayName: '哥哥' } } } }));
    const result = await pushUserState(baseState, null);
    expect(getCalls()).toBe(1);
    expect(result.conflict).toBe(false);
  });
});
