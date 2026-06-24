"use client";

import { type BoardId } from "@/features/circuit";

/**
 * 3D 작업대 코너 라벨(좌상단) + CC-BY 출처표기(좌하단).
 * 출처표기는 GLB 자산(아두이노)일 때만 의무 — ESP32 는 절차 모델(자체 제작)이라 표기 없음.
 */
export function CanvasLabel({ board }: { board?: BoardId }) {
  // 아두이노 GLB 가 화면에 있을 때만 CC-BY 표기(생략 시 기본 = 아두이노).
  const showGlbCredit = board === undefined || board === "arduino-uno";
  return (
    <>
      <p className="pointer-events-none absolute left-3 top-3 z-10 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        3D 작업대
      </p>
      {showGlbCredit && (
        <p className="pointer-events-none absolute bottom-2 left-3 font-mono text-[9px] text-muted-foreground/70">
          3D: “Arduino Uno Board” by crimsonfalcon (Sketchfab), CC-BY-4.0
        </p>
      )}
    </>
  );
}
