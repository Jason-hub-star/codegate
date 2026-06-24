/**
 * 부품 3D 메시 생성 — 핀 홀 좌표 배열을 받아 Object3D 반환.
 * DEC-024 품질바: 실린더·돔·베벨·PBR. 맨 큐브·평면 SVG 금지.
 */
import * as THREE from "three";
import { PARTS } from "@/features/circuit";
import { MAT, TOKEN } from "./theme3d";
import { buildGlbPart } from "./glbParts";

const LEG_MAT = new THREE.MeshStandardMaterial({
  color: MAT.metalLeg,
  roughness: 0.25,
  metalness: 0.9,
});
const LEG_R = 0.5; // 다리 반지름 (가시성)

function centroid(pts: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  pts.forEach((p) => c.add(p));
  return c.multiplyScalar(1 / pts.length);
}

/** 핀 홀에서 본체 아래까지 올라오는 다리 */
function leg(pin: THREE.Vector3, topY: number): THREE.Mesh {
  const h = Math.max(topY, 1);
  const geo = new THREE.CylinderGeometry(LEG_R, LEG_R, h, 10);
  const m = new THREE.Mesh(geo, LEG_MAT);
  m.position.set(pin.x, h / 2, pin.z);
  return m;
}

/** 임의 두 점을 잇는 가는 금속 리드(원기둥) */
function segment(from: THREE.Vector3, to: THREE.Vector3): THREE.Mesh {
  const len = from.distanceTo(to) || 0.01;
  const geo = new THREE.CylinderGeometry(LEG_R, LEG_R, len, 10);
  const m = new THREE.Mesh(geo, LEG_MAT);
  const dir = to.clone().sub(from).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  m.position.copy(from.clone().add(to).multiplyScalar(0.5));
  return m;
}

function buildLED(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 6.5;
  // 다리 (애노드 길게, 캐소드 짧게)
  g.add(leg(pins[0], bodyY));
  g.add(leg(pins[1], bodyY - 1.5));
  // 베이스 림
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.7, 1.4, 20),
    new THREE.MeshStandardMaterial({ color: MAT.ledBase, roughness: 0.5 }),
  );
  base.position.set(c.x, bodyY, c.z);
  g.add(base);
  // 돔 (반구, 반투명 — 글로우 아님)
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: MAT.ledDome,
      roughness: 0.25,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
    }),
  );
  dome.position.set(c.x, bodyY + 0.7, c.z);
  dome.scale.y = 1.6;
  dome.userData.visualRole = "led-dome";
  g.add(dome);
  return g;
}

function buildResistor(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const a = pins[0];
  const b = pins[1];
  const bodyY = 5.5;
  g.add(leg(a, bodyY));
  g.add(leg(b, bodyY));
  // 본체: 두 핀 사이 수평 실린더
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y = bodyY;
  const dist = a.distanceTo(b);
  const len = dist * 0.5;
  const dirAxis = b.clone().sub(a).normalize();
  const aTop = new THREE.Vector3(a.x, bodyY, a.z);
  const bTop = new THREE.Vector3(b.x, bodyY, b.z);
  const endA = mid.clone().add(dirAxis.clone().multiplyScalar(-len / 2));
  const endB = mid.clone().add(dirAxis.clone().multiplyScalar(len / 2));
  // 다리 top ↔ 본체 끝 수평 리드 (다리-본체 분리 방지)
  g.add(segment(aTop, endA));
  g.add(segment(bTop, endB));
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.3, len, 16),
    new THREE.MeshStandardMaterial({ color: MAT.resistorBody, roughness: 0.6 }),
  );
  // 실린더 기본 축 y → 핀 축으로 회전
  const dir = b.clone().sub(a).normalize();
  body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  body.position.copy(mid);
  g.add(body);
  // 색 띠 (4개)
  const bandColors = MAT.resistorBands;
  bandColors.forEach((col, i) => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(1.36, 1.36, 0.5, 16),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 }),
    );
    band.quaternion.copy(body.quaternion);
    const t = -len * 0.3 + i * (len * 0.18);
    band.position.copy(mid.clone().add(dir.clone().multiplyScalar(t)));
    g.add(band);
  });
  return g;
}

function buildButton(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 4.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: MAT.buttonBase, roughness: 0.6 }),
  );
  base.position.set(c.x, bodyY + 1.7, c.z);
  g.add(base);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 1.6, 18),
    new THREE.MeshStandardMaterial({ color: MAT.buttonCap, roughness: 0.4 }),
  );
  cap.position.set(c.x, bodyY + 4.0, c.z);
  g.add(cap);
  return g;
}

function buildPot(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 6;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 4, 22),
    new THREE.MeshStandardMaterial({
      color: MAT.potBody,
      roughness: 0.45,
      metalness: 0.2,
    }),
  );
  body.position.set(c.x, bodyY + 2, c.z);
  g.add(body);
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.4, 2.6, 16),
    new THREE.MeshStandardMaterial({ color: MAT.potKnob, roughness: 0.4 }),
  );
  knob.position.set(c.x, bodyY + 5.2, c.z);
  g.add(knob);
  return g;
}

