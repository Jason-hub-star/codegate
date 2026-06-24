"use client";

import type { CalibratorApi } from "../hooks/useCalibrator";
import { SliderRow } from "./SliderRow";
import { ExportSnippet } from "./ExportSnippet";

/** 제어 패널 — SliderRow 3종 + Auto/Reset + Export 조립(조립만, 로직은 허브). */
interface Props {
  api: CalibratorApi;
}

const BTN =
  "border border-border-soft bg-card px-2 py-1 font-mono text-[11px] hover:bg-surface-2 disabled:opacity-40";

export function TransformPanel({ api }: Props) {
  const { spec, setSpec, autoScale, reset, assetId, dirty } = api;

  return (
    <div className="space-y-3">
      <SliderRow
        label="scaleLen"
        value={spec.scaleLen}
        min={5}
        max={60}
        unit="mm"
        onChange={(v) => setSpec({ scaleLen: v })}
      />
      <SliderRow
        label="yLift"
        value={spec.yLift}
        min={-5}
        max={15}
        unit="mm"
        onChange={(v) => setSpec({ yLift: v })}
      />
      <SliderRow
        label="rotationY"
        value={spec.rotationY}
        min={0}
        max={Math.PI * 2}
        step={0.01}
        unit="rad"
        onChange={(v) => setSpec({ rotationY: v })}
      />

      <div className="flex gap-1">
        <button type="button" onClick={autoScale} className={BTN}>
          Auto 스케일
        </button>
        <button type="button" onClick={reset} disabled={!dirty} className={BTN}>
          리셋
        </button>
      </div>

      <ExportSnippet assetId={assetId} spec={spec} />
    </div>
  );
}
