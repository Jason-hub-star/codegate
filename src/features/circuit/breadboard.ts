/**
 * 빵판 레이아웃 — 순수 도메인 정본 (React/Three/LLM 의존 0)
 *
 * 3D 렌더(breadboard-3d)와 전기 연결 그래프(net.ts)가 **같은 좌표·노드 정의**를
 * 공유하도록 여기 한 곳에서 정의한다. (DEC-013 하프 빵판 1종 고정)
 *
 * 좌표계: mm 단위, 빵판 윗면 중심이 원점(0,0). x=길이(열), z=폭(행), y=높이.
 * 정밀도 책임은 이 그리드 + 스냅 round(v/2.54)*2.54 (DEC-003).
 */

/** 홀 간격 (mm) — 2.54mm = 0.1인치 표준 */
export const PITCH = 2.54;

/**
 * 빵판 종류 레지스트리 (SSOT) — 하프/풀의 유일한 차이는 열 개수(COLS).
 * 행(a–j 10행)·레일·PITCH·홀 id 체계는 공통이라 cols 만 다르면 모든 파생이 따라온다.
 * 빵판 추가 = 여기 한 항목(+ BreadboardId 1줄). 카탈로그·썸네일·스왑 UI가 이걸 파생(DEC-030).
 */
export type BreadboardId = "half" | "full" | "mini";
export interface BreadboardDef {
  id: BreadboardId;
  label: string;
  /** 본체 열 개수 (1..cols) */
  cols: number;
  /** 대략 tie-point 수 (표시용) */
  tiePoints: number;
  /**
   * 전원 레일(T+/T-/B+/B−) 유무. 기본 true(half/full). 미니 빵판은 레일이 없어
   * false — getHoles 가 레일 홀을 안 깔고, 렌더는 스트라이프를 생략, boardDimensions 는
   * 본체 가장 바깥 행(a)을 폭 기준으로 쓴다. 레일 없는 빵판에선 본체 열을 전원 버스로.
   */
  hasRails?: boolean;
}
export const BREADBOARDS: Record<BreadboardId, BreadboardDef> = {
  half: { id: "half", label: "하프 빵판 (400홀)", cols: 30, tiePoints: 400 },
  full: { id: "full", label: "풀 빵판 (830홀)", cols: 63, tiePoints: 830 },
  mini: { id: "mini", label: "미니 빵판 (170홀)", cols: 17, tiePoints: 170, hasRails: false },
};

/**
 * 현재 활성 빵판 (작업대 스왑 시 setActiveBreadboard 로 교체). 회로 초기화와 함께 바뀜.
 * ★ UI(브라우저·단일 사용자) 편의용 기본값일 뿐 — diagnose/buildNet 등 순수 함수는
 *   빵판을 인자로 받을 수 있어 MCP 동시요청은 이 전역에 의존하지 않는다(요청간 독립).
 */
let _active: BreadboardDef = BREADBOARDS.half;
/** 활성 빵판 정의 (인자 미지정 함수의 기본값) */
export const activeBreadboard = (): BreadboardDef => _active;
/**
 * 활성 빵판 교체 — UI 스왑 전용. 캐시는 id별 키라 무효화 불필요(레이아웃은 id당 불변).
 * MCP/서버 진입점은 이 함수를 호출하지 않고 함수 인자로 빵판을 명시한다(동시요청 오염 방지).
 */
export function setActiveBreadboard(id: BreadboardId): void {
  _active = BREADBOARDS[id];
}

/** 행 문자 a..j (a-e = 위 뱅크, f-j = 아래 뱅크, 중앙 홈으로 분리) */
export const ROW_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"] as const;
export type RowLetter = (typeof ROW_LETTERS)[number];

/** 전원 레일 식별자: Top/Bottom × +(Plus)/−(Minus) */
export type Rail = "T+" | "T-" | "B+" | "B-";
export const RAILS: Rail[] = ["T+", "T-", "B+", "B-"];

export type HoleKind = "main" | "rail";

export interface Hole {
  /** 고유 id. main: 'e5' (행문자+열) / rail: 'T+_5' (레일_열) */
  id: string;
  kind: HoleKind;
  /** 본체 홀: 열 번호 1..30 / 레일 홀: 정렬된 열 번호 */
  col: number;
  /** 본체 홀에만: 행 문자 a..j */
  row?: RowLetter;
  /** 레일 홀에만: 어느 레일인가 */
  rail?: Rail;
  /** 윗면 기준 월드 좌표 (mm) */
  x: number;
  z: number;
}

const RAVINE_HALF = PITCH; // 중앙 홈 반폭 → e와 f 사이 간격 = 2*PITCH

/** 열 번호 → x (mm), 중앙 정렬 (빵판 열수 기준, 기본=활성 빵판) */
export function colX(col: number, bb: BreadboardDef = activeBreadboard()): number {
  return (col - (bb.cols + 1) / 2) * PITCH;
}

/** 행 인덱스(0..9) → z (mm). a..e 는 +z, f..j 는 -z, 중앙 홈으로 분리 */
function rowZ(index: number): number {
  if (index <= 4) {
    // a(0)..e(4): e가 홈에 가장 가깝게
    return RAVINE_HALF + (4 - index) * PITCH;
  }
  // f(5)..j(9): f가 홈에 가장 가깝게 (-z)
  return -(RAVINE_HALF + (index - 5) * PITCH);
}

