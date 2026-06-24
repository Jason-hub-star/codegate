"use client";

import { useState } from "react";
import { type Verdict } from "@/features/circuit";
import { type WiringApi } from "@/features/wiring";
import { cn } from "@/lib/utils";
import { DiagnoseTab } from "./tabs/DiagnoseTab";
import { ExamplesTab } from "./tabs/ExamplesTab";
import { BomTab } from "./tabs/BomTab";

type TabKey = "diagnose" | "bom" | "console" | "examples";

const TABS: { key: TabKey; label: string; disabled?: boolean }[] = [
  { key: "diagnose", label: "진단" },
  { key: "bom", label: "명세" },
  { key: "console", label: "콘솔", disabled: true }, // M3.5: 시리얼 로그
  { key: "examples", label: "예제" },
];

/**
 * 우측 패널 셸 — [진단][콘솔][예제] 탭 컨테이너. verdict 상태 소유.
 * 콘솔은 M3.5(시리얼 로그)에서 활성화, 인스펙터·AI 설명은 M4에서 진단 탭에 추가.
 */
interface Props {
  w: WiringApi;
  liveVerdict: Verdict;
}

export function DiagnosisPanel({ w, liveVerdict }: Props) {
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tab, setTab] = useState<TabKey>("diagnose");

  return (
    <aside className="hidden w-[26%] min-w-[260px] shrink-0 flex-col border-l border-border-soft bg-card p-4 lg:flex">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        진단 패널
      </p>

      {/* 탭 */}
      <div className="mt-3 flex gap-1 border-b border-border-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={t.disabled}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-2.5 py-1.5 text-xs",
              t.disabled
                ? "cursor-not-allowed border-transparent text-muted-foreground/40"
                : tab === t.key
                  ? "border-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {tab === "diagnose" && (
          <DiagnoseTab
            verdict={verdict}
            onDiagnose={() => setVerdict(liveVerdict)}
          />
        )}
        {tab === "bom" && <BomTab w={w} />}
        {tab === "console" && (
          <p className="text-xs text-muted-foreground">
            콘솔 — M3.5에서 아두이노 시리얼 로그를 연결해요.
          </p>
        )}
        {tab === "examples" && (
          <ExamplesTab
            onLoad={(model) => {
              w.load(model);
              setVerdict(null);
            }}
          />
        )}
      </div>
    </aside>
  );
}
