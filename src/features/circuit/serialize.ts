/**
 * 직렬화 — 회로 + verdict 를 입문자 한국어 가독 텍스트로 (ARCHITECTURE §B).
 * 토큰효율보다 **한국어 가독성** 우선(차별점, research/13). M4 LLM 입력.
 */
import {
  getBoardPinMap,
  isBoardPinId,
  boardRefLabel,
  activeBoard,
  type BoardDef,
} from "./board";
import { buildBom, type BomItem } from "./bom";
import { buildNetlist, type Netlist, type NetlistEntry } from "./netlist";
import type { CircuitContext } from "./net";
import type { CircuitModel, Protocol } from "./types";
import type { Verdict } from "./diagnose";

const PROTOCOL_LABEL: Record<Protocol, string> = {
  onoff: "디지털",
  analog: "아날로그",
  pwm: "PWM",
  i2c: "I2C",
  "1-wire": "1-Wire",
  addressable: "주소지정 LED",
  pulse: "펄스",
};

/** BOM → 한국어 명세 텍스트 (LLM 프롬프트 주입용). `- 라벨 ×개수 (메타)` */
export function serializeBom(bom: BomItem[]): string {
  if (bom.length === 0) return "- 부품: 없음";
  return bom
    .map((it) => {
      const meta: string[] = [];
      if (it.operatingV) meta.push(it.operatingV);
      if (it.protocol) meta.push(PROTOCOL_LABEL[it.protocol]);
      if (it.needsResistor) meta.push("저항 필요");
      if (it.needsPullup) meta.push("풀업 권장");
      const suffix = meta.length ? ` (${meta.join(", ")})` : "";
      return `- ${it.label} ×${it.count}${suffix}`;
    })
    .join("\n");
}

const RAIL_LABEL: Record<string, string> = {
  "T+": "+레일(위)",
  "T-": "−레일(위)",
  "B+": "+레일(아래)",
  "B-": "−레일(아래)",
};

/** 넷(node) 친화 라벨 — 전원/GND/열n (기본=활성 보드) */
function netName(net: NetlistEntry, board: BoardDef = activeBoard()): string {
  if (net.role === "power") return "전원";
  if (net.role === "ground") return "GND";
  const col = net.nodeId.match(/^COL(\d+)_(T|B)$/);
  if (col) return `열${col[1]} ${col[2] === "T" ? "상단" : "하단"}`;
  const rail = net.nodeId.match(/^RAIL_(.+)$/);
  if (rail) return RAIL_LABEL[rail[1]] ?? net.nodeId;
  if (isBoardPinId(net.nodeId, board)) return holeLabel(net.nodeId, board);
  return net.nodeId;
}

const termLabel = (t: { ref: string; pin: string }): string => `${t.ref} ${t.pin}`;

/** 넷리스트 → 한국어 연결 구조 텍스트 (LLM 프롬프트 주입용, 기본=활성 보드). */
export function serializeNetlist(nl: Netlist, ctx: CircuitContext = {}): string {
  if (nl.nets.length === 0 && nl.unconnected.length === 0) return "- 연결 없음";
  const out: string[] = [];
  for (const net of nl.nets) {
    out.push(`- ${netName(net, ctx.board)}: ${net.terminals.map(termLabel).join(", ")}`);
  }
  if (nl.unconnected.length) {
    out.push(`- 미연결: ${nl.unconnected.map(termLabel).join(", ")}`);
  }
  return out.join("\n");
}

/** 홀/핀 id → 사람이 읽는 라벨 (기본=활성 보드) */
export function holeLabel(id: string, board: BoardDef = activeBoard()): string {
  if (isBoardPinId(id, board)) {
    const pin = getBoardPinMap(board).get(id);
    if (!pin) return id;
    const label =
      (pin.role === "digital" || pin.role === "pwm") && /^\d+$/.test(pin.label)
        ? `D${pin.label}`
        : pin.label;
    return `${boardRefLabel(board)} ${label}`;
  }
  const rail = id.match(/^(T\+|T-|B\+|B-)_/);
  if (rail) return RAIL_LABEL[rail[1]];
  return id; // 본체 홀 'e5' 등은 그대로
}

export function serialize(
  model: CircuitModel,
  verdict: Verdict,
  ctx: CircuitContext = {},
): string {
  const lines: string[] = [];

  // 요약 명세(무엇이 있나) — LLM이 부품 목록을 빠르게 파악.
  lines.push("[부품 명세]");
  lines.push(serializeBom(buildBom(model)));
  lines.push("");

  // 연결 구조(무엇이 무엇과 연결됐나) — 넷 중심 넷리스트(인스턴스 나열보다 가독).
  lines.push("[연결 구조]");
  lines.push(serializeNetlist(buildNetlist(model, ctx), ctx));
  // 사용자가 그은 점퍼선(원시) — 넷리스트가 전기 연결을, 이건 문자 그대로의 행위를 보존.
  if (model.wires.length) {
    lines.push("- 점퍼선:");
    for (const w of model.wires) {
      lines.push(`  · ${holeLabel(w.a, ctx.board)} ↔ ${holeLabel(w.b, ctx.board)}`);
    }
  }

  lines.push("");
  lines.push("[진단 결과]");
  if (verdict.findings.length === 0) {
    lines.push(`- 정상: ${verdict.summary}`);
  } else {
    for (const f of verdict.findings) {
      const mis = f.misconception ? ` (오개념: ${f.misconception})` : "";
      lines.push(`- (${f.severity}) ${f.type}: ${f.message}${mis}`);
    }
  }

  return lines.join("\n");
}
