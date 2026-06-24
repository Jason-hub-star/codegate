/**
 * 작업대 개발보드 메시 — 활성 보드(BoardDef)의 render 전략으로 디스패치.
 *  · glb     : 실측 GLB 로드(아두이노 UNO, getCalibTarget 좌표). 실패 시 절차 폴백.
 *  · procedural: 절차 메시(ESP32 = fixtures.buildEsp32Board). 외부 자산 의존 0.
 * 핀 마커·pose 는 Scene 이 보드 그룹에 얹는다(여기선 본체 메시만 책임).
 */
import * as THREE from "three";
import { getCalibTarget, type BoardDef } from "@/features/circuit";
import { loadGlbInto } from "./loadGlb";
import { buildEsp32Board } from "./fixtures";

const L = 68.6; // 아두이노 실측 길이(mm) — 절차 폴백용
const W = 53.4;
const PCB_H = 1.6;

/** 절차 보드 빌더 디스패치(render.builder 키 → 본체 메시). */
const PROCEDURAL_BOARD: Record<string, () => THREE.Object3D> = {
  esp32: buildEsp32Board,
};

export function createBoard(
  board: BoardDef,
  standZ: number,
  standY: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "board";
  group.position.set(0, standY, standZ);

  if (board.render.kind === "glb") {
    const target = getCalibTarget(board.modelKey);
    loadGlbInto(group, target?.glbUrl ?? "/assets/arduino/arduino_uno_board.opt.glb", {
      scaleLen: target?.scaleLen ?? L,
      removeFloor: target?.removeFloor ?? true,
      cache: true, // 보드는 스왑마다 재마운트 → 1회 파싱 후 clone(매번 1.5MB 재파싱 방지)
      onError: () => group.add(buildProceduralArduino()),
    });
  } else {
    const build = PROCEDURAL_BOARD[board.render.builder];
    if (build) group.add(build());
  }

  return group;
}

// ── 절차 폴백 (아두이노 GLB 실패 시) ──────────────────────
function roundedRect(w: number, h: number, r: number): THREE.Shape {
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

function buildProceduralArduino(): THREE.Group {
  const g = new THREE.Group();
  const pcbGeo = new THREE.ExtrudeGeometry(roundedRect(L, W, 3), {
    depth: PCB_H,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 1,
    curveSegments: 6,
  });
  pcbGeo.rotateX(-Math.PI / 2);
  const pcb = new THREE.Mesh(
    pcbGeo,
    new THREE.MeshStandardMaterial({
      color: 0x1f6f6b,
      roughness: 0.5,
      metalness: 0.05,
    }),
  );
  g.add(pcb);

  const black = new THREE.MeshStandardMaterial({
    color: 0x14151a,
    roughness: 0.6,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0xc9ccce,
    roughness: 0.28,
    metalness: 0.85,
  });
  const usb = new THREE.Mesh(new THREE.BoxGeometry(12, 11, 16), metal);
  usb.position.set(-L / 2 + 4, PCB_H + 5.5, W / 2 - 12);
  g.add(usb);
  const jack = new THREE.Mesh(new THREE.BoxGeometry(9, 11, 14), black);
  jack.position.set(-L / 2 + 5, PCB_H + 5.5, -(W / 2 - 11));
  g.add(jack);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 7), black);
  chip.position.set(14, PCB_H + 1.5, -6);
  g.add(chip);
  return g;
}
