"use client";

import { connectionDebugId, listConnections } from "@/features/circuit";
import type { WiringApi } from "@/features/wiring";
import { cn } from "@/lib/utils";

export function ConnectionList({ w }: { w: WiringApi }) {
  const connections = listConnections(w.model);
  if (connections.length === 0) return null;

  return (
    <section className="border-b border-border-soft py-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        연결 목록
      </p>
      <div className="mt-2 space-y-1">
        {connections.map((connection) => {
          const selected = w.selectedWireId === connection.id;
          return (
            <button
              key={connection.id}
              type="button"
              onClick={() => w.selectWire(selected ? null : connection.id)}
              className={cn(
                "grid w-full grid-cols-[68px_1fr] gap-2 border px-2 py-1.5 text-left text-xs",
                selected
                  ? "border-foreground bg-surface-2 text-foreground"
                : "border-border-soft text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <span className="truncate font-mono font-bold">
                {connectionDebugId(connection.id)}
              </span>
              <span className="truncate">{connection.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
