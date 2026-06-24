"use client";

import { type ViewPreset } from "../../three/viewport";

const PRESETS: { key: ViewPreset; label: string }[] = [
  { key: "home", label: "홈" },
  { key: "front", label: "정면" },
  { key: "top", label: "위" },
  { key: "iso", label: "등각" },
];

/** 뷰 프리셋 버튼(모노크롬, 우하단). research/14의 "맵뷰"를 버튼형으로. */
export function ViewPresets({
  onSelect,
}: {
  onSelect: (p: ViewPreset) => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 flex gap-1">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onSelect(p.key)}
          className="border border-border-soft bg-card/90 px-2 py-1 font-mono text-[10px] text-muted-foreground backdrop-blur-sm hover:bg-surface-2 hover:text-foreground"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
