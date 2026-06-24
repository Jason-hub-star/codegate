/**
 * 넷리스트(연결 구조) — 회로 파생 SSOT (DEC: 보드밖 부품 / LLM-readable).
 * buildNet(union-find)에서 **넷(node) 중심**으로 파생: "한 전선에 무엇이 묶였나".
 * 인스턴스 핀-홀 나열보다 LLM이 추론 없이 읽기 쉬운 형식(EDA 넷리스트 관례).
 * 단일 함수 → UI · serializeNetlist(텍스트) · (미래) 에이전트 JSON 이 공유.
 */
import { buildNet, type CircuitContext } from "./net";
import { PARTS, partEndpoints } from "./parts";
import { getBoardPins, boardRefLabel } from "./board";
import type { CircuitModel } from "./types";

export interface NetlistTerminal {
  /** 부품 라벨("LED#1") 또는 "아두이노" */
  ref: string;
  /** 핀 라벨("애노드(+)", "D9", "5V") */
  pin: string;
  /** 부품 단자일 때 인스턴스 uid (캔버스 핫링크 — DEC-027) */
  partUid?: string;
  /** 원시 끝점 id("e5" | "AD_D9") — 디버그/툴콜용 */
  endpoint: string;
}

export interface NetlistEntry {
  /** union-find 루트(안정 식별자) */
  nodeId: string;
  /** 전원/그라운드/일반 — 전류 출입구를 LLM이 바로 인지 */
  role: "power" | "ground" | "signal";
  /** 이 넷에 전기적으로 묶인 단자들 */
  terminals: NetlistTerminal[];
}

export interface Netlist {
  /** 부품 단자가 1개 이상 있는 넷만(노이즈 제외), 결정론 정렬 */
  nets: NetlistEntry[];
  /** 어디에도 안 닿은 부품 핀(보드밖 미연결 리드 등) — 튜터링 직결 */
  unconnected: { ref: string; pin: string; partUid: string }[];
}

// 숫자 핀에만 'D' 접두(아두이노 D13·ESP32 D13). 이름핀(RX·MO 등)은 그대로.
const boardPinLabel = (label: string, role: string): string =>
  (role === "digital" || role === "pwm") && /^\d+$/.test(label) ? `D${label}` : label;

/** 회로 → 넷 중심 연결 구조(결정론). */
export function buildNetlist(model: CircuitModel, ctx: CircuitContext = {}): Netlist {
  const net = buildNet(model, ctx);
  const groups = new Map<string, NetlistTerminal[]>();
  const unconnected: Netlist["unconnected"] = [];

  // 같은 종류 부품 번호("LED#1","LED#2") — 모델 순서로 안정 부여
  const seq = new Map<string, number>();

  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def) continue;
    const n = (seq.get(p.defId) ?? 0) + 1;
    seq.set(p.defId, n);
    const ref = `${def.label}#${n}`;
    const eps = partEndpoints(p);
    def.pins.forEach((pin, i) => {
      const endpoint = eps[i] ?? null;
      const root = endpoint ? net.nodeOfHole(endpoint) : null;
      if (!endpoint || !root) {
        unconnected.push({ ref, pin: pin.label, partUid: p.uid });
        return;
      }
      const t: NetlistTerminal = {
        ref,
        pin: pin.label,
        partUid: p.uid,
        endpoint,
      };
      const arr = groups.get(root);
      if (arr) arr.push(t);
      else groups.set(root, [t]);
    });
  }

  // 보드 핀: 부품 단자가 있는 넷에 속하면 단자로 합류(전원/신호 출처 표시).
  // 부품과 무관한 단독 핀은 노이즈라 제외.
  const ref = boardRefLabel(ctx.board);
  for (const ap of getBoardPins(ctx.board)) {
    const root = net.nodeOfHole(ap.id);
    if (!root || !groups.has(root)) continue;
    groups.get(root)!.push({
      ref,
      pin: boardPinLabel(ap.label, ap.role),
      endpoint: ap.id,
    });
  }

  const roleOf = (root: string): NetlistEntry["role"] =>
    net.powerRoots.has(root)
      ? "power"
      : net.groundRoots.has(root)
        ? "ground"
        : "signal";

  const ROLE_ORDER = { power: 0, ground: 1, signal: 2 } as const;
  const nets: NetlistEntry[] = [...groups.entries()]
    .map(([nodeId, terminals]) => ({
      nodeId,
      role: roleOf(nodeId),
      terminals: terminals.sort(
        (a, b) => a.ref.localeCompare(b.ref, "ko") || a.pin.localeCompare(b.pin, "ko"),
      ),
    }))
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        a.nodeId.localeCompare(b.nodeId),
    );

  return { nets, unconnected };
}
