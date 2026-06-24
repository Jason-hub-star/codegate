/**
 * 픽스처(보드·빵판) 절차 메시 — 배포 GLB 가 없는 스테이징 픽스처용(DEC-030).
 * 팔레트 썸네일이 "3D" 폴백 대신 실루엣을 보이도록 순수 Three.js 로 직접 빌드.
 * DEC-002(순수 Three.js)·라이선스 금지 규칙 준수, 외부 자산 의존 0.
 * DEC-024 품질바: 맨 큐브 금지 → 베벨 본체·헤더핀·PBR.
 */
import * as THREE from "three";
import { PITCH } from "@/features/circuit";
import { roundedRectShape } from "./breadboard";
import { TOKEN, POLARITY, MAT } from "./theme3d";

/** 베벨 라운드 PCB 본체 — 밑면 y=0, 위로 두께만큼 솟음 */
function pcbBody(
  length: number,
  width: number,
  height: number,
  color: number,
  roughness: number,
): THREE.Mesh {
  const shape = roundedRectShape(length, width, 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 1,
    curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2); // 눕히기: 폭→z, 깊이→y
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox!.min.y, 0); // 밑면 y=0
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }),
  );
}

/** 한 행(InstancedMesh)으로 작은 핀 헤더를 깐다 */
function pinRow(
  count: number,
  startX: number,
  stepX: number,
  z: number,
  topY: number,
): THREE.InstancedMesh {
  const mat = new THREE.MeshStandardMaterial({
    color: MAT.pinGold,
    roughness: 0.4,
    metalness: 0.7,
  });
  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 2.6, 1),
    mat,
    count,
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(startX + i * stepX, topY + 1.3, z);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

/** ESP32 (Huzzah32) 개발보드 — PCB + RF 실드 + USB-C + 양측 헤더핀 */
export function buildEsp32Board(): THREE.Object3D {
  const g = new THREE.Group();
  g.name = "fixture:esp32";
  const L = 51;
  const W = 23;
  const H = 1.6;

  const pcb = pcbBody(L, W, H, TOKEN.foreground, 0.55); // 짙은 기판
  g.add(pcb);

  // RF 실드(금속 캔) — Wi-Fi/BLE 모듈
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(15, 2, 16),
    new THREE.MeshStandardMaterial({
      color: MAT.metalCap,
      roughness: 0.3,
      metalness: 0.85,
    }),
  );
  shield.position.set(-L / 2 + 12, H + 1, 0);
  g.add(shield);

  // USB-C 커넥터
  const usb = new THREE.Mesh(
    new THREE.BoxGeometry(7, 3, 5),
    new THREE.MeshStandardMaterial({
      color: MAT.metalCap,
      roughness: 0.35,
      metalness: 0.8,
    }),
  );
  usb.position.set(L / 2 - 1, H + 1.5, 0);
  g.add(usb);

  // 양측 헤더핀(2열)
  const n = 14;
  const stepX = (L - 10) / (n - 1);
  g.add(pinRow(n, -L / 2 + 5, stepX, W / 2 - 1.5, H));
  g.add(pinRow(n, -L / 2 + 5, stepX, -(W / 2 - 1.5), H));
  return g;
}

/**
 * 빵판 코스메틱 썸네일 — 열수(cols)에 비례한 길이로 하프(30)·풀(63)을 시각 구분.
 * 전기 레이아웃(circuit/breadboard.ts)과 분리된 미리보기 전용. 윗면 y=0(풀 빵판 규약).
 */
export function buildBreadboardThumb(cols: number): THREE.Object3D {
  const g = new THREE.Group();
  g.name = `fixture:breadboard-${cols}`;
  const L = cols * PITCH + 16; // 열수 비례 길이(여백 포함)
  const W = 55;
  const H = 9;

  // 본체 — 윗면을 y=0 에 맞춤(풀 빵판 createBreadboard 와 동일 규약)
  const shape = roundedRectShape(L, W, 2.4);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: H,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.6,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox!.max.y, 0); // 윗면 y=0
  const body = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: TOKEN.muted,
      roughness: 0.72,
      metalness: 0,
    }),
  );
  g.add(body);

  // 중앙 홈
  const ravine = new THREE.Mesh(
    new THREE.BoxGeometry(L - 6, 1.2, PITCH * 1.4),
    new THREE.MeshStandardMaterial({ color: MAT.ravine, roughness: 0.8 }),
  );
  ravine.position.set(0, -0.4, 0);
  g.add(ravine);

  // 홀 그리드(InstancedMesh) — 중앙 홈 위·아래 각 5행
  const rowsPerSide = 5;
  const holeMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.15, 0.9, 1.15),
    new THREE.MeshBasicMaterial({ color: MAT.hole }),
    cols * rowsPerSide * 2,
  );
  holeMesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  let k = 0;
  for (const side of [-1, 1]) {
    for (let r = 0; r < rowsPerSide; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * PITCH;
        const z = side * (PITCH * 1.4 + r * PITCH);
        m.makeTranslation(x, -0.2, z);
        holeMesh.setMatrixAt(k++, m);
      }
    }
  }
  holeMesh.instanceMatrix.needsUpdate = true;
  g.add(holeMesh);

  // 레일 스트라이프(빨강 +, 파랑 −) — 상·하단
  const addStripe = (z: number, color: number) => {
    const s = new THREE.Mesh(
      new THREE.BoxGeometry(L - 10, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    s.position.set(0, 0.1, z);
    g.add(s);
  };
  addStripe(-W / 2 + 3, TOKEN.error);
  addStripe(-W / 2 + 5, POLARITY.blue);
  addStripe(W / 2 - 5, TOKEN.error);
  addStripe(W / 2 - 3, POLARITY.blue);
  return g;
}
