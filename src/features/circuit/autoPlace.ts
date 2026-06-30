/**
 * 오토플레이서 — 빵판-무관 논리 회로(net 연결) → 빵판별 물리 CircuitModel.
 *
 * 왜: 예제를 홀 좌표로 하드코딩하면 빵판마다 재작성(N×M). 논리로 한 번 정의하고
 * 빵판별 배치를 여기서 생성하면 N+M 으로 수렴(DEC: 논리 모델+오토플레이서).
 *
 * 단락 구조적 방지: net 마다 **분리된 물리 열/레일**을 점유하므로, 서로 다른 net 이
 * 같은 전기 노드에 닿을 수 없다 — 의도한 연결만 존재 → 단락이 구조적으로 불가능.
 *
 * ★ 한 홀 하나(물리 불변식): 같은 net(=한 전기 노드: 레일 전체 / 한 열의 a-e)이라도
 *   단자마다 그 노드 안의 **빈 홀을 따로** 준다. board 부품은 다리를 e행(중앙 홈쪽),
 *   점퍼는 같은 열 앞쪽(a행)에 둬서 다리와 점퍼가 겹치지 않는다.
 *
 * autoPlace: 점퍼 라우팅 충돌 회피(선 교차)는 하지 않는다(전기적으로 무관, 교육용).
 */
import type { CircuitModel, PlacedPart, Wire } from "./types";
import { PARTS, computePinHoles } from "./parts";
import { getHoles, boardDimensions, type BreadboardDef } from "./breadboard";

/** 위뱅크 행 앞→뒤(a=빵판 앞 가장자리 … e=중앙 홈). 점퍼는 앞(a)부터, 부품 다리는 e앵커. */
const UPPER_ROWS = ["a", "b", "c", "d", "e"] as const;

export interface LogicalPart {
  uid: string;
  defId: string;
}

export interface LogicalNet {
  /** 의미 라벨(디버그·BOM용, 선택) — "5V" | "GND" | "D4" */
  name?: string;
  /** 전원/접지/신호 구분 — power/ground 는 레일(있으면) 또는 버스 열로 */
  kind?: "power" | "ground" | "signal";
  /** 보드 핀 직결 끝점(있으면 이 핀이 net 대표) — "AD_D4" 등 */
  board?: string;
  /** 이 net 에 묶인 부품 핀들 (def.pins 인덱스) */
  terminals: { uid: string; pin: number }[];
}

export interface LogicalCircuit {
  parts: LogicalPart[];
  nets: LogicalNet[];
}

/** 물리 노드 — net 이 실현되는 곳(레일 전체 / 본체 한 열 / 보드 핀 / 보드 전원핀 직결). */
type NetNode =
  | { kind: "rail"; rail: "T+" | "T-" }
  | { kind: "col"; col: number }
  | { kind: "board"; pin: string }
  | { kind: "pins"; pins: string[] }; // 전원/접지 단자를 보드 전원핀에 직결(단자별 pop)

/**
 * 보드 전원/접지 핀 풀 — 단자 수가 이 핀 수 이하면 빵판 버스 없이 직결(선 절감).
 * ponytail: 아두이노 가정(5V 1핀·GND 3핀). 다른 보드 지원 시 board 인자로 파라미터화.
 */
const SUPPLY_PINS: Record<"power" | "ground", string[]> = {
  power: ["AD_5V"],
  // ponytail: 보정 좌표가 있는 전원 헤더 GND 2개만 직결 풀로 쓴다.
  // 3개 이상 GND 단자는 레일/버스에 모아 AD_GND_P1 공급선 하나로 먹이는 게 실물에도 맞다.
  // 디지털 헤더 GND를 보정하면 여기 풀에 다시 추가하면 된다.
  ground: ["AD_GND_P1", "AD_GND_P2"],
};

/** "e20" → 20 (행문자+열번호에서 열). */
function colOfHole(id: string): number {
  return parseInt(id.slice(1), 10);
}

/**
 * 논리 회로 → 빵판별 물리 CircuitModel. 결정론(같은 입력=같은 출력).
 * 레일 있는 빵판: 전원/접지를 T+/T- 레일에. 없는 빵판(미니): 본체 위뱅크 열을 버스로.
 */
