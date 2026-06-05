<!--
[INPUT]: 依赖 SKILL.md 的 Scan/Tidy/Build 流程、fitness-plan.md 中间真相源、references/minimum-friction.md 的最小阻力原则、assets/index.html 页面目标、公开 demo、animal-island-ui 参考资源和 scripts/ 字体管线
[OUTPUT]: 对外提供 fitness-island 的中文说明、三个真相源、demo 地址、UI 参考、安装方式、触发词、工作流、依赖和目录结构
[POS]: fitness-island 的中文入口说明，面向人类读者解释这个 skill 如何生成低压力运动习惯项目
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 动森训练岛

从身体情况、训练目标、时间窗口和器械照片，到可部署的动森风格运动打卡页。

三阶段流水线：**扫描现实约束 → 写清路线 → 生成训练岛页面**。

定位：生成每天打开一次的参考习惯系统，不是假装身体会按计划表机械执行的训练脚本。

## Demo

查看示例：[fitness-obsession-plan.vercel.app](https://fitness-obsession-plan.vercel.app/)

UI 资源参考：[guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui)

## 共享记忆

只保留一个记忆文件：`~/.fitness-island/MEMORY.md`。

所有 agent 都优先读写这一个文件。长期有效的训练默认值都写在这里：训练地点、可用器械、时间窗口、最低承诺、重启路线、疼痛/旧伤约束、奖励提示、周复盘结论和项目路径。

它不保存原始身体照片、医疗记录、完整聊天记录、精确住址或其他敏感材料。

## 三个真相源

```text
~/.fitness-island/MEMORY.md  # 下次仍然有用的稳定事实
fitness-plan.md              # 人能读懂的训练路线真相
plan.json                    # 页面渲染用的数据投影
```

`fitness-plan.md` 写意图，`plan.json` 管渲染，`MEMORY.md` 只记长期事实。

## 这个技能做什么

给 AI agent 一套完整的运动习惯养成工作流：

1. 用户给出身体情况、目标、时间窗口、器械照片或文字描述。
2. Agent 提取硬约束：地点、器械、训练基础、疼痛风险、阻力来源。
3. Agent 主动删掉高摩擦动作，写成 `fitness-plan.md`。
4. 从 `fitness-plan.md` 投影出 `plan.json`。
5. 生成静态页面：动森风格 UI、7 日路线、今日任务、结算按钮、完成盖章、周复盘 Table、可复制 agent 训练数据。
6. 输出可部署项目，手机打开直接用。
7. 更新 `~/.fitness-island/MEMORY.md`，只保存下次仍然有用的训练上下文。

## 安装

```bash
npx skills add hiyeshu/fitness-island
```

## 触发词

说这些话会激活技能：

- “动森训练岛”
- “运动习惯”
- “健身打卡页”
- “训练路线”
- “生成训练岛”
- “做个新手健身计划”
- “把我的器械和时间做成训练路线”
- “fitness island”
- “build a fitness habit page”

## 工作流

### Phase 1：扫描现实约束

从用户给的碎片信息里抽出硬约束，先看现实可做什么，而不是先写理想训练表。

核心原则：

- 只问会改变路线的问题。
- 用户已经给过的信息不重复问。
- 最多问两轮，然后用保守默认值继续。
- 所有需要用户决策的问题使用四拍格式：`Re-ground → Simplify → Recommend → Options`。
- 先确认安全边界：尖锐关节痛、麻木、眩晕、胸痛、昏厥感、旧伤复发。

详见 [`references/minimum-friction.md`](references/minimum-friction.md)

### Phase 2：写清路线

像整理房间一样整理训练计划：先删掉挡住开始的东西，再谈加量。

核心原则：

- 先删高技术动作、复杂器械设置、超时路线和需要意志力解释的环节。
- 训练入口必须能在 2 分钟内开始。
- 新手默认走路、低技术器械、低重量、短路线。
- 路线只保留三件稳定东西：最低承诺、默认路线、重启路线。
- 跳过训练不补课、不惩罚；重启路线是系统维护，不是失败。
- `fitness-plan.md` 必须写清：现实约束、删除项、最低承诺、默认路线、重启路线、周复盘和停止规则。

### Phase 3：生成训练岛页面

基于内置页面、CSS、JS 和设计参考生成静态项目，并更新共享记忆：

- 动森训练岛 hero
- 今日进度条
- 7 日路线节点
- 今日任务卡
- 一个黄色结算主按钮
- 完成盖章弹窗
- 周复盘 Table
- 30 天全图 Collapse
- 可复制 agent 训练数据
- 三键底部导航

复制的参考目标：

```text
index.html      # 从 assets/index.html 复制
styles.css      # 从 assets/styles.css 复制
app.js          # 从 assets/app.js 复制
design.md       # 从 assets/design.md 复制
assets/favicon.svg
assets/animal-island/
```

按本次路线生成：

```text
fitness-plan.md # 人类可读的路线真相
plan.json       # 从 assets/plan.example.json 播种，再从 fitness-plan.md 投影
```

`plan.json` 有格式契约，但保持弹性：硬契约只管页面能渲染，软建议才推荐 30 天、每周 7 天、周末复盘。详见 [`references/plan-json.md`](references/plan-json.md)。

可选增强：

```text
assets/fonts/   # 只有需要自托管圆角中文字体时才生成
```

## 字体

默认页面用系统 fallback 字体跑通。Resource Han Rounded CN 是可选生产字体源：运行时不加载云字体，不把完整 TTF/OTF/WOFF2 字体包放进 skill。字体子集是生产增强，不是默认输出。

常用命令：

```bash
python3 scripts/collect_text.py --root /path/to/project --out /tmp/fitness-text.txt

python3 scripts/validate_plan.py /path/to/project/plan.json

python3 scripts/build_font_subset.py \
  --text /tmp/fitness-text.txt \
  --medium /path/to/ResourceHanRoundedCN-Medium.ttf \
  --heavy /path/to/ResourceHanRoundedCN-Heavy.ttf \
  --out /path/to/project/assets/fonts

python3 scripts/check_glyphs.py \
  --text /tmp/fitness-text.txt \
  --font /path/to/project/assets/fonts/fitness-rounded-cn-medium.woff2
```

## 依赖

| 工具 | 用途 | 安装 |
|------|------|------|
| Python 3 | 初始化、收集文本、字体脚本 | 系统自带或 `brew install python` |
| fontTools + brotli | 生成 WOFF2 字体子集和缺字检查 | `python3 -m pip install fonttools brotli` |
| Resource Han Rounded CN | 圆角中文源字体 | 下载并缓存到本机 |
| 浏览器 | 移动端视觉检查 | Chrome / Codex browser |

## 目录结构

```text
fitness-island/
├── CLAUDE.md                    # 技能目录地图，记录职责边界
├── SKILL.md                     # 技能入口，Scan/Tidy/Build 主流程
├── README.md                    # 本文件
├── assets/
│   ├── CLAUDE.md                # assets 局部地图
│   ├── animal-island/           # 页面实际引用的动森视觉资产
│   ├── app.js                   # 静态应用行为参考
│   ├── design.md                # UI 组件契约参考
│   ├── favicon.svg              # 圆角 favicon
│   ├── index.html               # Fitness Island 页面骨架
│   ├── plan.example.json        # 可运行路线示例
│   └── styles.css               # 视觉层参考
├── references/
│   ├── CLAUDE.md                # references 局部地图
│   ├── minimum-friction.md      # 最小阻力与可持续运动参考
│   └── plan-json.md             # plan.json 格式契约
└── scripts/
    ├── CLAUDE.md                # scripts 局部地图
    ├── init_project.sh          # 初始化静态项目
    ├── validate_plan.py         # 检查 plan.json 硬契约
    ├── collect_text.py          # 收集页面文本
    ├── build_font_subset.py     # 生成 WOFF2 子集
    └── check_glyphs.py          # 检查缺字
```

## 许可

Skill 代码建议使用 MIT。字体遵循 Resource Han Rounded CN 上游授权，生成项目必须保留对应字体 license。

## 安全边界

这个 skill 只生成训练参考，不做医疗诊断。尖锐关节痛、麻木、刺痛、眩晕、胸痛、昏厥感、动作质量因疼痛改变或旧伤复发时，停止加量，降低路线，必要时找专业人员。
