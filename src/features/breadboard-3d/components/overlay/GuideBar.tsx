"use client";

import { useMemo } from "react";
import { PARTS, recommendNextStep, type StepPriority } from "@/features/circuit";
import { type WiringApi } from "@/features/wiring";
import { cn } from "@/lib/utils";

const PRIORITY_CLASS: Record<StepPriority, string> = {
  critical: "text-error",
  high: "text-amber",
  medium: "text-foreground",
  info: "text-muted-foreground",
};

/**
 * 작업대 가이드 바(하단중앙) — ① 현재 모드(배치/선택/배선) ② 다음-단계 추천(DEC-027).
 * 둘 다 "지금 뭘 하면 되는지"를 LLM 없이 알려주는 안내(결정론). 모노크롬·글로우 금지.
 * 코드엔 있으나 UI에 없던 두 기능(모드 가시화·recommendNextStep 사장)을 한 곳에 노출.
 */
export function GuideBar({ w }: { w: WiringApi }) {
  const labelOf = (defId: string) => PARTS[defId]?.label ?? defId;

  const boardLabel = (b: "breadboard" | "arduino") =>
    b === "breadboard" ? "빵판" : "아두이노";

  // 배치/이동/선택 중인 부품이 free(보드 밖)인지 — 안내·회전단위 분기
  const placingDef = w.selectedPartDef ?? "";
  const selectedDefId =
    w.parts.find((x) => x.uid === w.selectedPartUid)?.defId ?? "";
  const freeActive =
    PARTS[placingDef]?.mount === "free" ||
    PARTS[selectedDefId]?.mount === "free";

  // 리드 보정 중인 free 부품(있으면)
  const calibPart = w.calibratingUid
    ? w.parts.find((x) => x.uid === w.calibratingUid)
    : null;

  // 현재 모드 — 리드보정 > 보드이동 > 보드선택 > 부품이동 > 배치 > 부품선택 > 배선
  const mode = calibPart
    ? (() => {
        const def = PARTS[calibPart.defId];
        const n = def?.pins.length ?? 0;
        const pinLabel = def?.pins[w.calibratePin]?.label ?? `핀${w.calibratePin + 1}`;
        return {
          tag: "리드 보정",
          detail: `${labelOf(calibPart.defId)} · "${pinLabel}" 위치를 본체에서 클릭 (${w.calibratePin + 1}/${n}) · Esc=종료`,
        };
      })()
    : w.relocatingBoard
    ? {
        tag: "보드 이동 모드",
        detail: `${boardLabel(w.relocatingBoard)} · 새 위치 클릭 (Esc=취소)`,
      }
    : w.selectedBoard
      ? {
          tag: "보드 선택",
          detail: `${boardLabel(w.selectedBoard)} · M=이동 · R=90° 회전`,
        }
      : w.relocating
    ? {
        tag: "이동 모드",
        detail: `${labelOf(w.selectedPartDef ?? "")} · ${
          freeActive ? "새 위치 클릭" : "새 홀 클릭"
        } (Esc=취소)`,
      }
    : w.selectedPartDef
      ? {
          tag: "배치 모드",
          detail: `${labelOf(w.selectedPartDef)} · ${
            freeActive ? "빈 곳 클릭=소환" : "빵판 홀 클릭"
          } (Esc=취소)`,
        }
      : w.selectedPartUid
        ? (() => {
            const defId =
              w.parts.find((x) => x.uid === w.selectedPartUid)?.defId ?? "";
            const isFree = PARTS[defId]?.mount === "free";
            return {
              tag: "부품 선택",
              detail: isFree
                ? `${labelOf(defId)} · 핀→홀=리드연결 · M=이동 · R=90° · Del=삭제`
                : `${labelOf(defId)} · Del=삭제`,
            };
          })()
        : { tag: "배선 모드", detail: "홀 2개 클릭 = 점퍼선" };

  // 회전은 배치·이동·선택(부품/보드) 때 의미가 있다.
  const showRotate = Boolean(
    w.selectedPartDef || w.selectedPartUid || w.relocating || w.selectedBoard,
  );
  // 이동 버튼 — 부품/보드 선택 상태에서(이동/배치 중엔 제외).
  const showMove =
    (Boolean(w.selectedPartUid) && !w.relocating) ||
    (Boolean(w.selectedBoard) && !w.relocatingBoard);
  // 리드 보정 버튼 — free 부품 선택 시(보정 중엔 제외).
  const showCalibrate =
    Boolean(w.selectedPartUid) && freeActive && !w.calibratingUid;

  // 다음-단계 추천 (회로 바뀔 때만 재계산)
  const next = useMemo(
    () => recommendNextStep({ parts: w.parts, wires: w.wires }),
    [w.parts, w.wires],
  );

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1">
      <div className="flex items-center gap-2 border border-border-soft bg-card/90 px-3 py-1 backdrop-blur-sm">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
          {mode.tag}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {mode.detail}
        </span>
        {showMove && (
          <button
            type="button"
            onClick={w.beginRelocate}
            title="이동 — 누른 뒤 새 홀 클릭"
            className="pointer-events-auto border border-border-soft bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-foreground"
          >
            ✛ 이동
          </button>
        )}
        {showCalibrate && (
          <button
            type="button"
            onClick={w.beginCalibrateLead}
            title="리드 보정 — 본체에서 3선 시작점을 클릭"
            className="pointer-events-auto border border-border-soft bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-foreground"
          >
            ⌖ 리드보정
          </button>
        )}
        {showRotate && (
          <button
            type="button"
            onClick={w.rotate}
            title="회전 (단축키 R)"
            className="pointer-events-auto border border-border-soft bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-foreground"
          >
            ↻{" "}
            {w.selectedBoard || freeActive
              ? "90°"
              : w.orientation === 0
                ? "가로"
                : "세로"}
          </button>
        )}
      </div>
      {next && (
        <div className="max-w-[min(80vw,520px)] border border-border-soft bg-card/90 px-3 py-1 text-center backdrop-blur-sm">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            다음 단계{" "}
          </span>
          <span
            className={cn(
              "text-[11px] leading-snug",
              PRIORITY_CLASS[next.priority],
            )}
          >
            {next.message}
          </span>
        </div>
      )}
    </div>
  );
}
