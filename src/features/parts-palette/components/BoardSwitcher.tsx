"use client";

import { BOARDS } from "@/features/circuit";
import { type WorkbenchApi } from "@/features/workbench";
import { cn } from "@/lib/utils";
import { SwapConfirm } from "./SwapConfirm";

interface Props {
  bench: WorkbenchApi;
  thumbs: Record<string, string>;
}

/**
 * 개발보드 스왑 카드 그룹 — BOARDS 레지스트리를 iterate(보드 추가=레지스트리 항목).
 * 현재 작업대 보드는 "현재" 표시·비활성, 나머지는 클릭 시 스왑 요청(회로 있으면 확인창).
 * 빵판 스왑(BreadboardSwitcher)과 동일 패턴.
 */
export function BoardSwitcher({ bench, thumbs }: Props) {
  const pending = bench.pendingBoardSwap ? BOARDS[bench.pendingBoardSwap] : null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground">보드</p>
      {Object.values(BOARDS).map((d) => {
        const current = d.id === bench.currentBoard;
        const thumb = thumbs[`board-${d.id}`];
        return (
          <button
            key={d.id}
            type="button"
            onClick={current ? undefined : () => bench.requestBoardSwap(d.id)}
            aria-pressed={current}
            title={current ? "현재 작업대 보드" : `${d.label}으로 전환`}
            className={cn(
              "flex w-full items-center gap-2.5 border px-2 py-2 text-left transition-colors",
              current
                ? "cursor-default border-foreground/35 bg-surface-2"
                : "border-border-soft bg-card hover:bg-surface-2",
            )}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-soft bg-surface-2">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumb}
                  alt={`${d.label} 3D 미리보기`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="font-mono text-[9px] text-muted-foreground">
                  3D
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{d.label}</span>
                <span
                  className={cn(
                    "shrink-0 border px-1 py-px font-mono text-[8px] uppercase tracking-wide",
                    current
                      ? "border-foreground/40 text-foreground"
                      : "border-border-soft text-muted-foreground",
                  )}
                >
                  {current ? "현재" : "전환"}
                </span>
              </span>
              <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                로직 {d.logicV}V
              </span>
            </span>
          </button>
        );
      })}
      {pending && (
        <SwapConfirm
          targetLabel={pending.label}
          onConfirm={bench.confirmBoardSwap}
          onCancel={bench.cancelBoardSwap}
        />
      )}
    </div>
  );
}
