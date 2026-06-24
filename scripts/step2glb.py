#!/usr/bin/env python3
"""
STEP → GLB 변환기 (핀메이트 합법 에셋 파이프라인)

KiCad packages3D(CC-BY-SA) · Adafruit CAD Parts(MIT)에서 받은 STEP을
Three.js용 GLB로 변환한다. 재질/파츠별 색상 보존. (DEC-022/024)

설치 (1회):
    python3 -m venv /tmp/step2glb
    /tmp/step2glb/bin/pip install cascadio trimesh

사용:
    /tmp/step2glb/bin/python scripts/step2glb.py <input.step> [output.glb] [--dense]
    # --dense: tol_linear 0.02(더 정밀·무거움), 기본 0.1(가벼움)

복잡 부품(서보·ESP32·센서)에만 권장. 단순 부품(LED·저항·버튼)은 절차 생성이 더 깔끔(DEC-024).
변환 후 폴리 많으면 gltf-transform/meshopt로 경량화.
"""
import sys, os

def convert(src, dst, tol_linear=0.1, tol_angular=0.5):
    import cascadio, trimesh
    cascadio.step_to_glb(src, dst, tol_linear, tol_angular)
    sc = trimesh.load(dst, file_type="glb")
    geos = list(sc.geometry.values()) if hasattr(sc, "geometry") else [sc]
    tris = sum(int(g.faces.shape[0]) for g in geos)
    kb = os.path.getsize(dst) / 1024
    print(f"OK  {os.path.basename(src)} -> {dst} | parts={len(geos)} tris={tris:,} {kb:.0f}KB")
    return tris, kb

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dense = "--dense" in sys.argv
    if not args:
        print(__doc__); sys.exit(1)
    src = args[0]
    dst = args[1] if len(args) > 1 else os.path.splitext(src)[0] + ".glb"
    convert(src, dst, tol_linear=0.02 if dense else 0.1)
