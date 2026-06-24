/**
 * 부품 명세(BOM) — 회로(model.parts)에서 자동 파생하는 집계 목록. 순수·결정론.
 * 단일 SSOT: UI 패널 · LLM 직렬화(serializeBom) · (미래)에이전트 툴콜이 모두 이 결과를 공유.
 * → 사람이 보는 명세 == AI가 읽는 명세 (드리프트 0). 독립 장바구니 상태 없음.
 */
import { PARTS } from "./parts";
import { CATEGORIES } from "./catalog";
import type {
  CircuitModel,
  ComponentCategory,
  OperatingV,
  Protocol,
} from "./types";

/** 부품 1종 집계 — 자기설명적(메타 포함, LLM이 다른 표 없이 이해) */
export interface BomItem {
  defId: string;
  label: string;
  count: number;
  /** 개별 인스턴스 uid (개체 지목·캔버스 핫링크용, 배치 순서) */
  uids: string[];
  category: ComponentCategory;
  operatingV?: OperatingV;
  protocol?: Protocol;
  needsResistor?: boolean;
  needsPullup?: boolean;
}

const CATEGORY_ORDER: ComponentCategory[] = CATEGORIES.map((c) => c.id);

/**
 * 회로에 놓인 부품을 종류(defId)별로 묶어 개수·메타와 함께 반환.
 * 정렬 = 카탈로그 카테고리 순 → 라벨(가나다). 결정론적이라 LLM 출력도 안정.
 */
export function buildBom(model: CircuitModel): BomItem[] {
  const byDef = new Map<string, BomItem>();
  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def) continue;
    const existing = byDef.get(p.defId);
    if (existing) {
      existing.count += 1;
      existing.uids.push(p.uid);
      continue;
    }
    byDef.set(p.defId, {
      defId: p.defId,
      label: def.label,
      count: 1,
      uids: [p.uid],
      category: def.category,
      operatingV: def.operatingV,
      protocol: def.protocol,
      needsResistor: def.needsResistor,
      needsPullup: def.needsPullup,
    });
  }
  return [...byDef.values()].sort((a, b) => {
    const ca = CATEGORY_ORDER.indexOf(a.category);
    const cb = CATEGORY_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.label.localeCompare(b.label, "ko");
  });
}
