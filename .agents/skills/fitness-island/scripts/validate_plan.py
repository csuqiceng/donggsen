#!/usr/bin/env python3
"""
[INPUT]: 依赖 plan.json 的 Fitness Island 路线数据
[OUTPUT]: 对外提供轻量 plan.json 契约检查，错误非零退出，软建议打印 warning
[POS]: scripts 的数据边界检查器，保证生成路线能被 assets/app.js 渲染，同时保留路线长度和周结构弹性
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""

import json
import sys
from pathlib import Path


def fail(errors, message):
    errors.append(message)


def warn(warnings, message):
    warnings.append(message)


def is_nonempty_string(value):
    return isinstance(value, str) and bool(value.strip())


def check_group(group, path, errors, warnings):
    if not isinstance(group, dict):
        fail(errors, f"{path} must be an object")
        return []

    days = group.get("days")
    if not isinstance(days, list) or not days:
        fail(errors, f"{path}.days must be a non-empty array")
        return []
    if len(days) > 7:
        warn(warnings, f"{path}.days has {len(days)} days; weekly route works best at 7 or fewer")

    for key in ("theme", "signal", "sentence", "plant"):
        if key in group and not isinstance(group[key], str):
            fail(errors, f"{path}.{key} must be a string when present")

    for index, day in enumerate(days):
        check_day(day, f"{path}.days[{index}]", errors, warnings)

    return days


def check_day(day, path, errors, warnings):
    if not isinstance(day, dict):
        fail(errors, f"{path} must be an object")
        return

    for key in ("type", "title", "phase", "summary"):
        if key not in day:
            warn(warnings, f"{path}.{key} is recommended for polished UI")
        elif not isinstance(day[key], str):
            fail(errors, f"{path}.{key} must be a string")

    minutes = day.get("minutes")
    if minutes is None:
        warn(warnings, f"{path}.minutes is recommended")
    elif not isinstance(minutes, (int, float)) or minutes <= 0:
        fail(errors, f"{path}.minutes must be a positive number")

    if "review" in day and not isinstance(day["review"], bool):
        fail(errors, f"{path}.review must be true or false")

    exercises = day.get("exercises")
    if not isinstance(exercises, list) or not exercises:
        fail(errors, f"{path}.exercises must be a non-empty array")
        return
    if len(exercises) > 7:
        warn(warnings, f"{path}.exercises has {len(exercises)} items; short routes are easier to finish")

    for index, item in enumerate(exercises):
        if not isinstance(item, list) or len(item) != 3:
            fail(errors, f"{path}.exercises[{index}] must be [name, detail, note]")
            continue
        for part_index, value in enumerate(item):
            if not is_nonempty_string(value):
                fail(errors, f"{path}.exercises[{index}][{part_index}] must be a non-empty string")


def main():
    if len(sys.argv) != 2:
        print("usage: validate_plan.py /path/to/plan.json", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    errors = []
    warnings = []

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"plan.json invalid JSON: {exc}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        fail(errors, "plan.json must be an object")
        data = {}

    weeks = data.get("weeks")
    if not isinstance(weeks, list) or not weeks:
        fail(errors, "weeks must be a non-empty array")
        weeks = []

    all_days = []
    for index, week in enumerate(weeks):
        all_days.extend(check_group(week, f"weeks[{index}]", errors, warnings))

    buffer = data.get("buffer")
    if buffer is not None:
        if not isinstance(buffer, dict):
            fail(errors, "buffer must be an object when present")
        else:
            days = buffer.get("days", [])
            if days:
                all_days.extend(check_group(buffer, "buffer", errors, warnings))
            elif "days" in buffer and not isinstance(days, list):
                fail(errors, "buffer.days must be an array when present")

    total = len(all_days)
    if total == 0:
        fail(errors, "plan must contain at least one day")
    if total > 30:
        fail(errors, f"plan has {total} days; app renders the first 30 days")
    if total != 30:
        warn(warnings, f"plan has {total} days; 30 days is the default Fitness Island route")

    for message in warnings:
        print(f"warning: {message}", file=sys.stderr)

    if errors:
        for message in errors:
            print(f"error: {message}", file=sys.stderr)
        return 1

    print(f"plan ok: {total} days")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
