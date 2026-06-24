/**
 * 범용 GLB 로더 — 스케일-투-핏 + 바닥 제거 + 바닥정렬(group/model y=0).
 * 아두이노/센서 등 모든 GLB 모델이 공유(보정 도구·씬 양쪽).
 *
 * 두 진입점:
 *  - loadGlbInto: group 에 직접 삽입(아두이노·/calibrate 처럼 1회 배치).
 *  - loadGlbSource: url 당 1회 fetch→캐시. 인스턴스는 clone 해서 씀(부품처럼 다수 배치).
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export interface LoadGlbOpts {
  scaleLen: number; // 가장 긴 수평 치수를 이 길이(mm)에 맞춤
  removeFloor?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  /**
   * (url+scaleLen+removeFloor) 당 1회 fetch·파싱·fit 후 clone 삽입(스왑마다 재파싱 방지).
   * 보드처럼 자주 재마운트되는 1-인스턴스 모델용. clearGroup(createScene.dispose) 가
   * 인스턴스 geometry 를 dispose 해도 캐시 소스가 안 깨지게 geometry 는 인스턴스마다 복제.
   */
  cache?: boolean;
}

// fit 된 소스 캐시 — 키 = url|scaleLen|removeFloor (보드 68.6 vs 썸네일 18 충돌 방지).
const fittedPending = new Map<string, Promise<THREE.Object3D | null>>();
const fitKey = (url: string, scaleLen: number, removeFloor?: boolean) =>
  `${url}|${scaleLen}|${removeFloor ? 1 : 0}`;

/** GLB 를 group 에 스케일·정렬해 삽입 (group 로컬 = 보정 좌표계). opts.cache=true 면 1회 파싱 후 clone. */
export function loadGlbInto(
  group: THREE.Group,
  url: string,
  opts: LoadGlbOpts,
): void {
  if (opts.cache) {
    const key = fitKey(url, opts.scaleLen, opts.removeFloor);
    let p = fittedPending.get(key);
    if (!p) {
      p = new Promise<THREE.Object3D | null>((resolve) => {
        new GLTFLoader().load(
          url,
          (gltf) => {
            if (opts.removeFloor) dropFloor(gltf.scene);
            fitModel(gltf.scene, opts.scaleLen);
            resolve(gltf.scene);
          },
          undefined,
          () => resolve(null),
        );
      });
      fittedPending.set(key, p);
    }
    p.then((src) => {
      if (!src) return opts.onError?.();
      const inst = src.clone(true); // 씬그래프 복제(머티리얼 공유=부품 선례)
      inst.traverse((o) => {
        const m = o as THREE.Mesh; // dispose 안전: geometry 만 인스턴스 복제
        if (m.isMesh && m.geometry) m.geometry = m.geometry.clone();
      });
      group.add(inst);
      opts.onLoad?.();
    });
    return;
  }

  const loader = new GLTFLoader();
  loader.load(
    url,
    (gltf) => {
      if (opts.removeFloor) dropFloor(gltf.scene);
      fitModel(gltf.scene, opts.scaleLen);
      group.add(gltf.scene);
      opts.onLoad?.();
    },
    undefined,
    () => opts.onError?.(),
  );
}

// ── 캐시 소스 로더 (부품: url 1회 fetch, 인스턴스마다 clone) ──
interface SourceOpts {
  scaleLen: number;
  removeFloor?: boolean;
}
const sourcePending = new Map<string, Promise<THREE.Object3D | null>>();
const sourceResolved = new Map<string, THREE.Object3D | null>();

/**
 * url 의 GLB 를 스케일·정렬한 "소스" Object3D 로 1회 로드(캐시). 실패 시 null.
 * 반환된 소스는 어떤 그룹에도 붙지 않은 원본 — 사용처는 clone 해서 씀.
 */
export function loadGlbSource(
  url: string,
  opts: SourceOpts,
): Promise<THREE.Object3D | null> {
  const cached = sourcePending.get(url);
  if (cached) return cached;

  const p = new Promise<THREE.Object3D | null>((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (opts.removeFloor) dropFloor(gltf.scene);
        fitModel(gltf.scene, opts.scaleLen);
        sourceResolved.set(url, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      () => {
        sourceResolved.set(url, null);
        resolve(null);
      },
    );
  });
  sourcePending.set(url, p);
  return p;
}

/** 이미 로드 완료된 소스를 동기 반환(없으면 undefined → 미로드). */
export function getGlbSourceSync(url: string): THREE.Object3D | null | undefined {
  return sourceResolved.get(url);
}

// ── raw 로더 (캘리브레이터: 스케일을 굽지 않고 라이브 제어) ──
export interface RawGlb {
  model: THREE.Object3D; // 스케일 1, xz중심·바닥 y=0 정렬됨
  baseLongest: number; // 스케일 전 수평 최장축(max x,z) — 라이브 스케일 기준
}

/**
 * GLB 를 스케일 없이 로드 → 바닥제거·중심정렬만 적용하고 baseLongest 측정.
 * 캘리브레이터가 model 을 outer 그룹에 담아 scaleLen/baseLongest 로 실시간 스케일.
 * (loadGlbInto/loadGlbSource 는 로드 시 scaleLen 을 bake 하므로 라이브 제어엔 부적합.)
 */
export function loadGlbRaw(
  url: string,
  opts?: { removeFloor?: boolean },
): Promise<RawGlb | null> {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (opts?.removeFloor) dropFloor(gltf.scene);
        const size = new THREE.Box3()
          .setFromObject(gltf.scene)
          .getSize(new THREE.Vector3());
        const baseLongest = Math.max(size.x, size.z) || 1;
        seatModel(gltf.scene); // xz중심·바닥 y=0 (스케일 1)
        resolve({ model: gltf.scene, baseLongest });
      },
      undefined,
      () => resolve(null),
    );
  });
}

// ── 공유 헬퍼 ──
function dropFloor(root: THREE.Object3D) {
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (/floor/i.test(o.name)) drop.push(o);
  });
  drop.forEach((o) => o.parent?.remove(o));
}

/** 가장 긴 수평 치수를 scaleLen 에 맞추고, xz 중심·바닥 y=0 정렬(균일 스케일=비율 보존). */
function fitModel(model: THREE.Object3D, scaleLen: number) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.z) || 1;
  model.scale.setScalar(scaleLen / longest);
  seatModel(model);
}

/** xz 중심·바닥 y=0 정렬 + 그림자 off (현재 스케일 기준). */
function seatModel(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box.min.y; // 바닥을 y=0 에

  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
}
