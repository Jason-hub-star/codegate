"use client";

import { type Verdict } from "@/features/circuit";
import { VerdictBadge } from "../VerdictBadge";
import { FindingItem } from "../FindingItem";

interface Props {
  verdict: Verdict | null;
  onDiagnose: () => void;
}

/**
 * 진단 탭 — 진단받기 + 결과(배지 + 문제목록).
 * M4: 선택 부품 인스펙터(PartInspector) · AI 설명(TutorThread) 섹션을 여기 붙인다.
 */
export function DiagnoseTab({ verdict, onDiagnose }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onDiagnose}
        className="w-full bg-foreground py-2 text-sm font-semibold text-background hover:opacity-90"
      >
        진단받기
      </button>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {!verdict ? (
          <p className="text-xs text-muted-foreground">
            회로를 만들고 “진단받기”를 누르면 결정론 엔진이 정·오류를 판정해요.
            (M4에서 AI가 한국어로 설명)
          </p>
        ) : (
          <div className="space-y-3">
            <VerdictBadge verdict={verdict} />
            {verdict.findings.length > 0 && (
              <ul className="space-y-2">
                {verdict.findings.map((f, i) => (
                  <FindingItem key={i} finding={f} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
