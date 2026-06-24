"use client";

import type { DraftSpec } from "../hooks/useCalibrator";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

/** 현재 값을 GLB_PART_SPECS 한 줄 형식으로 직렬화(기본값 0/undefined 는 생략). */
export function formatSpec(assetId: string, spec: DraftSpec): string {
  const fields = [`scaleLen: ${spec.scaleLen}`];
  if (spec.yLift) fields.push(`yLift: ${spec.yLift}`);
  if (spec.rotationY) fields.push(`rotationY: ${spec.rotationY}`);
  return `  "${assetId}": { ${fields.join(", ")} },`;
}

interface Props {
  assetId: string | null;
  spec: DraftSpec;
}

/** GLB_PART_SPECS 스니펫 + 복사 — glbParts.ts 에 붙여넣기. */
export function ExportSnippet({ assetId, spec }: Props) {
  const { copied, copy } = useCopyToClipboard();
  if (!assetId) return null;
  const snippet = formatSpec(assetId, spec);

  return (
    <div className="space-y-1">
      <pre className="overflow-x-auto border border-border-soft bg-card p-2 font-mono text-[10px] leading-relaxed">
        {snippet}
      </pre>
      <button
        type="button"
        onClick={() => copy(snippet)}
        className="border border-border-soft bg-card px-2 py-1 font-mono text-[11px] hover:bg-surface-2"
      >
        {copied ? "복사됨 ✓" : "복사"}
      </button>
    </div>
  );
}
