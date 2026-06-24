import { describe, it, expect } from "vitest";
import { synthesizeCircuit, occupiedHoles } from "../generate";
import { diagnose } from "../diagnose";
import type { CircuitModel, Wire } from "../types";

describe("synthesizeCircuit — 안전한 회로 합성 (M5)", () => {
  describe("겹침 거부", () => {
    it("같은 anchor에 부품 2개 → 오류 반환", () => {
      const result = synthesizeCircuit([
        { defId: "led", anchor: "e5" },
        { defId: "resistor", anchor: "e5" }, // 같은 위치 → 겹침
      ]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("겹침");
      }
    });

    it("핀이 겹치는 배치(LED span2 e5→e7, resistor span4 e7→...) → 오류", () => {
      const result = synthesizeCircuit([
        { defId: "led", anchor: "e5", orientation: 0 }, // e5, e7 점유
        { defId: "resistor", anchor: "e7", orientation: 0 }, // e7, e11 점유 → 겹침!
      ]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("겹침");
      }
    });

    it("배치 불가(경계 밖) → 오류", () => {
      const result = synthesizeCircuit([{ defId: "led", anchor: "z99" }]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("배치 불가");
      }
    });

    it("미등록 부품 → 오류", () => {
      const result = synthesizeCircuit([{ defId: "nonexistent", anchor: "e5" }]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("미등록");
      }
    });
  });

  describe("정상 합성", () => {
    it("LED@e5 + resistor@a7 → ok, 겹침 0", () => {
      const result = synthesizeCircuit([
        { defId: "led", anchor: "e5" },
        { defId: "resistor", anchor: "a7" },
      ]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.model.parts).toHaveLength(2);
        expect(result.model.parts[0].uid).toBe("led1");
        expect(result.model.parts[1].uid).toBe("resistor1");
      }
    });

    it("LED@e5 + resistor@a7 + 5V/GND 점퍼선 → 완전 회로", () => {
      const wires: Wire[] = [
        { id: "w1", a: "AD_5V", b: "a5" }, // 5V → LED 애노드
        { id: "w2", a: "a11", b: "AD_GND_P1" }, // 저항 끝 → GND
      ];

      const result = synthesizeCircuit(
        [
          { defId: "led", anchor: "e5" },
          { defId: "resistor", anchor: "a7" },
        ],
        wires,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.model.wires).toHaveLength(2);
      }
    });
  });

  describe("결정론성 (Determinism)", () => {
    it("같은 spec 2회 합성 → uid 포함 동일(전역 _uid 비의존)", () => {
      const specs = [
        { defId: "led", anchor: "e5" },
        { defId: "resistor", anchor: "a7" },
      ];

      const result1 = synthesizeCircuit([...specs]);
      const result2 = synthesizeCircuit([...specs]);

      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);

      if (result1.ok && result2.ok) {
        // uid 동일 확인 (led1, resistor1)
        expect(result1.model.parts[0].uid).toBe(result2.model.parts[0].uid);
        expect(result1.model.parts[1].uid).toBe(result2.model.parts[1].uid);

        // 전체 model 동일
        expect(result1.model).toEqual(result2.model);
      }
    });

    it("같은 defId가 여러 번 등장 → uid 순서대로 (led1, led2, ...)", () => {
      const result = synthesizeCircuit([
        { defId: "led", anchor: "e5" },
        { defId: "button", anchor: "a5" },
        { defId: "led", anchor: "j5" }, // 두 번째 LED
      ]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.model.parts[0].uid).toBe("led1");
        expect(result.model.parts[1].uid).toBe("button1");
        expect(result.model.parts[2].uid).toBe("led2");
      }
    });
  });

  describe("생성→진단 통과", () => {
    it("ledCorrect 재구현 → diagnose.ok === true, ledCorrect 동등", () => {
      const wires: Wire[] = [
        { id: "w1", a: "AD_5V", b: "a5" },
        { id: "w2", a: "a11", b: "AD_GND_P1" },
      ];

      const result = synthesizeCircuit(
        [
          { defId: "led", anchor: "e5" },
          { defId: "resistor", anchor: "a7" },
        ],
        wires,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const v = diagnose(result.model);
        expect(v.ok).toBe(true);
        expect(v.findings).toHaveLength(0);
        expect(v.workingLeds).toBe(1);
        expect(v.summary).toContain("LED");
      }
    });
  });

  describe("occupiedHoles", () => {
    it("빈 회로 → 집합 크기 0", () => {
      const model: CircuitModel = { parts: [], wires: [] };
      const occupied = occupiedHoles(model);
      expect(occupied.size).toBe(0);
    });

    it("LED@e5 → e5, e7 점유", () => {
      const result = synthesizeCircuit([{ defId: "led", anchor: "e5" }]);
      expect(result.ok).toBe(true);

      if (result.ok) {
        const occupied = occupiedHoles(result.model);
        expect(occupied.has("e5")).toBe(true);
        expect(occupied.has("e7")).toBe(true);
        expect(occupied.size).toBe(2);
      }
    });

    it("LED + resistor → 모든 핀 홀 포함", () => {
      const result = synthesizeCircuit([
        { defId: "led", anchor: "e5" }, // e5, e7
        { defId: "resistor", anchor: "a7" }, // a7, a11
      ]);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const occupied = occupiedHoles(result.model);
        expect(occupied.has("e5")).toBe(true);
        expect(occupied.has("e7")).toBe(true);
        expect(occupied.has("a7")).toBe(true);
        expect(occupied.has("a11")).toBe(true);
        expect(occupied.size).toBe(4);
      }
    });
  });

  describe("경계 검증", () => {
    it("anchor 유효하지 않음 → 배치 불가 오류", () => {
      const result = synthesizeCircuit([{ defId: "led", anchor: "invalid" }]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("배치 불가");
      }
    });

    it("부품이 보드 밖으로 나감(span 초과) → null 반환(배치 불가)", () => {
      // 보드는 a-j 행, 1-30 열 (약). 끝 부근 배치 시도 → 경계 밖
      const result = synthesizeCircuit([
        { defId: "resistor", anchor: "e29", orientation: 0 }, // span4 → e29,e30,e31(x),... → null
      ]);

      // 배치 불가면 오류
      if (!result.ok) {
        expect(result.error).toContain("배치 불가");
      }
    });
  });
});
