/**
 * 전기 연결 그래프 — 순수 도메인 (DEC-016 핵심).
 * 점퍼선 = union-find 병합(같은 노드), 부품 = 노드 사이 간선(병합 X).
 * 전원 모델(M3.5): **실제 아두이노 핀**이 출처. 5V/3V3/VIN·디지털핀 = 전원원, GND핀 = 그라운드.
 * (레일은 더 이상 자동 전원 아님 — 5V핀↔레일을 점퍼로 이어야 전원이 들어온다)
 */
import { getHoleMap, nodeIdForHole, type BreadboardDef } from "./breadboard";
import { getBoardPins, isBoardPinId, type BoardDef } from "./board";
import { PARTS, partEndpoints } from "./parts";
import type { CircuitModel } from "./types";

/**
 * 회로 분석 컨텍스트 — 어떤 빵판/보드 위의 회로인가. 미지정 시 활성 싱글톤(UI 기본).
 * MCP/서버는 codec 에서 디코드한 빵판·보드를 명시 주입해 요청간 독립(동시요청 오염 방지).
 */
export interface CircuitContext {
  breadboard?: BreadboardDef;
  board?: BoardDef;
}

export interface PartEdge {
  uid: string;
  defId: string;
  isResistor: boolean;
  u: string;
  v: string;
  pinA: number;
  pinB: number;
  /** 릴레이 접점 간선 — 'no'(여자 시 도통)·'nc'(휴지 시 도통). 부하 회로가 접점 경유 완결. */
  relay?: "no" | "nc";
}

export interface NetGraph {
  find: (n: string) => string;
  powerRoots: Set<string>;
  groundRoots: Set<string>;
  nodeOfHole: (id: string) => string | null;
  partEdges: PartEdge[];
  reach: (
    start: string,
    targets: Set<string>,
    opts?: { excludeResistor?: boolean; excludeUid?: string },
  ) => boolean;
}

const POWER_ROLES = new Set(["power5", "power3v3", "vin", "digital", "pwm"]);

export function buildNet(model: CircuitModel, ctx: CircuitContext = {}): NetGraph {
  const parent = new Map<string, string>();
  const ensure = (n: string) => {
    if (!parent.has(n)) parent.set(n, n);
  };
  const find = (n: string): string => {
    ensure(n);
    let r = n;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let cur = n;
    while (parent.get(cur) !== r) {
      const next = parent.get(cur)!;
      parent.set(cur, r);
      cur = next;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  const holeMap = getHoleMap(ctx.breadboard);
  const pins = getBoardPins(ctx.board);

  // 엔드포인트(빵판 홀 | 보드 핀) → raw 노드 id
  const nodeOfRaw = (id: string): string | null => {
    if (isBoardPinId(id, ctx.board)) return id; // 핀 자체가 노드
    const h = holeMap.get(id);
    return h ? nodeIdForHole(h) : null;
  };

  // 아두이노 핀 노드 미리 생성
  for (const p of pins) ensure(p.id);

  // 점퍼선 → union
  for (const w of model.wires) {
    const na = nodeOfRaw(w.a);
    const nb = nodeOfRaw(w.b);
    if (na && nb) union(na, nb);
  }

  // 부품 도통쌍 → 간선
  const edges: PartEdge[] = [];
  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def) continue;
    const eps = partEndpoints(p); // board=pinHoles, free=leads (미연결=null)
    for (const [i, j] of def.conducts) {
      const ei = eps[i];
      const ej = eps[j];
      const ni = ei ? nodeOfRaw(ei) : null;
      const nj = ej ? nodeOfRaw(ej) : null;
      if (!ni || !nj) continue; // 끝점 미연결 → 간선 없음(자동 격리)
      edges.push({
        uid: p.uid,
        defId: p.defId,
        isResistor: p.defId === "resistor",
        u: find(ni),
        v: find(nj),
        pinA: i,
        pinB: j,
      });
    }
  }

  // 릴레이 접점 → 간선(병합 X). COM↔NO(여자)·COM↔NC(휴지) 둘 다 깔아 부하 회로가
  // 접점을 통해 완결되게 한다(단락 판정은 union 기반이라 거짓 단락 없음).
  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def?.relay) continue;
    const eps = partEndpoints(p);
    const nCom = eps[def.relay.com] ? nodeOfRaw(eps[def.relay.com]!) : null;
    if (!nCom) continue;
    for (const [pinIdx, contact] of [
      [def.relay.no, "no"],
      [def.relay.nc, "nc"],
    ] as const) {
      const ep = eps[pinIdx];
      const n = ep ? nodeOfRaw(ep) : null;
      if (!n) continue; // 접점 미연결 → 간선 없음
      edges.push({
        uid: p.uid,
        defId: p.defId,
        isResistor: false,
        u: find(nCom),
        v: find(n),
        pinA: def.relay.com,
        pinB: pinIdx,
        relay: contact,
      });
    }
  }

  // 전원/그라운드 루트 = 아두이노 핀 역할 기반
  const powerRoots = new Set<string>();
  const groundRoots = new Set<string>();
  for (const p of pins) {
    if (POWER_ROLES.has(p.role)) powerRoots.add(find(p.id));
    else if (p.role === "gnd") groundRoots.add(find(p.id));
  }

  const nodeOfHole = (id: string): string | null => {
    const n = nodeOfRaw(id);
    return n ? find(n) : null;
  };

  const reach = (
    start: string,
    targets: Set<string>,
    opts: { excludeResistor?: boolean; excludeUid?: string } = {},
  ): boolean => {
    const startR = find(start);
    if (targets.has(startR)) return true;
    const visited = new Set<string>([startR]);
    const queue = [startR];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of edges) {
        if (opts.excludeUid && e.uid === opts.excludeUid) continue;
        if (opts.excludeResistor && e.isResistor) continue;
        let nxt: string | null = null;
        if (e.u === cur) nxt = e.v;
        else if (e.v === cur) nxt = e.u;
        if (nxt && !visited.has(nxt)) {
          if (targets.has(nxt)) return true;
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }
    return false;
  };

  return { find, powerRoots, groundRoots, nodeOfHole, partEdges: edges, reach };
}
