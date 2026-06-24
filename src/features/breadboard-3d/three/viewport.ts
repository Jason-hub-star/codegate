/**
 * 카메라 뷰포트 제어 — 프리셋 전환·전체보기(fit)를 부드러운 트윈으로.
 * research/14 C: 순간이동 금지 → easeInOutCubic. createScene 의 onFrame 훅을 재사용.
 * React 비의존(순수) — 오버레이는 이 API 로만 카메라를 만진다.
 */
import * as THREE from "three";
import type { SceneHandle } from "./createScene";

export type ViewPreset = "front" | "top" | "iso" | "home";

export interface ViewportApi {
  /** 현재 각도 유지하며 콘텐츠가 화면에 꽉 차게 거리만 조정 */
  fit(): void;
  /** 정해진 시점으로 전환 */
  setView(p: ViewPreset): void;
}

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 카메라/타깃을 목표로 트윈. 진행 중 콜백 해제 함수 반환. */
function animateCamera(
  handle: SceneHandle,
  toPos: THREE.Vector3,
  toTarget: THREE.Vector3,
  ms = 600,
): () => void {
  handle.controls.autoRotate = false;
  const fromPos = handle.camera.position.clone();
  const fromTarget = handle.controls.target.clone();
  let t = 0;
  const stop = handle.onFrame((dt) => {
    t += (dt * 1000) / ms;
    const k = easeInOutCubic(Math.min(1, t));
    handle.camera.position.lerpVectors(fromPos, toPos, k);
    handle.controls.target.lerpVectors(fromTarget, toTarget, k);
    handle.controls.update();
    if (t >= 1) stop();
  });
  return stop;
}

/** 콘텐츠 박스 기준으로 뷰포트 API 생성 (board+arduino 영역). */
export function createViewportApi(
  handle: SceneHandle,
  box: THREE.Box3,
): ViewportApi {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 50;
  const fov = (handle.camera.fov * Math.PI) / 180;
  const dist = (radius / Math.sin(fov / 2)) * 1.15; // 약간의 여백

  let cancel: (() => void) | null = null;
  const go = (pos: THREE.Vector3, target: THREE.Vector3) => {
    cancel?.();
    cancel = animateCamera(handle, pos, target, 600);
  };

  const presetPos = (p: ViewPreset): THREE.Vector3 => {
    switch (p) {
      case "front":
        return center.clone().add(new THREE.Vector3(0, size.y * 0.35, dist));
      case "top":
        return center.clone().add(new THREE.Vector3(0, dist, 0.001));
      case "iso":
        return center
          .clone()
          .add(new THREE.Vector3(dist * 0.6, dist * 0.55, dist * 0.7));
      case "home":
      default:
        return center
          .clone()
          .add(new THREE.Vector3(dist * 0.55, dist * 0.5, dist * 0.85));
    }
  };

  return {
    fit: () => {
      const dir = handle.camera.position
        .clone()
        .sub(handle.controls.target)
        .normalize();
      if (dir.lengthSq() === 0) dir.set(0.55, 0.5, 0.85).normalize();
      go(center.clone().add(dir.multiplyScalar(dist)), center.clone());
    },
    setView: (p) => go(presetPos(p), center.clone()),
  };
}
