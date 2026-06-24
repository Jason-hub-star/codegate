"use client";

import { useState, useMemo, useEffect } from "react";
import { Scene } from "@/features/breadboard-3d";
import { decodeCircuit, diagnose } from "@/features/circuit";
import { ViewportApi } from "@/features/breadboard-3d/three/viewport";

interface CircuitViewProps {
  code: string | null;
  title?: string | null;
}

/**
 * 모바일 전용 읽기 뷰 — 회로를 3D로 표시 + 캡션 (편집 불가).
 * 모든 인터랙션 콜백은 no-op.
 * Scene 로드 직후 viewport.fit() 으로 자동 맞춤.
 */
export function CircuitView({ code, title }: CircuitViewProps) {
  const [viewport, setViewport] = useState<ViewportApi | null>(null);

  // 코드 디코딩 결과를 useMemo로 계산 (set-state-in-effect 회피)
  const decodedState = useMemo(() => {
    if (!code) {
      return { state: null, error: true };
    }
    const decoded = decodeCircuit(code);
    if (!decoded) {
      return { state: null, error: true };
    }
    return { state: decoded, error: false };
  }, [code]);

  const state = decodedState.state;
  const error = decodedState.error;

  // 빵판 활성화는 Scene이 breadboard prop으로 처리(Scene.tsx) — 여기선 중복 호출 안 함.
  // viewport 로드 후 fit 호출
  useEffect(() => {
    if (viewport) {
      viewport.fit();
    }
  }, [viewport]);

  if (!state) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-surface-1">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="font-medium text-muted-foreground">
            {error ? "회로를 불러올 수 없어요" : "회로를 불러오는 중…"}
          </div>
          {error && (
            <p className="text-sm text-muted-foreground">
              유효하지 않은 회로 코드입니다. 핀메이트에서 공유받은 URL인지
              확인해주세요.
            </p>
          )}
        </div>
      </div>
    );
  }

  const { model, board, devBoard, layout } = state;
  const verdict = diagnose(model);

  return (
    <div className="relative h-dvh w-full">
      {/* 3D 캔버스 — 공유링크의 보드 레이아웃(pose) 반영 */}
      <Scene
        breadboard={board}
        board={devBoard}
        wires={model.wires}
        parts={model.parts}
        selectedPartDef={null}
        selectedPartUid={null}
        verdict={verdict}
        orientation={0}
        breadboardPose={layout?.breadboard}
        arduinoPose={layout?.arduino}
        onAddWire={() => {}}
        onPlacePart={() => {}}
        onSelectPart={() => {}}
        onCancel={() => {}}
        onDelete={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        onRotate={() => {}}
        onRelocate={() => {}}
        onConnectLead={() => {}}
        onViewportReady={(api) => {
          setViewport(api);
        }}
      />

      {/* 하단 캡션 바 */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-border-soft bg-surface-2/95 px-4 py-3 backdrop-blur-sm">
        <span className="font-medium text-foreground">
          {title || "회로"}
        </span>
        <a
          href="/build"
          className="text-sm text-foreground hover:underline"
        >
          핀메이트에서 편집
        </a>
      </div>
    </div>
  );
}
