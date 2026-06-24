"use client";

import type { GlbCalibPart } from "../hooks/useCalibrator";

/** 보정할 GLB 부품 선택 드롭다운. */
interface Props {
  parts: GlbCalibPart[];
  value: string | null;
  onChange: (assetId: string) => void;
}

export function PartPicker({ parts, value, onChange }: Props) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-border-soft bg-card px-2 py-1.5 font-mono text-[12px]"
    >
      {parts.map((p) => (
        <option key={p.id} value={p.assetId}>
          {p.label} ({p.assetId})
        </option>
      ))}
    </select>
  );
}
