"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createScene } from "../three/createScene";
import { createBreadboard } from "../three/breadboard";
import { createBoard } from "../three/board";
import { createInteraction, type InteractionHandle } from "../three/picking";
import { createViewportApi, type ViewportApi } from "../three/viewport";
import { MAT } from "../three/theme3d";
import {
  activeBoard,
  boardDimensions,
  getBoardPins,
  setActiveBoard,
  setActiveBreadboard,
  DEFAULT_POSE,
  type BoardId,
  type BoardPose,
  type BreadboardId,
  type PlacedPart,
  type Rail,
  type Verdict,
  type Wire,
} from "@/features/circuit";
import { setRailStripeState, visualStateFromVerdict } from "../three/visualState";

/** pose(이동 x,z + 90° rot) → 그룹 transform 적용 (평면 이동 + y축 yaw) */
function applyPose(
  obj: THREE.Object3D,
  base: THREE.Vector3,
  pose: BoardPose,
): void {
  obj.position.set(base.x + pose.x, base.y, base.z + pose.z);
  obj.rotation.y = -(pose.rot * Math.PI) / 2;
  obj.updateMatrixWorld(true);
}

export interface SceneProps {
  /** 활성 빵판 — 바뀌면 씬 전체 재구성(레이아웃 교체) */
  breadboard: BreadboardId;
  /** 활성 개발보드(아두이노/ESP32) — 바뀌면 씬 재구성. 생략 시 기본(아두이노). */
  board?: BoardId;
  wires: Wire[];
  parts: PlacedPart[];
  selectedPartDef: string | null;
  selectedPartUid: string | null;
  verdict: Verdict | null;
  orientation: 0 | 1;
  /** 빵판 배치(이동/회전) — 생략 시 기본 */
  breadboardPose?: BoardPose;
  /** 아두이노 배치(이동/회전) — 생략 시 기본 */
  arduinoPose?: BoardPose;
  /** 보드 이동 모드 (다음 평면 클릭이 보드 이동) */
  relocatingBoard?: "breadboard" | "arduino" | null;
  onSelectBoard?: (which: "breadboard" | "arduino" | null) => void;
  onMoveBoardBy?: (
    which: "breadboard" | "arduino",
    dx: number,
    dz: number,
  ) => void;
  onAddWire: (a: string, b: string) => void;
  onPlacePart: (anchorHoleId: string) => void;
  onPlaceFree?: (x: number, z: number) => void;
  onSelectPart: (uid: string | null) => void;
  onCancel: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRotate: () => void;
  onRelocate: () => void;
  onConnectLead: (uid: string, pinIndex: number, endpoint: string) => void;
  calibratingUid?: string | null;
  calibratePin?: number;
  onSetLeadAnchor?: (
    uid: string,
    pinIndex: number,
    coord: [number, number, number],
  ) => void;
  showLabels?: boolean;
  onViewportReady?: (api: ViewportApi | null) => void;
}

function isRail(value: unknown): value is Rail {
  return value === "T+" || value === "T-" || value === "B+" || value === "B-";
}

