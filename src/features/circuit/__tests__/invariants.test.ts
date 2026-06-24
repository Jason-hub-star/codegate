/**
 * 무상태 불변식 검증 — M1 마일스톤
 *
 * 회로 도메인이 순수 동기 함수로만 이루어져 있고,
 * 런타임 중간에 빵판을 바꾸지 않는다는 불변식을 테스트로 보증한다.
 * (서버리스/MCP 진입점 설계 시 동시요청 오염 방지용)
 */

import { describe, it, expect, afterEach } from "vitest";
import { diagnose } from "../diagnose";
import { serialize } from "../serialize";
import { activeBreadboard, setActiveBreadboard, BREADBOARDS } from "../breadboard";
import { SCENARIOS } from "../scenarios";

describe("무상태 불변식 — M1", () => {
  // 테스트 격리: 각 테스트 후 "half" 원복
  afterEach(() => {
    setActiveBreadboard("half");
  });

  describe("(a) 요청 간 독립성 — 직전 진단이 다음 결과를 오염시키지 않음", () => {
    it("ledCorrect 단독 진단 → ledNoResistor·ledCorrect 번갈아 진단해도 ledCorrect 결과 불변", () => {
      // 1. ledCorrect 단독 진단 보관
      const ledCorrectAlone = diagnose(SCENARIOS.ledCorrect.model);
      const baselineOk = ledCorrectAlone.ok;
      const baselineFindings = ledCorrectAlone.findings;
      const baselineWorkingLeds = ledCorrectAlone.workingLeds;

      // 2. ledNoResistor 진단
      diagnose(SCENARIOS.ledNoResistor.model);

      // 3. ledCorrect 다시 진단
      const ledCorrectAfterNoRes = diagnose(SCENARIOS.ledCorrect.model);

      // 4. 비교: ledCorrect 결과가 처음과 동일
      expect(ledCorrectAfterNoRes.ok).toBe(baselineOk);
      expect(ledCorrectAfterNoRes.findings).toEqual(baselineFindings);
      expect(ledCorrectAfterNoRes.workingLeds).toBe(baselineWorkingLeds);

      // 5. 또 다시 ledNoResistor 진단
      diagnose(SCENARIOS.ledNoResistor.model);

      // 6. ledCorrect 재진단 — 여전히 처음과 동일
      const ledCorrectSecondRound = diagnose(SCENARIOS.ledCorrect.model);
      expect(ledCorrectSecondRound.ok).toBe(baselineOk);
      expect(ledCorrectSecondRound.findings).toEqual(baselineFindings);
      expect(ledCorrectSecondRound.workingLeds).toBe(baselineWorkingLeds);
    });

    it("여러 시나리오를 섞어 진단해도 각 시나리오의 verdict 동일성 유지", () => {
      const baselineVerdict = {
        ledCorrect: diagnose(SCENARIOS.ledCorrect.model),
        ledNoResistor: diagnose(SCENARIOS.ledNoResistor.model),
        ledReversed: diagnose(SCENARIOS.ledReversed.model),
      };

      // 임의 순서 섞기
      diagnose(SCENARIOS.ledReversed.model);
      diagnose(SCENARIOS.ledCorrect.model);
      diagnose(SCENARIOS.shortCircuit.model);
      diagnose(SCENARIOS.ledNoResistor.model);

      // 각 시나리오 재진단
      const secondRoundVerdict = {
        ledCorrect: diagnose(SCENARIOS.ledCorrect.model),
        ledNoResistor: diagnose(SCENARIOS.ledNoResistor.model),
        ledReversed: diagnose(SCENARIOS.ledReversed.model),
      };

      // 모두 처음과 동일
      expect(secondRoundVerdict.ledCorrect).toEqual(baselineVerdict.ledCorrect);
      expect(secondRoundVerdict.ledNoResistor).toEqual(baselineVerdict.ledNoResistor);
      expect(secondRoundVerdict.ledReversed).toEqual(baselineVerdict.ledReversed);
    });
  });

  describe("(b) 결정론 — 같은 model을 반복 진단해도 동일 결과", () => {
    it("diagnose 2회 호출 → toEqual 일치", () => {
      const v1 = diagnose(SCENARIOS.ledCorrect.model);
      const v2 = diagnose(SCENARIOS.ledCorrect.model);
      expect(v2).toEqual(v1);
    });

    it("serialize(model, diagnose(model)) 2회 → 문자열 toBe 동일", () => {
      const m = SCENARIOS.ledCorrect.model;
      const s1 = serialize(m, diagnose(m));
      const s2 = serialize(m, diagnose(m));
      expect(s2).toBe(s1);
    });

    it("여러 시나리오 각각 결정론 검증", () => {
      const scenarios = [
        SCENARIOS.ledCorrect,
        SCENARIOS.ledNoResistor,
        SCENARIOS.ledReversed,
        SCENARIOS.shortCircuit,
        SCENARIOS.openCircuit,
        SCENARIOS.empty,
      ];

      for (const scenario of scenarios) {
        const v1 = diagnose(scenario.model);
        const v2 = diagnose(scenario.model);
        expect(v2).toEqual(v1);

        const s1 = serialize(scenario.model, v1);
        const s2 = serialize(scenario.model, v2);
        expect(s2).toBe(s1);
      }
    });
  });

  describe("(c) 기본 활성 빵판", () => {
    it("activeBreadboard().id === 'half' (초기값)", () => {
      expect(activeBreadboard().id).toBe("half");
    });

    it("활성 빵판 정의 일치", () => {
      expect(activeBreadboard()).toEqual(BREADBOARDS.half);
    });
  });

  describe("(선택) setActiveBreadboard 동작 + 원복", () => {
    it("setActiveBreadboard('full') → 'full', setActiveBreadboard('half') → 'half'", () => {
      // 초기 상태 확인
      expect(activeBreadboard().id).toBe("half");

      // "full"로 변경
      setActiveBreadboard("full");
      expect(activeBreadboard().id).toBe("full");
      expect(activeBreadboard()).toEqual(BREADBOARDS.full);

      // "half"로 원복
      setActiveBreadboard("half");
      expect(activeBreadboard().id).toBe("half");
      expect(activeBreadboard()).toEqual(BREADBOARDS.half);
    });

    it("breadboard 변경 후에도 diagnose 동작 유지", () => {
      // half에서 진단
      const v1Half = diagnose(SCENARIOS.ledCorrect.model);

      // full로 변경 후 진단
      setActiveBreadboard("full");
      const v1Full = diagnose(SCENARIOS.ledCorrect.model);

      // full의 진단도 동일 model에 대해 결정론 (breadboard 변경이 diagnose 논리를 영향 X)
      const v2Full = diagnose(SCENARIOS.ledCorrect.model);
      expect(v2Full).toEqual(v1Full);

      // 원복
      setActiveBreadboard("half");

      // half에서 재진단 — v1Half와 동일
      const v2Half = diagnose(SCENARIOS.ledCorrect.model);
      expect(v2Half).toEqual(v1Half);
    });
  });
});
