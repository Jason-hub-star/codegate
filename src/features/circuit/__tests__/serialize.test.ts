import { describe, it, expect } from "vitest";
import { serialize, serializeNetlist, serializeBom } from "@/features/circuit/serialize";
import { buildNetlist, buildBom } from "@/features/circuit";
import { diagnose } from "@/features/circuit/diagnose";
import { SCENARIOS } from "@/features/circuit/scenarios";

describe("serialize 포맷 락 — 직렬화 출력 안정성", () => {
  it("ledCorrect: serialize 전체 출력 일관성", () => {
    const m = SCENARIOS.ledCorrect.model;
    const s = serialize(m, diagnose(m));
    expect(s).toMatchInlineSnapshot(`
      "[부품 명세]
      - LED ×1 (5V/3.3V, 디지털, 저항 필요)
      - 저항 220Ω ×1

      [연결 구조]
      - 전원: 아두이노 5V, LED#1 애노드(+)
      - GND: 아두이노 GND, 저항 220Ω#1 2
      - 열7 상단: 저항 220Ω#1 1, LED#1 캐소드(−)
      - 점퍼선:
        · 아두이노 5V ↔ a5
        · a11 ↔ 아두이노 GND

      [진단 결과]
      - 정상: 좋아요! LED 1개가 정상적으로 켜질 회로예요."
    `);
  });

  it("ledNoResistor: serialize 전체 출력 일관성", () => {
    const m = SCENARIOS.ledNoResistor.model;
    const s = serialize(m, diagnose(m));
    expect(s).toMatchInlineSnapshot(`
      "[부품 명세]
      - LED ×1 (5V/3.3V, 디지털, 저항 필요)

      [연결 구조]
      - 전원: 아두이노 5V, LED#1 애노드(+)
      - GND: 아두이노 GND, LED#1 캐소드(−)
      - 점퍼선:
        · 아두이노 5V ↔ a5
        · a7 ↔ 아두이노 GND

      [진단 결과]
      - (high) missing_resistor: LED에 직렬 저항이 없어 과전류(>40mA) 위험이에요. 220Ω을 넣어 보세요. (오개념: resistor_necessity)"
    `);
  });

  it("ledCorrect: serializeBom 포맷 락", () => {
    const m = SCENARIOS.ledCorrect.model;
    const text = serializeBom(buildBom(m));
    expect(text).toMatchInlineSnapshot(`
      "- LED ×1 (5V/3.3V, 디지털, 저항 필요)
      - 저항 220Ω ×1"
    `);
  });

  it("ledNoResistor: serializeBom 포맷 락", () => {
    const m = SCENARIOS.ledNoResistor.model;
    const text = serializeBom(buildBom(m));
    expect(text).toMatchInlineSnapshot(`"- LED ×1 (5V/3.3V, 디지털, 저항 필요)"`);
  });

  it("ledCorrect: serializeNetlist 포맷 락", () => {
    const m = SCENARIOS.ledCorrect.model;
    const text = serializeNetlist(buildNetlist(m));
    expect(text).toMatchInlineSnapshot(`
      "- 전원: 아두이노 5V, LED#1 애노드(+)
      - GND: 아두이노 GND, 저항 220Ω#1 2
      - 열7 상단: 저항 220Ω#1 1, LED#1 캐소드(−)"
    `);
  });

  it("ledNoResistor: serializeNetlist 포맷 락", () => {
    const m = SCENARIOS.ledNoResistor.model;
    const text = serializeNetlist(buildNetlist(m));
    expect(text).toMatchInlineSnapshot(`
      "- 전원: 아두이노 5V, LED#1 애노드(+)
      - GND: 아두이노 GND, LED#1 캐소드(−)"
    `);
  });
});
