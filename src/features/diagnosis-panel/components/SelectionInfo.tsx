"use client";

import {
  describeConnection,
  describePartConnection,
} from "@/features/circuit";
import type { WiringApi } from "@/features/wiring";

export function SelectionInfo({ w }: { w: WiringApi }) {
  const wire = describeConnection(w.model, w.selectedWireId);
  const part = !wire ? describePartConnection(w.model, w.selectedPartUid) : null;

  if (!wire && !part) return null;

  return (
    <section className="border-b border-border-soft py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        선택 정보
      </p>

      {wire && (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="font-semibold text-foreground">{wire.label}</p>
          <div className="grid grid-cols-[44px_1fr] gap-x-2 gap-y-1 text-muted-foreground">
            <span>출발</span>
            <span className="text-foreground">{wire.from.label}</span>
            <span>도착</span>
            <span className="text-foreground">{wire.to.label}</span>
          </div>
        </div>
      )}

      {part && (
        <div className="mt-2 space-y-1.5 text-xs">
          <p className="font-semibold text-foreground">{part.title}</p>
          <div className="space-y-1">
            {part.rows.map((row) => (
              <div
                key={`${row.pin}:${row.endpoint}`}
                className="grid grid-cols-[88px_1fr] gap-x-2 text-muted-foreground"
              >
                <span>{row.pin}</span>
                <span className="text-foreground">{row.endpointLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
