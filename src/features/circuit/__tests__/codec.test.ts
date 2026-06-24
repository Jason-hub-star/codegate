import { describe, it, expect } from "vitest";
import { encodeCircuit, decodeCircuit } from "../codec";
import { SCENARIOS } from "../scenarios";
import { placeFreePart, withLead, setLeadAnchor } from "../parts";
import type { CircuitModel } from "../types";

describe("codec — 회로 인코딩·디코딩", () => {
  it("빈 회로 라운드트립 — 무손실", () => {
    const original = SCENARIOS.empty.model;
    const code = encodeCircuit(original, "half");
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(0);

    const decoded = decodeCircuit(code);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.model).toEqual(original);
      expect(decoded.board).toBe("half");
    }
  });

  it("정상 LED 회로 라운드트립 — 무손실", () => {
    const original = SCENARIOS.ledCorrect.model;
    const code = encodeCircuit(original, "half");

    const decoded = decodeCircuit(code);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.model).toEqual(original);
      expect(decoded.board).toBe("half");
    }
  });

  it("보드밖 서보 라운드트립 — mount/bodyPos/leads 무손실", () => {
    let servo = placeFreePart("servo", { x: 10.5, z: -25.4 });
    expect(servo).not.toBeNull();

    // leads 연결 + mount 설정
    servo = withLead(servo!, 0, "e10")!;
    servo = withLead(servo, 2, "T+_5")!;

    const original: CircuitModel = {
      parts: [servo],
      wires: [],
    };

    const code = encodeCircuit(original, "full");
    const decoded = decodeCircuit(code);

    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.model).toEqual(original);
      expect(decoded.board).toBe("full");
      // bodyPos 확인
      expect(decoded.model.parts[0].bodyPos).toEqual({ x: 10.5, z: -25.4 });
      // leads 확인
      expect(decoded.model.parts[0].leads).toEqual(["e10", null, "T+_5"]);
    }
  });

  it("free 본체 회전(rot) 라운드트립 — 무손실", () => {
    const servo = placeFreePart("servo", { x: 0, z: 30 }, 3);
    expect(servo?.rot).toBe(3);
    const original: CircuitModel = { parts: [servo!], wires: [] };
    const decoded = decodeCircuit(encodeCircuit(original, "half"));
    expect(decoded?.model.parts[0].rot).toBe(3);
    expect(decoded?.model).toEqual(original);
  });

  it("free 리드 보정(leadAnchors) 라운드트립 — 무손실", () => {
    let servo = placeFreePart("servo", { x: 0, z: 30 })!;
    servo = setLeadAnchor(servo, 0, [1.35, 2.46, -17.34]);
    servo = setLeadAnchor(servo, 2, [-1.32, 2.46, -17.36]);
    const original: CircuitModel = { parts: [servo], wires: [] };
    const decoded = decodeCircuit(encodeCircuit(original, "half"));
    expect(decoded?.model.parts[0].leadAnchors).toEqual([
      [1.35, 2.46, -17.34],
      null,
      [-1.32, 2.46, -17.36],
    ]);
    expect(decoded?.model).toEqual(original);
  });

  it("빈 문자열 → null", () => {
    expect(decodeCircuit("")).toBeNull();
  });

  it("깨진 base64 → null", () => {
    expect(decodeCircuit("!!!not-valid-base64!!!")).toBeNull();
  });

  it("base64지만 비JSON → null", () => {
    // "hello world" encode → 디코드 가능하지만 JSON이 아님
    const notJson = encodeCircuit(SCENARIOS.empty.model).slice(0, 20) + "xxx";
    expect(decodeCircuit(notJson)).toBeNull();
  });

  it("스키마 위반 (orientation=5) → null", () => {
    // 수동으로 잘못된 봉투 생성
    const malformedJson = JSON.stringify({
      v: 1,
      b: "half",
      m: {
        parts: [
          {
            uid: "p1",
            defId: "led",
            pinHoles: ["e5", "e7"],
            orientation: 5, // 0 또는 1만 허용
            anchorHoleId: "e5",
          },
        ],
        wires: [],
      },
    });
    // 수동 base64
    const code = btoa(malformedJson)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    expect(decodeCircuit(code)).toBeNull();
  });

  it("버전 불일치 (v=99) → null", () => {
    const malformedJson = JSON.stringify({
      v: 99, // 1이 아님
      b: "half",
      m: {
        parts: [],
        wires: [],
      },
    });
    const code = btoa(malformedJson)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    expect(decodeCircuit(code)).toBeNull();
  });

  it("인코딩된 문자열 형식: URL-safe base64", () => {
    const code = encodeCircuit(SCENARIOS.empty.model, "half");
    // URL-safe base64: + 또는 / 또는 = 포함하면 안 됨
    expect(code).not.toMatch(/[\+\/=]/);
    // 문자와 숫자, 대시, 언더스코어만 포함
    expect(code).toMatch(/^[a-zA-Z0-9_-]*$/);
  });

  it("full 보드 라운드트립", () => {
    const original = SCENARIOS.ledCorrect.model;
    const code = encodeCircuit(original, "full");

    const decoded = decodeCircuit(code);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.board).toBe("full");
      expect(decoded.model).toEqual(original);
    }
  });

  it("모든 시나리오 라운드트립", () => {
    Object.entries(SCENARIOS).forEach(([key, scenario]) => {
      const code = encodeCircuit(scenario.model, "half");
      const decoded = decodeCircuit(code);
      expect(decoded, `${key} failed`).not.toBeNull();
      if (decoded) {
        expect(decoded.model, `${key} model mismatch`).toEqual(scenario.model);
        expect(decoded.board, `${key} board mismatch`).toBe("half");
      }
    });
  });

  it("레이아웃(보드 pose) 라운드트립 — 무손실", () => {
    const original = SCENARIOS.ledCorrect.model;
    const layout = {
      breadboard: { x: 10, z: -5, rot: 1 as const },
      arduino: { x: -20, z: 8, rot: 3 as const },
    };
    const code = encodeCircuit(original, "half", layout);
    const decoded = decodeCircuit(code);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.model).toEqual(original);
      expect(decoded.layout).toEqual(layout);
    }
  });

  it("레이아웃 생략 → layout undefined (기존 링크 하위호환)", () => {
    const code = encodeCircuit(SCENARIOS.ledCorrect.model, "half");
    const decoded = decodeCircuit(code);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.layout).toBeUndefined();
    }
  });

  it("레이아웃 부분 지정(아두이노만)도 라운드트립", () => {
    const layout = { arduino: { x: 5, z: 5, rot: 2 as const } };
    const code = encodeCircuit(SCENARIOS.empty.model, "half", layout);
    const decoded = decodeCircuit(code);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.layout).toEqual(layout);
    }
  });

  it("에지 케이스: 많은 부품과 배선", () => {
    const model: CircuitModel = {
      parts: Array.from({ length: 10 }, (_, i) => ({
        uid: `p${i}`,
        defId: "resistor",
        pinHoles: [`a${i + 1}`, `a${i + 3}`],
        orientation: (i % 2) as 0 | 1,
        anchorHoleId: `a${i + 1}`,
      })),
      wires: Array.from({ length: 20 }, (_, i) => ({
        id: `w${i}`,
        a: `a${(i % 30) + 1}`,
        b: `b${(i % 30) + 1}`,
      })),
    };

    const code = encodeCircuit(model, "half");
    const decoded = decodeCircuit(code);

    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.model).toEqual(model);
      expect(decoded.board).toBe("half");
    }
  });

  it("ESP32 보드 라운드트립 — devBoard 무손실", () => {
    const original = SCENARIOS.ledCorrect.model;
    const code = encodeCircuit(original, "half", undefined, "esp32-huzzah32");

    const decoded = decodeCircuit(code);
    expect(decoded).not.toBeNull();
    if (decoded) {
      expect(decoded.model).toEqual(original);
      expect(decoded.board).toBe("half");
      expect(decoded.devBoard).toBe("esp32-huzzah32");
    }
  });

  it("하위호환: 보드 생략(기존 링크) = 아두이노 기본", () => {
    const original = SCENARIOS.ledCorrect.model;
    // devBoard 인자 없이 인코딩(기존 호출 형태) → 봉투에 bd 미포함
    const code = encodeCircuit(original, "half");
    const decoded = decodeCircuit(code);
    expect(decoded?.devBoard).toBe("arduino-uno");
  });
});
