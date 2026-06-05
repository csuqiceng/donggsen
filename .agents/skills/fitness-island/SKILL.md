---
name: fitness-island
description: >
  End-to-end fitness habit planning: gather body context, goals, real time
  window, equipment photos or notes, cut high-friction actions, build a
  low-pressure route, write fitness-plan.md, then generate an Animal Island style mobile-first static
  check-in page with 7-day route, daily tasks, settlement button, reward stamp,
  copyable agent training data, and shared ~/.fitness-island/MEMORY.md. Use when the user asks
  for a beginner fitness plan, habit reset, training map, deployable fitness
  page, Fitness Island UI, rounded Chinese font subset, weekly review table, or
  says "动森训练岛", "运动习惯", "健身打卡页", "训练路线", "生成训练岛".
---

<!--
[INPUT]: 依赖用户身体情况、训练目标、时间窗口、器械照片或文字描述、~/.fitness-island/MEMORY.md 共享记忆、assets/index.html 页面目标和 scripts/ 工具
[OUTPUT]: 对外提供 fitness-plan.md、plan.json、动森风格静态打卡页、可复制 agent 训练数据、共享记忆更新和交付验证流程
[POS]: fitness-island 独立技能入口，按 Scan -> Tidy -> Build 流程把现实约束变成可部署的运动习惯项目
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 动森训练岛 - 运动习惯养成 Skill

Three-phase pipeline: **Scan → Tidy → Build**.

The output is a **reference habit system**, not a script the body must obey.
Fatigue, pain, sleep, work, and available time can override the route.

## Truth sources

Keep the map small:

```text
~/.fitness-island/MEMORY.md  # durable facts for next time
fitness-plan.md              # human-readable route truth
plan.json                    # page data projection
```

`fitness-plan.md` owns intent. `plan.json` owns rendering. `MEMORY.md` owns
only stable carryover facts.

## Shared memory

Use exactly one memory file: `~/.fitness-island/MEMORY.md`.

Before planning or building, read `~/.fitness-island/MEMORY.md` if it exists.
If it does not exist, create the minimal file directly and continue.

Use it only for durable training context:

- default training place
- available equipment
- time window
- minimum promise
- reset route
- pain or old-injury constraints
- reward cue
- previous weekly review conclusions
- generated project paths

Do not store raw body photos, medical records, full chat logs, precise private
address, or other sensitive material.

After each completed route, page build, or weekly review, update
`~/.fitness-island/MEMORY.md` with only durable facts:

Use this shape when creating the file:

```md
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
```

## Phase 1: Scan the real constraints

Read `references/minimum-friction.md` before planning when the task involves
making exercise sustainable, restarting after skipped days, reducing resistance,
or designing the minimum promise.

Core sequence:

1. **Extract hard constraints** — body context, goal, real time window, place,
   equipment, pain risk, old injuries
2. **Classify training surface** — home / gym / treadmill / machines / walking
   only / no equipment
3. **Find friction** — what the user hates, forgets, delays, overthinks, or
   cannot start in two minutes
4. **Check safety boundary** — sharp pain, numbness, dizziness, chest pain,
   faintness, old injury flare-up
5. **Write constraint summary** — conclusion first, then assumptions and safe
   defaults

Key principles:

- Smart skip: if the user already gave enough information, do not re-ask it.
- Ask at most two rounds, then default conservatively.
- Ask only questions that change the route.
- Never ask for daily feelings by default.
- All user-facing questions follow the **4-beat format**:
  Re-ground → Simplify → Recommend → Options.

Use the 4-beat format when a decision is needed:

```text
Re-ground: 动森训练岛，Step 1: 归位
Simplify: 我需要先知道你在哪里练、每天能拿出多久、有没有伤痛。
Recommend: 建议先用最短 20 分钟路线，先建立出现习惯，再加量。
Options:
A) 家里练，20 分钟
B) 健身房，30 分钟
C) 只有散步，10-15 分钟
D) 我补充器械照片/身体限制
```

Mandatory questions only when missing:

- body risk: pain, old injury, numbness, dizziness, chest pain
- time window: realistic daily duration
- place/equipment: where training happens and what is available
- goal conflict: for example zero training base plus extreme-speed fat loss

If the user asks for personalized loading while pain, old injury, numbness,
dizziness, chest pain, or faintness is unknown, ask the safety question first.
For low-intensity habit pages, default to "no red-flag symptoms reported" and
write the stop rules.

## Phase 2: Tidy into a route

Treat planning like tidying. Delete before adding.
Use `references/minimum-friction.md` to choose the minimum route, default route,
reset route, if-then plan, and weekly review rule.

Core sequence:

1. **Cut high-friction actions first** — technical lifts, complex setup,
   crowded machines, routes longer than the real window
2. **Pick the first action** — the action that can start in two minutes
3. **Set minimum promise** — the smallest action that keeps the chain alive
4. **Set default route** — the normal order when energy is fine
5. **Set reset route** — what to do after a missed day, bad sleep, pain warning,
   or schedule collapse
6. **Write weekly review rule** — reduce the weakest part before adding volume
7. **Write `fitness-plan.md`** — route truth before any page data

Key principles:

- Keep actions that are obvious, available, low risk, and repeatable.
- Prefer walking, low-tech machines, low weight, and short routes for beginners.
- Do not reward intensity before consistency.
- The route only needs three stable pieces: minimum promise, default route,
  reset route.
- `fitness-plan.md` must include: constraints, what was cut, minimum promise,
  default route, reset route, weekly review rule, and safety stop rules.
