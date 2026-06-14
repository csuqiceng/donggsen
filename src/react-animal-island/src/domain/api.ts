import { PLAN_URL, ROOM_KEY, SYNC_API } from './config';
import { buildUserPayload, findSelfRecord, normalizeMailbox, restoreUserFromServer } from './compat';
import type { LocalUserState, ServerState, SharedPatch, TrainingPlan } from './types';

export async function fetchPlan(): Promise<TrainingPlan> {
  const response = await fetch(PLAN_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`plan.json ${response.status}`);
  return response.json();
}

export async function fetchServerState(): Promise<ServerState> {
  const response = await fetch(`${SYNC_API}?room=${encodeURIComponent(ROOM_KEY)}&t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`state.php ${response.status}`);
  return response.json();
}

export async function pushUserState(state: LocalUserState, shared?: SharedPatch | null): Promise<{
  server: ServerState;
  restored: Partial<LocalUserState>;
  conflict: boolean;
}> {
  const response = await fetch(`${SYNC_API}?room=${encodeURIComponent(ROOM_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildUserPayload(state, shared)),
  });
  const server = await response.json().catch(() => ({ ok: false, error: 'Invalid JSON' }));
  const serverSelf = findSelfRecord(server.users, state.username);
  if (response.status === 409) {
    return { server, restored: restoreUserFromServer(serverSelf), conflict: true };
  }
  if (!response.ok || !server.ok) {
    throw new Error(server.error || `state.php ${response.status}`);
  }
  return { server, restored: restoreUserFromServer(serverSelf), conflict: false };
}

export function getSharedMailbox(server: ServerState | null) {
  return normalizeMailbox(server?.shared?.mailbox || []);
}
