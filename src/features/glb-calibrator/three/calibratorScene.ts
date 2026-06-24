/**
 * 캘리브레이터 3D 씬 (DEC-031, 순수 three) — createScene + 빵판 + 선택 GLB 부품 라이브 마운트.
 * applySpec 으로 scaleLen·yLift·rotationY 를 실시간 반영. 프레임워크 비의존.
 *
 * scaleLen 라이브 제어: loadGlbRaw(스케일 1 + baseLongest)로 받아 outer 그룹에
 * scaleLen/baseLongest 균일스케일 → 원점기준이라 바닥 y=0·xz중심 유지(스케일 불변점).
 */
import * as THREE from "three";
import { createScene } from "@/features/breadboard-3d/three/createScene";
import { createBreadboard } from "@/features/breadboard-3d/three/breadboard";
import { loadGlbRaw } from "@/features/breadboard-3d/three/loadGlb";
import { ASSET_CREDITS } from "@/lib/assetCredits";

/** DraftSpec 와 구조 호환(역방향 import 회피) */
export interface SpecInput {
  scaleLen: number;
  yLift: number;
  rotationY: number;
}

export interface CalibratorSceneHandle {
  /** 선택 부품을 footprint 위에 마운트하고 현재 spec 을 적용 */
  applySpec: (assetId: string | null, spec: SpecInput) => void;
  dispose: () => void;
}

const URL_BY_ID = new Map(ASSET_CREDITS.map((a) => [a.id, a.glb]));

export interface CalibratorSceneOpts {
  /** 부품 로드 직후 본연 최장축(mm) 보고 — autoScale 기준값 */
  onPartLoaded?: (baseLongest: number) => void;
}

export function createCalibratorScene(
  container: HTMLElement,
  opts?: CalibratorSceneOpts,
): CalibratorSceneHandle {
  const handle = createScene(container);
  const { group: breadboard } = createBreadboard();
  handle.scene.add(breadboard);

  // 부품은 빵판 중앙(원점) 위에 1개만 — 보정 대상은 변환값(핀 정합 X, DEC-031)
  const partGroup = new THREE.Group();
  partGroup.name = "calib-part";
  handle.scene.add(partGroup);

  handle.controls.target.set(0, 5, 0);
  handle.camera.position.set(38, 32, 48);
  handle.controls.update();
  handle.start();

  const ro = new ResizeObserver(() => handle.resize());
  ro.observe(container);

  // ── 마운트 상태 ──
  let currentAssetId: string | null = null;
  let outer: THREE.Group | null = null; // 변환 노드(scale/lift/rot)
  let baseLongest = 1; // 스케일 전 수평 최장축
  let pendingSpec: SpecInput | null = null;
  let loadSeq = 0; // 비동기 로드 경쟁 방지

  const clearPart = () => {
    for (const c of [...partGroup.children]) {
      partGroup.remove(c);
      c.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose(); // 머티리얼은 공유 자원 → 보존
      });
    }
    outer = null;
  };

  const applyTransform = (spec: SpecInput) => {
    if (!outer) return;
    outer.scale.setScalar(spec.scaleLen / baseLongest); // 원본 대비 절대(누적 X)
    outer.position.y = spec.yLift;
    outer.rotation.y = spec.rotationY;
  };

  const applySpec: CalibratorSceneHandle["applySpec"] = (assetId, spec) => {
    pendingSpec = spec;

    // 같은 부품 → 재로드 없이 mutate 만(라이브)
    if (assetId === currentAssetId) {
      applyTransform(spec);
      return;
    }

    // 부품 교체 → 재로드
    currentAssetId = assetId;
    clearPart();
    if (!assetId) return;
    const url = URL_BY_ID.get(assetId);
    if (!url) return;

    const seq = ++loadSeq;
    loadGlbRaw(url, { removeFloor: true }).then((raw) => {
      if (seq !== loadSeq || !raw) return; // 그 사이 다른 부품 선택 → 폐기
      baseLongest = raw.baseLongest;
      outer = new THREE.Group();
      outer.add(raw.model);
      partGroup.add(outer);
      if (pendingSpec) applyTransform(pendingSpec);
      opts?.onPartLoaded?.(raw.baseLongest);
    });
  };

  const dispose = () => {
    ro.disconnect();
    clearPart();
    handle.dispose();
  };

  return { applySpec, dispose };
}
