/**
 * free 부품 기하(리드·앵커)의 순수 geometry 헬퍼.
 * 클로저 상태 비의존 — 모든 행렬을 명시 파라미터로 스레드.
 */
import * as THREE from "three";
import { PARTS, PITCH, getCalibration } from "@/features/circuit";
import { glbSpecFor, glbUrlFor } from "../glbParts";
import { getGlbSourceSync } from "../loadGlb";

export const LEAD_OUT = 8; // 바깥 방향(mm)
export const LEAD_Y = 1.5; // 커넥터/핀 높이(보드 바로 위) — 출구가 핀 하단에 오도록

/**
 * free 본체 합성 핀(보드 옆, PITCH 간격). rot=90°×n 으로 핀축 회전 →
 * buildGlbPart 의 axisAngle 가 모델을 따라 돌린다(별도 yaw 불필요).
 */
export const freeBodyPins = (
  defId: string,
  bodyPos: { x: number; z: number },
  rot: 0 | 1 | 2 | 3,
  bbMatrix: THREE.Matrix4,
): THREE.Vector3[] => {
  const n = PARTS[defId]?.pins.length ?? 0;
  const a = (rot * Math.PI) / 2;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return Array.from({ length: n }, (_, i) => {
    const t = (i - (n - 1) / 2) * PITCH;
    return new THREE.Vector3(
      bodyPos.x + cos * t,
      0,
      bodyPos.z + sin * t,
    ).applyMatrix4(bbMatrix); // free 본체도 빵판 pose 따라감
  });
};

/**
 * 본체(GLB) 변환 기준 — `buildGlbPart` 와 **동일한 배치/회전**을 재현한다.
 * 본체는 group.position=centroid(합성핀), inst.rotation.y=spec.rotationY-axisAngle(합성핀),
 * inst.position.y=yLift 로 렌더되므로, 리드도 이 변환을 그대로 써야 회전·빵판 pose 와
 * 무관하게 항상 본체에 붙는다(단순 R(-rot·90°)는 빵판 yaw·spec 차이에서 어긋남).
 * ⚠️ glbParts.buildGlbPart 와 좌표 계약 공유 — 한쪽 바뀌면 같이 갱신.
 */
const leadBasis = (
  defId: string,
  bodyPos: { x: number; z: number },
  rot: 0 | 1 | 2 | 3,
  bbMatrix: THREE.Matrix4,
): { centroid: THREE.Vector3; rotY: number; yLift: number; seat: THREE.Vector3 } => {
  const def = PARTS[defId];
  const assetId = def?.render.kind === "glb" ? def.render.assetId : "";
  const bp = freeBodyPins(defId, bodyPos, rot, bbMatrix); // world 합성 핀
  const centroid = new THREE.Vector3();
  bp.forEach((p) => centroid.add(p));
  centroid.multiplyScalar(1 / Math.max(1, bp.length));
  centroid.y = 0; // buildGlbPart: group.position.y=0
  const a = bp[0];
  const b = bp[bp.length - 1];
  const axis = bp.length >= 2 ? Math.atan2(b.z - a.z, b.x - a.x) : 0;
  const spec = glbSpecFor(assetId);
  // seatModel 이 모델을 bbox중심·바닥0 으로 옮긴 오프셋(src.position). 본체는 이걸
  // inst.position(회전 무관 평행이동)으로 적용하므로, 리드도 회전에서 제외해야 함.
  const url = glbUrlFor(assetId);
  const src = url ? getGlbSourceSync(url) : null;
  const seat = src ? src.position.clone() : new THREE.Vector3();
  return { centroid, rotY: (spec.rotationY ?? 0) - axis, yLift: spec.yLift ?? 0, seat };
};

/**
 * 리드선 시작점(3선 커넥터). 보정좌표(인스턴스 leadAnchors → CALIBRATIONS[assetId].pin{i})를
 * **본체와 동일 변환**(leadBasis)으로 배치 → GLB 실제 커넥터와 정렬, 회전·pose 무관 추종.
 * 미보정이면 freeBodyPins(합성)로 폴백 → 기존 동작 무회귀.
 */
