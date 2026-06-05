<!--
[INPUT]: 依赖 fitness-plan.md 的路线真相、assets/app.js 对 plan.json 的实际字段消费、assets/index.html 的路线 DOM 和 Fitness Island 的 7 日路线/30 天全图交互
[OUTPUT]: 对外提供 plan.json 作为页面投影的硬契约、软建议、字段语义和生成注意事项
[POS]: fitness-island references 的数据契约参考，用于保证 plan.json 与 HTML/JS 可灵活对齐
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# plan.json Contract

`fitness-plan.md` is the human truth. `plan.json` is only the page projection.
Keep the schema small.

## Hard Contract

The page must be able to render from this minimum shape:

```json
{
  "weeks": [
    {
      "theme": "出现",
      "signal": "今天来岛上走走。",
      "sentence": "只守住入口。",
      "plant": "sprout",
      "days": [
        {
          "type": "A 训练",
          "title": "背 + 核心",
          "phase": "力量入门",
          "summary": "低重量，先完成出现。",
          "minutes": 10,
          "review": false,
          "exercises": [
            ["跑步机", "4.0 km/h，走 5 分钟", "入口"]
          ]
        }
      ]
    }
  ],
  "buffer": {
    "theme": "缓冲",
    "signal": "不补课，只重启。",
    "sentence": "今天到这也算数。",
    "plant": "sprout",
    "days": []
  }
}
```

Required:

- top-level `weeks`: non-empty array
- each group `days`: non-empty array
- each day `exercises`: non-empty array
- each exercise: exactly three strings `[name, detail, note]`
- optional `buffer.days`: appended after all weeks
- optional `review`: boolean; when true, the weekly review panel appears

## Soft Contract

Recommended, not mandatory:

- 30 total days by default: 4 weeks x 7 days + 2 buffer days
- keep each `weeks[].days` at 7 days so the route remains a weekly route
- put `review: true` on the last day of each week and final buffer day
- keep each day to 1-7 exercises
- keep `minutes` realistic and numeric
- use `type + phase` for the small label, `title` for the task section, and
  `summary` for the hero prompt

## Field Map

| Field | Used by | Meaning |
|-------|---------|---------|
| `weeks[].theme` | review grouping | week name |
| `weeks[].signal` | route card | short weekly prompt |
| `weeks[].sentence` | hero fallback | fallback sentence |
| `weeks[].plant` | visual state | plant marker key |
| `days[].type` | phase label | day category |
| `days[].phase` | phase label | training stage |
| `days[].title` | task section | day title |
| `days[].summary` | hero prompt | today's route sentence |
| `days[].minutes` | hero meta | planned duration |
| `days[].review` | review panel | show weekly review |
| `days[].exercises[]` | task cards | action tuple |

Rule of taste: do not add fields until HTML or JS actually consumes them.
