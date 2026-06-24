/**
 * 절차적 하프 빵판 메시 — circuit/breadboard 레이아웃 정본을 소비.
 * 본체(베벨 라운드) + 홀(InstancedMesh) + 중앙 홈 + 레일 스트라이프 + 가짜 컨택트섀도.
 * DEC-024 품질바: 맨 큐브 금지 → 베벨·PBR·실제 실루엣.
 */
import * as THREE from "three";
import {
  getHoles,
  boardDimensions,
  colX,
  activeBreadboard,
  PITCH,
  railZForStripe,
  type Hole,
  type Rail,
} from "@/features/circuit";
import { TOKEN, POLARITY, MAT } from "./theme3d";

export interface BreadboardObject {
  group: THREE.Group;
  /** 핀 피킹용 (M2): raycast → instanceId → holes[instanceId] */
  holeMesh: THREE.InstancedMesh;
  holes: Hole[];
}

export function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function createBreadboard(): BreadboardObject {
  const group = new THREE.Group();
  group.name = "breadboard";
  const { length, width, height } = boardDimensions();

  // ── 본체 (베벨 라운드 박스) ─────────────────────────────
  const shape = roundedRectShape(length, width, 2.4);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.6,
    bevelSegments: 2,
    curveSegments: 6,
  });
  bodyGeo.rotateX(-Math.PI / 2); // 눕히기: 폭→z, 깊이→y
  // 베벨로 윗면이 height 보다 위에 생기므로 bbox 로 정확히 윗면을 y=0 에 맞춤
  bodyGeo.computeBoundingBox();
  bodyGeo.translate(0, -bodyGeo.boundingBox!.max.y, 0);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: TOKEN.muted, // 에디토리얼 오프화이트 플라스틱
    roughness: 0.72,
    metalness: 0.0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // ── 중앙 홈 (ravine) ───────────────────────────────────
  const ravineGeo = new THREE.BoxGeometry(length - 6, 1.2, PITCH * 1.4);
  const ravineMat = new THREE.MeshStandardMaterial({
    color: MAT.ravine,
    roughness: 0.8,
  });
  const ravine = new THREE.Mesh(ravineGeo, ravineMat);
  ravine.position.set(0, -0.4, 0);
  group.add(ravine);

  // ── 홀 (InstancedMesh) ─────────────────────────────────
  const holes = getHoles();
  // 구멍: 조명 무시(MeshBasic) 검정 + 윗면보다 확실히 위로 → z-fighting·워시아웃 방지
  const holeGeo = new THREE.BoxGeometry(1.15, 0.9, 1.15);
  const holeMat = new THREE.MeshBasicMaterial({ color: MAT.hole });
  const holeMesh = new THREE.InstancedMesh(holeGeo, holeMat, holes.length);
  holeMesh.name = "holes";
  holeMesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  holes.forEach((h, i) => {
    // 박스 높이 0.9 → 중심 y=-0.2 면 윗면이 +0.25 로 돌출(확실히 보임)
    m.makeTranslation(h.x, -0.2, h.z);
    holeMesh.setMatrixAt(i, m);
  });
  holeMesh.instanceMatrix.needsUpdate = true;
  group.add(holeMesh);

  // ── 레일 스트라이프 (빨강 +, 파랑 −) ───────────────────
  const stripeLen = colX(activeBreadboard().cols) - colX(1) + PITCH * 2;
  const addStripe = (rail: Rail, color: number) => {
    const geo = new THREE.BoxGeometry(stripeLen, 0.18, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const s = new THREE.Mesh(geo, mat);
    s.name = `rail-stripe:${rail}`;
    s.userData.rail = rail;
    s.position.set(0, 0.1, railZForStripe(rail));
    group.add(s);
  };
  const RED = TOKEN.error;
  const BLUE = POLARITY.blue;
  addStripe("T+", RED);
  addStripe("T-", BLUE);
  addStripe("B+", RED);
  addStripe("B-", BLUE);

  // ── 가짜 컨택트 섀도 (접지, research/14 A1) ────────────
  group.add(createContactShadow(length, width, height));

  return { group, holeMesh, holes };
}

function createContactShadow(
  length: number,
  width: number,
  height: number,
): THREE.Mesh {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.12,
    size / 2,
    size / 2,
    size * 0.5,
  );
  g.addColorStop(0, `rgba(${MAT.shadowRgb},0.40)`);
  g.addColorStop(0.6, `rgba(${MAT.shadowRgb},0.16)`);
  g.addColorStop(1, `rgba(${MAT.shadowRgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(length * 1.5, width * 1.7);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -height - 0.15;
  mesh.renderOrder = -1;
  mesh.name = "contact-shadow";
  return mesh;
}
