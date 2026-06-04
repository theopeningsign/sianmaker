#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""한글 상호명을 깨끗한 흑백 윤곽 이미지로 렌더 (Flux Canny ControlNet 입력용).
사용: python make_control.py "대박치킨"  ->  control_input.png 생성
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

text = sys.argv[1] if len(sys.argv) > 1 else "대박치킨"
W, H = 1280, 480

fonts = [r"C:\Windows\Fonts\malgunbd.ttf", r"C:\Windows\Fonts\malgun.ttf"]
fp = next((f for f in fonts if os.path.exists(f)), None)
if not fp:
    sys.exit("✗ 한글 폰트(맑은고딕) 없음")

img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

# 화면 폭에 맞춰 폰트 크기 자동 조정
size = 300
while size > 40:
    font = ImageFont.truetype(fp, size)
    b = d.textbbox((0, 0), text, font=font)
    if (b[2]-b[0]) <= W*0.88 and (b[3]-b[1]) <= H*0.8:
        break
    size -= 10

b = d.textbbox((0, 0), text, font=font)
tw, th = b[2]-b[0], b[3]-b[1]
d.text(((W-tw)/2 - b[0], (H-th)/2 - b[1]), text, fill="black", font=font)

out = "control_input.png"
img.save(out)
print(f"[OK] {out} saved ({W}x{H}, font {size}px) text='{text}'")
