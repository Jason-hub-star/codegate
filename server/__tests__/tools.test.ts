/**
 * MCP 도구 코어 — 무상태·동시성·결정론 검증 (M3).
 *
 * MCP 서버는 요청마다 도구를 호출하되 전역 setActive* 를 부르지 않는다.
 * 서로 다른 회로(다른 보드/빵판) 요청을 인터리브해도 결과가 섞이지 않고,
 * 같은 입력이면 항상 같은 출력(결정론)임을 HTTP 없이 직접 검증한다.
 */
import { describe, it, expect } from "vitest";
import {
  runGenerate,
  runDiagnose,
  runSuggest,
  runBom,
  runExplain,
  matchScenario,
  findPart,
  viewUrl,
  BASE_URL,
} from "../tools";
import { SCENARIOS, encodeCircuit } from "../../src/features/circuit/index";
import { activeBoard, setActiveBoard } from "../../src/features/circuit/board";
import { activeBreadboard } from "../../src/features/circuit/breadboard";

/** 시나리오 → code(딥링크 인코딩)와 동일 규칙으로 코드 생성. */
function codeFor(scenarioId: keyof typeof SCENARIOS, board: "half" | "full" = "half", dev: "arduino-uno" | "esp32-huzzah32" = "arduino-uno") {
  return encodeCircuit(SCENARIOS[scenarioId].model, board, undefined, dev);
}

describe("도구 코어 — 결정론", () => {
  it("같은 code → diagnose 결과 문자열 동일 (2회)", () => {
    const c = codeFor("ledNoResistor");
    expect(runDiagnose(c).text).toBe(runDiagnose(c).text);
  });

  it("같은 쿼리 → generate 결과 동일", () => {
    expect(runGenerate("저항 없이 LED").text).toBe(runGenerate("저항 없이 LED").text);
  });

  it("bom / suggest 도 결정론", () => {
    const c = codeFor("ledCorrect");
    expect(runBom(c).text).toBe(runBom(c).text);
    expect(runSuggest(c).text).toBe(runSuggest(c).text);
  });
});

describe("도구 코어 — 무상태·동시성 격리", () => {
  it("아두이노/ESP32 회로를 인터리브해도 결과 불변 + 전역 싱글톤 무변경", async () => {
    const ardCode = codeFor("ledCorrect", "half", "arduino-uno");
    const espCode = codeFor("ledCorrect", "full", "esp32-huzzah32");

    const ardBase = runDiagnose(ardCode).text;
    const espBase = runDiagnose(espCode).text;
    // 보드가 다르면 출력도 달라야(컨텍스트가 실제로 흐른다)
    expect(espBase).not.toBe(ardBase);

    // 100개의 뒤섞인 동시 요청(아두이노·ESP32 번갈아)
    const jobs = Array.from({ length: 100 }, (_, i) =>
      Promise.resolve().then(() =>
        runDiagnose(i % 2 === 0 ? ardCode : espCode).text,
      ),
    );
    const results = await Promise.all(jobs);
    results.forEach((text, i) => {
      expect(text).toBe(i % 2 === 0 ? ardBase : espBase);
    });

    // ★ MCP 경로는 setActive 를 부르지 않으므로 전역은 기본값 그대로
    expect(activeBoard().id).toBe("arduino-uno");
    expect(activeBreadboard().id).toBe("half");
  });

  it("UI가 보드를 바꿔도(setActiveBoard) 도구는 code 의 보드를 따른다", () => {
    const ardCode = codeFor("ledCorrect", "half", "arduino-uno");
    const before = runDiagnose(ardCode).text;
    setActiveBoard("esp32-huzzah32"); // UI 전역 변경 시뮬레이션
    try {
      const after = runDiagnose(ardCode).text; // 여전히 code=아두이노 기준
      expect(after).toBe(before);
    } finally {
      setActiveBoard("arduino-uno"); // 원복
    }
  });
});

describe("도구 코어 — 매칭·딥링크·에러", () => {
  it("matchScenario: 키워드별 올바른 시나리오", () => {
    expect(matchScenario("저항 없이 LED").scenario.id).toBe("ledNoResistor");
    expect(matchScenario("릴레이로 펌프 켜기").scenario.id).toBe("relayPumpExternal");
    expect(matchScenario("버튼 회로").scenario.id).toBe("buttonCorrect");
    expect(matchScenario("서보 모터").scenario.id).toBe("servoCorrect");
  });

  it("매칭 실패 시 score 0 + 기본 회로", () => {
    const r = matchScenario("zzz 알수없는 요청 qqq");
    expect(r.score).toBe(0);
    expect(r.scenario.id).toBe("ledCorrect");
  });

  it("findPart: id·라벨·한국어 별칭", () => {
    expect(findPart("led")?.id).toBe("led");
    expect(findPart("릴레이")?.id).toBe("relay");
    expect(findPart("저항")?.id).toBe("resistor");
    expect(findPart("없는부품")).toBeNull();
  });

  it("viewUrl: BASE_URL + /view?c= 형식", () => {
    const { url, code } = viewUrl(SCENARIOS.ledCorrect.model);
    expect(url).toBe(`${BASE_URL}/view?c=${code}`);
    expect(url).toContain("/view?c=");
  });

  it("잘못된 code → isError", () => {
    expect(runDiagnose("!!깨진코드!!").isError).toBe(true);
    expect(runBom("").isError).toBe(true);
    expect(runExplain("존재하지않는부품xyz").isError).toBe(true);
  });

  it("explain_component: 릴레이 핵심 정보 포함", () => {
    const t = runExplain("릴레이").text;
    expect(t).toContain("릴레이");
    expect(t).toContain("COM/NO/NC");
  });
});
