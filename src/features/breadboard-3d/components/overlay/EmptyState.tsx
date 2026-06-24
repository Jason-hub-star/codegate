"use client";

/** 시작 후 빈 작업대 안내 — 부품·선이 0일 때 표시. 3D 위에서도 읽히게 카드 배경. */
export function EmptyState({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-14">
      <div className="rounded-sm border border-border-soft bg-card/85 px-5 py-3 text-center backdrop-blur-sm">
        <p className="text-sm font-semibold text-foreground/80">빈 빵판이에요</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          좌측에서 부품을 골라 빵판 홀을 클릭해 배치하세요.
          <br />
          핀 2개를 클릭하면 점퍼선이 연결돼요.
        </p>
      </div>
    </div>
  );
}
