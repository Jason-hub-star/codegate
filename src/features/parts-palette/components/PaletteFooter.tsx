"use client";

interface Props {
  orientation: 0 | 1;
  partCount: number;
  wireCount: number;
  onRotate: () => void;
  onClear: () => void;
}

/** 팔레트 하단 — 방향 토글 · 작업 카운트 · 단축키 안내. */
export function PaletteFooter({
  orientation,
  partCount,
  wireCount,
  onRotate,
  onClear,
}: Props) {
  return (
    <div className="mt-auto space-y-2 border-t border-border-soft pt-3">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>방향</span>
        <button
          type="button"
          onClick={onRotate}
          className="border border-border-soft bg-card px-2 py-1 font-mono text-[11px] hover:bg-surface-2"
        >
          {orientation === 0 ? "가로 ─" : "세로 │"} · R
        </button>
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
        <span>
          부품 {partCount} · 선 {wireCount}
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-error hover:underline"
        >
          전체 지우기
        </button>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
        핀 2개 클릭 = 점퍼선 · 부품 클릭 = 선택 · M = 이동 · R = 회전 · Del =
        삭제 · 우클릭/Esc = 취소 · ⌘Z = 되돌리기
      </p>
    </div>
  );
}
