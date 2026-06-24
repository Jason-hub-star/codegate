#!/usr/bin/env python3
"""PinMate 에디토리얼 자산 생성기 — gpt-image-2 범용 호출.

Vtube `generate_master_sheets.py`의 call_images 패턴 재사용. 단 캐릭터가 아닌
**에디토리얼 아카데믹**(모노크롬·직각·타이포) 자산 전용. 캐릭터/마스코트/네온 금지.

키: ~/.config/vtube/openai_api_key (없으면 env OPENAI_API_KEY). 코드/로그에 키 비노출.

안전장치: 기본은 **드라이런**(프롬프트만 출력, 과금 0). 실제 생성은 `--go` 필요.
  python3 gen_asset.py --type brand-mark --name pinmate            # 드라이런(프롬프트 확인)
  python3 gen_asset.py --type og-image  --name pinmate --go        # 실제 생성(~$1)
  python3 gen_asset.py --prompt "..." --name custom --go           # 커스텀 프롬프트
  python3 gen_asset.py --type spot-success --name led --ref a.png --go  # 이미지 edit(참조)
"""
from __future__ import annotations
import argparse, base64, json, sys, time
from pathlib import Path

MODEL = "gpt-image-2"
API = "https://api.openai.com/v1"
KEY_PATHS = [Path.home() / ".config/vtube/openai_api_key"]

# ── 모든 프롬프트에 박히는 에디토리얼 제약 (DECISION-LOG DEC-004) ─────────────
STYLE = (
    "Editorial-academic style: warm off-white background (#faf9f7), pure black ink, "
    "monochrome warm-grey accents, flat 2D, clean geometric forms, right angles "
    "(no rounded corners), generous negative space, typographic technical-diagram "
    "aesthetic like a research tool or textbook figure. Minimal and restrained."
)
AVOID = (
    "Do NOT include: neon, purple or blue gradients, glassmorphism, glow effects, "
    "cyberpunk, cartoon characters, mascots, anime, faces, shiny 3D render, "
    "photorealism, busy textures, heavy drop shadows, emoji, bright saturated colors."
)

# ── 에디토리얼-안전 자산 템플릿 (ASSET-PLAN.md §2) ───────────────────────────
TEMPLATES: dict[str, dict] = {
    "brand-mark": {
        "size": "1024x1024",
        "prompt": "A minimal monochrome geometric logo mark for 'PinMate', a circuit-"
        "learning tool for beginners. Concept: a breadboard pin connecting with a "
        "companion dot/line (pin + mate). Single black mark on warm off-white, flat, "
        "geometric, centered with wide margin, suitable as a favicon / app icon.",
    },
    "og-image": {
        "size": "1536x1024",
        "prompt": "An editorial landscape banner for 'PinMate — a 3D breadboard circuit "
        "tutor'. Composition: a clean low-poly breadboard with one jumper wire and a "
        "small LED, drawn flat and monochrome as a technical diagram, with generous "
        "empty space on one side for a title. Textbook figure aesthetic. (Crop to "
        "1200x630 in post for OG.)",
    },
    "spot-empty": {
        "size": "1024x1024",
        "prompt": "A minimal single-line monochrome technical illustration of an empty "
        "electronics breadboard seen at a slight angle, lots of negative space, "
        "no labels, calm and clean.",
    },
    "spot-success": {
        "size": "1024x1024",
        "prompt": "A minimal single-line monochrome technical illustration of one small "
        "LED lit with a subtle soft halo (restrained, not glowing neon), clean line "
        "drawing, lots of negative space.",
    },
    "texture-breadboard": {
        "size": "1024x1024",
        "prompt": "A seamless tileable flat top-down texture of a white plastic "
        "breadboard surface with a regular grid of small square sockets, matte, "
        "monochrome, even lighting, technical. (Verify tiling in post.)",
    },
    "texture-pcb": {
        "size": "1024x1024",
        "prompt": "A seamless tileable flat texture of a matte printed-circuit-board "
        "surface in monochrome grey-black with subtle thin traces, no bright colors, "
        "even lighting, technical. (Verify tiling in post.)",
    },
}


def load_key() -> str:
    for p in KEY_PATHS:
        if p.exists():
            k = p.read_text().strip()
            if k:
                return k
    import os
    k = os.environ.get("OPENAI_API_KEY", "").strip()
    if k:
        return k
    sys.exit("키 없음: ~/.config/vtube/openai_api_key 또는 env OPENAI_API_KEY 필요")


def build_prompt(args) -> tuple[str, str]:
    """(full_prompt, size) 반환."""
    if args.prompt:
        base, size = args.prompt, args.size or "1024x1024"
    else:
        t = TEMPLATES.get(args.type)
        if not t:
            sys.exit(f"--type 미지원: {args.type}. 가능: {', '.join(TEMPLATES)} (또는 --prompt)")
        base, size = t["prompt"], args.size or t["size"]
    full = f"{base}\n\n{STYLE}\n\n{AVOID}"
    return full, size


def call_images(key: str, prompt: str, size: str, quality: str, ref: Path | None) -> bytes:
    import requests
    headers = {"Authorization": f"Bearer {key}"}
    common = {"model": MODEL, "prompt": prompt, "size": size, "quality": quality, "n": 1}
    if ref is None:
        resp = requests.post(f"{API}/images/generations", headers=headers, json=common, timeout=600)
    else:
        with open(ref, "rb") as f:
            resp = requests.post(f"{API}/images/edits", headers=headers,
                                 data={k: str(v) for k, v in common.items()},
                                 files={"image": (ref.name, f, "image/png")}, timeout=600)
    if resp.status_code != 200:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:300]}")
    return base64.b64decode(resp.json()["data"][0]["b64_json"])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--type", help=f"자산 타입: {', '.join(TEMPLATES)}")
    ap.add_argument("--prompt", help="커스텀 프롬프트(타입 대신). STYLE/AVOID는 자동 부착")
    ap.add_argument("--name", default="asset", help="출력 파일명 접두")
    ap.add_argument("--size", help="1024x1024 | 1536x1024 | 1024x1536")
    ap.add_argument("--quality", default="high", help="low|medium|high")
    ap.add_argument("--ref", type=Path, help="참조 PNG(images/edits로 생성)")
    ap.add_argument("--out", type=Path, default=Path("assets/generated"))
    ap.add_argument("--go", action="store_true", help="실제 생성(없으면 드라이런·과금0)")
    args = ap.parse_args()

    prompt, size = build_prompt(args)
    print(f"=== {args.name} ({args.type or 'custom'}, {size}, q={args.quality}) ===\n{prompt}\n")
    if not args.go:
        print("[드라이런] 실제 생성하려면 --go 추가 (~$1/장, 청구 SSOT=OpenAI 콘솔)")
        return 0

    key = load_key()
    args.out.mkdir(parents=True, exist_ok=True)
    stem = f"{args.type or 'custom'}-{args.name}"
    try:
        png = call_images(key, prompt, size, args.quality, args.ref)
    except Exception as e:
        sys.exit(f"생성 실패: {e}")
    png_path = args.out / f"{stem}.png"
    png_path.write_bytes(png)
    (args.out / f"{stem}.json").write_text(json.dumps(
        {"model": MODEL, "size": size, "quality": args.quality, "type": args.type,
         "prompt": prompt, "ref": str(args.ref) if args.ref else None,
         "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S")}, ensure_ascii=False, indent=2))
    print(f"✅ {png_path} ({len(png)//1024}KB) + 사이드카 JSON")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
