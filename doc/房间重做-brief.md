# 房间内景重做 — 交给 ChatGPT 的开工 Brief

## 任务
重新实现 React 应用里的「房间内景」视图（伪 3D 动森风），重做**房间布局**和**家具的视觉设计**。
当前实现能用但**太丑**，需要朝着"动森温馨治愈风"的参考图重做。

## 技术约束（必须遵守）
- **React + TypeScript**，单组件 `RoomShell`，挂在 `src/App.tsx`。
- **渲染路线：纯 SVG + CSS 等距 2.5D**（俯视斜 45°）。**不要引入 react-three-fiber / three.js / GLB**（项目无法提供 3D 模型素材，已确认此路被堵）。
- 数据模型**保持不变**（见下「数据契约」），改动只在渲染层（SVG 构图 / 家具绘制 / CSS）。
- 服务端为唯一真源，无 localStorage；组件是纯展示+回调，状态由父组件通过 props 传入。
- 不引入新重依赖；emoji / SVG 手绘 / 现有 webp 图标任选。

## 视觉目标（参考图）
> 参考图见 `src/assets/房间.png`（动森风等距 2.5D 房间）。核心特征：

- **风格**：卡通动漫 / 手绘水彩质感，线条圆润、色彩柔和、童趣治愈，**不是真实 3D 渲染**。
- **布局**：矩形房间，以**中央圆形地毯**为核心，分睡眠区 / 阅读区 / 休闲区，紧凑但不拥挤。
- **墙**：浅米色 / 奶油色，三面斜墙开放式房间；墙面装饰丰富——装饰画、挂饰、星星串灯、时钟、风铃。
- **地板**：浅棕木地板；**中央铺圆形白色毛绒地毯**，地毯上点缀小植物。
- **家具**：小巧圆润；能看到**侧面深度**（书架有厚度、床有体积），不是平面贴纸。
  - 睡眠区：单人床（格子床单+枕头）、床头柜（放植物）
  - 阅读区：多层书架、储物柜、沙发/茶几
  - 休闲区：圆地毯、小椅子（格子坐垫）、角落吉他/挂饰
  - 点缀：植物（床边/书架旁/地毯上）、装饰画、星星串灯、时钟、风铃
- **配色**：暖色基底（米墙 / 棕地板 / 白地毯）；点缀红（格子床单/吉他）、绿（植物）、黄（串灯/沙发）。

## 当前实现为什么丑（要逐条改）
1. **地毯是红色菱形** → 应为**圆形白色毛绒**（SVG 椭圆 + 毛绒边缘描边）。
2. **家具是 2D 平面图标 `<img>` 贴在格子上，像贴纸** → 应有 2.5D 立体感（能看出侧面/厚度）。这是最大质感差距。
3. **元素稀疏**：只有 1 个画框 + 串灯 → 参考图墙面装饰密集（画/时钟/风铃/挂饰），角落有吉他/小物。
4. **缺家具种类**：当前 8 件（木椅/木桌/小床/木栅栏/花盆/台灯/地毯/书架）→ 参考图有床头柜/沙发/储物柜/多株绿植。
5. **几何感太强、水彩柔和感不足**：墙/地板是硬渐变多边形 → 应更柔、更圆润、手绘感。

## 数据契约（不可改）
房间数据存在 `state.roomFurniture`，每条 `{ uid, recipeId, tx, ty }`，网格 6×6（`tx/ty` ∈ 0..5）。

```ts
// src/domain/room.ts
export const ROOM_GRID = { size: 6 };
export interface RoomFurniture { uid: string; recipeId: string; tx: number; ty: number; }

export function placeRoomFurniture(state, recipeId, tx, ty, now?): RoomPlaceResult  // 越界/库存不足返回 ok:false
export function removeRoomFurniture(state, uid): state                              // 收回，库存+1
```

