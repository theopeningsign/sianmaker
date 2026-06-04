#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""검은 배경 글자 이미지를 건물 사진에 합성.
- 글자 이미지(검은 배경)에서 'value(밝기)'를 알파로 추출 → 검정은 투명, 글자/발광은 유지
- 건물 사진 위 지정 위치/크기에 알파 합성
사용: python composite.py <letters_on_black.png> <building.png> [out.png]
"""
import sys
from PIL import Image, ImageChops

letters_p = sys.argv[1]
bg_p = sys.argv[2]
out_p = sys.argv[3] if len(sys.argv) > 3 else "out_composite.png"

letters = Image.open(letters_p).convert("RGB")
# 알파 = 채널 최대값(=HSV의 V). 검정(0)→투명, 파란면/흰테/발광→불투명
r, g, b = letters.split()
alpha = ImageChops.lighter(ImageChops.lighter(r, g), b)
# 약한 글로우까지 살짝 살리되 배경 노이즈는 죽이기 (가벼운 대비)
alpha = alpha.point(lambda v: 0 if v < 18 else min(255, int(v * 1.25)))
letters_rgba = Image.merge("RGBA", (r, g, b, alpha))

bg = Image.open(bg_p).convert("RGBA")
BW, BH = bg.size

# 간판 폭 = 건물 폭의 62%, 상단 사인밴드 부근(위에서 22%)에 배치
target_w = int(BW * 0.62)
scale = target_w / letters_rgba.width
target_h = int(letters_rgba.height * scale)
letters_rsz = letters_rgba.resize((target_w, target_h), Image.LANCZOS)

px = (BW - target_w) // 2
py = int(BH * 0.20)

comp = bg.copy()
comp.alpha_composite(letters_rsz, (px, py))
comp.convert("RGB").save(out_p)
print(f"[OK] {out_p}  (bg {BW}x{BH}, sign w={target_w})")
