import * as THREE from "three";
import {
  type PlacedPart,
  type Hole,
  type BoardPin,
  type Verdict,
} from "@/features/circuit";

export interface InteractionCallbacks {
  onAddWire?: (aHoleId: string, bHoleId: string) => void;
  onPlacePart?: (anchorHoleId: string) => void;
  /** free 부품을 빵판 로컬 좌표(x,z)에 소환/이동 */
  onPlaceFree?: (x: number, z: number) => void;
  onSelectPart?: (uid: string | null) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onRotate?: () => void;
  onRelocate?: () => void;
  onConnectLead?: (uid: string, pinIndex: number, endpoint: string) => void;
  /** in-page 리드 보정 — 본체 클릭점을 모델 로컬좌표로 해당 핀에 저장 */
  onSetLeadAnchor?: (
    uid: string,
    pinIndex: number,
    coord: [number, number, number],
  ) => void;
  onSelectBoard?: (which: "breadboard" | "arduino" | null) => void;
  onMoveBoardBy?: (
    which: "breadboard" | "arduino",
    dx: number,
    dz: number,
  ) => void;
}

export interface InteractionHandle {
  setSelectedPartDef: (defId: string | null) => void;
  setOrientation: (orientation: 0 | 1) => void;
  setCallbacks: (cb: InteractionCallbacks) => void;
  syncWires: (wires: { id: string; a: string; b: string }[]) => void;
  syncParts: (parts: PlacedPart[], selectedUid: string | null) => void;
  syncVisualState: (verdict: Verdict | null) => void;
  /** 빵판·아두이노 pose 변경 시 world 행렬 갱신 + 배선·부품 재동기화 */
  setBoardMatrices: (breadboard: THREE.Matrix4, arduino: THREE.Matrix4) => void;
  /** 보드 이동 모드 설정 — 다음 평면 클릭이 해당 보드를 이동 */
  setBoardRelocating: (which: "breadboard" | "arduino" | null) => void;
  /** 리드 보정 모드 — uid 의 본체 클릭이 pinIndex 리드 시작점을 설정(null=종료) */
  setCalibrating: (uid: string | null, pinIndex: number) => void;
  /** 이름표 전역 표시/숨김 */
  setLabelsVisible: (visible: boolean) => void;
  dispose: () => void;
}

export interface Opts {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dom: HTMLElement;
  holeMesh: THREE.InstancedMesh;
  holes: Hole[];
  pinMesh: THREE.InstancedMesh | null;
  pins: BoardPin[];
  /** 빵판 그룹 world 행렬 (이동/회전 pose 반영) */
  breadboardMatrix: THREE.Matrix4;
  /** 아두이노 그룹 world 행렬 (기본 오프셋 + pose 반영) */
  arduinoMatrix: THREE.Matrix4;
  /** 보드 본체 선택 레이캐스트용 그룹 */
  breadboardGroup: THREE.Object3D;
  arduinoGroup: THREE.Object3D;
}

export type LabelSel =
  | { kind: "board"; which: "breadboard" | "arduino" }
  | { kind: "part"; uid: string };