家具配方（决定 `recipeId` 集合与图标）：
```ts
// src/domain/workshop.ts — GRID_RECIPES
{ id: 'wooden_chair',  name: '木椅',   icon: '🪑',  category: 'furniture', ingredients: { wood: 2, softwood: 1 } }
{ id: 'wooden_table',  name: '木桌',   icon: '🍽️', category: 'furniture', ingredients: { wood: 3, hardwood: 1 } }
{ id: 'bed',           name: '小床',   icon: '🛏️', category: 'furniture', ingredients: { wood: 2, softwood: 2, weed: 1 } }
{ id: 'fence',         name: '木栅栏', icon: '🚧', category: 'furniture', ingredients: { wood: 3, stone: 1 } }
{ id: 'flower_pot',    name: '花盆',   icon: '🪴', category: 'furniture', ingredients: { clay: 2, weed: 1 } }
{ id: 'lamp',          name: '台灯',   icon: '💡', category: 'furniture', ingredients: { ironNugget: 1, wood: 2, clay: 1 } }
{ id: 'rug',           name: '地毯',   icon: '🟫', category: 'furniture', ingredients: { weed: 3, shell: 1 } }
{ id: 'shelf',         name: '书架',   icon: '📚', category: 'furniture', ingredients: { hardwood: 3, wood: 1, ironNugget: 1 } }
{ id: 'house',         name: '房子',   icon: '🏠', category: 'house', ... }   // 不进房间
```

## 家具素材（可选用）
现有动森官方 webp 图标在 `src/assets/acnh-icons/`：`wooden_chair.webp`、`wooden_table.webp`、`bed.webp`、`fence.webp`、`flower_pot.webp`、`lamp.webp`、`rug.webp`、`shelf.webp`。
来源 https://animalcrossing.fandom.com（2D 平面图标，直接 `<img>` 用）。**但这些是平面贴纸感——要立体的话建议改为 SVG 手绘每件家具的等距侧面。**

## 现有完整实现（参考 / 改写基础）
### `src/App.tsx` — `RoomShell`（948–1166 行）
```tsx
function RoomShell({ state, onLeave, onPlace, onRemove }: {
  state: LocalUserState;
  onLeave: () => void;
  onPlace: (recipeId: string, tx: number, ty: number) => void;
  onRemove: (uid: string) => void;
}) {
  const TILE_W = 64;
  const TILE_H = 32;
  const WALL_H = 96;
  const N = ROOM_GRID.size;
  const gridW = (N - 1) * TILE_W + TILE_W;
  const baseW = gridW + TILE_W;
  const baseY = WALL_H + TILE_H / 2 + 6;
  const baseH = baseY + (N - 1) * TILE_H + TILE_H / 2 + 12;
  const originX = baseW / 2;
  const tiles: { tx: number; ty: number; left: number; top: number }[] = [];
  for (let s = 0; s <= 2 * (N - 1); s += 1) {
    for (let tx = Math.max(0, s - (N - 1)); tx <= Math.min(N - 1, s); tx += 1) {
      const ty = s - tx;
      const c = { x: originX + (tx - ty) * TILE_W / 2, y: baseY + (tx + ty) * TILE_H / 2 };
      tiles.push({ tx, ty, left: c.x - TILE_W / 2, top: c.y - TILE_H / 2 });
    }
  }

  const [charPos, setCharPos] = useState({ tx: Math.floor(N / 2), ty: Math.floor(N / 2) });
  const [placing, setPlacing] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      let { tx, ty } = charPos;
      if (k === 'ArrowLeft' || k === 'a') tx = Math.max(0, tx - 1);
      else if (k === 'ArrowRight' || k === 'd') tx = Math.min(N - 1, tx + 1);
      else if (k === 'ArrowUp' || k === 'w') ty = Math.max(0, ty - 1);
      else if (k === 'ArrowDown' || k === 's') ty = Math.min(N - 1, ty + 1);
      else return;
      e.preventDefault();
      setCharPos({ tx, ty });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [charPos, N]);

  const centerC = (tx: number, ty: number) => ({ x: originX + (tx - ty) * TILE_W / 2, y: baseY + (tx + ty) * TILE_H / 2 });
  const screen = (tx: number, ty: number) => ({ left: centerC(tx, ty).x - TILE_W / 2, top: centerC(tx, ty).y - TILE_H / 2 });

  // 房间剖视图：后墙 + 左墙 + 地板（SVG 多边形）
  const P = {
    back:  { x: originX, y: baseY - TILE_H / 2 },
    right: { x: originX + (N - 1) * TILE_W / 2 + TILE_W / 2, y: baseY + (N - 1) * TILE_H / 2 },
    front: { x: originX, y: baseY + (N - 1) * TILE_H + TILE_H / 2 },
    left:  { x: originX - (N - 1) * TILE_W / 2 - TILE_W / 2, y: baseY + (N - 1) * TILE_H / 2 },
  };
  const top = (p) => ({ x: p.x, y: p.y - WALL_H });
  const poly = (pts) => pts.map(p => `${p.x},${p.y}`).join(' ');
  // ...（墙、窗、串灯、画框、地板、地毯、窗光、网格线等 SVG 多边形，约 100 行，详见原文件）
  // 地毯当前是菱形红色 rugPts，要改成圆形白色毛绒。
  // 家具调色板 + 已放置家具 + 人物，按 tx+ty 深度排序后渲染。

  const palette = GRID_RECIPES.filter(r => r.category === 'furniture' && (state.inventory[r.id] || 0) > 0);
  const placed = state.roomFurniture || [];
  const items = [
    ...placed.map(f => ({ kind: 'furniture' as const, ...f, ...screen(f.tx, f.ty) })),
    { kind: 'character' as const, tx: charPos.tx, ty: charPos.ty, ...screen(charPos.tx, charPos.ty) },
  ].sort((a, b) => a.tx + a.ty - (b.tx + b.ty));

  return (
    <main className="museum-shell room-shell">
      {/* 顶部说明卡 */}
      {/* Card > room-stage(svg) + 地板点击层 tiles + 家具/人物 sprites */}
      {/* Card > 家具调色板 palette（选中 placing 后点地板放置；点家具收回） */}
    </main>
  );
}
```

