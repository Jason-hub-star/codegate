/**
 * GLB 부품 빌더 — render.kind === "glb" 부품을 핀 홀 footprint 에 배치.
 *
 * 절차 부품(buildPartMesh→BUILDERS)과 달리 모델이 고정 형상이라:
 *  1) url 1회 fetch→캐시(loadGlbSource), 인스턴스는 clone.
 *  2) 핀 홀 centroid 에 그룹, 모델은 핀축 각도로 회전(orientation 따라감), 바닥 y=0 안착.
 *  3) geometry 는 인스턴스마다 복제(머티리얼은 공유) — clearGroup 의 geometry dispose 가
 *     캐시 소스를 망가뜨리지 않도록.
 *
 * 정밀 핀보정(arduino식 CALIB_TARGETS)은 빵판 부품엔 과함 — footprint 배치로 충분(DEC-030).
 */
import * as THREE from "three";
import type { PartDef } from "@/features/circuit";
import { ASSET_CREDITS } from "@/lib/assetCredits";
import { loadGlbSource, getGlbSourceSync } from "./loadGlb";
import { MAT } from "./theme3d";

/** assetId → public GLB 경로 (assetCredits SSOT 조인) */
const URL_BY_ID = new Map(ASSET_CREDITS.map((a) => [a.id, a.glb]));

export interface GlbPartSpec {
  scaleLen: number; // 가장 긴 수평 치수(mm) — 균일 스케일(비율 보존)
  yLift?: number; // 보드 위로 올리기(mm, 음수=박아넣기)
  rotationY?: number; // 모델 기본 정면 보정(rad) — 핀축 회전에 가산
}

const DEFAULT_SPEC: GlbPartSpec = { scaleLen: 18, yLift: 0, rotationY: 0 };

/**
 * assetId 별 변환 보정 — 없으면 DEFAULT_SPEC ("부품 추가 = 항목 하나" 유지).
 * scaleLen 만 대략 실측, 미세 정렬(rotationY·yLift)은 실제 화면 보며 데이터로 튜닝.
 */
// scaleLen = 모델 실척(GLB는 미터 제작 → ×1000한 mm). /measure-glb 측정값(2026-06-20):
// 모델 자체가 실측 크기라 max(x,z)_mm 를 그대로 쓰면 실물 비율로 렌더된다.
export const GLB_PART_SPECS: Record<string, GlbPartSpec> = {
  dht11: { scaleLen: 24 },
  "pir-presence": { scaleLen: 25 },
  ldr: { scaleLen: 16 },
  "oled-ssd1306": { scaleLen: 35 },
  "buzzer-piezo": { scaleLen: 12 },
  "pot-bourns": { scaleLen: 10 },
  "servo-mg923b": { scaleLen: 37 },
};

const PLACEHOLDER_MAT = new THREE.MeshStandardMaterial({
  color: MAT.metalCap, // 중립 회색 = "로딩 프록시"
  roughness: 0.7,
  metalness: 0.1,
});

export function glbSpecFor(assetId: string): GlbPartSpec {
  return GLB_PART_SPECS[assetId] ?? DEFAULT_SPEC;
}

/** assetId → public GLB 경로 (리드 보정이 seatModel 오프셋을 읽을 때 공용) */
export function glbUrlFor(assetId: string): string | undefined {
  return URL_BY_ID.get(assetId);
}

function centroid(pts: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  pts.forEach((p) => c.add(p));
  return c.multiplyScalar(1 / Math.max(1, pts.length));
}

/** 핀축 각도(첫→끝 핀) — orientation(가로/세로)에 따라 모델·박스가 함께 회전 */
function axisAngle(pins: THREE.Vector3[]): number {
  if (pins.length < 2) return 0;
  const a = pins[0];
  const b = pins[pins.length - 1];
  return Math.atan2(b.z - a.z, b.x - a.x);
}

/** 로딩/폴백용 프록시 박스 — footprint 길이에 맞춘 중립 박스 */
function placeholderBox(
  footprintLen: number,
  yLift: number,
  rotY: number,
): THREE.Mesh {
  const w = Math.max(footprintLen, 6);
  const h = 6;
  const d = 8;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), PLACEHOLDER_MAT);
  box.position.y = yLift + h / 2;
  box.rotation.y = rotY;
  return box;
}

/** geometry 만 dispose(머티리얼은 공유 자원이라 보존) */
function disposeGeom(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}

interface BuildOpts {
  /** false 면 미캐시 시 GLB 비동기 로드를 트리거하지 않음(고스트: hover churn 방지) */
  load?: boolean;
}

/** GLB 부품 인스턴스(Group). 미캐시면 프록시 박스 → (load 시) 비동기 교체. */
export function buildGlbPart(
  def: PartDef,
  pins: THREE.Vector3[],
  opts?: BuildOpts,
): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `part:${def.id}`;
  const c = centroid(pins);
  group.position.set(c.x, 0, c.z);

  const assetId = def.render.kind === "glb" ? def.render.assetId : "";
  const url = URL_BY_ID.get(assetId);
  const spec = glbSpecFor(assetId);
  const yLift = spec.yLift ?? 0;
  const rotY = (spec.rotationY ?? 0) - axisAngle(pins);
  const fp = pins.length > 1 ? pins[0].distanceTo(pins[pins.length - 1]) : 5;

  // 소스 clone → geometry 인스턴스 복제 → 배치
  const mount = (src: THREE.Object3D): THREE.Object3D => {
    const inst = src.clone(true);
    inst.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry = m.geometry.clone();
    });
    inst.position.y = yLift;
    inst.rotation.y = rotY;
    return inst;
  };

  if (!url) {
    group.add(placeholderBox(fp, yLift, rotY));
    return group;
  }

  const src = getGlbSourceSync(url);
  if (src) {
    group.add(mount(src)); // 따뜻한 캐시 → 즉시(깜빡임 0)
    return group;
  }
  if (src === null) {
    group.add(placeholderBox(fp, yLift, rotY)); // 로드 실패 확정 → 박스
    return group;
  }

  // 미로드: 프록시 먼저, (load 시) 비동기 로드 후 교체
  const ph = placeholderBox(fp, yLift, rotY);
  group.add(ph);
  if (opts?.load !== false) {
    loadGlbSource(url, { scaleLen: spec.scaleLen, removeFloor: true }).then(
      (loaded) => {
        if (!group.parent) return; // 그 사이 재동기화로 떨어져 나감 → 무시
        group.remove(ph);
        disposeGeom(ph);
        group.add(loaded ? mount(loaded) : placeholderBox(fp, yLift, rotY));
      },
    );
  }
  return group;
}
