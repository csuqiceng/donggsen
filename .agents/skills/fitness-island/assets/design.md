<!--
[INPUT]: 依赖 animal-island-ui v0.9.3 的 Card/Button/Checkbox/Collapse/Modal/Footer/Cursor 组件规律、assets/animal-island 原生资产、plan.json 训练路线和当前静态 HTML/CSS/JS 边界
[OUTPUT]: 对外提供 Fitness Island 静态打卡页的组件设计宪法、字体防缺字规则、组件清单、状态映射和改动流程
[POS]: fitness-island/assets 的 UI 设计参考，约束 index.html、styles.css 和 app.js 只能从组件出发演化
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Fitness Island Design

设计目标：个人训练页不是营销页，是每天打开一次的打卡器。界面必须像 animal-island-ui 的组件组合，而不是临场拼装的装饰画。

## 铁律

1. 先组件，后页面。任何新 UI 先落到下面的组件清单，再写 HTML/CSS/JS。
2. 不发明相似组件。已有 Button、Card、Checkbox、Collapse、Modal、Footer、Cursor 能表达，就复用现有形态。
3. 文案只服务动作。状态能靠颜色、位置、aria-label 表达时，不加第二层可见文字。
4. 字体分两档：默认页面用系统 fallback 跑通；生产包有子集文件时才启用本地圆角字体。
5. 每次改 UI 后，用浏览器看目标区域，检查缺字、截断、重叠和移动端宽度。

## 字体

CSS 统一使用 `--animal-font-family`。

优先级：
`Fitness Rounded CN` -> `Resource Han Rounded CN` -> `Nunito` -> `Noto Sans SC` -> `Zen Maru Gothic` -> `HarmonyOS Sans SC` -> `MiSans` -> `sans-serif`。

默认模板不 preload、不声明不存在的 WOFF2。生成 `assets/fonts` 后，才加入
`@font-face` 和可选 preload。

生产字体策略：
- 扫描 `index.html`、`app.js`、`plan.json`、`fitness-plan.md` 和用户文案。
- 按实际文字生成 WOFF2 子集，不放完整字体包。
- 发布前跑 glyph check；缺字就扩大子集。
- WOFF2 子集按 `400/500/600/700/800/900` 分别声明 `@font-face`。

## Tokens

颜色、间距、圆角只从 `styles.css :root` 的 `--animal-*` token 取。

核心语义：
- `--animal-primary-color`: 已出现、已完成、确认状态。
- `--animal-focus-yellow`: 今天、主行动、焦点状态。
- `--animal-error-color`: 逾期、风险、重置。
- `--animal-bg-content`: 卡片底色。
- `--animal-text-color`: 标题和强信息。
- `--animal-text-color-muted`: 备注和轻提示。

间距阶梯：
- `--animal-stack-gap`: 普通组件之间的垂直距离，固定 16px。
- `--animal-stack-gap-raised`: 带 3D 阴影组件之后的距离，固定 22px，阴影也算布局占用。
- `--animal-surface-pad-x/y`: 外层 surface 的水平/垂直内边距，桌面 24px/18px，移动端只按断点整体收缩。
- `--animal-inset-gap`: 外壳到内层主按钮的距离，固定 14px。
- 列表内部 gap 使用 14px；小于 8px 只允许在 icon 内部使用。

圆角阶梯：
- `--animal-radius-base`: 16px，用于小按钮、输入、信息块。
- `--animal-radius-lg`: 22px，用于节点、轻量卡片。
- `--animal-radius-card`: 28px，用于任务卡。
- `--animal-radius-surface`: 32px，用于 RouteCard、CompleteStrip、ArchiveCollapse 这类外层 surface。
- `--animal-radius-pill`: 999px，只用于真正的胶囊按钮和圆形控件。

禁止写 `34px`、`40px 35px 45px` 这类临场半径。Animal 的有机感来自阴影、贴图和 clip-path，不来自随机圆角。

## Components

### AppShell

页面外框。只负责最大宽度、底部导航安全距离和背景层级。

### IslandBackground

全局背景使用 animal-island-ui 原生 `home-bg.webp`。纹理尺寸固定为 `1120px auto`，滚动周期固定为 `48s`；禁止把叶子纹理调回密集小图。

### Loading

启动遮罩。只在 `plan.json` 加载期间出现，使用 animal-island-ui Loading 的同一套游戏化反馈原则：中心伙伴、短状态文案、条纹进度条和 3D 阴影。加载成功后淡出并从可访问树隐藏；加载失败时停留在当前层显示 `plan.json 加载失败`，不露出半初始化页面。

### Hero

首页标题区。包含页面标题、日期打字机、游戏提示语、进度条和伙伴贴图。Hero 不是卡片，不加边框。

