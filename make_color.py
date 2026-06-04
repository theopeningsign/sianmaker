#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""컬러 입력 이미지 생성 (측면발광 힌트: 파란 글자면 + 흰 외곽).
kontext/img2img 입력용.  사용: python make_color.py "클래시컴퍼니"
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

text = sys.argv[1] if len(sys.argv) > 1 else "클래시컴퍼니"
W, H = 1280, 480
fp = r"C:\Windows\Fonts\malgunbd.ttf"
if not os.path.exists(fp):
    fp = r"C:\Windows\Fonts\malgun.ttf"

img = Image.new("RGB", (W, H), (32, 33, 38))   # 어두운 벽 느낌
d = ImageDraw.Draw(img)

size = 200
while size > 40:
    font = ImageFont.truetype(fp, size)
    sw = max(3, size // 22)
    b = d.textbbox((0, 0), text, font=font, stroke_width=sw)
    if (b[2]-b[0]) <= W*0.9 and (b[3]-b[1]) <= H*0.78:
        break
    size -= 8

sw = max(3, size // 22)
b = d.textbbox((0, 0), text, font=font, stroke_width=sw)
tw, th = b[2]-b[0], b[3]-b[1]
x, y = (W-tw)/2 - b[0], (H-th)/2 - b[1]
# 파란 면 + 흰 외곽(측면발광 힌트)
d.text((x, y), text, font=font, fill=(22, 86, 214),
       stroke_width=sw, stroke_fill=(255, 255, 255))

img.save("color_input.png")
print("[OK] color_input.png saved", (W, H), "font", size)