export function Scene(props: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionHandle | null>(null);
  const breadboardRef = useRef<THREE.Group | null>(null);
  const boardRef = useRef<THREE.Group | null>(null);
  const boardBaseRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // 콜백 최신값을 이벤트 핸들러가 보도록 ref 로 보관 (렌더 중 쓰기 금지 → effect)
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  // 마운트(+빵판 변경 시 재구성): 씬·빵판·아두이노·인터랙션 구성
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setActiveBreadboard(props.breadboard); // 도메인 레이아웃 = prop 보장(스왑 재마운트)
    setActiveBoard(props.board ?? "arduino-uno"); // 활성 보드 = prop 보장(핀맵 파생)

    const bbPose = propsRef.current.breadboardPose ?? DEFAULT_POSE;
    const adPose = propsRef.current.arduinoPose ?? DEFAULT_POSE;

    const handle = createScene(container);
    const { group: bb, holeMesh, holes } = createBreadboard();
    breadboardRef.current = bb;
    applyPose(bb, new THREE.Vector3(0, 0, 0), bbPose); // 빵판 pose
    handle.scene.add(bb);

    const dims = boardDimensions();
    const arduinoOffset = new THREE.Vector3(
      0,
      -dims.height,
      -(dims.width / 2 + 34),
    );
    boardBaseRef.current = arduinoOffset.clone();
    // 보드 그룹: 기본 오프셋 + pose. 핀 마커는 이 그룹 자식이라 함께 이동.
    const arduino = createBoard(activeBoard(), arduinoOffset.z, arduinoOffset.y);
    boardRef.current = arduino;
    applyPose(arduino, arduinoOffset, adPose);
    handle.scene.add(arduino);
    handle.controls.target.set(0, -2, -20);
    handle.controls.update();

    // 보드 핀 마커 (좌표=보드 로컬, 클릭 가능). 보드 그룹 자식.
    const pins = getBoardPins();
    const pinGeo = new THREE.CylinderGeometry(0.65, 0.65, 2.4, 8);
    const pinMat = new THREE.MeshStandardMaterial({
      color: MAT.pinGold,
      metalness: 0.7,
      roughness: 0.4,
    });
    const pinMesh = new THREE.InstancedMesh(pinGeo, pinMat, pins.length || 1);
    pinMesh.name = "arduino-pins";
    pinMesh.frustumCulled = false;
    const pm = new THREE.Matrix4();
    pins.forEach((p, i) => {
      pm.makeTranslation(p.x, p.y, p.z); // 로컬 좌표 — 그룹 transform 이 world 로
      pinMesh.setMatrixAt(i, pm);
    });
    pinMesh.instanceMatrix.needsUpdate = true;
    if (pins.length) arduino.add(pinMesh);
    arduino.updateMatrixWorld(true);

    const interaction = createInteraction({
      scene: handle.scene,
      camera: handle.camera,
      dom: handle.renderer.domElement,
      holeMesh,
      holes,
      pinMesh: pins.length ? pinMesh : null,
      pins,
      breadboardMatrix: bb.matrixWorld,
      arduinoMatrix: arduino.matrixWorld,
      breadboardGroup: bb,
      arduinoGroup: arduino,
    });
    interactionRef.current = interaction;

    handle.start();
    const ro = new ResizeObserver(() => handle.resize());
    ro.observe(container);

    // 뷰포트 API — 콘텐츠 박스(board+arduino)를 수치로 산출(GLB 로드 비의존)
    const contentBox = new THREE.Box3();
    contentBox.expandByPoint(
      new THREE.Vector3(-dims.length / 2, -dims.height, -dims.width / 2),
    );
    contentBox.expandByPoint(new THREE.Vector3(dims.length / 2, 2, dims.width / 2));
    // 보드 콘텐츠 박스 — 활성 보드 치수로 프레이밍(아두이노 68.6×53.4 / ESP32 51×23)
    const bd = activeBoard().dims;
    contentBox.expandByPoint(
      new THREE.Vector3(
        -bd.length / 2 + arduinoOffset.x,
        arduinoOffset.y,
        -bd.width / 2 + arduinoOffset.z,
      ),
    );
    contentBox.expandByPoint(
      new THREE.Vector3(
        bd.length / 2 + arduinoOffset.x,
        arduinoOffset.y + 12,
        bd.width / 2 + arduinoOffset.z,
      ),
    );
    propsRef.current.onViewportReady?.(createViewportApi(handle, contentBox));

    return () => {
      ro.disconnect();
      propsRef.current.onViewportReady?.(null);
      interaction.dispose();
      interactionRef.current = null;
      breadboardRef.current = null;
      boardRef.current = null;
      handle.dispose();
    };
  }, [props.breadboard, props.board]);

  // 보드 pose 변경 → 그룹 transform 갱신 + picking 행렬 동기화(부품·배선 재빌드)
  useEffect(() => {
    const bb = breadboardRef.current;
    const arduino = boardRef.current;
    if (!bb || !arduino) return;
    applyPose(bb, new THREE.Vector3(0, 0, 0), props.breadboardPose ?? DEFAULT_POSE);
    applyPose(arduino, boardBaseRef.current, props.arduinoPose ?? DEFAULT_POSE);
    interactionRef.current?.setBoardMatrices(bb.matrixWorld, arduino.matrixWorld);
  }, [props.breadboardPose, props.arduinoPose]);

  // 콜백 등록 (정적 래퍼가 ref 통해 최신 호출).
  // ⚠️ 빵판/보드 스왑 시 mount effect 가 인터랙션을 재생성하므로(interactionRef 교체)
  //    같은 deps 로 재실행해 새 인터랙션에도 콜백을 다시 붙인다(안 그러면 스왑 후 배선·클릭이 죽음).
  useEffect(() => {
    interactionRef.current?.setCallbacks({
      onAddWire: (a, b) => propsRef.current.onAddWire(a, b),
      onPlacePart: (h) => propsRef.current.onPlacePart(h),
      onPlaceFree: (x, z) => propsRef.current.onPlaceFree?.(x, z),
      onSelectPart: (u) => propsRef.current.onSelectPart(u),
      onCancel: () => propsRef.current.onCancel(),
      onDelete: () => propsRef.current.onDelete(),
      onUndo: () => propsRef.current.onUndo(),
      onRedo: () => propsRef.current.onRedo(),
      onRotate: () => propsRef.current.onRotate(),
      onRelocate: () => propsRef.current.onRelocate(),
      onConnectLead: (u, i, e) => propsRef.current.onConnectLead(u, i, e),
      onSetLeadAnchor: (u, i, c) => propsRef.current.onSetLeadAnchor?.(u, i, c),
      onSelectBoard: (w) => propsRef.current.onSelectBoard?.(w),
      onMoveBoardBy: (w, dx, dz) => propsRef.current.onMoveBoardBy?.(w, dx, dz),
    });
  }, [props.breadboard, props.board]);

  // 보드 이동 모드 푸시 (다음 평면 클릭이 보드 이동)
  useEffect(() => {
    interactionRef.current?.setBoardRelocating(props.relocatingBoard ?? null);
  }, [props.relocatingBoard]);

  // 이름표 전역 표시/숨김
  useEffect(() => {
    interactionRef.current?.setLabelsVisible(props.showLabels ?? true);
  }, [props.showLabels]);

  // 리드 보정 모드 푸시 + 마커 강조 갱신(현재 핀 하이라이트 위해 재동기화)
  useEffect(() => {
    interactionRef.current?.setCalibrating(
      props.calibratingUid ?? null,
      props.calibratePin ?? 0,
    );
    interactionRef.current?.syncParts(props.parts, props.selectedPartUid);
  }, [props.calibratingUid, props.calibratePin, props.parts, props.selectedPartUid]);

  // 모델 동기화
  useEffect(() => {
    interactionRef.current?.syncWires(props.wires);
  }, [props.wires]);

  useEffect(() => {
    interactionRef.current?.syncParts(props.parts, props.selectedPartUid);
  }, [props.parts, props.selectedPartUid]);

  useEffect(() => {
    interactionRef.current?.syncVisualState(props.verdict);
    const state = visualStateFromVerdict(props.verdict);
    breadboardRef.current?.traverse((obj) => {
      const rail = obj.userData.rail;
      if (isRail(rail)) {
        setRailStripeState(obj, rail, state.energizedRails[rail]);
      }
    });
  }, [props.verdict]);

  useEffect(() => {
    interactionRef.current?.setSelectedPartDef(props.selectedPartDef);
  }, [props.selectedPartDef]);

  useEffect(() => {
    interactionRef.current?.setOrientation(props.orientation);
  }, [props.orientation]);

  return <div ref={containerRef} className="h-full w-full" />;
}
