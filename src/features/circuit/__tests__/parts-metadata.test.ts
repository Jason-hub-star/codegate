/**
 * 부품 메타 검증 — M4 마일스톤
 *
 * 모든 PARTS 항목이 필수 메타(description·category·status)를 가지고 있는지 검증.
 * neopixel 프로토콜 등 특수 필드도 단언.
 */

import { describe, it, expect } from "vitest";
import { PARTS } from "../parts";

describe("부품 메타 검증 — M4", () => {
  describe("(a) 모든 부품이 필수 필드를 가짐", () => {
    it("각 부품은 id·label·category·status를 가져야 함", () => {
      Object.entries(PARTS).forEach(([key, part]) => {
        expect(part.id).toBeDefined();
        expect(part.id).toBe(key);
        expect(part.label).toBeDefined();
        expect(typeof part.label).toBe("string");
        expect(part.category).toBeDefined();
        expect(["board", "breadboard", "input", "sensor", "output", "passive"]).toContain(
          part.category
        );
        expect(part.status).toBeDefined();
        expect(["ready", "active", "glb-pending", "staged"]).toContain(part.status);
      });
    });

    it("각 부품은 render·pins·span·conducts를 가져야 함", () => {
      Object.entries(PARTS).forEach(([, part]) => {
        expect(part.render).toBeDefined();
        expect(["procedural", "glb"]).toContain(part.render.kind);
        expect(part.pins).toBeDefined();
        expect(Array.isArray(part.pins)).toBe(true);
        expect(part.pins.length).toBeGreaterThan(0);
        expect(part.span).toBeDefined();
        expect(typeof part.span).toBe("number");
        expect(part.conducts).toBeDefined();
        expect(Array.isArray(part.conducts)).toBe(true);
      });
    });
  });

  describe("(b) 모든 부품이 한국어 description을 가짐", () => {
    it("각 부품의 description이 비어있지 않아야 함", () => {
      Object.entries(PARTS).forEach(([, part]) => {
        expect(part.description).toBeDefined();
        expect(typeof part.description).toBe("string");
        expect((part.description as string).length).toBeGreaterThan(0);
      });
    });

    it("description에 한국어가 포함되어 있는지 샘플링 확인 (LED·버튼·광센서)", () => {
      // LED: "애노드"·"캐소드"
      expect(PARTS.led.description!).toMatch(/애노드|캐소드/);

      // Button: "풀업"·"입력"
      expect(PARTS.button.description!).toMatch(/풀업|입력|버튼/);

      // LDR: "빛"·"저항"
      expect(PARTS.ldr.description!).toMatch(/빛|저항/);
    });
  });

  describe("(c) 주요 활성 부품들의 메타 숫자 값 검증", () => {
    it("LED: operatingV·currentMa·protocol·polarity·needsResistor", () => {
      const led = PARTS.led;
      expect(led.operatingV).toBe("5V/3.3V");
      expect(led.currentMa).toBe(20);
      expect(led.protocol).toBe("onoff");
      expect(led.polarity).toBe(true);
      expect(led.needsResistor).toBe(true);
    });

    it("저항: category·description (operatingV는 의도적으로 N/A)", () => {
      const resistor = PARTS.resistor;
      expect(resistor.category).toBe("passive");
      expect(resistor.operatingV).toBeUndefined();
      expect(resistor.description).toContain("극성");
    });

    it("버튼: operatingV·protocol·needsPullup", () => {
      const button = PARTS.button;
      expect(button.operatingV).toBe("5V/3.3V");
      expect(button.protocol).toBe("onoff");
      expect(button.needsPullup).toBe(true);
    });
  });

  describe("(d) 수동소자(resistor·ldr)의 operatingV 명문화", () => {
    it("resistor.operatingV는 undefined (주석으로 명문화됨)", () => {
      expect(PARTS.resistor.operatingV).toBeUndefined();
    });

    it("ldr.operatingV는 undefined (주석으로 명문화됨)", () => {
      expect(PARTS.ldr.operatingV).toBeUndefined();
    });
  });

  describe("(e) neopixel 메타", () => {
    it("neopixel: operatingV·description에 프로토콜 명시", () => {
      const neopixel = PARTS.neopixel;
      expect(neopixel.operatingV).toBe("5V");
      // protocol 필드는 없으므로 description에 WS2812·800kHz·시리얼 정보가 있어야 함
      expect(neopixel.description!).toMatch(/WS2812|800kHz|시리얼|데이터선/);
    });

    it("neopixel: pins의 DIN이 digital role로 표시", () => {
      const neopixel = PARTS.neopixel;
      const dinPin = neopixel.pins.find((p) => p.label === "DIN");
      expect(dinPin).toBeDefined();
      expect(dinPin?.role).toBe("digital");
    });
  });

  describe("(f) 모든 부품의 핀 일관성", () => {
    it("각 부품의 pins 길이와 conducts 참조 일치", () => {
      Object.entries(PARTS).forEach(([, part]) => {
        // conducts의 모든 핀 인덱스는 pins 범위 내여야 함
        part.conducts.forEach(([a, b]) => {
          expect(a).toBeGreaterThanOrEqual(0);
          expect(a).toBeLessThan(part.pins.length);
          expect(b).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThan(part.pins.length);
        });
      });
    });
  });
});
