"use client";

/**
 * GLB 캘리브레이터 상태 허브 (DEC-031) — useWiring 패턴.
 * 선택 assetId + draft 변환값(scaleLen·yLift·rotationY)을 들고, 컴포넌트는 이 API의 뷰.
 * 출력은 항상 GLB_PART_SPECS 데이터(같은 assetId = 한 값) — 가드(DEC-031).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { CATALOG, FIXTURES } from "@/features/circuit";
import { glbSpecFor, type GlbPartSpec } from "@/features/breadboard-3d";

/** 보드·빵판(FIXTURES)은 보정 대상 아님 — 빵판 위에 올리는 부품만 캘리브레이트 */
const FIXTURE_IDS = new Set(FIXTURES.map((f) => f.id));

/** 보정 대상 = render.kind==="glb" 카탈로그 항목 */
export interface GlbCalibPart {
  id: string;
  label: string;
  assetId: string;
}

/** 정규화된 작업값(슬라이더가 직접 바인딩) — GlbPartSpec 와 구조 호환 */
export interface DraftSpec {
  scaleLen: number;
  yLift: number;
  rotationY: number;
}

export interface CalibratorApi {
  parts: GlbCalibPart[];
  assetId: string | null;
  spec: DraftSpec;
  dirty: boolean;
  selectAsset: (assetId: string | null) => void;
  setSpec: (patch: Partial<DraftSpec>) => void;
  autoScale: () => void;
  reset: () => void;
  /** 씬이 부품 로드 후 측정한 baseLongest(mm) 보고 — autoScale 기준값 */
  reportBase: (baseLongest: number) => void;
}

const toDraft = (s: GlbPartSpec): DraftSpec => ({
  scaleLen: s.scaleLen,
  yLift: s.yLift ?? 0,
  rotationY: s.rotationY ?? 0,
});

export function useCalibrator(): CalibratorApi {
  // GLB 부품만, 픽스처(보드·빵판) 제외 — 빵판 위 배치 부품이 보정 대상(DEC-031)
  const parts = useMemo<GlbCalibPart[]>(
    () =>
      CATALOG.flatMap((c) =>
        c.render.kind === "glb" && !FIXTURE_IDS.has(c.id)
          ? [{ id: c.id, label: c.label, assetId: c.render.assetId }]
          : [],
      ),
    [],
  );

  const first = parts[0]?.assetId ?? null;
  const [assetId, setAssetId] = useState<string | null>(first);
  const [spec, setSpecState] = useState<DraftSpec>(() =>
    toDraft(glbSpecFor(first ?? "")),
  );
  const [dirty, setDirty] = useState(false);
  const baseLongestRef = useRef(0); // 씬이 보고한 마지막 부품의 본연 최장축(mm)

  const reportBase = useCallback((baseLongest: number) => {
    baseLongestRef.current = baseLongest;
  }, []);

  const selectAsset = useCallback((id: string | null) => {
    setAssetId(id);
    setSpecState(toDraft(glbSpecFor(id ?? "")));
    setDirty(false);
  }, []);

  const setSpec = useCallback((patch: Partial<DraftSpec>) => {
    setSpecState((s) => ({ ...s, ...patch }));
    setDirty(true);
  }, []);

  const autoScale = useCallback(() => {
    // 본연 최장축을 실척 mm 로 — GLB는 미터 제작이라 ×1000(measure-glb로 검증).
    // ldr 0.016m=16mm가 파일명 D13.8mm와 일치 → 미터 가정 타당.
    const base = baseLongestRef.current;
    if (base > 0) setSpec({ scaleLen: Math.round(base * 1000 * 10) / 10 });
  }, [setSpec]);

  const reset = useCallback(() => {
    setSpecState(toDraft(glbSpecFor(assetId ?? "")));
    setDirty(false);
  }, [assetId]);

  return {
    parts,
    assetId,
    spec,
    dirty,
    selectAsset,
    setSpec,
    autoScale,
    reset,
    reportBase,
  };
}
