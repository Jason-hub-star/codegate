/** 핀 스냅 + 홀 월드 좌표. 정밀도 책임은 여기 (DEC-003). */
import * as THREE from "three";
import { PITCH, getHoleMap } from "@/features/circuit";

/** 2.54mm 그리드 스냅 */
export function snap(v: number): number {
  return Math.round(v / PITCH) * PITCH;
}

/** 홀 id → 월드 좌표 (윗면 y=0) */
export function holeWorldPos(holeId: string): THREE.Vector3 | null {
  const h = getHoleMap().get(holeId);
  if (!h) return null;
  return new THREE.Vector3(h.x, 0, h.z);
}

/** 임의 (x,z) 에 가장 가까운 홀 id (스냅 보조) */
export function nearestHoleId(x: number, z: number): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const h of getHoleMap().values()) {
    const d = (h.x - x) ** 2 + (h.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = h.id;
    }
  }
  return best;
}
