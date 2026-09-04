#!/usr/bin/env python3
"""生成 PIGWATCH PWA 图标（纯标准库，深色底 + 粉色猪鼻圆）。"""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "site" / "icons"
ROOT.mkdir(parents=True, exist_ok=True)

BG = (11, 18, 32)        # #0b1220
PINK = (244, 114, 182)   # 猪鼻粉
DARK = (190, 70, 130)


def png_write(path, size):
    rows = []
    c = size / 2
    r_outer = size * 0.30
    r_nostril = size * 0.055
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            dx, dy = x - c, y - c
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= r_outer:
                # 鼻孔：左右两个小圆
                for nx in (-size * 0.11, size * 0.11):
                    if ((x - c - nx) ** 2 + (y - c) ** 2) ** 0.5 <= r_nostril:
                        row += bytes(DARK)
                        break
                else:
                    row += bytes(PINK)
            else:
                row += bytes(BG)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))

    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(raw)))
        f.write(chunk(b"IEND", b""))
    print(f"[write] {path}")


png_write(ROOT / "icon-192.png", 192)
png_write(ROOT / "icon-512.png", 512)
