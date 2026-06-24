import { describe, it, expect } from "vitest";
import { buildSketch } from "../codegen";
import { SCENARIOS } from "../scenarios";
import { placePart, placeFreePart, withLead } from "../parts";
import type { CircuitModel, PlacedPart, Wire } from "../types";

const must = (p: PlacedPart | null): PlacedPart => {
  if (!p) throw new Error("place 실패(픽스처)");
  return p;
};
const wire = (id: string, a: string, b: string): Wire => ({ id, a, b });
const model = (parts: PlacedPart[], wires: Wire[] = []): CircuitModel => ({ parts, wires });

describe("buildSketch — 결정론 코드 추천 (Phase A)", () => {
  it("빈 회로 → 스텁 스케치(컴파일 가능), 노트 없음", () => {
    const { code, notes } = buildSketch(model([]));
    expect(code).toContain("void setup()");
    expect(code).toContain("void loop()");
    expect(code).toContain("연결된 부품이 없어요");
    expect(notes).toEqual([]);
  });

  it("LED+저항 → D핀이 저항 너머 LED를 구동(수동소자 1홉 추적)", () => {
    // LED 애노드 e5 / 캐소드 e7. 저항 a5(=e5와 같은 열5상단)·a9. D9→a9, 캐소드→GND.
    const led = must(placePart("led", "e5", 0));
    const res = must(placePart("resistor", "a5", 0)); // a5, a9 (span4)
    const m = model(
      [led, res],
      [wire("w1", "AD_D9", "a9"), wire("w2", "e7", "AD_GND_P1")],
    );
    const { code } = buildSketch(m);
    expect(code).toContain("const int ledPin = 9;");
    expect(code).toContain("pinMode(ledPin, OUTPUT);");
    expect(code).toContain("digitalWrite(ledPin, HIGH);");
    // 저항은 변수로 등장하지 않는다(수동소자)
    expect(code).not.toContain("rPin");
  });

  it("버튼 → 디지털 입력(INPUT_PULLUP) + Serial 읽기", () => {
    const btn = must(placePart("button", "e5", 0)); // A=e5, B=e7
    const m = model([btn], [wire("w1", "AD_D2", "e5"), wire("w2", "e7", "AD_GND_P1")]);
    const { code } = buildSketch(m);
    expect(code).toContain("const int buttonPin = 2;");
    expect(code).toContain("pinMode(buttonPin, INPUT_PULLUP);");
    expect(code).toContain("digitalRead(buttonPin)");
    expect(code).toContain("Serial.begin(9600);");
  });

  it("가변저항 와이퍼 → 아날로그 입력(analogRead, A0)", () => {
    const pot = must(placePart("pot", "e5", 0)); // VCC=e5, 와이퍼=e6, GND=e7
    const m = model(
      [pot],
      [
        wire("w1", "AD_5V", "e5"),
        wire("w2", "AD_A0", "e6"),
        wire("w3", "e7", "AD_GND_P1"),
      ],
    );
    const { code } = buildSketch(m);
    expect(code).toContain("const int potPin = A0;");
    expect(code).toContain("analogRead(potPin)");
  });

  it("서보(free, PWM) → Servo 라이브러리 + attach/write", () => {
    let servo = must(placeFreePart("servo", { x: 0, z: -40 }));
    servo = withLead(servo, 0, "e10"); // 신호 리드 → e10
    const m = model([servo], [wire("w1", "e10", "AD_D9")]);
    const { code } = buildSketch(m);
    expect(code).toContain("#include <Servo.h>");
    expect(code).toContain("Servo servo;");
    expect(code).toContain("servo.attach(servoPin);");
    expect(code).toContain("servo.write(");
  });

  it("아두이노에 안 닿은 능동부품 → notes 로 안내", () => {
    // LED를 GND에만 연결(제어핀 없음) → 바인딩 0, LED 미구동 안내
    const led = must(placePart("led", "e5", 0));
    const m = model([led], [wire("w1", "e7", "AD_GND_P1")]);
    const { code, notes } = buildSketch(m);
    expect(code).toContain("연결된 부품이 없어요");
    expect(notes.some((n) => n.includes("LED"))).toBe(true);
  });

  it("릴레이(free) IN→D8 → 디지털 출력 토글 (쇼케이스: 펌프 제어)", () => {
    let relay = must(placeFreePart("relay", { x: 0, z: -40 })); // IN/VCC/GND 리드
    relay = withLead(relay, 0, "AD_D8"); // IN(lead0) → D8
    const { code } = buildSketch(model([relay]));
    expect(code).toContain("const int relayPin = 8;");
    expect(code).toContain("pinMode(relayPin, OUTPUT);");
    expect(code).toContain("digitalWrite(relayPin, HIGH);");
  });

  it("워터펌프(free, 미연결) → 코드 제외 + notes 안내", () => {
    const pump = must(placeFreePart("pump", { x: 0, z: -40 })); // leads 미연결
    const { notes } = buildSketch(model([pump]));
    expect(notes.some((n) => n.includes("워터펌프"))).toBe(true);
  });

  it("예제 시나리오 relayControl → 릴레이 D8 디지털 출력 토글", () => {
    const { code } = buildSketch(SCENARIOS.relayControl.model);
    expect(code).toContain("const int relayPin = 8;");
    expect(code).toContain("pinMode(relayPin, OUTPUT);");
    expect(code).toContain("digitalWrite(relayPin, HIGH);");
  });

  it("예제 시나리오 relayPumpExternal → 릴레이는 코드화, 펌프는 notes 안내", () => {
    const { code, notes } = buildSketch(SCENARIOS.relayPumpExternal.model);
    expect(code).toContain("const int relayPin = 8;");
    // 펌프는 아두이노 제어핀에 직결 안 됨 → notes 로 안내(코드 변수 없음)
    expect(notes.some((n) => n.includes("워터펌프"))).toBe(true);
  });

  it("결정론: 같은 입력 → 같은 출력", () => {
    const m = model(
      [must(placePart("button", "e5", 0))],
      [wire("w1", "AD_D2", "e5"), wire("w2", "e7", "AD_GND_P1")],
    );
    expect(buildSketch(m).code).toBe(buildSketch(m).code);
  });
});
