/** 점퍼선 — CatmullRomCurve3 + TubeGeometry, y축으로 띄운 곡선 (ARCHITECTURE 계약). */
import * as THREE from "three";
import { POLARITY, MAT } from "./theme3d";

export interface WireColors {
  red: number;
  blue: number;
  neutral: number;
}
export const WIRE_COLOR = {
  red: POLARITY.red,
  blue: POLARITY.blue,
  neutral: POLARITY.neutral,
};

/**
 * 두 끝점 사이에 띄운 선 메시. 끝 단자 캡(홀에 꽂힌 느낌)은 양끝 개별 제어.
 * 홀-홀 점퍼=양끝 캡(기본), 서보 피그테일=캡 없음, 점퍼(커넥터→홀)=홀 쪽만.
 */
export function buildWire(
  a: THREE.Vector3,
  b: THREE.Vector3,
  color: number = WIRE_COLOR.neutral,
  opts?: { capA?: boolean; capB?: boolean; radius?: number },
): THREE.Mesh {
  const dist = a.distanceTo(b);
  const lift = Math.min(2 + dist * 0.22, 16); // 길수록 더 띄움, 상한
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += lift;
  const c1 = a.clone().lerp(mid, 0.5);
  c1.y += lift * 0.4;
  const c2 = b.clone().lerp(mid, 0.5);
  c2.y += lift * 0.4;

  const curve = new THREE.CatmullRomCurve3([a, c1, mid, c2, b]);
  const segs = Math.max(12, Math.round(dist));
  const geo = new THREE.TubeGeometry(curve, segs, opts?.radius ?? 0.85, 8, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "wire";
  // 양 끝 단자 캡 (홀에 꽂힌 느낌)
  const capGeo = new THREE.CylinderGeometry(0.95, 0.95, 2, 10);
  const capMat = new THREE.MeshStandardMaterial({
    color: MAT.metalCap,
    roughness: 0.4,
    metalness: 0.6,
  });
  const capEnds: THREE.Vector3[] = [];
  if (opts?.capA ?? true) capEnds.push(a);
  if (opts?.capB ?? true) capEnds.push(b);
  for (const p of capEnds) {
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(p.x, 0, p.z);
    mesh.add(cap);
  }
  return mesh;
}