- Before building the page, show the route summary and wait for confirmation
  when the user has not clearly authorized generation.

## Phase 3: Build the island page

1. Seed reusable page targets from `assets/`
2. Ensure `~/.fitness-island/MEMORY.md` exists
3. Write or update `fitness-plan.md`
4. Fill `plan.json` from `fitness-plan.md`. Use `references/plan-json.md`: 30
   days is the default route, not a prison.
5. Adapt `styles.css`, `app.js`, and `design.md` only when the route needs it
6. Keep the page behavior complete:
   动森训练岛 hero, favicon, 7-day route, daily task cards, one settlement button,
   reward stamp modal, weekly review table, copyable agent training data, and
   bottom navigation
7. Generate local rounded Chinese font subsets only when production packaging
   needs self-hosted rounded fonts; never load cloud fonts at runtime
8. Verify in browser before delivery

Copied reference targets:

```text
index.html      # seeded from assets/index.html
styles.css      # seeded from assets/styles.css
app.js          # seeded from assets/app.js
design.md       # seeded from assets/design.md
assets/favicon.svg
assets/animal-island/
```

Generated for the user route:

```text
fitness-plan.md # human-readable truth source
plan.json       # seeded from assets/plan.example.json, then rewritten as page data
```

Optional production asset:

```text
assets/fonts/   # generated WOFF2 subsets, only when self-hosted fonts are required
```

`fitness-plan.md` owns training intent. `plan.json` owns training data for the
page. `design.md` owns UI decisions. HTML is shell, CSS is visual state, JS is
projection.

### UI system

Use only these component meanings:

- `Hero` — title, day meta, game prompt, animal art, progress meter
- `RouteCard` / `RouteNode` — 7-day route; node text is number only
- `TaskCard` — checkbox, action name, parameter pill, note
- `CompleteStrip` — one yellow settlement entry
- `CompleteRewardModal` — reward stamp, `盖章啦`, collect button
- `ReviewTable` — visible weekly review table, not Markdown `<pre>`
- `ArchiveCollapse` — 30-day map entry
- `FloatingNav` — previous, settle/complete, next

Settlement labels:

- `0/total`: `完成今天`
- `1..total-1/total`: `今天到这`
- `total/total`: `完成今天`
- after settlement: `今天已完成`

## Fonts

Default source: Resource Han Rounded CN `0.990`.

Do not ship full TTF/OTF/WOFF2 font families inside the skill. Generated
projects must run with system fallback fonts. Ship WOFF2 subsets only when
self-hosted rounded Chinese fonts are required and the files exist:

```text
assets/fonts/fitness-rounded-cn-medium.woff2
assets/fonts/fitness-rounded-cn-heavy.woff2
assets/fonts/OFL-License.txt
```

Commands:

```bash
bash scripts/init_project.sh "$PROJECT_DIR"
python3 scripts/collect_text.py --root "$PROJECT_DIR" --out /tmp/fitness-text.txt
python3 scripts/validate_plan.py "$PROJECT_DIR/plan.json"
python3 scripts/build_font_subset.py --text /tmp/fitness-text.txt --medium "$MEDIUM_TTF" --heavy "$HEAVY_TTF" --out "$PROJECT_DIR/assets/fonts"
python3 scripts/check_glyphs.py --text /tmp/fitness-text.txt --font "$PROJECT_DIR/assets/fonts/fitness-rounded-cn-medium.woff2"
node --check "$PROJECT_DIR/app.js"
```

## Deploy (optional)

Static output can be deployed by Git push to Vercel, or served locally:

```bash
python3 -m http.server 4173
```

## Dependencies

| Tool | Purpose | Install |
|------|---------|---------|
| Python 3 | init, text collection, font scripts | system Python or `brew install python` |
| fontTools + brotli | WOFF2 subset generation and glyph checks | `python3 -m pip install fonttools brotli` |
| Resource Han Rounded CN | rounded Chinese source font | download/cache locally |
| Browser | mobile visual QA | Chrome / Codex browser |

## Resources

- `references/minimum-friction.md` — sustainability, minimum resistance, habit
  cue, reset route, and weekly review reference
- `references/plan-json.md` — flexible `plan.json` hard contract and soft
  recommendations
- `assets/index.html` — canonical Fitness Island page shell
- `assets/styles.css` — canonical Animal Island visual layer
- `assets/app.js` — canonical static app behavior
- `assets/design.md` — UI contract reference
- `assets/favicon.svg` — rounded favicon for generated pages
- `assets/plan.example.json` — runnable route example and seed
- `assets/animal-island/` — required native visual assets referenced by CSS
- `scripts/init_project.sh` — seed project files from assets
- `scripts/validate_plan.py` — lightweight `plan.json` validator
- `scripts/collect_text.py` — collect project text for font subsetting
- `scripts/build_font_subset.py` — build WOFF2 subsets
- `scripts/check_glyphs.py` — block delivery on missing glyphs

## Verification

- no missing Chinese glyphs
- `plan.json` passes `scripts/validate_plan.py`
- no clipped or overlapping text
- mobile first screen shows the main action
- fixed footer sea does not cover the nav
- partial completion records `今天到这` without filling unfinished actions
- full completion opens the `盖章啦` reward modal
- weekly review table is visible on review days
- exported agent training data can drive the next route adjustment

## Safety boundary

This skill provides practical habit and training references, not medical
diagnosis. Sharp joint pain, numbness, tingling, dizziness, chest pain,
faintness, pain that changes movement quality, or old injury flare-up stops
progression. Reduce load first; seek professional care when symptoms are not
ordinary effort.
