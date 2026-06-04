#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""여러 모델로 간판 생성 테스트 (한글 보존 + 포토리얼 비교).
사용:
  python gen.py --model kontext  --image color_input.png   --prompt "..."
  python gen.py --model ideogram --prompt "..."
  python gen.py --model canny-pro --image control_input.png --prompt "..."
"""
import os, sys, argparse, datetime
try:
    from dotenv import load_dotenv; load_dotenv()
except ImportError:
    pass
import replicate

MODELS = {
    "kontext":   "black-forest-labs/flux-kontext-pro",
    "ideogram":  "ideogram-ai/ideogram-v3-turbo",
    "imagen":    "google/imagen-4",
    "canny-pro": "black-forest-labs/flux-canny-pro",
    "canny-dev": "black-forest-labs/flux-canny-dev",
}

ap = argparse.ArgumentParser()
ap.add_argument("--model", required=True, choices=list(MODELS))
ap.add_argument("--image")
ap.add_argument("--prompt", required=True)
ap.add_argument("--ar", default="16:9", help="aspect ratio (ideogram/imagen)")
args = ap.parse_args()

if not os.environ.get("REPLICATE_API_TOKEN"):
    sys.exit("[ERR] REPLICATE_API_TOKEN missing (.env)")

m = MODELS[args.model]
payload = {"prompt": args.prompt}

if args.model == "kontext":
    if not args.image: sys.exit("[ERR] kontext needs --image")
    payload["input_image"] = open(args.image, "rb")
    payload["output_format"] = "png"
    payload["aspect_ratio"] = "match_input_image"
elif args.model in ("ideogram",):
    payload["aspect_ratio"] = args.ar
elif args.model == "imagen":
    payload["aspect_ratio"] = args.ar
elif args.model.startswith("canny"):
    if not args.image: sys.exit("[ERR] canny needs --image")
    payload["control_image"] = open(args.image, "rb")
    payload["output_format"] = "png"
    if args.model == "canny-dev":
        payload["guidance"] = 30
    else:
        payload["safety_tolerance"] = 2

print(f"[model] {m}")
print("[run] generating...")
out = replicate.run(m, input=payload)

item = out[0] if isinstance(out, (list, tuple)) else out
ts = datetime.datetime.now().strftime("%H%M%S")
path = f"out_{args.model}_{ts}.png"

if hasattr(item, "read"):
    data = item.read()
elif isinstance(item, (bytes, bytearray)):
    data = item
elif isinstance(item, str):
    import requests; data = requests.get(item).content
else:
    sys.exit(f"[ERR] unknown output: {type(item)}")

with open(path, "wb") as f:
    f.write(data)
print(f"[OK] {path}")
