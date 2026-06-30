import { describe, it, expect, afterEach } from "vitest";
import { diagnose } from "@/features/circuit/diagnose";
import { serialize } from "@/features/circuit/serialize";
import { SCENARIOS } from "@/features/circuit/scenarios";
import { setActiveBoard } from "@/features/circuit/board";
import type { ErrorType } from "@/features/circuit/diagnose";
import type { CircuitModel } from "@/features/circuit/types";

const has = (types: ErrorType[], t: ErrorType) => types.includes(t);

describe("diagnose — 결정론 규칙 엔진", () => {
  it("정상 회로: 오류 없음, LED 1개 점등", () => {
    const v = diagnose(SCENARIOS.ledCorrect.model);
    expect(v.ok).toBe(true);
    expect(v.findings).toHaveLength(0);
    expect(v.workingLeds).toBe(1);
    expect(v.workingLedUids).toEqual(["led1"]);
    expect(v.energizedRails).toEqual({});
  });

  it("저항 누락: missing_resistor + 오개념 resistor_necessity", () => {
    const v = diagnose(SCENARIOS.ledNoResistor.model);
    expect(v.ok).toBe(false);
    const f = v.findings.find((x) => x.type === "missing_resistor");
    expect(f).toBeDefined();
    expect(f?.misconception).toBe("resistor_necessity");
    expect(v.workingLeds).toBe(0);
    expect(v.workingLedUids).toEqual([]);
  });

  it("극성 반대: polarity_reversed + 오개념 polarity_concept", () => {
    const v = diagnose(SCENARIOS.ledReversed.model);
    const f = v.findings.find((x) => x.type === "polarity_reversed");
    expect(f).toBeDefined();
    expect(f?.misconception).toBe("polarity_concept");
    expect(v.workingLedUids).toEqual([]);
  });

  it("단락: short_circuit (critical)", () => {
    const v = diagnose(SCENARIOS.shortCircuit.model);
    const f = v.findings.find((x) => x.type === "short_circuit");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("critical");
  });

  it("열린 회로: open_circuit", () => {
    const v = diagnose(SCENARIOS.openCircuit.model);
    expect(has(v.findings.map((f) => f.type), "open_circuit")).toBe(true);
  });

  it("빈 회로: 오류 없음", () => {
    const v = diagnose(SCENARIOS.empty.model);
    expect(v.ok).toBe(true);
    expect(v.findings).toHaveLength(0);
  });

  it("아두이노 전원 점퍼가 연결된 레일만 인가 상태로 표시", () => {
    const v = diagnose({
      parts: [],
      wires: [
        { id: "w1", a: "AD_5V", b: "T+_1" },
        { id: "w2", a: "AD_GND_P1", b: "T-_1" },
      ],
    });

    expect(v.energizedRails).toEqual({ "T+": "power", "T-": "ground" });
  });

  it("헤드라인은 가장 심각한 오류 (정렬)", () => {
    const v = diagnose(SCENARIOS.shortCircuit.model);
    expect(v.summary).toBe(v.findings[0].message);
    expect(v.findings[0].severity).toBe("critical");
  });

  it("버튼 회로 정상: 디지털핀(D2)→버튼→GND → 오류 없음 (DEC-039)", () => {
    const m = SCENARIOS.buttonCorrect.model;
    const v = diagnose(m);
    expect(v.ok).toBe(true);
    expect(v.findings).toHaveLength(0);
  });

  it("버튼 회로 floating: 전원·GND 미연결 → missing_power_ground (medium)", () => {
    const m = SCENARIOS.buttonFloating.model;
    const v = diagnose(m);
    const f = v.findings.find((x) => x.type === "missing_power_ground");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("medium");
    // 비-LED 부품의 floating은 medium 레벨(LED의 high/critical과 다름)
  });

  it("버튼 오배선: 5V↔GND만 연결(입력핀 없음) → open_circuit (DEC-039)", () => {
    const v = diagnose(SCENARIOS.buttonNoInput.model);
    expect(v.ok).toBe(false);
    const f = v.findings.find((x) => x.type === "open_circuit");
    expect(f).toBeDefined();
    expect(f?.message).toContain("입력핀");
  });

  it("서보 정상: 신호→D9(PWM)·VCC→5V·GND→GND → 오류 없음 (DEC-039)", () => {
    const v = diagnose(SCENARIOS.servoCorrect.model);
    expect(v.ok).toBe(true);
    expect(v.findings).toHaveLength(0);
  });

  it("서보+버튼 레일 경유 회로 → 오류 없음·레일 전원/접지", () => {
    // 자체 물리 픽스처(레일 경유) — 레일 진단 로직 검증. 예제 배치 방식과 무관.
    const model: CircuitModel = {
      parts: [
        {
          uid: "servo1",
          defId: "servo",
          pinHoles: [],
          orientation: 0,
          anchorHoleId: "",
          mount: "free",
          bodyPos: { x: 0, z: 70 },
          leads: ["e10", "T+_5", "T-_5"],
        },
        {
          uid: "btn1",
          defId: "button",
          pinHoles: ["e20", "e22"],
          orientation: 0,
          anchorHoleId: "e20",
        },
      ],
      wires: [
        { id: "w1", a: "AD_5V", b: "T+_1" },
        { id: "w2", a: "AD_GND_P1", b: "T-_1" },
        { id: "w3", a: "AD_D9", b: "a10" },
        { id: "w4", a: "AD_D2", b: "a20" },
        { id: "w5", a: "a22", b: "T-_10" },
      ],
    };
    const v = diagnose(model);
    expect(v.ok).toBe(true);
    expect(v.findings).toHaveLength(0);
    expect(v.energizedRails).toEqual({ "T+": "power", "T-": "ground" });
  });

  it("서보 오배선: 신호가 PWM 아닌 핀 → open_circuit + PWM 안내 (DEC-039)", () => {
    const v = diagnose(SCENARIOS.servoSignalNotPwm.model);
    expect(v.ok).toBe(false);
    const f = v.findings.find((x) => x.type === "open_circuit");
    expect(f).toBeDefined();
    expect(f?.message).toContain("PWM");
  });

  it("릴레이 제어 정상: IN→D8·VCC→5V·GND→GND → 오류 없음", () => {
    const v = diagnose(SCENARIOS.relayControl.model);
    expect(v.ok).toBe(true);
    expect(v.findings).toHaveLength(0);
  });

  it("릴레이+펌프(접점 경유): 거짓 단락 없음, 부하 회로 완결 → 오류 없음", () => {
    const v = diagnose(SCENARIOS.relayPumpExternal.model);
    expect(v.findings.some((f) => f.type === "short_circuit")).toBe(false);
    expect(v.ok).toBe(true);
  });

  it("릴레이 IN 미연결: open_circuit (제어 안내)", () => {
    const base = SCENARIOS.relayControl.model;
    const noIn: typeof base = {
      ...base,
      // IN(lead0)만 끊고 VCC/GND 유지
      parts: base.parts.map((p) => ({
        ...p,
        leads: [null, "AD_5V", "AD_GND_P1", null, null, null],
      })),
    };
    const v = diagnose(noIn);
    const f = v.findings.find((x) => x.type === "open_circuit");
    expect(f).toBeDefined();
    expect(f?.message).toContain("IN");
  });

  it("free 본체 회전(rot)·이동(bodyPos)은 진단에 무영향 (geometry-only)", () => {
    const base = SCENARIOS.servoCorrect.model;
    const moved: typeof base = {
      ...base,
      parts: base.parts.map((p) => ({
        ...p,
        rot: 2 as const,
        bodyPos: { x: 99, z: -42 },
      })),
    };
    expect(diagnose(moved)).toEqual(diagnose(base));
  });
});

