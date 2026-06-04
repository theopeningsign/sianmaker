#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI 사진 마감(Stage 3) 검증 스크립트
─────────────────────────────────────────────
WebGL 렌더(proto-channel.html에서 [PNG 내보내기]한 이미지)를
Replicate Flux Canny ControlNet에 넣어서:
  · 한글 글자 윤곽은 그대로 고정(canny)
  · 그 위에 photoreal 재질/조명/질감을 AI가 입힘
이게 "그림 → 사진"으로 넘어가는지 + 한글 안 깨지는지 검증한다.

[준비]
  1) 프로젝트 폴더에 .env 파일:
        REPLICATE_API_TOKEN=r8_xxx   (토큰은 사장님이 직접 입력)
  2) 패키지 설치:
        pip install replicate python-dotenv requests
  3) proto-channel.html 에서 [PNG 내보내기] 한 파일 준비 (예: sign_대박치킨_night.png)

[실행]
  python ai_finish_test.py sign_대박치킨_night.png
  python ai_finish_test.py 입력.png --model pro      # 더 고품질(flux-canny-pro)
  python ai_finish_test.py 입력.png --prompt "원하는 프롬프트"

결과는 out_finish_*.png 로 저장됨.
"""

import os
import sys
import argparse
import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv 없으면 환경변수 직접 사용

# ── 카테고리별 마감 프롬프트 (전면 채널·맨벽 기준) ──
DEFAULT_PROMPT = (
    "A photorealistic photograph of an illuminated 3D LED channel-letter signboard "
    "mounted on a building exterior wall at night. Glossy acrylic letter faces glowing "
    "with bright even internal LED light, dark metal returns on the letter sides, "
    "realistic depth and thickness, soft colored light spill on the surrounding wall, "
    "shot on a DSLR camera, sharp focus, high detail, real storefront at night. "
    "Preserve the exact letter shapes and spelling."
)
NEGATIVE = "cartoon, illustration, flat graphic, cgi, lowres, blurry, distorted letters, extra letters"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image", help="컨트롤 입력 이미지 (WebGL 렌더 PNG)")
    ap.add_argument("--model", choices=["dev", "pro"], default="dev",
                    help="dev=flux-canny-dev(저렴), pro=flux-canny-pro(고품질)")
    ap.add_argument("--prompt", default=DEFAULT_PROMPT)
    args = ap.parse_args()

    token = os.environ.get("REPLICATE_API_TOKEN")
    if not token:
        sys.exit("✗ REPLICATE_API_TOKEN 이 없습니다. .env 파일을 확인하세요.")

    if not os.path.exists(args.image):
        sys.exit(f"✗ 입력 이미지 없음: {args.image}")

    try:
        import replicate
    except ImportError:
        sys.exit("✗ replicate 패키지 없음 →  pip install replicate python-dotenv requests")

    model = ("black-forest-labs/flux-canny-pro" if args.model == "pro"
             else "black-forest-labs/flux-canny-dev")

    print(f"[model] {model}")
    print(f"[input] {args.image}")
    print("[run] generating...")

    payload = {
        "prompt": args.prompt,
        "control_image": open(args.image, "rb"),
        "output_format": "png",
    }
    # 모델별 전용 파라미터 (스키마 불일치 방지)
    if args.model == "dev":
        payload["guidance"] = 30
    else:  # pro
        payload["safety_tolerance"] = 2

    output = replicate.run(model, input=payload)

    # ── 결과 저장 (FileOutput / list / url 모두 대응) ──
    item = output[0] if isinstance(output, (list, tuple)) else output
    ts = datetime.datetime.now().strftime("%H%M%S")
    out_path = f"out_finish_{args.model}_{ts}.png"

    data = None
    if hasattr(item, "read"):           # FileOutput
        data = item.read()
    elif isinstance(item, (bytes, bytearray)):
        data = item
    elif isinstance(item, str):         # URL
        import requests
        data = requests.get(item).content
    else:
        sys.exit(f"✗ 알 수 없는 출력 형식: {type(item)}")

    with open(out_path, "wb") as f:
        f.write(data)

    print(f"[OK] saved: {out_path}")
    print("  -> check Hangul intact + photoreal")


if __name__ == "__main__":
    main()