function buildPiezo(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 6;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 2.4, 24),
    new THREE.MeshStandardMaterial({ color: MAT.piezoDisc, roughness: 0.5 }),
  );
  disc.position.set(c.x, bodyY + 1.2, c.z);
  g.add(disc);
  const port = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 2.6, 12),
    new THREE.MeshStandardMaterial({ color: MAT.piezoPort, roughness: 0.5 }),
  );
  port.position.set(c.x, bodyY + 1.4, c.z);
  g.add(port);
  return g;
}

function buildRGB(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 6.5;
  pins.forEach((p, i) => g.add(leg(p, bodyY - (i === 1 ? 1.5 : 0))));
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.8, 1.4, 20),
    new THREE.MeshStandardMaterial({ color: MAT.rgbBase, roughness: 0.5 }),
  );
  base.position.set(c.x, bodyY, c.z);
  g.add(base);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: MAT.rgbDome,
      roughness: 0.15,
      transparent: true,
      opacity: 0.7,
    }),
  );
  dome.position.set(c.x, bodyY + 0.7, c.z);
  dome.scale.y = 1.6;
  g.add(dome);
  return g;
}

function buildNeopixel(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 3.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  // 소형 PCB(짙은 기판)
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(10, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: TOKEN.foreground, roughness: 0.6 }),
  );
  pcb.position.set(c.x, bodyY + 0.8, c.z);
  g.add(pcb);
  // 5050 화이트 LED 패키지
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1.6, 5),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35 }),
  );
  led.position.set(c.x, bodyY + 2.4, c.z);
  g.add(led);
  // 렌즈 돔(반투명 — 글로우 아님)
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0xfafafa,
      roughness: 0.15,
      transparent: true,
      opacity: 0.8,
    }),
  );
  lens.position.set(c.x, bodyY + 3.1, c.z);
  g.add(lens);
  return g;
}

function buildRelay(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 3.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  // PCB 기판 (모노 슬레이트)
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(16, 1.6, 12),
    new THREE.MeshStandardMaterial({ color: 0x33373a, roughness: 0.7 }),
  );
  pcb.position.set(c.x, bodyY + 0.8, c.z);
  g.add(pcb);
  // 릴레이 캔 (직육면체 블록)
  const can = new THREE.Mesh(
    new THREE.BoxGeometry(7, 7, 9),
    new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.5 }),
  );
  can.position.set(c.x - 3, bodyY + 5, c.z);
  g.add(can);
  // 스크류 단자대
  const term = new THREE.Mesh(
    new THREE.BoxGeometry(5, 4, 9),
    new THREE.MeshStandardMaterial({ color: 0x6b7077, roughness: 0.55 }),
  );
  term.position.set(c.x + 4.5, bodyY + 3.5, c.z);
  g.add(term);
  return g;
}

function buildPump(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  // 원통 본체(모터부) — 눕힘
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 12, 24),
    new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.4, metalness: 0.3 }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.set(c.x - 1, bodyY + 5, c.z);
  g.add(body);
  // 펌프 헤드
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 4, 20),
    new THREE.MeshStandardMaterial({ color: 0x7a7f85, roughness: 0.5 }),
  );
  head.rotation.z = Math.PI / 2;
  head.position.set(c.x + 6, bodyY + 5, c.z);
  g.add(head);
  // 출수 노즐
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x9a9ea3, roughness: 0.5 }),
  );
  nozzle.position.set(c.x + 8, bodyY + 9, c.z);
  g.add(nozzle);
  return g;
}

const BUILDERS: Record<string, (pins: THREE.Vector3[]) => THREE.Object3D> = {
  led: buildLED,
  resistor: buildResistor,
  button: buildButton,
  pot: buildPot,
  piezo: buildPiezo,
  rgb: buildRGB,
  neopixel: buildNeopixel,
  relay: buildRelay,
  pump: buildPump,
};

export interface BuildPartOpts {
  /** GLB 부품: false 면 미캐시 시 비동기 로드 안 함(고스트 hover churn 방지) */
  load?: boolean;
}

/**
 * defId + 핀 홀 월드좌표 → 부품 Object3D (없으면 null).
 * 렌더 전략(def.render.kind)으로 디스패치 — 절차=BUILDERS, GLB=buildGlbPart (DEC-030).
 */
export function buildPartMesh(
  defId: string,
  pinPositions: THREE.Vector3[],
  opts?: BuildPartOpts,
): THREE.Object3D | null {
  const def = PARTS[defId];
  if (!def) return null;

  if (def.render.kind === "procedural") {
    const builder = BUILDERS[def.render.builder];
    if (!builder) return null;
    const obj = builder(pinPositions);
    obj.name = `part:${defId}`;
    return obj;
  }
  // GLB 전략
  return buildGlbPart(def, pinPositions, opts);
}
