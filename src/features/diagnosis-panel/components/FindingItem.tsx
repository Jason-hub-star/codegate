"use client";

import { type Verdict } from "@/features/circuit";
import { cn } from "@/lib/utils";

type Finding = Verdict["findings"][number];

const SEV_CLASS: Record<string, string> = {
  critical: "text-error",
  high: "text-error",
  medium: "text-amber",
  low: "text-muted-foreground",
};

/** 문제 1개 — 심각도·타입·메시지·오개념. (M4: 클릭 시 캔버스 하이라이트 핫링크 추가 예정) */
export function FindingItem({ finding }: { finding: Finding }) {
  return (
    <li className="border border-border-soft px-3 py-2 text-xs">
      <span
        className={cn(
          "font-mono text-[10px] font-bold uppercase",
          SEV_CLASS[finding.severity],
        )}
      >
        {finding.type}
      </span>
      <p className="mt-1 leading-snug">{finding.message}</p>
      {finding.misconception && (
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          오개념: {finding.misconception}
        </p>
      )}
    </li>
  );
}
