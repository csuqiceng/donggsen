// 房间内景（伪3D）：把已打造的家具放进房间网格。
export const ROOM_GRID = { size: 6 }; // 6×6 地板

export interface RoomFurniture {
  uid: string;
  recipeId: string;
  tx: number;
  ty: number;
}

export interface RoomPlaceResult {
  state: import('./types').LocalUserState;
  ok: boolean;
  reason?: string;
}

export function placeRoomFurniture(
  state: import('./types').LocalUserState,
  recipeId: string,
  tx: number,
  ty: number,
  now = Date.now(),
): RoomPlaceResult {
  if (tx < 0 || ty < 0 || tx >= ROOM_GRID.size || ty >= ROOM_GRID.size) {
    return { state, ok: false, reason: '位置越界' };
  }
  if ((state.inventory[recipeId] || 0) < 1) {
    return { state, ok: false, reason: '成品不足' };
  }
  const roomFurniture: RoomFurniture[] = [...(state.roomFurniture || []), { uid: `rf_${now}_${tx}_${ty}`, recipeId, tx, ty }];
  const inventory = { ...state.inventory, [recipeId]: state.inventory[recipeId] - 1 };
  return { state: { ...state, inventory, roomFurniture }, ok: true };
}

export function removeRoomFurniture(state: import('./types').LocalUserState, uid: string): import('./types').LocalUserState {
  const removed = (state.roomFurniture || []).find(f => f.uid === uid);
  if (!removed) return state;
  const roomFurniture = (state.roomFurniture || []).filter(f => f.uid !== uid);
  const inventory = { ...state.inventory, [removed.recipeId]: (state.inventory[removed.recipeId] || 0) + 1 };
  return { ...state, inventory, roomFurniture };
}
