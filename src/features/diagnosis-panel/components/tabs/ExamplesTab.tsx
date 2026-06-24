"use client";

import { SCENARIOS, type CircuitModel } from "@/features/circuit";

const EXAMPLES = [
  "ledCorrect",
  "ledNoResistor",
  "ledReversed",
  "shortCircuit",
  "servoButtonViaRails",
  "relayControl",
  "relayPumpExternal",
] as const;

/** 예제 탭 — 프리셋 회로 불러오기. */
export function ExamplesTab({ onLoad }: { onLoad: (model: CircuitModel) => void }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">예제 불러오기</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {EXAMPLES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onLoad(SCENARIOS[id].model)}
            className="border border-border-soft bg-card px-2 py-1.5 text-left text-[11px] hover:bg-surface-2"
          >
            {SCENARIOS[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
