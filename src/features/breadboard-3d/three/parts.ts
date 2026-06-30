/**
 * 부품 3D 메시 생성 — 핀 홀 좌표 배열을 받아 Object3D 반환.
 * DEC-024 품질바: 실린더·돔·베벨·PBR. 맨 큐브·평면 SVG 금지.
 */
import * as THREE from "three";
import { PARTS, type PartDef, type PartPin } from "@/features/circuit";
import { MAT, TOKEN, POLARITY } from "./theme3d";
import { buildGlbPart } from "./glbParts";

const LEG_MAT = new THREE.MeshStandardMaterial({
  color: MAT.metalLeg,
  roughness: 0.25,
  metalness: 0.9,
});
// 핀 의미 색(전기 색 관례) — 레일·점퍼와 같은 언어. +빨강 · −파랑 · 신호 금색.
const LEG_POS = new THREE.MeshStandardMaterial({
  color: POLARITY.red,
  roughness: 0.35,
  metalness: 0.6,
});
const LEG_NEG = new THREE.MeshStandardMaterial({
  color: POLARITY.blue,
  roughness: 0.35,
  metalness: 0.6,
});
const LEG_SIG = new THREE.MeshStandardMaterial({
  color: MAT.pinGold,
  roughness: 0.35,
  metalness: 0.6,
});
const LEG_R = 0.3; // 다리 반지름 — 모든 부품 다리·리드 공용(여기 한 곳에서 굵기 관리)

/** 핀 역할 → 다리 색(전기 색). null = 기본 은색 유지(무극성·릴레이 접점 등). */
function legMatFor(pin: PartPin, polarity?: boolean): THREE.Material | null {
  switch (pin.role) {
    case "gnd":
      return LEG_NEG;
    case "power":
      return LEG_POS;
    case "digital":
    case "pwm":
    case "analog":
      return LEG_SIG;
    case "signal":
      return polarity ? LEG_POS : null; // 극성 부품의 +극만 빨강, 무극성(저항)은 은색
    default:
      return null; // switch(릴레이 접점) 등
  }
}

function centroid(pts: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  pts.forEach((p) => c.add(p));
  return c.multiplyScalar(1 / pts.length);
}

/** 핀 홀에서 본체 아래까지 올라오는 다리. legPin = 핀 위치 마킹(색 후처리용). */
function leg(pin: THREE.Vector3, topY: number): THREE.Mesh {
  const h = Math.max(topY, 1);
  const geo = new THREE.CylinderGeometry(LEG_R, LEG_R, h, 10);
  const m = new THREE.Mesh(geo, LEG_MAT);
  m.position.set(pin.x, h / 2, pin.z);
  m.userData.legPin = [pin.x, pin.z]; // 핀 위치 → buildPartMesh 가 role 색 입힘
  return m;
}

/** 다리 메시(legPin 마킹)를 핀 위치로 def.pins 와 매칭해 전기 색을 입힌다(빌더 불변). */
function applyPinColors(
  obj: THREE.Object3D,
  def: PartDef,
  pins: THREE.Vector3[],
): void {
  obj.traverse((o) => {
    const lp = o.userData.legPin as [number, number] | undefined;
    if (!lp || !(o instanceof THREE.Mesh)) return;
    const i = pins.findIndex(
      (p) => Math.abs(p.x - lp[0]) < 0.05 && Math.abs(p.z - lp[1]) < 0.05,
    );
    if (i < 0 || !def.pins[i]) return;
    const mat = legMatFor(def.pins[i], def.polarity);
    if (mat) o.material = mat;
  });
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

function buildBuzzerModule(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 3.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  // 소형 PCB 기판
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.6, 8),
    new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.7 }),
  );
  pcb.position.set(c.x, bodyY + 0.8, c.z);
  g.add(pcb);
  // 부저 캔(검은 원통)
  const can = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 5, 24),
    new THREE.MeshStandardMaterial({ color: MAT.piezoDisc, roughness: 0.5 }),
  );
  can.position.set(c.x, bodyY + 3.5, c.z);
  g.add(can);
  // 상단 음공
  const port = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 0.8, 5.2, 12),
    new THREE.MeshStandardMaterial({ color: MAT.piezoPort, roughness: 0.5 }),
  );
  port.position.set(c.x, bodyY + 3.6, c.z);
  g.add(port);
  return g;
}