/** a 행의 z (윗 뱅크 가장 바깥) — 레일 배치 기준 */
const TOP_BANK_EDGE_Z = rowZ(0);

/**
 * 레일 z 위치 (본체 바깥). 참고 이미지 규약: 위·아래 모두 파랑(−) 안쪽 / 빨강(+) 바깥쪽
 * → 보드 전체 위→아래 = −, +, [본체], −, +
 */
function railZ(rail: Rail): number {
  switch (rail) {
    case "T-": // 위 바깥 (파랑 −)
      return TOP_BANK_EDGE_Z + 3 * PITCH;
    case "T+": // 위 안쪽 (빨강 +)
      return TOP_BANK_EDGE_Z + 2 * PITCH;
    case "B-": // 아래 안쪽 (파랑 −)
      return -(TOP_BANK_EDGE_Z + 2 * PITCH);
    case "B+": // 아래 바깥 (빨강 +)
      return -(TOP_BANK_EDGE_Z + 3 * PITCH);
  }
}

/**
 * 레일 홀이 존재하는 열인지. 실제 빵판처럼 5개씩 묶고 6번째를 비워 그룹감을 준다.
 * (col-1)%6 === 5 인 열은 빈칸 → 30열 중 25홀.
 */
function railHasHole(col: number): boolean {
  return (col - 1) % 6 !== 5;
}

/** 레일 색 스트라이프 z (홀 줄 바로 바깥, 보드 가장자리 쪽) — 3D 렌더용 */
export function railZForStripe(rail: Rail): number {
  const z = railZ(rail);
  return z + (z > 0 ? 0.95 : -0.95);
}

/** 모든 홀 생성 (본체 300 + 레일 100 = 400 tie-point 급, 기본=활성 빵판) */
export function getHoles(bb: BreadboardDef = activeBreadboard()): Hole[] {
  const holes: Hole[] = [];
  const cols = bb.cols;

  // 본체 a..j × 1..cols
  for (let col = 1; col <= cols; col++) {
    ROW_LETTERS.forEach((row, idx) => {
      holes.push({
        id: `${row}${col}`,
        kind: "main",
        col,
        row,
        x: colX(col, bb),
        z: rowZ(idx),
      });
    });
  }

  // 레일 4종 (레일 없는 빵판=미니는 생략 — 본체 홀만)
  if (bb.hasRails !== false) {
    for (const rail of RAILS) {
      const z = railZ(rail);
      for (let col = 1; col <= cols; col++) {
        if (!railHasHole(col)) continue;
        holes.push({
          id: `${rail}_${col}`,
          kind: "rail",
          col,
          rail,
          x: colX(col, bb),
          z,
        });
      }
    }
  }

  return holes;
}

/** id → Hole 맵 캐시 — 빵판 id별(레이아웃은 id당 불변이라 동시요청 안전). */
const _holeMapCache = new Map<BreadboardId, Map<string, Hole>>();
/** id → Hole 조회 맵 (지연 생성·id별 캐시, 기본=활성 빵판) */
export function getHoleMap(bb: BreadboardDef = activeBreadboard()): Map<string, Hole> {
  let m = _holeMapCache.get(bb.id);
  if (!m) {
    m = new Map(getHoles(bb).map((h) => [h.id, h]));
    _holeMapCache.set(bb.id, m);
  }
  return m;
}

/** 본체 홀 id (row,col) 유효하면 반환, 아니면 null (기본=활성 빵판) */
export function mainHoleId(
  row: RowLetter,
  col: number,
  bb: BreadboardDef = activeBreadboard(),
): string | null {
  if (col < 1 || col > bb.cols) return null;
  return `${row}${col}`;
}

/** 빵판 외곽 치수 (mm) — 홀 분포 + 여백에서 산출 (기본=활성 빵판) */
export function boardDimensions(bb: BreadboardDef = activeBreadboard()) {
  const margin = 3.2;
  // 가장 바깥 레일 + 여백. 레일 없는 빵판(미니)은 가장 바깥 본체 행(a)이 폭 기준.
  const halfWidthZ = (bb.hasRails !== false ? railZ("T-") : TOP_BANK_EDGE_Z) + margin;
  const halfLengthX = colX(bb.cols, bb) + margin;
  return {
    length: halfLengthX * 2, // x
    width: halfWidthZ * 2, // z
    height: 8.5, // y
  };
}

/**
 * 전기적 노드 id (M3 net 에서 사용) — "어떤 홀들이 한 노드인가"의 정본.
 * - 본체: 같은 열의 a-e(위 뱅크)가 한 노드, f-j(아래 뱅크)가 한 노드 (중앙 홈 분리)
 * - 레일: 한 레일 전체가 한 노드
 */
export function nodeIdForHole(hole: Hole): string {
  if (hole.kind === "rail") return `RAIL_${hole.rail}`;
  const bank = hole.row && "abcde".includes(hole.row) ? "T" : "B";
  return `COL${hole.col}_${bank}`;
}
