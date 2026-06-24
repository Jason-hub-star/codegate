"use client";

/**
 * GLB 캘리브레이터 셸 (DEC-031) — 3D 뷰 + 제어 패널 조립만(로직은 useCalibrator).
 * 라우트(app/calibrate/parts)는 이 컴포넌트만 렌더.
 */
import { useCalibrator } from "../hooks/useCalibrator";
import { PartPicker } from "./PartPicker";
import { CalibratorScene } from "./CalibratorScene";
import { TransformPanel } from "./TransformPanel";

export function Calibrator() {
  const api = useCalibrator();

  return (
    <div className="flex h-dvh w-full">
      <main className="relative min-w-0 flex-1">
        <CalibratorScene
          assetId={api.assetId}
          spec={api.spec}
          onPartLoaded={api.reportBase}
        />
        <span className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] text-muted-foreground">
          GLB 변환 보정 / calibrate parts
        </span>
      </main>

      <aside className="w-[320px] shrink-0 space-y-4 border-l border-border-soft bg-surface-2 p-4">
        <PartPicker
          parts={api.parts}
          value={api.assetId}
          onChange={api.selectAsset}
        />
        <TransformPanel api={api} />
      </aside>
    </div>
  );
}