export function autoPlace(
  logical: LogicalCircuit,
  bb: BreadboardDef,
): CircuitModel {
  const cols = bb.cols;
  const occupied = new Set<string>(); // 점유된 빵판 홀(한 홀 하나 보장)

  // 레일 홀 풀(앞 열부터). 미니(레일 없음)는 빈 풀 → 전원 net 이 col 로 떨어진다.
  const railPool: Record<"T+" | "T-", string[]> = { "T+": [], "T-": [] };
  for (const h of getHoles(bb))
    if (h.kind === "rail" && (h.rail === "T+" || h.rail === "T-"))
      railPool[h.rail].push(h.id);
  railPool["T+"].sort((a, b) => colOfHole(a) - colOfHole(b));
  railPool["T-"].sort((a, b) => colOfHole(a) - colOfHole(b));

  // 본체 열 점유(부품 전용 열·버스 열이 안 겹치게 한곳에서 관리)
  const usedCol = new Array<boolean>(cols + 1).fill(false);
  const takeCol = (): number => {
    for (let c = 1; c <= cols; c++)
      if (!usedCol[c]) {
        usedCol[c] = true;
        return c;
      }
    throw new Error("autoPlace: 빵판 본체 열 부족");
  };
  const takeRun = (len: number): number => {
    for (let c = 1; c + len - 1 <= cols; c++) {
      let ok = true;
      for (let k = 0; k < len; k++) if (usedCol[c + k]) ok = false;
      if (ok) {
        for (let k = 0; k < len; k++) usedCol[c + k] = true;
        return c;
      }
    }
    throw new Error("autoPlace: 연속 빈 열 부족");
  };

  // (uid,pin) → net 역인덱스
  const netOf = new Map<string, LogicalNet>();
  for (const net of logical.nets)
    for (const t of net.terminals) netOf.set(`${t.uid}:${t.pin}`, net);

  // net → 물리 노드. 전원/접지는 단자가 보드 핀 수 이하면 핀 직결(버스·공급선 제거),
  // 많으면 레일(있으면) 또는 본체 버스 열.
  const hasRails = bb.hasRails !== false;
  const netNode = new Map<LogicalNet, NetNode>();
  for (const net of logical.nets) {
    if (net.board) {
      netNode.set(net, { kind: "board", pin: net.board });
      continue;
    }
    if (net.kind === "power" || net.kind === "ground") {
      const pool = SUPPLY_PINS[net.kind];
      if (net.terminals.length <= pool.length) {
        netNode.set(net, { kind: "pins", pins: [...pool] }); // 직결
        continue;
      }
      if (hasRails) {
        netNode.set(net, { kind: "rail", rail: net.kind === "power" ? "T+" : "T-" });
        continue;
      }
    }
    netNode.set(net, { kind: "col", col: takeCol() }); // 신호 또는 단자 많은 전원(미니)
  }

  /** 한 열(위뱅크 a-e)에서 빈 홀 하나 — 앞(a)부터. */
  const allocInCol = (col: number): string => {
    for (const r of UPPER_ROWS) {
      const id = `${r}${col}`;
      if (!occupied.has(id)) {
        occupied.add(id);
        return id;
      }
    }
    throw new Error(`autoPlace: 열 ${col} 홀 부족(한 노드 5단자 초과)`);
  };
  /** net 의 다음 빈 연결 홀 — 노드 종류별. 보드 핀은 점유 추적 안 함(신호 단자 1개 가정). */
  const allocNet = (net: LogicalNet): string => {
    const node = netNode.get(net)!;
    if (node.kind === "board") return node.pin;
    if (node.kind === "pins") {
      const p = node.pins.shift(); // 단자마다 다른 보드 전원핀
      if (!p) throw new Error("autoPlace: 보드 전원핀 부족");
      return p;
    }
    if (node.kind === "rail") {
      for (const id of railPool[node.rail])
        if (!occupied.has(id)) {
          occupied.add(id);
          return id;
        }
      throw new Error("autoPlace: 레일 홀 부족");
    }
    return allocInCol(node.col);
  };

  const parts: PlacedPart[] = [];
  const wires: Wire[] = [];
  let wid = 0;

  const freeCount = logical.parts.filter(
    (p) => PARTS[p.defId]?.mount === "free",
  ).length;
  let freeIdx = 0;
  const frontZ = boardDimensions(bb).width / 2 + 20; // 보드 앞 20mm

  for (const lp of logical.parts) {
    const def = PARTS[lp.defId];
    if (!def) continue;
    const netAt = (i: number) => netOf.get(`${lp.uid}:${i}`);

    if (def.mount === "free") {
      // 리드 = 각 핀 net 노드의 빈 홀(서로 다른 홀). 점퍼 wire 0개.
      const leads = def.pins.map((_, i) => {
        const net = netAt(i);
        return net ? allocNet(net) : null;
      });
      const x = (freeIdx - (freeCount - 1) / 2) * 30; // 보드 앞 가로 분산
      freeIdx += 1;
      parts.push({
        uid: lp.uid,
        defId: lp.defId,
        pinHoles: [],
        orientation: 0,
        anchorHoleId: "",
        mount: "free",
        bodyPos: { x, z: frontZ },
        leads,
      });
    } else {
      // board: 부품 전용 연속 열 확보 → 다리는 e행, 점퍼는 같은 열 앞쪽(a행)
      const run = (def.pins.length - 1) * def.span + 1;
      const anchor = `e${takeRun(run)}`;
      const pinHoles = computePinHoles(lp.defId, anchor, 0);
      if (!pinHoles) continue;
      pinHoles.forEach((h) => occupied.add(h)); // 다리 홀 점유
      parts.push({
        uid: lp.uid,
        defId: lp.defId,
        pinHoles,
        orientation: 0,
        anchorHoleId: anchor,
      });
      // 각 핀: 같은 열 앞쪽 빈 홀(near) ↔ net 노드 빈 홀(far) 점퍼
      pinHoles.forEach((legHole, i) => {
        const net = netAt(i);
        if (!net) return;
        const near = allocInCol(colOfHole(legHole)); // 다리(e행)와 다른 홀(a행부터)
        const far = allocNet(net);
        wires.push({ id: `w${(wid += 1)}`, a: near, b: far });
      });
    }
  }

  // 레일/버스 열로 모은 전원/접지 net 에만 보드 전원 핀을 공급(이게 빠지면 전기가 안 들어옴).
  // pins 직결 net 은 단자가 이미 보드 핀에 있으니 공급선 불필요(선 절감의 핵심).
  for (const net of logical.nets) {
    if (net.kind !== "power" && net.kind !== "ground") continue;
    const node = netNode.get(net)!;
    if (node.kind !== "rail" && node.kind !== "col") continue;
    const feed = SUPPLY_PINS[net.kind][0]; // 공급원 핀(AD_5V / AD_GND_P1)
    const hole = allocNet(net); // 노드의 또 다른 빈 홀
    wires.push({ id: `w${(wid += 1)}`, a: feed, b: hole });
  }

  return { parts, wires };
}