export const freeLeadPins = (
  defId: string,
  bodyPos: { x: number; z: number },
  rot: 0 | 1 | 2 | 3,
  bbMatrix: THREE.Matrix4,
  anchors?: ([number, number, number] | null)[],
): THREE.Vector3[] => {
  const def = PARTS[defId];
  const n = def?.pins.length ?? 0;
  const assetId = def?.render.kind === "glb" ? def.render.assetId : "";
  const calib = assetId ? getCalibration(assetId) : {};
  // 우선순위: 인스턴스 leadAnchors → CALIBRATIONS[assetId] → (미보정 시 합성)
  const coords = Array.from(
    { length: n },
    (_, i) => anchors?.[i] ?? calib[`pin${i}`],
  );
  if (n === 0 || coords.some((c) => !c)) {
    return freeBodyPins(defId, bodyPos, rot, bbMatrix); // 미보정 폴백
  }
  const { centroid, rotY, yLift, seat } = leadBasis(defId, bodyPos, rot, bbMatrix);
  const yaw = new THREE.Matrix4().makeRotationY(rotY);
  // world = (centroid + seat) + R(rotY)·(calib − seat) — seat(=bbox중심 오프셋)는 회전 제외
  return coords.map((c) => {
    const off = new THREE.Vector3(
      c![0] - seat.x,
      c![1] - seat.y,
      c![2] - seat.z,
    ).applyMatrix4(yaw);
    return new THREE.Vector3(
      centroid.x + seat.x + off.x,
      yLift + off.y,
      centroid.z + seat.z + off.z,
    );
  });
};

/**
 * freeLeadPins 역변환: 월드 hit → 모델 로컬좌표(보정 저장용). leadBasis 와 짝.
 */
export const worldToLeadLocal = (
  hit: THREE.Vector3,
  defId: string,
  bodyPos: { x: number; z: number },
  rot: 0 | 1 | 2 | 3,
  bbMatrix: THREE.Matrix4,
): [number, number, number] => {
  const { centroid, rotY, yLift, seat } = leadBasis(defId, bodyPos, rot, bbMatrix);
  // freeLeadPins 역: calib = R(−rotY)·(hit − (centroid+seat)) + seat
  const rel = new THREE.Vector3(
    hit.x - centroid.x - seat.x,
    hit.y - yLift,
    hit.z - centroid.z - seat.z,
  ).applyMatrix4(new THREE.Matrix4().makeRotationY(-rotY));
  return [
    Math.round((rel.x + seat.x) * 100) / 100,
    Math.round((rel.y + seat.y) * 100) / 100,
    Math.round((rel.z + seat.z) * 100) / 100,
  ];
};

/**
 * 서보 피그테일(본체에서 나온 선) — 바깥 방향 살짝 + 보드 레벨로 내려옴.
 * 끝=암컷 커넥터(핀=연결 지점). 실물 서보처럼 선이 본체에서 나와 아래로 늘어진다.
 */
export const freeLeadEnds = (
  lp: THREE.Vector3[],
  bodyPos: { x: number; z: number },
  bbMatrix: THREE.Matrix4,
): THREE.Vector3[] => {
  const bodyWorld = new THREE.Vector3(
    bodyPos.x,
    0,
    bodyPos.z,
  ).applyMatrix4(bbMatrix);
  return lp.map((p) => {
    const dir = new THREE.Vector3(p.x - bodyWorld.x, 0, p.z - bodyWorld.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1); // 커넥터=중심 근처 → 기본 -z
    dir.normalize();
    return new THREE.Vector3(
      p.x + dir.x * LEAD_OUT,
      LEAD_Y, // 보드 레벨로 내려 핀이 선 하단에 위치
      p.z + dir.z * LEAD_OUT,
    );
  });
};