Hero 使用统一 `hero-stage` 舞台构图：标题固定左上，日期和提示语固定左下，`ProgressMeter` 固定左下更低处，`hero-animal` 固定右侧。桌面和移动端共享同一套位置关系，只允许尺寸通过 `clamp()` 和容器宽度缩放；禁止再写移动端 grid 重排或桌面伪元素伙伴贴图。

### ProgressMeter

今日进度条。文字只显示计数，例如 `0/5`。不在进度条旁边再解释含义。

### RouteCard

本周路线容器。顶部保留周信息和右侧状态 pill；下面只放 `RouteNode`。

### RouteNode

7 日路线节点。可见内容只保留日期数字，不显示 `今天/出现/待做/未完成`。状态通过 class 表达：
- `selected`: 当前查看日，黄色底。
- `today`: 今天，数字圆点黄色。
- `done`: 完成，薄荷底和 teal 圆点。
- `appeared`: 出现过，teal 圆点。
- `late`: 已过期未出现，暖红边框。

无障碍语义放在 `aria-label`，不要把状态文字塞回视觉层。

### TaskCard

训练动作卡。左侧 `Checkbox`，右侧动作名、参数 pill、备注。完成态只改底色、边框和 checkbox，不改文案。

文字层级：
- 动作名最大，移动端约 23px。
- 参数 pill 居中，移动端约 18px，必须小于动作名、大于备注。
- 备注最轻，移动端约 15px。

### CompleteStrip

黄色主行动卡。它是唯一结算入口，按钮下不放解释文字。
外壳用 `--animal-radius-surface`，内距用 `--animal-inset-gap`，和下一个卡片之间用 `--animal-stack-gap-raised`。

按钮文案：
- `0/total`: `完成今天`
- `1..total-1/total`: `今天到这`
- `total/total`: `完成今天`
- 已完整结算后：`今天已完成`

语义：
- `完成今天`: 勾满当前日所有动作，并触发 `CompleteRewardModal`。
- `今天到这`: 按当前勾选进度收摊并进入下一天，不补全剩余动作，不触发完整完成奖励。

### CompleteRewardModal

每日完成后的奖励弹窗。结构固定为 `OK` 奖励章、短标题 `盖章啦`、主按钮 `收下`。

规则：
- 不放 caption。
- 不放解释段落。
- 不写第二句鼓励文案。
- `收下` 必须是 Animal Button primary 物理按钮：50px 胶囊、黄色背景、底部 3D shadow、hover 上浮 1px、active 下压 2px。
- 惊喜感来自奖励章弹出动画和按钮按压，不来自大段文字。

### ReviewTable

周日复盘只用 Table 展示，不用深色代码块展示 Markdown。

结构：
- columns: `项目`、`结果`、`记录`。
- rows: `周期`、`完成`、`最稳`、`最弱`、`连续`。
- `完成` 的记录列使用 Day chip，`done/appeared/missed` 通过颜色表达。

规则：
- 屏幕显示用 table rows，复制给 Agent 继续用 Markdown 文本。
- Table 外壳使用 `--animal-bg-content`、6px padding、`--animal-radius-card`。
- 行分隔使用 animal-island-ui Table 的虚线 divider。
- 禁止再把周复盘可见区域做成 `<pre>` 代码块。

### ArchiveCollapse

30 天全图。使用 Collapse/Card/Divider 组合，只有一行入口；禁止再加右侧二级查看按钮。
外壳圆角必须和 `CompleteStrip` 同级，避免一个 32px 一个 24px 的视觉断层。

### FloatingNav

底部三键导航：前一天、完成今天、后一天。固定 3 个按钮，不扩展到 4 个以上。

### Modal

完成、导出、重置都使用 Animal Modal clip-path。Modal 内只保留一个主动作和必要取消动作。

Modal 按钮来自 animal-island-ui：
- default: `box-shadow: 0 5px 0 0 #bdaea0`
- hover: `box-shadow: 0 6px 0 0 #bdaea0; transform: translateY(-1px)`
- active: `box-shadow: 0 1px 0 0 #bdaea0; transform: translateY(2px)`

### Toast

短反馈。只用于动作结果，不承载说明文档。

## Change Flow

1. 先改 `design.md`，把组件或状态写清楚。
2. 再改 `index.html` 的组件骨架。
3. 再改 `styles.css` 的组件样式。
4. 最后改 `app.js` 的状态渲染。
5. 回头检查 L3 头部和 `CLAUDE.md` / `AGENTS.md` 成员清单。

## 禁止

- 禁止在 `app.js` 里拼出新的视觉结构后再补 CSS。
- 禁止为一个状态增加三种视觉表达。
- 禁止给 RouteNode 加可见状态文字。
- 禁止默认引用不存在的字体文件；有 `assets/fonts` 子集后再启用本地圆角字体。
- 禁止新增没有组件名的 class。
