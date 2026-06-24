"use client";

import { useState } from "react";
import { buildSketch, type CircuitModel } from "@/features/circuit";

/**
 * 추천 코드 섹션 (Phase A) — 회로에서 결정론으로 만든 아두이노 스케치 + 복사.
 * buildSketch 는 순수함수(LLM 0). 진단 탭 하단에 붙어 "진단 → 올릴 코드"를 한 흐름으로.
 */
export function CodeRecommendation({ model }: { model: CircuitModel }) {
  const { code, notes } = buildSketch(model);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 미지원 환경 — 조용히 무시 */
    }
  };

  return (
    <section className="space-y-2 border-t border-border-soft pt-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground">
          추천 코드 · 아두이노
        </p>
        <button
          type="button"
          onClick={copy}
          className="border border-border-soft px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
      <pre className="max-h-56 overflow-auto bg-foreground/[0.04] p-2 font-mono text-[10px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      {notes.length > 0 && (
        <ul className="space-y-1">
          {notes.map((n, i) => (
            <li key={i} className="text-[10px] leading-relaxed text-muted-foreground">
              · {n}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
