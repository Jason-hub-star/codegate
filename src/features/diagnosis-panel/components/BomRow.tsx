"use client";

import { type BomItem } from "@/features/circuit";

const PROTO: Record<string, string> = {
  onoff: "디지털",
  analog: "아날로그",
  pwm: "PWM",
  i2c: "I2C",
  "1-wire": "1-Wire",
};

const BTN =
  "border border-border-soft px-1.5 font-mono text-xs leading-5 text-muted-foreground hover:bg-surface-2 hover:text-foreground";

interface Props {
  item: BomItem;
  onAdd: (defId: string) => void;
  onRemove: (uid: string) => void;
}

/** 명세 1행 — 라벨 · ×개수 · 메타칩 · 추가(+)/제거(−). 추가=배치 재선택, 제거=마지막 1개. */
export function BomRow({ item, onAdd, onRemove }: Props) {
  const chips: string[] = [];
  if (item.operatingV) chips.push(item.operatingV);
  if (item.protocol) chips.push(PROTO[item.protocol] ?? item.protocol);
  if (item.needsResistor) chips.push("저항 필요");
  if (item.needsPullup) chips.push("풀업 권장");

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border border-border-soft px-2.5 py-1.5">
      <span className="flex-1 text-xs font-semibold">{item.label}</span>
      <span className="font-mono text-[11px] text-muted-foreground">
        ×{item.count}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onAdd(item.defId)}
          title="하나 더 배치 (선택 후 빵판 클릭)"
          className={BTN}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.uids[item.uids.length - 1])}
          title="하나 제거"
          className={BTN}
        >
          −
        </button>
      </div>
      {chips.length > 0 && (
        <div className="flex basis-full flex-wrap gap-1">
          {chips.map((c) => (
            <span
              key={c}
              className="border border-border-soft px-1 font-mono text-[9px] text-muted-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
