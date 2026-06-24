"use client";

import { useMemo } from "react";
import { Workbench } from "@/features/breadboard-3d";
import { diagnose } from "@/features/circuit";
import { PartsPalette } from "@/features/parts-palette";
import { DiagnosisPanel } from "@/features/diagnosis-panel";
import { useWiring } from "@/features/wiring";
import { useWorkbench } from "@/features/workbench";

export default function BuildPage() {
  const w = useWiring();
  const bench = useWorkbench({
    resetCircuit: w.clear,
    isEmpty: w.parts.length === 0 && w.wires.length === 0,
  });
  const liveVerdict = useMemo(() => diagnose(w.model), [w.model]);

  return (
    <div className="flex h-dvh w-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border-soft px-5 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black tracking-tight">핀메이트</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            / build
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          3D 빵판 회로 튜터
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 좌: 부품 팔레트 (Part Palette) */}
        <aside className="hidden w-[18%] min-w-[170px] shrink-0 border-r border-border-soft bg-surface-2 p-4 md:block">
          <PartsPalette w={w} bench={bench} />
        </aside>

        {/* 중앙: 3D 작업대 (3D Workbench) */}
        <Workbench w={w} bench={bench} verdict={liveVerdict} />

        {/* 우: 진단 패널 (Diagnosis Panel) */}
        <DiagnosisPanel w={w} liveVerdict={liveVerdict} />
      </div>
    </div>
  );
}
