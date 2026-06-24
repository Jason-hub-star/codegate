import { describe, it, expect } from "vitest";
import { recommendNextStep } from "@/features/circuit/recommendation";
import { diagnose } from "@/features/circuit/diagnose";
import { SCENARIOS } from "@/features/circuit/scenarios";
import { computePinHoles } from "@/features/circuit/parts";
import type { CircuitModel, PlacedPart, Wire } from "@/features/circuit/types";

function part(uid: string, defId: string, anchor: string): PlacedPart {
  const pinHoles = computePinHoles(defId, anchor, 0);
  if (!pinHoles) throw new Error(`배치 불가: ${defId}@${anchor}`);
  return { uid, defId, pinHoles, orientation: 0, anchorHoleId: anchor };
}
const wire = (id: string, a: string, b: string): Wire => ({ id, a, b });

describe("recommendNextStep — 배선 다음-단계 추천 (DEC-027)", () => {
  it("빈 작업대: 첫 부품 유도", () => {
    const s = recommendNextStep(SCENARIOS.empty.model);
    expect(s?.priority).toBe("info");
    expect(s?.message).toContain("LED");
  });

  it("LED만 배치(저항 없음): 저항 배치 유도", () => {
    const model: CircuitModel = { parts: [part("led1", "led", "e5")], wires: [] };
    const s = recommendNextStep(model);
    expect(s?.message).toContain("저항");
    expect(s?.partUid).toBe("led1");
  });

  it("LED+저항 있는데 배선 0: 연결 시작 유도", () => {
    const model: CircuitModel = {
      parts: [part("led1", "led", "e5"), part("r1", "resistor", "a7")],
      wires: [],
    };
    const s = recommendNextStep(model);
    expect(s?.message).toContain("점퍼선");
  });

  it("전원만 연결(GND 미완결): GND 연결 유도", () => {
    const s = recommendNextStep(SCENARIOS.openCircuit.model);
    expect(s?.message).toContain("GND");
    expect(s?.partUid).toBeDefined();
  });

  it("완성 회로: 진단 유도(info)", () => {
    const s = recommendNextStep(SCENARIOS.ledCorrect.model);
    expect(s?.priority).toBe("info");
    expect(s?.message).toContain("진단");
  });

  it("verdict 오류가 있으면 수정이 최우선", () => {
    const m = SCENARIOS.shortCircuit.model;
    const s = recommendNextStep(m, diagnose(m));
    expect(s?.priority).toBe("critical");
    expect(s?.message).toBe(diagnose(m).findings[0].message);
  });

  it("버튼: 전원·GND 닿으면 풀업 권장", () => {
    const model: CircuitModel = {
      parts: [part("b1", "button", "e5")],
      wires: [wire("w1", "AD_5V", "a5"), wire("w2", "a7", "AD_GND_P1")],
    };
    const s = recommendNextStep(model);
    expect(s?.message).toContain("풀업");
    expect(s?.priority).toBe("medium");
  });
});
