import { describe, expect, it } from "vitest";
import {
  connectionDebugId,
  describePartConnection,
  describeConnection,
  describeWireConnection,
  listConnections,
  wireDebugLabel,
} from "../connectionInfo";
import { SCENARIOS } from "../scenarios";

describe("connectionInfo — 선택 디버그 라벨", () => {
  const model = SCENARIOS.servoButtonViaRails.model;

  it("서보+버튼 예제 선 의미를 5V/VCC/GND/SIG/PWM 기준으로 요약", () => {
    const labels = Object.fromEntries(
      model.wires.map((wire) => [wire.id, wireDebugLabel(model, wire)]),
    );

    expect(labels.w1).toBe("5V → + rail");
    expect(labels.w2).toBe("GND → - rail");
    expect(labels.w3).toBe("D9 PWM → 서보 SIG/PWM");
    expect(labels.w4).toBe("D2 INPUT → 버튼 SIG");
    expect(labels.w5).toBe("버튼 SIG → - rail");
  });

  it("선택한 선의 양 끝 정보를 우측 패널용으로 반환", () => {
    const wire = describeWireConnection(model, "w3");
    expect(wire?.label).toBe("D9 PWM → 서보 SIG/PWM");
    expect(wire?.from.label).toBe("D9 PWM");
    expect(wire?.to.label).toBe("서보 모터 신호 (SIG/PWM)");
  });

  it("free 부품 리드도 연결 목록/선택 정보로 반환", () => {
    const connections = listConnections(model);
    expect(connections.map((c) => c.id)).toEqual([
      "w1",
      "w2",
      "w3",
      "w4",
      "w5",
      "lead:servo1:0",
      "lead:servo1:1",
      "lead:servo1:2",
    ]);
    expect(connectionDebugId("lead:servo1:0")).toBe("servo1-L1");
    const signalLead = describeConnection(model, "lead:servo1:0");
    expect(signalLead?.label).toBe("서보 SIG/PWM → e10");
    expect(signalLead?.to.label).toBe("빵판 e10");
    expect(describeConnection(model, "lead:servo1:1")?.label).toBe(
      "서보 VCC → + rail",
    );
    expect(describeConnection(model, "lead:servo1:2")?.label).toBe(
      "서보 GND → - rail",
    );
  });

  it("선택한 부품의 핀 연결표를 반환", () => {
    const part = describePartConnection(model, "servo1");
    expect(part?.title).toBe("서보 모터");
    expect(part?.rows.map((row) => [row.pin, row.endpointLabel])).toEqual([
      ["신호 (SIG/PWM)", "서보 모터 신호 (SIG/PWM)"],
      ["VCC (VCC)", "+ rail (T5)"],
      ["GND (GND)", "- rail (T5)"],
    ]);
  });
});
