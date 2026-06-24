"use client";

/** 재사용 슬라이더+수치 1행 — scaleLen/yLift/rotationY 공용. */
interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  onChange,
}: Props) {
  // 숫자 입력은 HTML min/max 가 타이핑을 막지 못함 → 직접 클램프(잘못된 값 export 차단).
  const emit = (raw: number) => {
    if (Number.isNaN(raw)) return;
    onChange(Math.min(max, Math.max(min, raw)));
  };
  return (
    <label className="flex items-center gap-2">
      <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => emit(Number(e.target.value))}
        className="min-w-0 flex-1"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => emit(Number(e.target.value))}
        className="w-16 shrink-0 border border-border-soft bg-card px-1.5 py-0.5 text-right font-mono text-[11px]"
      />
      {unit && (
        <span className="w-6 shrink-0 font-mono text-[10px] text-muted-foreground">
          {unit}
        </span>
      )}
    </label>
  );
}
