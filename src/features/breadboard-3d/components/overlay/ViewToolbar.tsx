"use client";

interface Props {
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onFit: () => void;
  labelsOn: boolean;
  onToggleLabels: () => void;
}

const BTN =
  "border border-border-soft bg-card/90 px-2 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-sm hover:bg-surface-2 hover:text-foreground";

/** 작업대 풀 툴바(우상단) — 되돌리기·다시하기·삭제·전체보기·이름표 토글. */
export function ViewToolbar({
  onUndo,
  onRedo,
  onDelete,
  onFit,
  labelsOn,
  onToggleLabels,
}: Props) {
  return (
    <div className="absolute right-3 top-3 z-10 flex gap-1">
      <button
        type="button"
        onClick={onToggleLabels}
        className={
          BTN + (labelsOn ? " !text-foreground !border-foreground" : "")
        }
        title="이름표 표시/숨김 (전역)"
      >
        이름표 {labelsOn ? "ON" : "OFF"}
      </button>
      <button type="button" onClick={onUndo} className={BTN} title="되돌리기 (⌘Z)">
        ↶
      </button>
      <button
        type="button"
        onClick={onRedo}
        className={BTN}
        title="다시하기 (⌘⇧Z)"
      >
        ↷
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={BTN}
        title="삭제 (Del)"
      >
        삭제
      </button>
      <button type="button" onClick={onFit} className={BTN} title="전체보기">
        전체보기
      </button>
    </div>
  );
}
