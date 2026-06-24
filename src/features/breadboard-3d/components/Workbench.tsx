"use client";

import { useState } from "react";
import { type Verdict } from "@/features/circuit";
import { type WiringApi } from "@/features/wiring";
import { type WorkbenchApi } from "@/features/workbench";
import { type ViewportApi } from "../three/viewport";
import { Scene } from "./Scene";
import { CanvasLabel } from "./overlay/CanvasLabel";
import { EmptyState } from "./overlay/EmptyState";
import { GuideBar } from "./overlay/GuideBar";
import { StartGate } from "./overlay/StartGate";
import { ViewPresets } from "./overlay/ViewPresets";
import { ViewToolbar } from "./overlay/ViewToolbar";

interface Props {
  w: WiringApi;
  bench: WorkbenchApi;
  verdict: Verdict | null;
}

/**
 * 중앙 패널 셸 — 3D 캔버스(Scene) + 캔버스 오버레이(HUD) 조립.
 * 레이아웃: 라벨=좌상 · 툴바=우상 · 프리셋=우하 · 크레딧=좌하.
 * 카메라 제어는 Scene 이 올려주는 ViewportApi 로만 호출(의존 단방향).
 */
export function Workbench({ w, bench, verdict }: Props) {
  const [viewport, setViewport] = useState<ViewportApi | null>(null);
  const [started, setStarted] = useState(false);
  const [showLabels, setShowLabels] = useState(true); // 이름표 전역 표시
  const empty = w.parts.length === 0 && w.wires.length === 0;

  return (
    <main className="relative min-w-0 flex-1">
      {!started ? (
        <StartGate onStart={() => setStarted(true)} />
      ) : (
        <>
          <Scene
            breadboard={bench.currentBreadboard}
            board={bench.currentBoard}
            wires={w.wires}
            parts={w.parts}
            selectedPartDef={w.selectedPartDef}
            selectedPartUid={w.selectedPartUid}
            verdict={verdict}
            orientation={w.orientation}
            breadboardPose={w.breadboardPose}
            arduinoPose={w.arduinoPose}
            relocatingBoard={w.relocatingBoard}
            onAddWire={w.addWire}
            onPlacePart={w.placeAt}
            onPlaceFree={w.placeFreeAt}
            onSelectPart={w.selectPart}
            onCancel={w.cancel}
            onDelete={w.deleteSelected}
            onUndo={w.undo}
            onRedo={w.redo}
            onRotate={w.rotate}
            onRelocate={w.beginRelocate}
            onConnectLead={w.connectLead}
            calibratingUid={w.calibratingUid}
            calibratePin={w.calibratePin}
            onSetLeadAnchor={w.setLeadAnchorAt}
            onSelectBoard={w.selectBoard}
            onMoveBoardBy={w.moveBoardBy}
            showLabels={showLabels}
            onViewportReady={setViewport}
          />
          <CanvasLabel board={bench.currentBoard} />
          <EmptyState show={empty} />
          <GuideBar w={w} />
          <ViewToolbar
            onUndo={w.undo}
            onRedo={w.redo}
            onDelete={w.deleteSelected}
            onFit={() => viewport?.fit()}
            labelsOn={showLabels}
            onToggleLabels={() => setShowLabels((v) => !v)}
          />
          <ViewPresets onSelect={(p) => viewport?.setView(p)} />
        </>
      )}
    </main>
  );
}
