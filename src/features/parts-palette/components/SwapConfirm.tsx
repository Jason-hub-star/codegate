"use client";

/** 작업대 스왑 확인 모달 — StartGate 스타일 모노크롬(글로우 금지, KITvibe). */
interface Props {
  targetLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SwapConfirm({ targetLabel, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 p-6">
      <div className="w-full max-w-sm border border-border-soft bg-card p-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          작업대 전환
        </p>
        <h2 className="mt-3 text-lg font-black tracking-tight">
          {targetLabel}(으)로 바꿀까요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          현재 회로(부품·배선)가 초기화됩니다.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-border-soft px-4 py-1.5 text-sm hover:bg-surface-2"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-foreground px-4 py-1.5 text-sm font-semibold text-background hover:opacity-90"
          >
            계속
          </button>
        </div>
      </div>
    </div>
  );
}
