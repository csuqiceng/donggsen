# fitness-island/
> L1 | 独立公共 Skill 仓库

成员清单
SKILL.md: 技能入口，按 Scan/Tidy/Build 三阶段定义 MEMORY.md、fitness-plan.md、plan.json 三个真相源、询问格式、路线收敛、页面生成和安全边界。
README.md: 中文说明，说明定位、三个真相源、触发词、工作流、字体、依赖和目录结构。
references/: 参考模块，保存最小阻力、可持续运动、if-then 计划、重启路线、周复盘取舍原则和 plan.json 页面投影契约。
scripts/: 可执行工具模块，保存项目初始化、fitness-plan.md 播种、plan.json 校验、文本收集、字体子集生成和缺字检查脚本。
assets/: 生成资产模块，保存 canonical 页面、样式、行为、设计契约、plan.json 示例和页面实际引用的 animal-island 视觉资产，不保存记忆模板或完整字体包。

架构决策
fitness-island 是独立 Skill 仓库，根目录即 Skill 根。它不携带用户个人数据，不携带完整字体源；执行协议集中在 SKILL.md，可持续运动取舍进入 references/minimum-friction.md，稳定页面目标留在 assets/，生成项目用 fitness-plan.md 做人类真相源、plan.json 做页面投影，全局共享记忆由协议或 init_project.sh 直接创建，确定性操作留在 scripts/。默认页面使用系统 fallback；Resource Han Rounded CN 只在生产子集存在时启用。

依赖边界
上游依赖用户真实环境、身体限制、训练目标、animal-island-ui 视觉规则、可选 Resource Han Rounded CN 官方源字体和 `~/.fitness-island/MEMORY.md`；下游输出带 fitness-plan.md、plan.json、统一 Hero 与 Animal Loading 的静态 Fitness Island 项目、可选本地 WOFF2 字体子集和共享记忆更新。

变更日志
2026-05-25: 引入 fitness-plan.md 作为生成项目的人类路线真相源，plan.json 降为页面投影，MEMORY.md 只存稳定事实。
2026-05-25: 默认模板移除不存在字体的 preload/@font-face，改为系统 fallback 先跑通，生产时再启用本地字体子集。
2026-05-25: assets 页面模板同步统一 hero-stage 舞台并增加 Animal Loading 启动遮罩，除 favicon 和顶部标题外与实际项目保持同构。
2026-05-25: README 增加公开 demo 链接和 animal-island-ui UI 资源参考。
2026-05-25: 新增圆角 favicon.svg，网页默认标题统一为「动森训练岛」。
2026-05-25: 从内置技能目录抽离为独立公共 Skill 仓库，根 CLAUDE.md 改为 L1 仓库地图。
2026-05-25: 增加 references/plan-json.md、assets/plan.example.json 和 scripts/validate_plan.py，用硬契约+软建议规定 plan.json。
2026-05-25: 将 styles.css、app.js、design.md 和必要 animal-island 图片收进 assets 作为参考目标；plan.json 保持每次生成。
2026-05-25: 删除 assets/MEMORY.md，改为由 SKILL.md 协议和 init_project.sh 直接创建 ~/.fitness-island/MEMORY.md。
2026-05-25: 将单一记忆改为 ~/.fitness-island/MEMORY.md，方便任意 agent 读取同一份训练默认值；生成项目不再创建第二份 MEMORY.md。
2026-05-25: 新增中文版 README.md，按 trip-map-builder README 结构说明 fitness-island 的定位、共享记忆、工作流、依赖和目录结构。
2026-05-24: 新增 references/minimum-friction.md，补齐最小阻力、持之以恒、if-then 计划、重启路线和周复盘参考资源。
2026-05-24: 按 trip-map-builder/SKILL.md 的章节顺序重写 SKILL.md，固定 Shared memory、三阶段流程、Dependencies、Resources 和 Verification。
2026-05-24: 为 SKILL.md 补齐询问协议、四拍提问格式和路线确认闸门，避免跳过用户归位流程直接生成。
2026-05-24: 按用户给定「这个技能做什么」重写 SKILL.md，并新增共享记忆初始化规则。
2026-05-24: 参照 trip-map-builder 重写 SKILL.md，新增最小共享记忆和 Reset/Route/Build 三阶段结构。
2026-05-24: 奥卡姆瘦身，执行协议压回 SKILL.md，保留 assets/index.html 页面目标和 scripts 确定性工具。
2026-05-24: 新增独立 fitness-island skill 地址，目录和内部 skill id 保持 fitness-island。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
