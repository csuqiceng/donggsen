# assets/
> L2 | 父级: ../CLAUDE.md

成员清单
animal-island/: Animal Island 原生视觉资产子模块，只保留页面 CSS 实际引用的背景、伙伴、光标、分隔线和海浪。
app.js: Fitness Island 静态应用行为目标，负责 Animal Loading、plan.json 渲染、本地状态、结算弹窗、周复盘和导出。
design.md: UI 组件契约参考，约束页面组件、Loading、字体 fallback/可选子集、token、状态映射和改动流程。
favicon.svg: 圆角动森训练岛 favicon，来自用户提供的 SVG，经 clipPath 圆角裁切。
index.html: Fitness Island 静态页 canonical 页面目标，保留 L3 契约、Animal Loading、hero、路线卡、今日任务、结算按钮、复盘 Table、导出弹窗、Footer sea 和底部导航骨架。
plan.example.json: 可运行 plan.json 示例，展示默认路线结构，被 init_project.sh 复制为初始 plan.json 后由 agent 按用户情况改写。
styles.css: Fitness Island 视觉层目标，承接 animal-island-ui token、Loading、系统 fallback 字体栈、布局、动效、移动端首屏和底部导航样式。

架构决策
assets/ 保存生成时直接使用或参考的页面目标，不保存记忆模板或完整 TTF/OTF/WOFF2 字体包。index.html 是页面骨架真相源；styles.css 和 app.js 是可运行体验目标；design.md 是 UI 规则参考；favicon.svg 是网页身份图标；plan.example.json 是数据格式示例，不是用户最终训练真相；animal-island/ 只保留 CSS 实际引用的视觉资产；全局共享记忆和 fitness-plan.md 由 SKILL.md 协议和 init_project.sh 直接创建。

变更日志
2026-05-25: 移除默认页面对不存在字体子集的 preload/@font-face 依赖，字体策略改为 fallback 先跑通、生产子集后启用。
2026-05-25: index/styles/app/design 同步统一 hero-stage 舞台并加入 Animal Loading 启动遮罩。
2026-05-25: 新增圆角 favicon.svg，并将网页默认标题改为「动森训练岛」。
2026-05-25: 独立仓库化，父级链接改为相对路径。
2026-05-25: 新增 plan.example.json，作为 init_project.sh 播种的可运行路线示例。
2026-05-25: 新增 styles.css、app.js、design.md 和 animal-island/，作为生成项目时可复制/改写的参考目标。
2026-05-25: 删除 MEMORY.md，assets 只保留页面目标。
2026-05-25: 历史 MEMORY.md 已删除，全局共享记忆改由 SKILL.md 协议和 init_project.sh 直接创建。
2026-05-24: 删除未被脚本消费的 font-profiles.json，保留可生成产物直接使用的资产。
2026-05-24: 新增 index.html，作为每次生成 Fitness Island 静态页时使用的 canonical 页面目标。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
