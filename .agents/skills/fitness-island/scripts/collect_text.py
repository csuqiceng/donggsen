#!/usr/bin/env python3
# /*
# [INPUT]: 依赖 Fitness Island 项目目录中的 index.html、app.js、plan.json 和可选文案文件
# [OUTPUT]: 对外提供用于字体子集生成的 UTF-8 文本文件
# [POS]: scripts 的文本收集工具，被字体子集和缺字检查流程调用
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
# */

import argparse
from pathlib import Path


DEFAULT_FILES = ("index.html", "app.js", "plan.json")


def read_text(path: Path) -> str:
    if not path.exists() or not path.is_file():
        return ""
    return path.read_text(encoding="utf-8", errors="ignore")


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect Fitness Island text for font subsetting.")
    parser.add_argument("--root", required=True, help="Project root.")
    parser.add_argument("--out", required=True, help="Output UTF-8 text file.")
    parser.add_argument(
        "--include",
        action="append",
        default=[],
        help="Additional project-relative file to include. Can be repeated.",
    )
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    files = list(DEFAULT_FILES) + args.include
    text = "\n".join(read_text(root / item) for item in files)

    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(f"collected_chars={len(text)}")
    print(f"out={out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
