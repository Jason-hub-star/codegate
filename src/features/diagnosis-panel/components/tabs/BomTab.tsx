"use client";

import { buildBom, CATEGORIES } from "@/features/circuit";
import { type WiringApi } from "@/features/wiring";
import { BomRow } from "../BomRow";

/**
 * 명세 탭 — 회로(w.model)에서 자동 파생한 부품 명세(BOM)를 카테고리별로 표시.
 * 새 상태 없음(파생). 같은 buildBom 을 LLM 직렬화(serializeBom)도 사용 → 드리프트 0.
 */
export function BomTab({ w }: { w: WiringApi }) {
  const bom = buildBom(w.model);

  if (bom.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        아직 배치된 부품이 없어요. 좌측에서 부품을 골라 빵판에 놓으면, 여기 명세가
        자동으로 채워져요.
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
      {CATEGORIES.map(({ id, label }) => {
        const items = bom.filter((b) => b.category === id);
        if (items.length === 0) return null;
        const total = items.reduce((n, it) => n + it.count, 0);
        return (
          <div key={id} className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {label} · {total}
            </p>
            <ul className="space-y-1">
              {items.map((it) => (
                <BomRow
                  key={it.defId}
                  item={it}
                  onAdd={w.selectPartDef}
                  onRemove={w.removePart}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
