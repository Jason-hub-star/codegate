/**
 * 결정론 규칙 엔진 — net 그래프 + 전기규칙 → 구조화 verdict (DEC-016).
 * ★ 정오 판정은 여기(코드)가 한다. LLM 은 이 verdict 를 한국어로 "설명만".
 * 오개념 추론(DEC-017): 배선 패턴 → 오개념 태그.
 * 판정 순서(research/11): 단락 → 전원/GND → 극성 → 열린회로 → 저항누락 → 핀충돌.
 */
import { buildNet } from "./net";
import { activeBoard, getBoardPins, type BoardPinRole } from "./board";
import { PARTS, partEndpoints } from "./parts";
import { energizedRailsForNet, type EnergizedRails } from "./powerVisualization";
import { DEFAULT_RESISTOR_OHM, ARDUINO_PIN_MAX_MA } from "./rules";
import type { CircuitModel } from "./types";

export type ErrorType =
  | "short_circuit"
  | "missing_power_ground"
  | "open_circuit"
  | "polarity_reversed"
  | "missing_resistor"
  | "pin_conflict"
  | "voltage_mismatch";

export type Misconception =
  | "resistor_necessity"
  | "polarity_concept"
  | "circuit_loop";

export type Severity = "critical" | "high" | "medium" | "low";

export interface Finding {
  type: ErrorType;
  severity: Severity;
  message: string;
  partUid?: string;
  partLabel?: string;
  misconception?: Misconception;
}

export interface Verdict {
  ok: boolean;
  findings: Finding[];
  summary: string;
  workingLeds: number;
  workingLedUids: string[];
  energizedRails: EnergizedRails;
}

const SEV_RANK: Record<Severity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

