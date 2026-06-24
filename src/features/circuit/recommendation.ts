/**
 * 배선 다음-단계 추천 엔진 — 결정론 (DEC-027).
 * 입력 = 현재 회로(+선택 verdict), 출력 = 한국어 "다음에 뭘 하면 되는지" 1줄.
 * ★ 정오 판정은 diagnose 가, 전진 가이드는 여기가 담당. LLM 의존 0.
 * 목표: 입문자가 "지금 뭘 해야 하지?"에서 막히지 않게 해 배선 성공률을 높인다.
 */
import { buildNet, type CircuitContext } from "./net";
import { PARTS, partEndpoints } from "./parts";
import type { Verdict } from "./diagnose";
import type { CircuitModel } from "./types";

export type StepPriority = "critical" | "high" | "medium" | "info";

export interface NextStep {
  /** 한국어 다음-단계 안내 1줄 */
  message: string;
  priority: StepPriority;
  /** 관련 부품 (있으면 캔버스 하이라이트 핫링크에 사용) */
  partUid?: string;
}

/**
 * 다음 단계 추천. 더 할 게 없으면(완성 추정) info 안내, 그래도 없으면 null.
 * verdict 를 주면 오류 수정이 최우선이 된다(진단 헤드라인 재사용).
 */
export function recommendNextStep(
  model: CircuitModel,
  verdict?: Verdict,
  ctx: CircuitContext = {},
): NextStep | null {
  // 0. 오류가 있으면 그 수정이 최우선 (진단 메시지 재사용)
  if (verdict && verdict.findings.length > 0) {
    const f = verdict.findings[0];
    const priority: StepPriority =
      f.severity === "critical" || f.severity === "high" ? "critical" : "high";
    return { message: f.message, priority, partUid: f.partUid };
  }

  // 1. 빈 작업대 — 첫 부품 유도
  if (model.parts.length === 0) {
    return {
      message: "팔레트에서 LED를 골라 빵판 홀에 놓아 보세요.",
      priority: "info",
    };
  }

  // 2. 저항이 필요한 부품(LED 등)이 있는데 저항이 없음
  const needsR = model.parts.find((p) => PARTS[p.defId]?.needsResistor);
  const hasResistor = model.parts.some((p) => p.defId === "resistor");
  if (needsR && !hasResistor) {
    const label = PARTS[needsR.defId]?.label ?? needsR.defId;
    return {
      message: `${label}에는 직렬 220Ω 저항이 필요해요. 저항을 배치해 보세요.`,
      priority: "high",
      partUid: needsR.uid,
    };
  }

  // 3. 부품은 있는데 배선이 0 — 연결 시작 유도
  if (model.wires.length === 0) {
    return {
      message: "부품을 배치했어요. 이제 핀 2개를 클릭해 점퍼선으로 연결해 보세요.",
      priority: "high",
    };
  }

  // 4. 부품별 전원/GND 미연결 점검 (net 사용, 저항 자체는 제외)
  const net = buildNet(model, ctx);
  const P = net.powerRoots;
  const G = net.groundRoots;
  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def || def.id === "resistor") continue;
    const terms = [
      ...new Set(
        partEndpoints(p)
          .filter((e): e is string => !!e)
          .map((h) => net.nodeOfHole(h)),
      ),
    ].filter((n): n is string => !!n);
    if (terms.length === 0) continue;
    const opt = { excludeUid: p.uid };
    if (!terms.some((t) => net.reach(t, P, opt))) {
      return {
        message: `${def.label}가 아직 전원에 닿지 않았어요. 전원 핀을 아두이노 5V로 연결해 보세요.`,
        priority: "high",
        partUid: p.uid,
      };
    }
    if (!terms.some((t) => net.reach(t, G, opt))) {
      return {
        message: `${def.label}를 GND로 연결해 회로를 닫아 보세요.`,
        priority: "high",
        partUid: p.uid,
      };
    }
  }

  // 5. 풀업이 필요한 입력 부품(버튼) 안내 — 전원·GND는 닿았으나 안정화 권장
  const needPull = model.parts.find((p) => PARTS[p.defId]?.needsPullup);
  if (needPull) {
    const label = PARTS[needPull.defId]?.label ?? needPull.defId;
    return {
      message: `${label} 입력은 플로팅을 막기 위해 풀업 저항(또는 INPUT_PULLUP)을 쓰는 게 안정적이에요.`,
      priority: "medium",
      partUid: needPull.uid,
    };
  }

  // 6. 완성 추정 — 진단 유도
  return {
    message: "회로가 완성된 것 같아요! [진단받기]를 눌러 확인해 보세요.",
    priority: "info",
  };
}
