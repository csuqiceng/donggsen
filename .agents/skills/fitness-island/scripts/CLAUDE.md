# scripts/
> L2 | 父级: ../CLAUDE.md

成员清单
build_font_subset.py: 调用 fontTools.subset，把 Resource Han Rounded CN Medium/Heavy 源字体生成项目 WOFF2 子集。
check_glyphs.py: 检查收集文本在指定字体中的 glyph 覆盖，缺字时以非零退出码阻断交付。
collect_text.py: 从项目输出文件收集 UTF-8 文本，作为字体子集和缺字检查输入。
init_project.sh: 初始化空 Fitness Island 项目骨架，从 assets/ 播种页面、样式、行为、设计契约、favicon 和 animal-island 视觉资产，创建 fitness-plan.md、plan.json，并直接创建缺失的 ~/.fitness-island/MEMORY.md。
validate_plan.py: 轻量检查 plan.json 硬契约，错误非零退出，软建议只打印 warning。

架构决策
scripts/ 只放确定性工具。训练判断、设计判断和交付判断留在 SKILL.md，避免脚本变成业务黑盒。

变更日志
2026-05-25: init_project.sh 增加 fitness-plan.md 人类路线真相源，并统一 MEMORY.md 模板中的奖励提示字段。
2026-05-25: init_project.sh 增加 favicon.svg 复制。
2026-05-25: 独立仓库化，父级链接改为相对路径。
2026-05-25: 新增 validate_plan.py，以硬契约+warning 方式检查 plan.json，同时保留路线弹性。
2026-05-25: init_project.sh 改为从 assets/ 复制 index.html、styles.css、app.js、design.md、plan.example.json 和 animal-island/。
2026-05-25: init_project.sh 去掉 assets/MEMORY.md 依赖，缺失时直接生成全局记忆文件。
2026-05-25: init_project.sh 改为初始化 ~/.fitness-island/MEMORY.md，不再在目标项目生成第二份 MEMORY.md。
2026-05-24: 协议瘦身后，脚本职责边界改为只受 SKILL.md 驱动。
2026-05-24: init_project.sh 改为从 skill assets/index.html 播种首页，确保每次生成使用同一页面目标。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
