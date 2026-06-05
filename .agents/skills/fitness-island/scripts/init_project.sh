#!/usr/bin/env bash
# /*
# [INPUT]: 依赖目标项目目录路径、skill assets/index.html 页面目标、assets/plan.example.json 和 ~/.fitness-island/MEMORY.md 共享记忆路径
# [OUTPUT]: 对外创建 Fitness Island 标准文件骨架，播种页面目标、fitness-plan.md、plan.json，确保 ~/.fitness-island/MEMORY.md 存在
# [POS]: scripts 的项目播种工具，用于空目录启动 Fitness Island 工作流
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
# */

set -eu

ROOT="${1:-}"
if [ -z "$ROOT" ]; then
  echo "usage: init_project.sh /path/to/project" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HTML_TEMPLATE="$SKILL_DIR/assets/index.html"
CSS_TEMPLATE="$SKILL_DIR/assets/styles.css"
JS_TEMPLATE="$SKILL_DIR/assets/app.js"
DESIGN_TEMPLATE="$SKILL_DIR/assets/design.md"
PLAN_TEMPLATE="$SKILL_DIR/assets/plan.example.json"
FAVICON_TEMPLATE="$SKILL_DIR/assets/favicon.svg"
ANIMAL_ASSETS="$SKILL_DIR/assets/animal-island"
MEMORY_DIR="${FITNESS_ISLAND_HOME:-$HOME/.fitness-island}"
MEMORY_FILE="$MEMORY_DIR/MEMORY.md"
FITNESS_PLAN_FILE="$ROOT/fitness-plan.md"

for template in "$HTML_TEMPLATE" "$CSS_TEMPLATE" "$JS_TEMPLATE" "$DESIGN_TEMPLATE" "$PLAN_TEMPLATE" "$FAVICON_TEMPLATE"; do
  if [ ! -f "$template" ]; then
    echo "missing template: $template" >&2
    exit 1
  fi
done
if [ ! -d "$ANIMAL_ASSETS" ]; then
  echo "missing assets: $ANIMAL_ASSETS" >&2
  exit 1
fi

mkdir -p "$ROOT/assets/animal-island"
mkdir -p "$MEMORY_DIR"

cp "$HTML_TEMPLATE" "$ROOT/index.html"
cp "$CSS_TEMPLATE" "$ROOT/styles.css"
cp "$JS_TEMPLATE" "$ROOT/app.js"
cp "$DESIGN_TEMPLATE" "$ROOT/design.md"
cp "$PLAN_TEMPLATE" "$ROOT/plan.json"
cp "$FAVICON_TEMPLATE" "$ROOT/assets/favicon.svg"
cp "$ANIMAL_ASSETS/animal-icon.png" "$ROOT/assets/animal-island/"
cp "$ANIMAL_ASSETS/cursor-icon-small.png" "$ROOT/assets/animal-island/"
cp "$ANIMAL_ASSETS/divider-line-brown.svg" "$ROOT/assets/animal-island/"
cp "$ANIMAL_ASSETS/footer-sea.svg" "$ROOT/assets/animal-island/"
cp "$ANIMAL_ASSETS/home-bg.webp" "$ROOT/assets/animal-island/"
if [ ! -f "$FITNESS_PLAN_FILE" ]; then
  cat > "$FITNESS_PLAN_FILE" <<'PLAN'
<!--
[INPUT]: 依赖用户约束、~/.fitness-island/MEMORY.md 稳定事实和 fitness-island 的 Scan/Tidy 结论
[OUTPUT]: 对外提供可读训练路线真相，供 plan.json 投影和下一次路线调整使用
[POS]: 生成项目的人类真相源，位于 plan.json 上游
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# Fitness Island Plan

## 结论
-

## 现实约束
- 地点:
- 时间:
- 器械:
- 身体边界:

## 删除
-

## 路线
- 最低承诺:
- 默认路线:
- 重启路线:

## 周复盘
- 先减少:
- 再增加:

## 停止规则
- 尖锐关节痛、麻木、刺痛、眩晕、胸痛、昏厥感、旧伤复发时停止加量。
PLAN
fi
if [ ! -f "$MEMORY_FILE" ]; then
  cat > "$MEMORY_FILE" <<'MEMORY'
# Fitness Island Memory

## 稳定默认值
- 训练地点:
- 可用器械:
- 时间窗口:
- 最低承诺:
- 默认路线:
- 重启路线:
- 奖励提示:

## 身体边界
- 疼痛/旧伤:
- 需要避免:

## 周复盘结论
- 最稳动作:
- 最弱动作:
- 下周先减少:
- 下周再增加:

## 项目索引
| 日期 | 项目路径 | 输出 | 备注 |
|------|----------|------|------|

## Agent 交接
- 上次导出:
- 待确认:
MEMORY
fi

echo "fitness_island_root=$ROOT"
echo "seeded=index.html styles.css app.js design.md fitness-plan.md assets/favicon.svg assets/animal-island"
echo "memory=$MEMORY_FILE"
echo "seeded_plan=plan.json<-assets/plan.example.json"
