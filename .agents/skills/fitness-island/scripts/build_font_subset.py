#!/usr/bin/env python3
# /*
# [INPUT]: 依赖 fontTools.subset、Resource Han Rounded CN Medium/Heavy 源字体和项目文本文件
# [OUTPUT]: 对外生成 fitness-rounded-cn-medium.woff2 与 fitness-rounded-cn-heavy.woff2
# [POS]: scripts 的字体构建工具，把完整源字体压成项目运行时子集
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
# */

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


OUTPUTS = (
    ("medium", "fitness-rounded-cn-medium.woff2"),
    ("heavy", "fitness-rounded-cn-heavy.woff2"),
)


def subset(source: Path, text: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "fontTools.subset",
        str(source),
        f"--text-file={text}",
        "--flavor=woff2",
        "--layout-features=*",
        "--glyph-names",
        "--symbol-cmap",
        "--legacy-cmap",
        f"--output-file={output}",
    ]
    subprocess.run(command, check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Build Fitness Island rounded Chinese WOFF2 subsets.")
    parser.add_argument("--text", required=True, help="UTF-8 text file collected from project output.")
    parser.add_argument("--medium", required=True, help="Resource Han Rounded CN Medium TTF/OTF.")
    parser.add_argument("--heavy", required=True, help="Resource Han Rounded CN Heavy TTF/OTF.")
    parser.add_argument("--out", required=True, help="Output assets/fonts directory.")
    parser.add_argument("--license", help="Optional OFL license file to copy into output.")
    args = parser.parse_args()

    text = Path(args.text).expanduser().resolve()
    out = Path(args.out).expanduser().resolve()
    sources = {
        "medium": Path(args.medium).expanduser().resolve(),
        "heavy": Path(args.heavy).expanduser().resolve(),
    }

    for key, filename in OUTPUTS:
        output = out / filename
        subset(sources[key], text, output)
        print(f"built={output}")

    if args.license:
        license_path = Path(args.license).expanduser().resolve()
        shutil.copyfile(license_path, out / "OFL-License.txt")
        print(f"license={out / 'OFL-License.txt'}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
