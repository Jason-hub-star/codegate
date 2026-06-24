/**
 * Pure visual builders (no closure state).
 * 부품 visual feedback — 외곽선, 극성 마커, 이름표, 리드 마커, 고스트 처리.
 */
import * as THREE from "three";
import { isBoardPinId } from "@/features/circuit";
import { TOKEN, POLARITY } from "../theme3d";
import { WIRE_COLOR } from "../wire";

/**
 * 고스트 (반투명 미리보기) — 단일 material 투명화
 */
export const ghostify = (m: THREE.Material): THREE.Material => {
  const c = m.clone();
  c.transparent = true;
  c.opacity = 0.45;
  c.depthWrite = false;
  return c;
};

/**
 * 트리 전체 고스트 처리 (재귀 traverse)
 */
export const ghostifyTree = (root: THREE.Object3D) => {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(ghostify)
      : ghostify(mesh.material);
  });
};

/**
 * 텍스트 → 카메라 향하는 스프라이트(에디토리얼: 다크 카드+얇은 보더). 깊이검사 off.
 */
export const makeTextLabel = (text: string): THREE.Sprite => {
  const fs = 44;
  const padX = 16;
  const padY = 9;
  const measure = document.createElement("canvas").getContext("2d")!;
  const font = `600 ${fs}px ui-sans-serif, system-ui, sans-serif`;
  measure.font = font;
  const tw = Math.ceil(measure.measureText(text).width);
  const c = document.createElement("canvas");
  c.width = tw + padX * 2;
  c.height = fs + padY * 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "rgba(24,24,27,0.92)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(250,250,250,0.3)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, c.width - 2, c.height - 2);
  ctx.font = font;
  ctx.fillStyle = "#fafafa";
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  const hmm = 7; // 라벨 높이 ~7mm
  spr.scale.set((c.width / c.height) * hmm, hmm, 1);
  spr.renderOrder = 999;
  return spr;
};

/**
 * 선택된 free 부품의 핀 마커(클릭=리드 재연결). 연결=역할색, 미연결=앰버.
 */
export const leadMarker = (color: number): THREE.Mesh =>
  new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 12, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
  );

/**
 * 핀 역할 → 리드선 색 (전원=빨강·GND=파랑·그외=중립)
 */
export const leadColor = (role: string): number =>
  role === "gnd"
    ? WIRE_COLOR.blue
    : role === "power"
      ? WIRE_COLOR.red
      : WIRE_COLOR.neutral;

/**
 * 배선 식별 → 색 (보드핀=전원/GND 색, 빵판 레일=레일색, 나머지=중립).
 * 보드중립: 활성 보드 핀ID(isBoardPinId)면 GND 패턴으로 색 분기(AD_/ESP_ 등 무관).
 */
export const wireColorFor = (id: string): number => {
  if (isBoardPinId(id)) {
    return /GND/.test(id) ? WIRE_COLOR.blue : WIRE_COLOR.red;
  }
  if (/^(T\+|B\+)_/.test(id)) return WIRE_COLOR.red; // + 레일 홀
  if (/^(T-|B-)_/.test(id)) return WIRE_COLOR.blue; // − 레일 홀
  return WIRE_COLOR.neutral;
};

/**
 * 텍스트 캔버스 스프라이트 (극성 마커용)
 */
export const labelSprite = (text: string, hex: number): THREE.Sprite => {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#" + hex.toString(16).padStart(6, "0");
  ctx.font = "bold 54px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 32, 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  spr.scale.set(4, 4, 1);
  return spr;
};

/**
 * +/− 극성 마커 (구체 cap + 라벨 스프라이트 조합)
 */
export const polarityMarker = (pos: THREE.Vector3, sign: "+" | "-"): THREE.Group => {
  const hex = sign === "+" ? POLARITY.red : POLARITY.blue;
  const g = new THREE.Group();
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 14, 12),
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.4 }),
  );
  cap.position.set(pos.x, 1.3, pos.z);
  g.add(cap);
  const label = labelSprite(sign, hex);
  label.position.set(pos.x, 13, pos.z);
  g.add(label);
  return g;
};

/**
 * 얇은 외곽선 선택 (글로우 X, research/14 E)
 */
export const addOutline = (obj: THREE.Object3D) => {
  // 대상 메시를 먼저 수집한다. traverse 도중 라인을 add 하면 그 라인을
  // 다시 방문→또 외곽선 추가…로 무한재귀(Maximum call stack)가 난다.
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    if (o instanceof THREE.LineSegments) return; // 외곽선 자신은 제외
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) meshes.push(mesh);
  });
  for (const mesh of meshes) {
    const edges = new THREE.EdgesGeometry(mesh.geometry, 30);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: TOKEN.foreground }),
    );
    mesh.add(line);
  }
};
