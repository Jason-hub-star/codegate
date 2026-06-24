/**
 * DEC-026 렌더 어댑터 — 도메인 verdict 를 Three.js 머티리얼 상태로 변환한다.
 * 전류 흐름·WebSerial 이 붙어도 이 얇은 경계만 확장한다.
 */
import * as THREE from "three";
import type { EnergizedRails, Rail, Verdict } from "@/features/circuit";
import { MAT, POLARITY, TOKEN } from "./theme3d";

export interface WorkingVisualState {
  workingLedUids: Set<string>;
  energizedRails: EnergizedRails;
}

export function visualStateFromVerdict(
  verdict: Verdict | null,
): WorkingVisualState {
  return {
    workingLedUids: new Set(verdict?.workingLedUids ?? []),
    energizedRails: verdict?.energizedRails ?? {},
  };
}

export function setLedDomeState(root: THREE.Object3D, on: boolean): void {
  root.traverse((obj) => {
    if (obj.userData.visualRole !== "led-dome") return;
    const mesh = obj as THREE.Mesh;
    const mat = mesh.material;
    const materials = Array.isArray(mat) ? mat : [mat];
    for (const m of materials) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue;
      m.color.setHex(on ? TOKEN.ok : MAT.ledDome);
      m.emissive.setHex(on ? TOKEN.ok : 0x000000);
      m.emissiveIntensity = on ? 0.45 : 0;
      m.opacity = on ? 0.95 : 0.85;
      m.needsUpdate = true;
    }
  });
}

export function setRailStripeState(
  mesh: THREE.Object3D,
  rail: Rail,
  energized: EnergizedRails[Rail],
): void {
  const target = mesh as THREE.Mesh;
  const mat = target.material;
  if (!(mat instanceof THREE.MeshStandardMaterial)) return;

  const base = rail.includes("+") ? TOKEN.error : POLARITY.blue;
  const color =
    energized === "power"
      ? TOKEN.error
      : energized === "ground"
        ? POLARITY.blue
        : energized === "short"
          ? TOKEN.amber
          : base;

  mat.color.setHex(color);
  mat.emissive.setHex(energized ? color : 0x000000);
  mat.emissiveIntensity = energized ? 0.18 : 0;
  mat.roughness = energized ? 0.42 : 0.6;
  mat.needsUpdate = true;
}