> 完整 SVG 构图（墙渐变、窗户天空裁剪、串灯、画框、地板木纹 pattern、菱形红地毯、墙脚 AO、暖光 ambient）见原文件 1053–1125 行，重做时以此为骨架改地毯形状 + 提升水彩质感 + 增加墙面装饰。

### 现有 CSS（`src/App.css` 2605–2617 行）
```css
.room-shell .room-stage { position: relative; margin: 12px auto; background: radial-gradient(circle at 50% 30%, #fff6e0, #f0e3c8); border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 24px rgba(120,90,40,0.18); }
.room-svg { position: absolute; inset: 0; pointer-events: none; }
.room-tile { position: absolute; transform: rotateZ(45deg) scale(1, 0.5); transform-origin: center; background: transparent; }
.room-tile.placeable:hover { background: rgba(106,176,76,0.45); }
.room-sprite { position: absolute; transform: translate(-50%, -100%); z-index: 5; display: flex; flex-direction: column; align-items: center; }
.room-shadow { width: 30px; height: 9px; background: radial-gradient(ellipse, rgba(0,0,0,0.28), transparent 70%); border-radius: 50%; }
.room-character-img { width: 38px; height: 38px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2)); }
.room-furniture { border: none; background: transparent; font-size: 30px; cursor: pointer; }
.room-furniture img { width: 60px; height: 60px; filter: drop-shadow(0 3px 3px rgba(0,0,0,0.35)) saturate(1.1); }
```

## 交互（保持）
- 方向键 / WASD 移动人物（仅展示）。
- 下方家具调色板选中 → 点地板格放置（`onPlace(recipeId, tx, ty)`）。
- 点已放置家具 → 收回（`onRemove(uid)`）。
- 深度排序：按 `tx + ty` 从小到大绘制（远的先画）。

## 验收标准
1. 房间整体观感贴近 `房间.png`：暖色水彩感、圆润、温馨。
2. 中央**圆形白色毛绒地毯**（非红菱形）。
3. 家具有**立体感**（非平面贴纸）；至少补齐床头柜/沙发/储物柜/绿植的视觉表现。
4. 墙面装饰更丰富（画/时钟/风铃/串灯）。
5. 数据契约不变，放置/收回/移动人物交互正常，6×6 网格越界拦截保留。

## 运行验证
```bash
npm run dev    # http://localhost:5173 ，登岛（选「哥哥」）→ 建房子 → 进房间
npm test       # 单测含 room.test.ts，需保持通过
```