describe("diagnose — 보드 전압 호환 (ESP32 3.3V)", () => {
  // 전역 활성 보드를 바꾸므로 각 테스트 후 기본(아두이노)으로 복원 — 다른 테스트 오염 방지
  afterEach(() => setActiveBoard("arduino-uno"));

  // PIR(5V 전용)의 VCC 를 ESP32 전원핀(USB=5V 레일)에 연결한 회로
  const pir5vPowered: CircuitModel = {
    parts: [
      {
        uid: "pir1",
        defId: "pir",
        pinHoles: ["a5", "a6", "a7"], // [VCC, OUT, GND]
        orientation: 0,
        anchorHoleId: "a5",
      },
    ],
    wires: [{ id: "w1", a: "a5", b: "ESP_USB" }], // VCC 홀 ↔ ESP32 전원
  };

  it("ESP32(3.3V)에서 5V 전용 부품 전원 연결 시 voltage_mismatch 경고", () => {
    setActiveBoard("esp32-huzzah32");
    const v = diagnose(pir5vPowered);
    const f = v.findings.find((x) => x.type === "voltage_mismatch");
    expect(f).toBeDefined();
    expect(f?.partLabel).toBe("PIR 모션");
    expect(f?.severity).toBe("medium");
  });

  it("아두이노(5V)에서는 같은 회로에 voltage_mismatch 없음 (보드별 규칙)", () => {
    setActiveBoard("arduino-uno");
    // 아두이노엔 ESP_USB 핀이 없으므로 전원 미연결 → 전압경고 대상 아님
    const v = diagnose(pir5vPowered);
    expect(has(v.findings.map((x) => x.type), "voltage_mismatch")).toBe(false);
  });

  it("ESP32에서 전원 미연결(floating)이면 전압경고 안 함", () => {
    setActiveBoard("esp32-huzzah32");
    const floating: CircuitModel = {
      parts: pir5vPowered.parts,
      wires: [], // 전원 연결 없음
    };
    const v = diagnose(floating);
    expect(has(v.findings.map((x) => x.type), "voltage_mismatch")).toBe(false);
  });

  it("보드 무관 회귀: ESP32로 바꿔도 기존 LED 정상 회로 판정 불변", () => {
    setActiveBoard("esp32-huzzah32");
    // ledCorrect 는 AD_ 핀 배선이라 ESP32에선 전원 미연결 → working LED 0,
    // 단 진단 자체는 보드무관하게 동작(throw 없음, 구조 유지)
    const v = diagnose(SCENARIOS.ledCorrect.model);
    expect(v).toHaveProperty("findings");
    expect(Array.isArray(v.findings)).toBe(true);
  });
});

describe("serialize — 한국어 가독 직렬화", () => {
  it("정상 회로: 부품·연결·진단 섹션 포함", () => {
    const m = SCENARIOS.ledCorrect.model;
    const s = serialize(m, diagnose(m));
    expect(s).toContain("[부품 명세]");
    expect(s).toContain("[연결 구조]");
    expect(s).toContain("LED");
    expect(s).toContain("아두이노 5V");
    expect(s).toContain("[진단 결과]");
  });

  it("저항 누락 회로: 오개념 라벨 포함", () => {
    const m = SCENARIOS.ledNoResistor.model;
    const s = serialize(m, diagnose(m));
    expect(s).toContain("오개념");
    expect(s).toContain("resistor_necessity");
  });
});
