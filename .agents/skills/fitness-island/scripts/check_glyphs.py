#!/usr/bin/env python3
# /*
# [INPUT]: 依赖 fontTools.ttLib、UTF-8 文本文件和待发布字体文件
# [OUTPUT]: 对外提供缺字计数、缺字样本和进程退出码
# [POS]: scripts 的字体验证工具，用于发布前阻断中文缺字
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
# */

import argparse
import unicodedata
from pathlib import Path

from fontTools.ttLib import TTFont


def useful_chars(text: str) -> set[str]:
    chars: set[str] = set()
    for char in text:
        if char.isspace():
            continue
        if unicodedata.category(char).startswith("C"):
            continue
        chars.add(char)
    return chars


def main() -> int:
    parser = argparse.ArgumentParser(description="Check glyph coverage for a generated webfont.")
    parser.add_argument("--text", required=True, help="UTF-8 text file collected from project output.")
    parser.add_argument("--font", required=True, help="TTF/OTF/WOFF/WOFF2 font to check.")
    args = parser.parse_args()

    text = Path(args.text).expanduser().read_text(encoding="utf-8", errors="ignore")
    font_path = Path(args.font).expanduser().resolve()
    font = TTFont(font_path)
    cmap = set(font.getBestCmap().keys())

    missing = sorted(char for char in useful_chars(text) if ord(char) not in cmap)
    print(f"font={font_path}")
    print(f"checked_chars={len(useful_chars(text))}")
    print(f"missing_count={len(missing)}")
    if missing:
      print("missing=" + "".join(missing[:120]))
      return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