function buildLaserTx(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 3.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  // 소형 PCB 기판
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.6, 11),
    new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.7 }),
  );
  pcb.position.set(c.x, bodyY + 0.8, c.z);
  g.add(pcb);
  // 레이저 다이오드 금속 배럴 (세로)
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.6, 7, 20),
    new THREE.MeshStandardMaterial({ color: MAT.metalCap, roughness: 0.3, metalness: 0.85 }),
  );
  barrel.position.set(c.x, bodyY + 5, c.z);
  g.add(barrel);
  // 발광 렌즈 (빨강, 위 끝 — 글로우 아님, 반투명 돔)
  const emit = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: POLARITY.red,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    }),
  );
  emit.position.set(c.x, bodyY + 8.6, c.z);
  g.add(emit);
  return g;
}

function buildLaserRx(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 3.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  // 소형 PCB 기판
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.6, 11),
    new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.7 }),
  );
  pcb.position.set(c.x, bodyY + 0.8, c.z);
  g.add(pcb);
  // 수광 센서 (반투명 어두운 큐브 — 빔 입사면)
  const sensor = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshStandardMaterial({
      color: 0x14151a,
      roughness: 0.25,
      transparent: true,
      opacity: 0.8,
    }),
  );
  sensor.position.set(c.x, bodyY + 3.2, c.z - 2);
  g.add(sensor);
  // 상태 LED (빨강 돔)
  const statusLed = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: POLARITY.red,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
    }),
  );
  statusLed.position.set(c.x + 3, bodyY + 2, c.z + 3);
  g.add(statusLed);
  return g;
}

function buildUltrasonicHcsr04(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 3.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  const pcb = new THREE.Mesh(
    new THREE.BoxGeometry(18, 1.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.7 }),
  );
  pcb.position.set(c.x, bodyY + 0.8, c.z);
  g.add(pcb);

  for (const dx of [-5, 5]) {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 3.2, 24),
      new THREE.MeshStandardMaterial({
        color: MAT.metalCap,
        roughness: 0.28,
        metalness: 0.8,
      }),
    );
    can.rotation.x = Math.PI / 2;
    can.position.set(c.x + dx, bodyY + 4.2, c.z - 1.6);
    g.add(can);
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 0.35, 24),
      new THREE.MeshStandardMaterial({ color: 0x202225, roughness: 0.4 }),
    );
    face.rotation.x = Math.PI / 2;
    face.position.set(c.x + dx, bodyY + 4.2, c.z - 3.3);
    g.add(face);
  }

  const header = new THREE.Mesh(
    new THREE.BoxGeometry(10, 2.2, 1.8),
    new THREE.MeshStandardMaterial({ color: MAT.pinGold, roughness: 0.45 }),
  );
  header.position.set(c.x, bodyY + 2.4, c.z + 4);
  g.add(header);
  return g;
}

function buildSoilMoisture(pins: THREE.Vector3[]): THREE.Object3D {
  const g = new THREE.Group();
  const c = centroid(pins);
  const bodyY = 3.5;
  pins.forEach((p) => g.add(leg(p, bodyY)));
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.4, 24),
    new THREE.MeshStandardMaterial({ color: 0x303438, roughness: 0.7 }),
  );
  board.position.set(c.x, bodyY + 0.7, c.z - 5);
  g.add(board);

  const forkMat = new THREE.MeshStandardMaterial({
    color: MAT.pinGold,
    roughness: 0.35,
    metalness: 0.65,
  });
  for (const dx of [-2.3, 2.3]) {
    const prong = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 16), forkMat);
    prong.position.set(c.x + dx, bodyY + 1.5, c.z - 8);
    g.add(prong);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.7, 1.3), forkMat);
  bridge.position.set(c.x, bodyY + 1.5, c.z - 0.5);
  g.add(bridge);

  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(5, 1.2, 4),
    new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.5 }),
  );
  chip.position.set(c.x, bodyY + 2.2, c.z + 4);
  g.add(chip);
  return g;
}

const BUILDERS: Record<string, (pins: THREE.Vector3[]) => THREE.Object3D> = {
  led: buildLED,
  resistor: buildResistor,
  button: buildButton,
  pot: buildPot,
  piezo: buildPiezo,
  rgb: buildRGB,
  buzzerModule: buildBuzzerModule,
  laserTx: buildLaserTx,
  laserRx: buildLaserRx,
  ultrasonicHcsr04: buildUltrasonicHcsr04,
  soilMoisture: buildSoilMoisture,
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
    applyPinColors(obj, def, pinPositions); // 다리에 전기 색(+빨강/−파랑/신호 금색)
    return obj;
  }
  // GLB 전략
  return buildGlbPart(def, pinPositions, opts);
}
