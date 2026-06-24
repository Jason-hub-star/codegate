/**
 * 안전한 회로 합성 유틸 (M5) — 결정론적 부품 배치 + 겹침 검증.
 * MCP generate_circuit 토대. 자연어→spec 매핑은 MCP 레이어(범위 밖).
 * DEC-024(M5 설계)
 */

import { computePinHoles, PARTS, partEndpoints } from "./parts";
import type { CircuitModel, PlacedPart, Wire } from "./types";

/**
 * 부품 배치 사양 — MCP에서 받을 spec 형태.
 * 결정론 uid 부여를 위해 defId·anchor·orientation 만 사용.
 */
export interface PartSpec {
  defId: string;
  anchor: string;
  orientation?: 0 | 1;
}

/**
 * 합성 결과 판별 유니온 (throw 없음).
 */
export type SynthesisResult =
  | { ok: true; model: CircuitModel }
  | { ok: false; error: string };

/**
 * 보드 부품의 모든 점유 홀을 모은 집합.
 * - 보드 부품(mount !== "free"): pinHoles
 * - 보드밖 부품(mount === "free"): leads의 non-null 요소 (점퍼 끝점)
 * 점퍼선 끝점(a5, e5 등)은 이미 부품 핀 점유에 포함되므로 별도 처리 불필요.
 */
export function occupiedHoles(model: CircuitModel): Set<string> {
  const occupied = new Set<string>();

  for (const part of model.parts) {
    const eps = partEndpoints(part);
    for (const hole of eps) {
      if (hole) occupied.add(hole);
    }
  }

  return occupied;
}

/**
 * 새 부품의 핀 홀이 기존 점유 홀과 겹치는지 판정.
 * 같은 부품 내 자기 핀끼리 겹치는 건 computePinHoles가 null로 반환했을 것이므로
 * 여기선 이미 배치된 부품과의 겹침만 체크.
 */
function wouldOverlap(
  newPinHoles: string[],
  occupiedSet: Set<string>,
): boolean {
  for (const hole of newPinHoles) {
    if (occupiedSet.has(hole)) {
      return true;
    }
  }
  return false;
}

/**
 * 부품 spec 목록을 순서대로 배치하여 CircuitModel을 생성.
 * - 경계 밖 anchor → error
 * - 기존 배치와 겹침 → error
 * - 결정론 uid: "${defId}${n}" (같은 defId 등장 순서)
 * - 전역 _uid 사용 금지
 * - 선택적으로 wires 통합
 *
 * @param partSpecs 부품 배치 사양 배열
 * @param wires 점퍼선 배열 (선택)
 * @returns 성공 시 { ok: true, model }, 실패 시 { ok: false, error }
 */
export function synthesizeCircuit(
  partSpecs: PartSpec[],
  wires: Wire[] = [],
): SynthesisResult {
  const parts: PlacedPart[] = [];
  const occupied = new Set<string>();
  const defIdCount = new Map<string, number>(); // defId별 count

  for (const spec of partSpecs) {
    const { defId, anchor, orientation = 0 } = spec;

    // 부품 정의 존재 확인
    if (!PARTS[defId]) {
      return {
        ok: false,
        error: `미등록 부품: ${defId}`,
      };
    }

    // pinHoles 계산
    const pinHoles = computePinHoles(defId, anchor, orientation);
    if (!pinHoles) {
      return {
        ok: false,
        error: `배치 불가: ${defId}@${anchor} (경계 밖 또는 유효하지 않은 anchor)`,
      };
    }

    // 겹침 검증
    if (wouldOverlap(pinHoles, occupied)) {
      return {
        ok: false,
        error: `겹침 오류: ${defId}@${anchor}의 핀이 기존 부품과 충돌`,
      };
    }

    // 결정론 uid: "${defId}${n}" (같은 defId의 n번째)
    const count = (defIdCount.get(defId) ?? 0) + 1;
    defIdCount.set(defId, count);
    const uid = `${defId}${count}`;

    // 부품 추가
    const placed: PlacedPart = {
      uid,
      defId,
      pinHoles,
      orientation,
      anchorHoleId: anchor,
    };

    parts.push(placed);

    // 점유 홀 업데이트
    for (const hole of pinHoles) {
      occupied.add(hole);
    }
  }

  return {
    ok: true,
    model: {
      parts,
      wires,
    },
  };
}
