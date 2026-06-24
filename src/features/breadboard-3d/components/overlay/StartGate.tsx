"use client";

/**
 * 진입 게이트 — 시작 전에는 3D 작업대(빵판·아두이노)를 마운트하지 않고
 * 가이드 + 「시작하기」만 보여준다. 클릭 시 작업대 등장(모델·WebGL 지연 생성).
 */
export function StartGate({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <div className="max-w-sm px-6 text-center">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          3D 작업대
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight">
          회로를 만들어 볼까요?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          빵판과 아두이노로 회로를 조립하면, 결정론 엔진이 정·오류를 짚어줘요.
          시작하면 3D 작업대가 나타납니다.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-6 bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
        >
          시작하기
        </button>
      </div>
    </div>
  );
}
