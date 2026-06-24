"use client";

import { type Verdict } from "@/features/circuit";
import { cn } from "@/lib/utils";

/** 진단 종합 배지 — 정상(초록)/오류(테두리) 요약. */
export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return (
    <div
      className={cn(
        "border px-3 py-2 text-sm",
        verdict.ok ? "border-[color:var(--ok)] text-ok" : "border-border-soft",
      )}
    >
      {verdict.summary}
    </div>
  );
}