export function diagnose(model: CircuitModel): Verdict {
  const net = buildNet(model);
  const P = net.powerRoots;
  const G = net.groundRoots;
  const findings: Finding[] = [];
  const workingLedUids: string[] = [];

  const labelOf = (defId: string) => PARTS[defId]?.label ?? defId;

  // 보드 핀 role별 노드셋 (서보·버튼 정밀 진단용, DEC-039).
  // net.powerRoots 는 digital/pwm 까지 전원으로 묶으므로 "진짜 5V"·"PWM핀"·"입력핀"을 따로 만든다.
  const boardPins = getBoardPins();
  const roleNodes = (...roles: BoardPinRole[]): Set<string> => {
    const rs = new Set(roles);
    return new Set(
      boardPins.filter((p) => rs.has(p.role)).map((p) => net.find(p.id)),
    );
  };
  const pwmNodes = roleNodes("pwm");
  const inputPinNodes = roleNodes("digital", "pwm", "analog");
  const supplyNodes = roleNodes("power5", "power3v3", "vin");
  // 활성 보드 PWM 핀 라벨(서보 안내 메시지용) — 보드별로 다름
  const pwmLabels = boardPins
    .filter((p) => p.role === "pwm")
    .map((p) => p.label)
    .join("·");

  // ── 1. 단락: + 레일과 − 레일이 점퍼로 직결 ──
  let shorted = false;
  for (const r of P) {
    if (G.has(r)) shorted = true;
  }
  if (shorted) {
    findings.push({
      type: "short_circuit",
      severity: "critical",
      message: "전원(+)과 그라운드(−)가 부하 없이 직접 연결됐어요 (단락).",
    });
  }

  // ── 부품별 핀충돌(양다리가 같은 줄) ──
  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def) continue;
    let conflict = false;
    const eps = partEndpoints(p);
    for (const [i, j] of def.conducts) {
      const ru = eps[i] ? net.nodeOfHole(eps[i]!) : null;
      const rv = eps[j] ? net.nodeOfHole(eps[j]!) : null;
      if (ru && rv && ru === rv) conflict = true;
    }
    if (conflict) {
      findings.push({
        type: "pin_conflict",
        severity: "high",
        message: `${def.label}의 두 다리가 같은 줄(노드)에 꽂혀 단락·무효예요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    }
  }

  const conflictUids = new Set(
    findings.filter((f) => f.type === "pin_conflict").map((f) => f.partUid),
  );

  // ── LED 심화 진단 ──
  for (const p of model.parts) {
    if (p.defId !== "led") continue;
    if (conflictUids.has(p.uid)) continue;
    const A = net.nodeOfHole(p.pinHoles[0]); // 애노드(+)
    const C = net.nodeOfHole(p.pinHoles[1]); // 캐소드(−)
    if (!A || !C) continue;

    const opt = { excludeUid: p.uid };
    const aPower = net.reach(A, P, opt);
    const cGround = net.reach(C, G, opt);
    const aGround = net.reach(A, G, opt);
    const cPower = net.reach(C, P, opt);

    const anyPower = aPower || cPower;
    const anyGround = aGround || cGround;

    // 전원/GND 미연결 (floating)
    if (!anyPower && !anyGround) {
      findings.push({
        type: "missing_power_ground",
        severity: "high",
        message: `${labelOf(p.defId)}가 전원·그라운드 어디에도 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: labelOf(p.defId),
        misconception: "circuit_loop",
      });
      continue;
    }

    const correct = aPower && cGround;
    const reversed = aGround && cPower;

    if (correct) {
      const aPowerNoR = net.reach(A, P, { ...opt, excludeResistor: true });
      const cGroundNoR = net.reach(C, G, { ...opt, excludeResistor: true });
      if (aPowerNoR && cGroundNoR) {
        findings.push({
          type: "missing_resistor",
          severity: "high",
          message: `${labelOf(p.defId)}에 직렬 저항이 없어 과전류(>${ARDUINO_PIN_MAX_MA}mA) 위험이에요. ${DEFAULT_RESISTOR_OHM}Ω을 넣어 보세요.`,
          partUid: p.uid,
          partLabel: labelOf(p.defId),
          misconception: "resistor_necessity",
        });
      } else {
        workingLedUids.push(p.uid);
      }
    } else if (reversed) {
      findings.push({
        type: "polarity_reversed",
        severity: "medium",
        message: `${labelOf(p.defId)} 극성이 반대예요. 긴 다리(애노드)가 전원(+) 쪽이어야 해요.`,
        partUid: p.uid,
        partLabel: labelOf(p.defId),
        misconception: "polarity_concept",
      });
    } else {
      findings.push({
        type: "open_circuit",
        severity: "high",
        message: `${labelOf(p.defId)} 회로가 전원→부품→그라운드로 완결되지 않았어요 (열린 회로).`,
        partUid: p.uid,
        partLabel: labelOf(p.defId),
        misconception: "circuit_loop",
      });
    }
  }

  // ── 서보 정밀 진단 (DEC-039): 신호→PWM핀 · VCC→전원(5V) · GND→접지 ──
  for (const p of model.parts) {
    if (p.defId !== "servo") continue;
    if (conflictUids.has(p.uid)) continue;
    const def = PARTS[p.defId];
    if (!def) continue;
    const eps = partEndpoints(p);
    const nodeForRole = (role: string): string | null => {
      const idx = def.pins.findIndex((pin) => pin.role === role);
      const ep = idx >= 0 ? eps[idx] : null;
      return ep ? net.nodeOfHole(ep) : null;
    };
    const sig = nodeForRole("pwm");
    const vcc = nodeForRole("power");
    const gnd = nodeForRole("gnd");

    if (!sig && !vcc && !gnd) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label}가 아두이노 핀에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
        misconception: "circuit_loop",
      });
      continue;
    }
    if (!sig || !net.reach(sig, pwmNodes)) {
      findings.push({
        type: "open_circuit",
        severity: "medium",
        message: `${def.label} 신호선은 PWM 핀(${pwmLabels})에 연결해야 각도 제어가 돼요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    }
    if (!vcc || !net.reach(vcc, supplyNodes)) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label} VCC가 전원에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    }
    if (!gnd || !net.reach(gnd, G)) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label} GND가 접지(GND)에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    }
  }

  // ── 릴레이 정밀 진단: 제어 IN→디지털핀 · VCC→전원 · GND→접지 ──
  // 부하측(COM/NO/NC)은 net 접점 간선으로 회로가 완결됨. 정적 모델이라 "지금 ON/OFF"는
  // 진단 안 함(실시간은 WebSerial 트윈 DEC-037) — 여기선 제어 배선 정확도만 본다.
  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def?.relay) continue;
    if (conflictUids.has(p.uid)) continue;
    const eps = partEndpoints(p);
    const nodeForRole = (role: string): string | null => {
      const idx = def.pins.findIndex((pin) => pin.role === role);
      const ep = idx >= 0 ? eps[idx] : null;
      return ep ? net.nodeOfHole(ep) : null;
    };
    const inn = nodeForRole("signal"); // IN
    const vcc = nodeForRole("power");
    const gnd = nodeForRole("gnd");

    if (!inn && !vcc && !gnd) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label} 제어측이 아두이노 핀에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
        misconception: "circuit_loop",
      });
      continue;
    }
    if (!inn || !net.reach(inn, inputPinNodes)) {
      findings.push({
        type: "open_circuit",
        severity: "medium",
        message: `${def.label} IN을 아두이노 디지털핀에 연결해야 ON/OFF 제어가 돼요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    }
    if (!vcc || !net.reach(vcc, supplyNodes)) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label} VCC가 전원(5V)에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    }
    if (!gnd || !net.reach(gnd, G)) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label} GND가 접지(GND)에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    }
  }

  // ── 버튼 정밀 진단 (DEC-039): 입력핀(디지털/아날로그) + 기준(GND/전원) 필요 ──
  // 풀업은 펌웨어(INPUT_PULLUP)로 대체 가능 → 배선만으론 단정 불가하므로 진단하지 않음.
  for (const p of model.parts) {
    if (p.defId !== "button") continue;
    if (conflictUids.has(p.uid)) continue;
    const def = PARTS[p.defId];
    if (!def) continue;
    const opt = { excludeUid: p.uid }; // 버튼 자체 간선 제외 → 양 단자 독립 평가
    const terms = partEndpoints(p).map((e) => (e ? net.nodeOfHole(e) : null));
    const reachInput = (n: string | null) => !!n && net.reach(n, inputPinNodes, opt);
    const reachRef = (n: string | null) =>
      !!n && (net.reach(n, G, opt) || net.reach(n, supplyNodes, opt));
    const hasInput = terms.some(reachInput);
    const hasRef = terms.some(reachRef);

    if (!hasInput && !hasRef) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label}가 전원·그라운드에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
        misconception: "circuit_loop",
      });
    } else if (!hasInput) {
      findings.push({
        type: "open_circuit",
        severity: "medium",
        message: `${def.label}이 아두이노 입력핀(디지털/아날로그)에 연결되지 않아 눌림을 읽을 수 없어요.`,
        partUid: p.uid,
        partLabel: def.label,
      });
    } else if (!hasRef) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label} 반대쪽이 GND(또는 전원) 기준에 연결되지 않았어요. 보통 한쪽=디지털핀, 다른쪽=GND예요.`,
        partUid: p.uid,
        partLabel: def.label,
        misconception: "circuit_loop",
      });
    }
  }

  // ── 비-LED·비-서보·비-버튼 부품 일반 floating 진단 ──
  for (const p of model.parts) {
    if (p.defId === "led" || p.defId === "servo" || p.defId === "button") continue;
    if (conflictUids.has(p.uid)) continue;
    const def = PARTS[p.defId];
    if (!def) continue;
    const terms = [
      ...new Set(
        partEndpoints(p)
          .filter((e): e is string => !!e)
          .map((h) => net.nodeOfHole(h)),
      ),
    ].filter((n): n is string => !!n);
    const opt = { excludeUid: p.uid };
    const anyP = terms.some((t) => net.reach(t, P, opt));
    const anyG = terms.some((t) => net.reach(t, G, opt));
    if (!anyP && !anyG) {
      findings.push({
        type: "missing_power_ground",
        severity: "medium",
        message: `${def.label}가 전원·그라운드에 연결되지 않았어요.`,
        partUid: p.uid,
        partLabel: def.label,
        misconception: "circuit_loop",
      });
    }
  }

  // ── 전압 호환 진단: 5V 전용 부품을 3.3V 보드(ESP32)에 전원 연결 시 경고 ──
  // 보드 logicV < 5 일 때만. 부품이 실제로 전원(P)에 연결됐을 때만(단순 미배치 제외).
  const board = activeBoard();
  if (board.logicV < 5) {
    for (const p of model.parts) {
      if (conflictUids.has(p.uid)) continue;
      const def = PARTS[p.defId];
      if (!def || def.operatingV !== "5V") continue; // 5V 전용만(겸용 5V/3.3V 제외)
      const terms = [
        ...new Set(
          partEndpoints(p)
            .filter((e): e is string => !!e)
            .map((h) => net.nodeOfHole(h)),
        ),
      ].filter((n): n is string => !!n);
      const powered = terms.some((t) => net.reach(t, P, { excludeUid: p.uid }));
      if (powered) {
        findings.push({
          type: "voltage_mismatch",
          severity: "medium",
          message: `${def.label}는 5V 전용인데 ${board.label}은 ${board.logicV}V 로직이에요. 전압이 부족해 오작동할 수 있어요.`,
          partUid: p.uid,
          partLabel: def.label,
        });
      }
    }
  }

  findings.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);

  const ok = findings.length === 0;
  let summary: string;
  if (findings.length) {
    summary = findings[0].message;
  } else if (workingLedUids.length > 0) {
    summary = `좋아요! LED ${workingLedUids.length}개가 정상적으로 켜질 회로예요.`;
  } else if (model.parts.length === 0) {
    summary = "부품을 배치하고 핀을 이어 회로를 만들어 보세요.";
  } else {
    summary = "회로를 점검했어요. 발견된 오류는 없어요.";
  }

  return {
    ok,
    findings,
    summary,
    workingLeds: workingLedUids.length,
    workingLedUids,
    energizedRails: energizedRailsForNet(net),
  };
}
