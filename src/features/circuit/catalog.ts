/**
 * 컴포넌트 카탈로그 — 카테고리 메타 + 보드/빵판 픽스처 + 통합 목록 (DEC-030).
 * SSOT: 팔레트·씬·썸네일이 부품/보드/빵판 목록을 직접 하드코딩하지 않고 여기 + PART_LIST 에서 파생.
 * 새 카테고리/보드/빵판 = 여기 한 줄. 빈 카테고리는 팔레트가 자동으로 숨긴다.
 */
import type { CatalogItem, ComponentCategory, ComponentStatus } from "./types";
import { BREADBOARDS } from "./breadboard";
import { BOARDS } from "./board";
import { PART_LIST } from "./parts";

export interface CategoryMeta {
  id: ComponentCategory;
  label: string;
}

/** 팔레트 표시 순서 = 배열 순서 (학습 흐름: 보드→빵판→출력(LED)→입력→센서→수동) */
export const CATEGORIES: CategoryMeta[] = [
  { id: "board", label: "보드" },
  { id: "breadboard", label: "빵판" },
  { id: "output", label: "출력" },
  { id: "input", label: "입력" },
  { id: "sensor", label: "센서" },
  { id: "passive", label: "수동" },
];

/** 상태 칩 라벨 — ready 는 칩 없음(빈 문자열) */
export const STATUS_LABEL: Record<ComponentStatus, string> = {
  ready: "",
  active: "현재",
  "glb-pending": "준비 중",
  staged: "준비 중",
};

/**
 * 보드·빵판 픽스처 — 부품(PartDef)이 아니라 작업대 종류(3단계에서 스왑).
 * 지금은 카탈로그에 표시만(active=현재 적용, staged=보유·미적용).
 */
export const FIXTURES: CatalogItem[] = [
  // ── 보드 ── BOARDS 레지스트리에서 파생(추가=레지스트리 한 항목). 카드는 런타임 currentBoard 로 구동(BoardSwitcher)
  ...Object.values(BOARDS).map(
    (d): CatalogItem => ({
      id: `board-${d.id}`,
      label: d.label,
      category: "board",
      status: "ready", // 보드 카드 표시·현재 강조는 BoardSwitcher 가 currentBoard 로 처리
      render: d.render,
      description: `로직 ${d.logicV}V · ${d.pinDefs.length}핀. 작업대 전환으로 스왑.`,
    }),
  ),
  // ── 빵판 ── BREADBOARDS 레지스트리에서 파생(추가=레지스트리 한 항목, 라벨 드리프트 차단)
  ...Object.values(BREADBOARDS).map(
    (d): CatalogItem => ({
      id: `breadboard-${d.id}`,
      label: d.label,
      category: "breadboard",
      status: "ready", // 빵판 카드 표시는 런타임 currentBreadboard 로 구동(BreadboardSwitcher)
      render: { kind: "procedural", builder: `breadboard-${d.id}` },
      description: `${d.tiePoints} tie-point · 2.54mm 표준 그리드. 작업대 전환으로 스왑.`,
    }),
  ),
];

/** 팔레트 표시용 통합 목록 — 보드/빵판(픽스처) + 부품(PART_LIST). */
export const CATALOG: CatalogItem[] = [...FIXTURES, ...PART_LIST];
