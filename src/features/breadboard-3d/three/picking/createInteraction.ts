/**
 * 인터랙션 컨트롤러 — Raycaster 핀 피킹 + 호버/배선 상태머신.
 * 드래그(궤도 회전) vs 클릭 구분, wires/parts 그룹을 React 모델에서 동기화.
 * 프레임워크 비의존: 콜백으로만 React 와 통신.
 */
import * as THREE from "three";
import {
  PARTS,
  PITCH,
  boardRefLabel,
  connectionIdForLead,
  computePinHoles,
  partEndpoints,
  parseLeadConnectionId,
  freeBodyPos,
  type PlacedPart,
  type Verdict,
} from "@/features/circuit";
import { holeWorldPos } from "../snap";
import { buildWire } from "../wire";
import { buildPartMesh } from "../parts";
import { TOKEN } from "../theme3d";
import { setLedDomeState, visualStateFromVerdict } from "../visualState";
import { type Opts, type InteractionCallbacks, type InteractionHandle, type LabelSel } from "./types";
import {
  freeBodyPins,
  freeLeadPins,
  freeLeadEnds,
  worldToLeadLocal,
} from "./freeLeads";
import {
  ghostifyTree,
  makeTextLabel,
  leadMarker,
  leadColor,
  wireColorFor,
  polarityMarker,
  addOutline,
} from "./decor";
import {
  createEndpointRingsAt,
  createEndpointRings,
  decorateConnectionMesh,
  syncWireMeshes,
} from "./wireSelection";
import { clearSpriteLabels, syncDebugLabels } from "./debugLabels";

export function createInteraction(opts: Opts): InteractionHandle {
  const { scene, camera, dom, holeMesh, holes, pinMesh, pins } = opts;
  const { breadboardGroup, arduinoGroup } = opts;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  // 보드 pose 행렬 — 빵판/아두이노 이동·회전 시 setBoardMatrices 로 갱신.
  const bbMatrix = opts.breadboardMatrix.clone();
  const adMatrix = opts.arduinoMatrix.clone();
  const bbInverse = bbMatrix.clone().invert();

  // 아두이노 핀 로컬 좌표(보드 그룹 기준). world = local × adMatrix.
  const pinLocalMap = new Map<string, THREE.Vector3>();
  for (const p of pins) {
    pinLocalMap.set(p.id, new THREE.Vector3(p.x, p.y, p.z));
  }

  // 빵판 홀 로컬 좌표 → world (빵판 pose 반영)
  const holeWorld = (id: string): THREE.Vector3 | null => {
    const local = holeWorldPos(id);
    return local ? local.applyMatrix4(bbMatrix) : null;
  };
  // 아두이노 핀 → world (아두이노 pose 반영)
  const pinWorld = (id: string): THREE.Vector3 | null => {
    const l = pinLocalMap.get(id);
    return l ? l.clone().applyMatrix4(adMatrix) : null;
  };

  // 엔드포인트(빵판 홀 | 보드 핀) → 월드 좌표. 보드중립: 활성 보드 핀맵(pinLocalMap)에 있으면 핀.
  const endpointPos = (id: string): THREE.Vector3 | null => {
    if (pinLocalMap.has(id)) return pinWorld(id);
    return holeWorld(id);
  };

  let selectedPartDef: string | null = null;
  let orientation: 0 | 1 = 0;
  let lastGhostKey: string | null = null;
  let cb: InteractionCallbacks = {};
  let pendingHoleId: string | null = null;
  // free 부품 리드 재연결 대기 — 선택 부품의 한 핀을 클릭하면 설정, 다음 홀 클릭이 끝점
  let pendingLead: { uid: string; pin: number } | null = null;
  // 보드 이동 모드 — 설정 시 다음 평면 클릭이 해당 보드를 이동
  let boardRelocating: "breadboard" | "arduino" | null = null;
  // 리드 보정 모드 — 설정 시 본체 클릭이 calibratePin 리드 시작점을 설정
  let calibratingUid: string | null = null;
  let calibratePin = 0;
  let lastParts: PlacedPart[] = []; // 리드 링 위치 계산용(최근 동기화 스냅)
  let lastSelectedUid: string | null = null;
  let lastSelectedWireId: string | null = null;
  let hoveredWireId: string | null = null;
  let lastWires: { id: string; a: string; b: string }[] = [];
  let lastVerdict: Verdict | null = null;
  const connectionEndpoints = new Map<
    string,
    { a: THREE.Vector3; b: THREE.Vector3 }
  >();

  // 그룹
  const wiresGroup = new THREE.Group();
  wiresGroup.name = "wires";
  const partsGroup = new THREE.Group();
  partsGroup.name = "parts";
  const ghostGroup = new THREE.Group();
  ghostGroup.name = "ghost";
  // 3D 플로팅 이름표(클릭=객체 선택). 깊이검사 off·상시 표시 → 클릭 충돌 없이 선택.
  const labelsGroup = new THREE.Group();
  labelsGroup.name = "labels";
  // 선택/hover 디버그 라벨(핀 역할·선 의미). 이름표 토글과 분리해 필요한 때만 표시.
  const debugLabelsGroup = new THREE.Group();
  debugLabelsGroup.name = "debug-labels";
  const wireSelectionGroup = new THREE.Group();
  wireSelectionGroup.name = "wire-selection";
  scene.add(
    wiresGroup,
    partsGroup,
    ghostGroup,
    labelsGroup,
    debugLabelsGroup,
    wireSelectionGroup,
  );

  // 인디케이터 (호버=앰버 링, 펜딩=초록 링)
  const ringGeo = new THREE.TorusGeometry(1.7, 0.35, 8, 20);
  ringGeo.rotateX(Math.PI / 2);
  const hoverRing = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({ color: TOKEN.amber, roughness: 0.5 }),
  );
  hoverRing.visible = false;
  const pendingRing = new THREE.Mesh(
    ringGeo.clone(),
    new THREE.MeshStandardMaterial({ color: TOKEN.ok, roughness: 0.5 }),
  );
  pendingRing.visible = false;
  // 고스트 배치 불가 표시(범위초과 등) — 빨강 링
  const ghostInvalidRing = new THREE.Mesh(
    ringGeo.clone(),
    new THREE.MeshStandardMaterial({ color: TOKEN.error, roughness: 0.5 }),
  );
  ghostInvalidRing.visible = false;
  scene.add(hoverRing, pendingRing, ghostInvalidRing);

  const setRing = (ring: THREE.Mesh, id: string | null) => {
    if (!id) {
      ring.visible = false;
      return;
    }
    const p = endpointPos(id);
    if (!p) {
      ring.visible = false;
      return;
    }
    ring.position.set(p.x, p.y + 0.4, p.z);
    ring.visible = true;
  };

  // ── footprint 고스트 (선택 부품이 꽂힐 자리 반투명 미리보기) ──
  const clearGhostMesh = () => {
    for (const c of [...ghostGroup.children]) {
      ghostGroup.remove(c);
      c.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
    }
  };

  const updateGhost = (anchorHoleId: string | null) => {
    // 같은 (부품·홀·방향)이면 재빌드 스킵 — pointermove 마다의 메시 churn 방지
    const key =
      selectedPartDef && anchorHoleId
        ? `${selectedPartDef}:${anchorHoleId}:${orientation}`
        : null;
    if (key === lastGhostKey) return;
    lastGhostKey = key;

    clearGhostMesh();
    ghostInvalidRing.visible = false;
    if (!selectedPartDef || !anchorHoleId) return;

    const pinHoles = computePinHoles(selectedPartDef, anchorHoleId, orientation);
    const positions = pinHoles ? pinHoles.map((h) => holeWorld(h)) : null;
    if (!positions || positions.some((v) => !v)) {
      // 배치 불가 → 앵커 홀에 빨강 링
      const p = holeWorld(anchorHoleId);
      if (p) {
        ghostInvalidRing.position.set(p.x, p.y + 0.4, p.z);
        ghostInvalidRing.visible = true;
      }
      return;
    }

    // 보드밖(free) 부품: 본체를 보드 옆에 + 리드선을 연결될 홀 묶음으로(실제 배치 미러)
    if (PARTS[selectedPartDef]?.mount === "free") {
      const bodyPos = freeBodyPos(anchorHoleId);
      const fg = bodyPos
        ? buildFreeVisual(selectedPartDef, bodyPos, pinHoles!, false)
        : null;
      if (!fg) return;
      ghostifyTree(fg);
      ghostGroup.add(fg);
      return;
    }

    // 고스트는 미캐시 GLB 를 hover 마다 fetch 하지 않음(load:false) → 박스 프록시.
    // 단, 이미 배치돼 캐시가 따뜻하면 buildGlbPart 가 실모델 clone 을 즉시 반환.
    const obj = buildPartMesh(selectedPartDef, positions as THREE.Vector3[], {
      load: false,
    });
    if (!obj) return;
    ghostifyTree(obj);
    ghostGroup.add(obj);
  };

  // ── 피킹 ──
  const updatePointer = (e: PointerEvent) => {
    const r = dom.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  };

  // 보드 윗면 평면(y=0) + 가까운 홀 스냅 허용 반경(홀 사이 클릭 흡수)
  const boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const planeHit = new THREE.Vector3();
  const SNAP_RADIUS = PITCH * 1.5;

  const pickHole = (): string | null => {
    raycaster.setFromCamera(pointer, camera);
    const objs = pinMesh ? [holeMesh, pinMesh] : [holeMesh];
    const hit = raycaster.intersectObjects(objs, false)[0];
    if (hit && hit.instanceId != null) {
      if (pinMesh && hit.object === pinMesh)
        return pins[hit.instanceId]?.id ?? null;
      return holes[hit.instanceId]?.id ?? null;
    }
    // 폴백: 홀을 정확히 못 맞혀도 보드 평면 교차점에서 가장 가까운 홀로 스냅.
    // 빵판이 이동/회전했으면 교차점(world)을 빵판 로컬로 되돌려 로컬 홀좌표와 비교.
    if (!raycaster.ray.intersectPlane(boardPlane, planeHit)) return null;
    const local = planeHit.clone().applyMatrix4(bbInverse);
    let best: typeof holes[0] | null = null;
    let bestD = SNAP_RADIUS;
    for (const h of holes) {
      const d = Math.hypot(h.x - local.x, h.z - local.z);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best?.id ?? null;
  };

  const pickPartUid = (): string | null => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(partsGroup.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData?.uid) return o.userData.uid as string;
        o = o.parent;
      }
    }
    return null;
  };

  const pickConnectionId = (): string | null => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(
      [...wiresGroup.children, ...partsGroup.children],
      true,
    );
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData?.wireId) return o.userData.wireId as string;
        o = o.parent;
      }
    }
    return null;
  };

  const updateDebugLabels = (hoverId: string | null = hoveredWireId) =>
    syncDebugLabels({
      group: debugLabelsGroup,
      parts: lastParts,
      wires: lastWires,
      selectedPartUid: lastSelectedUid,
      selectedWireId: lastSelectedWireId,
      hoveredWireId: hoverId,
      endpointPos,
      connectionMidpoint: (id) => {
        const endpoints = connectionEndpoints.get(id);
        if (!endpoints) return null;
        const mid = endpoints.a.clone().add(endpoints.b).multiplyScalar(0.5);
        mid.y = Math.max(endpoints.a.y, endpoints.b.y) + 8;
        return mid;
      },
      breadboardMatrix: bbMatrix,
    });

  const updateWireSelectionRings = () => {
    clearGroup(wireSelectionGroup);
    if (!lastSelectedWireId) return;
    const wire = lastWires.find((w) => w.id === lastSelectedWireId);
    const endpoints = connectionEndpoints.get(lastSelectedWireId);
    const rings = endpoints
      ? createEndpointRingsAt(endpoints.a, endpoints.b)
      : wire
        ? createEndpointRings(wire, endpointPos)
        : null;
    if (rings) wireSelectionGroup.add(rings);
  };

  // 특정 부품 본체 표면의 클릭 월드좌표(리드 보정용). 마커가 가려도 뒤 본체 hit 채택.
  const pickPartSurface = (uid: string): THREE.Vector3 | null => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(partsGroup.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData?.uid === uid) return h.point.clone();
        o = o.parent;
      }
    }
    return null;
  };

  // 보드 본체 클릭 → "breadboard" | "arduino" | null (가까운 것 우선)
  const pickBoard = (): "breadboard" | "arduino" | null => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([breadboardGroup, arduinoGroup], true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o === breadboardGroup) return "breadboard";
        if (o === arduinoGroup) return "arduino";
        o = o.parent;
      }
    }
    return null;
  };

  // free 부품 핀 마커 클릭 → { uid, pin } (없으면 null)
  const pickLeadPin = (): { uid: string; pin: number } | null => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(partsGroup.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (typeof o.userData?.leadPin === "number")
          return { uid: o.userData.leadUid as string, pin: o.userData.leadPin };
        o = o.parent;
      }
    }
    return null;
  };

  // 포인터 → 보드 평면 교차점을 빵판 로컬 좌표로 (free 소환/이동·고스트 공용)
  const planeLocalFromPointer = (): { x: number; z: number } | null => {
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(boardPlane, planeHit)) return null;
    const local = planeHit.clone().applyMatrix4(bbInverse);
    return { x: local.x, z: local.z };
  };

  // free 부품 소환/이동 미리보기 — 커서 평면 점에 본체 고스트(리드 미연결).
  const updateFreeGhost = (local: { x: number; z: number } | null) => {
    const key =
      selectedPartDef && local
        ? `${selectedPartDef}:free:${local.x.toFixed(1)}:${local.z.toFixed(1)}`
        : null;
    if (key === lastGhostKey) return;
    lastGhostKey = key;
    clearGhostMesh();
    ghostInvalidRing.visible = false;
    if (!selectedPartDef || !local) return;
    const def = PARTS[selectedPartDef];
    if (!def) return;
    const fg = buildFreeVisual(
      selectedPartDef,
      local,
      def.pins.map(() => null),
      false,
    );
    if (!fg) return;
    ghostifyTree(fg);
    ghostGroup.add(fg);
  };

  // ── 3D 플로팅 이름표(객체 선택) ──

  // 부품 라벨 위치(본체 위) — free=bodyPos, board=핀홀 centroid
  const partLabelPos = (p: PlacedPart): THREE.Vector3 | null => {
    if (p.mount === "free" && p.bodyPos) {
      return new THREE.Vector3(p.bodyPos.x, 0, p.bodyPos.z).applyMatrix4(bbMatrix);
    }
    const pts = p.pinHoles.map((h) => holeWorld(h)).filter(Boolean) as THREE.Vector3[];
    if (!pts.length) return null;
    const c = new THREE.Vector3();
    pts.forEach((v) => c.add(v));
    return c.multiplyScalar(1 / pts.length);
  };

  const clearLabels = () => {
    for (const ch of [...labelsGroup.children]) {
      labelsGroup.remove(ch);
      const m = (ch as THREE.Sprite).material as THREE.SpriteMaterial;
      m.map?.dispose();
      m.dispose();
    }
  };

  const addLabel = (text: string, pos: THREE.Vector3, yLift: number, sel: LabelSel) => {
    const spr = makeTextLabel(text);
    spr.position.set(pos.x, pos.y + yLift, pos.z);
    spr.userData.labelSelect = sel;
    labelsGroup.add(spr);
  };

  // 보드 2개 + 부품마다 이름표 재생성 (같은 종류 여럿이면 번호)
  const syncLabels = () => {
    clearLabels();
    addLabel(
      "빵판",
      new THREE.Vector3().setFromMatrixPosition(bbMatrix),
      24,
      { kind: "board", which: "breadboard" },
    );
    addLabel(
      boardRefLabel(), // 활성 보드 짧은 이름(아두이노/ESP32) — 하드코딩 금지
      new THREE.Vector3().setFromMatrixPosition(adMatrix),
      24,
      { kind: "board", which: "arduino" },
    );
    const seen: Record<string, number> = {};
    for (const p of lastParts) {
      const def = PARTS[p.defId];
      if (!def) continue;
      const pos = partLabelPos(p);
      if (!pos) continue;
      seen[p.defId] = (seen[p.defId] ?? 0) + 1;
      const total = lastParts.filter((x) => x.defId === p.defId).length;
      const text = total > 1 ? `${def.label} ${seen[p.defId]}` : def.label;
      addLabel(text, pos, 16, { kind: "part", uid: p.uid });
    }
  };

  const pickLabel = (): LabelSel | null => {
    if (!labelsGroup.visible) return null; // 숨김 상태 → 클릭 통과
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(labelsGroup.children, false)[0];
    return (hit?.object.userData.labelSelect as LabelSel) ?? null;
  };

  // 드래그 vs 클릭
  let downX = 0;
  let downY = 0;
  let downTime = 0;

  const onMove = (e: PointerEvent) => {
    updatePointer(e);
    if (selectedPartDef) {
      // free 부품: 커서 평면 점에 본체 고스트(보드 밖 자유 배치)
      if (PARTS[selectedPartDef]?.mount === "free") {
        const local = planeLocalFromPointer();
        setRing(hoverRing, null);
        updateFreeGhost(local);
        dom.style.cursor = local ? "pointer" : "default";
        return;
      }
      const id = pickHole();
      setRing(hoverRing, null);
      updateGhost(id); // 부품 선택 중 → 전체 footprint 고스트
      dom.style.cursor = id ? "pointer" : "default";
      return;
    }
    updateGhost(null);
    // 이름표 위면 선택 커서(클릭=객체 선택). 가장 쉬운 선택 경로.
    if (pickLabel()) {
      setRing(hoverRing, null);
      dom.style.cursor = "pointer";
      return;
    }
    const wireId = pickConnectionId();
    if (wireId) {
      setRing(hoverRing, null);
      if (hoveredWireId !== wireId) {
        hoveredWireId = wireId;
        syncWires(lastWires, lastSelectedWireId);
      } else {
        updateDebugLabels(wireId);
      }
      dom.style.cursor = "pointer";
      return;
    }
    // 비배치 모드: 부품 본체 위면 선택 호버(홀 링 숨김), 그 외엔 홀 호버.
    // onUp 의 클릭 우선순위(연결 > 부품 > 홀)와 호버를 일치시킨다.
    if (pickPartUid()) {
      setRing(hoverRing, null);
      if (hoveredWireId) {
        hoveredWireId = null;
        syncWires(lastWires, lastSelectedWireId);
      } else {
        updateDebugLabels(null);
      }
      dom.style.cursor = "pointer";
      return;
    }
    if (hoveredWireId) {
      hoveredWireId = null;
      syncWires(lastWires, lastSelectedWireId);
    } else {
      updateDebugLabels(null);
    }
    const id = pickHole();
    setRing(hoverRing, id);
    dom.style.cursor = id ? "pointer" : "default";
  };

  const onDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
    downTime = performance.now();
  };

  const onUp = (e: PointerEvent) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    const dt = performance.now() - downTime;
    if (moved > 8 || dt > 500) return; // 궤도 회전 → 무시 (탭 흔들림 허용)
    if (e.button !== 0) return;
    updatePointer(e);

    // 보드 이동 모드: 다음 평면 클릭 → 보드를 그 지점으로 이동(현재 원점 대비 dx,dz)
    if (boardRelocating) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(boardPlane, planeHit)) {
        const m = boardRelocating === "breadboard" ? bbMatrix : adMatrix;
        const origin = new THREE.Vector3().setFromMatrixPosition(m);
        cb.onMoveBoardBy?.(
          boardRelocating,
          planeHit.x - origin.x,
          planeHit.z - origin.z,
        );
      }
      return;
    }

    // 리드 보정 모드: 본체 클릭점 → 모델 로컬좌표로 현재 핀 시작점 저장
    if (calibratingUid) {
      const part = lastParts.find((p) => p.uid === calibratingUid);
      if (part?.bodyPos) {
        const hit = pickPartSurface(calibratingUid);
        if (hit) {
          cb.onSetLeadAnchor?.(
            calibratingUid,
            calibratePin,
            worldToLeadLocal(hit, part.defId, part.bodyPos, part.rot ?? 0, bbMatrix),
          );
        }
      }
      return;
    }

    // 배치 모드: 클릭 = 부품 배치
    if (selectedPartDef) {
      // free 부품 → 빵판 로컬 평면 점에 소환/이동(보드 밖 자유 위치)
      if (PARTS[selectedPartDef]?.mount === "free") {
        const local = planeLocalFromPointer();
        if (local) cb.onPlaceFree?.(local.x, local.z);
        return;
      }
      const holeId = pickHole();
      if (holeId) cb.onPlacePart?.(holeId);
      return;
    }

    // 0) 이름표 클릭 → 객체 선택(가장 쉬운 선택 경로, 홀/부품보다 우선)
    const lbl = pickLabel();
    if (lbl) {
      if (pendingHoleId) {
        pendingHoleId = null;
        setRing(pendingRing, null);
      }
      cb.onSelectWire?.(null);
      if (lbl.kind === "board") cb.onSelectBoard?.(lbl.which);
      else cb.onSelectPart?.(lbl.uid);
      return;
    }

    // 1) free 부품 핀 마커 클릭 → 리드 연결 시작/취소(같은 핀 다시=취소)
    const lead = pickLeadPin();
    if (lead) {
      pendingHoleId = null; // 배선 대기와 리드 대기는 배타
      pendingLead =
        pendingLead && pendingLead.uid === lead.uid && pendingLead.pin === lead.pin
          ? null
          : lead;
      showLeadRing();
      return;
    }

    const holeId = pickHole();

    // 2) 리드 연결 대기 중 → 홀 클릭=연결, 빈 곳=취소
    if (pendingLead) {
      if (holeId) cb.onConnectLead?.(pendingLead.uid, pendingLead.pin, holeId);
      pendingLead = null;
      showLeadRing();
      return;
    }

    // 3) 연결 클릭 → 점퍼선/리드선 선택(의미 라벨/우측 정보)
    const wireId = pickConnectionId();
    if (wireId) {
      if (pendingHoleId) {
        pendingHoleId = null;
        setRing(pendingRing, null);
      }
      cb.onSelectPart?.(null);
      cb.onSelectBoard?.(null);
      cb.onSelectWire?.(wireId);
      return;
    }

    // 4) 부품 본체 직격이면 선택을 우선한다(평면 스냅이 홀을 삼키기 전에).
    const uid = pickPartUid();
    if (uid) {
      if (pendingHoleId) {
        pendingHoleId = null;
        setRing(pendingRing, null);
      }
      cb.onSelectWire?.(null);
      cb.onSelectPart?.(uid);
      return;
    }

    // 5) 홀/핀 → 배선 상태머신
    if (holeId) {
      if (!pendingHoleId) {
        pendingHoleId = holeId;
        setRing(pendingRing, holeId);
      } else if (pendingHoleId !== holeId) {
        cb.onAddWire?.(pendingHoleId, holeId);
        pendingHoleId = null;
        setRing(pendingRing, null);
      } else {
        pendingHoleId = null;
        setRing(pendingRing, null);
      }
      return;
    }

    // 6) 보드 본체 클릭(홀 없는 영역) → 보드 선택
    const board = pickBoard();
    if (board) {
      cb.onSelectBoard?.(board);
      cb.onSelectWire?.(null);
      if (pendingHoleId) {
        pendingHoleId = null;
        setRing(pendingRing, null);
      }
      return;
    }

    // 7) 빈 곳 → 선택 해제 + 펜딩 취소
    cb.onSelectPart?.(null);
    cb.onSelectBoard?.(null);
    cb.onSelectWire?.(null);
    if (pendingHoleId) {
      pendingHoleId = null;
      setRing(pendingRing, null);
    }
  };

  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    pendingHoleId = null;
    pendingLead = null;
    setRing(pendingRing, null);
    cb.onCancel?.();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      pendingHoleId = null;
      pendingLead = null;
      setRing(pendingRing, null);
      cb.onCancel?.();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      cb.onDelete?.();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) cb.onRedo?.();
      else cb.onUndo?.();
    } else if (e.key.toLowerCase() === "r") {
      cb.onRotate?.();
    } else if (e.key.toLowerCase() === "m") {
      cb.onRelocate?.();
    }
  };

  dom.addEventListener("pointermove", onMove);
  dom.addEventListener("pointerdown", onDown);
  dom.addEventListener("pointerup", onUp);
  dom.addEventListener("contextmenu", onContext);
  window.addEventListener("keydown", onKey);

  // ── 동기화 ──
  const clearGroup = (g: THREE.Group) => {
    for (const c of [...g.children]) {
      g.remove(c);
      c.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    }
  };

  const syncWires = (
    wires: { id: string; a: string; b: string }[],
    selectedWireId: string | null = lastSelectedWireId,
  ) => {
    for (const id of [...connectionEndpoints.keys()]) {
      if (!parseLeadConnectionId(id)) connectionEndpoints.delete(id);
    }
    lastWires = wires;
    lastSelectedWireId = selectedWireId;
    clearGroup(wiresGroup);
    syncWireMeshes({
      wires,
      group: wiresGroup,
      selectedWireId: lastSelectedWireId,
      hoveredWireId,
      endpointPos,
      wireColorFor,
      onConnection: (id, a, b) => connectionEndpoints.set(id, { a, b }),
    });
    updateWireSelectionRings();
    updateDebugLabels();
    if (lastParts.length) syncParts(lastParts, lastSelectedUid);
  };

  const stampUid = (obj: THREE.Object3D, uid: string) => {
    obj.userData.uid = uid;
    obj.traverse((o) => (o.userData.uid = uid));
  };

  // 본체 + 리드선 그룹(고스트/실물 공용). 마커·uid·외곽선은 호출부에서.
  // 피그테일(본체→커넥터끝)은 항상, 점퍼(커넥터끝→연결 엔드포인트)는 연결 시.
  const buildFreeVisual = (
    defId: string,
    bodyPos: { x: number; z: number },
    leads: (string | null)[],
    load = true,
    rot: 0 | 1 | 2 | 3 = 0,
    anchors?: ([number, number, number] | null)[],
    uid?: string,
  ): THREE.Group | null => {
    const def = PARTS[defId];
    if (!def) return null;
    // 본체 배치=합성 핀(centroid=bodyPos, yaw=rot). 리드 시작점=보정좌표(있으면).
    const bp = freeBodyPins(defId, bodyPos, rot, bbMatrix);
    const lp = freeLeadPins(defId, bodyPos, rot, bbMatrix, anchors);
    const ends = freeLeadEnds(lp, bodyPos, bbMatrix);
    const body = buildPartMesh(defId, bp, { load });
    if (!body) return null;
    const g = new THREE.Group();
    g.add(body);
    const activeConnectionId = lastSelectedWireId ?? hoveredWireId;
    def.pins.forEach((pin, i) => {
      const connectionId = uid ? connectionIdForLead(uid, i) : null;
      const finalEndpoint = leads[i] ? endpointPos(leads[i]!) : null;
      if (connectionId) {
        connectionEndpoints.set(connectionId, {
          a: lp[i].clone(),
          b: (finalEndpoint ?? ends[i]).clone(),
        });
      }
      // 피그테일: 본체 커넥터 → 끝(암컷). 항상 표시. 홀에 꽂는 게 아니라 캡 없음.
      const tail = buildWire(lp[i], ends[i], leadColor(pin.role), {
        capA: false,
        capB: false,
        radius: connectionId === activeConnectionId ? 1.25 : 0.85,
      });
      if (connectionId) decorateConnectionMesh(tail, connectionId, activeConnectionId);
      g.add(tail);
      // 점퍼: 끝 → 연결된 홀/아두이노핀. 연결됐을 때만. 홀 쪽(b)에만 캡.
      const ep = leads[i];
      if (!ep) return;
      const at = finalEndpoint;
      if (at) {
        const jumper = buildWire(ends[i], at, leadColor(pin.role), {
          capA: false,
          capB: true,
          radius: connectionId === activeConnectionId ? 1.25 : 0.85,
        });
        if (connectionId)
          decorateConnectionMesh(jumper, connectionId, activeConnectionId);
        g.add(jumper);
      }
    });
    return g;
  };

  const renderFreePart = (p: PlacedPart, selectedUid: string | null) => {
    const def = PARTS[p.defId];
    if (!def || !p.bodyPos) return;
    const eps = partEndpoints(p);
    const g = buildFreeVisual(
      p.defId,
      p.bodyPos,
      eps,
      true,
      p.rot ?? 0,
      p.leadAnchors,
      p.uid,
    );
    if (!g) return;
    if (p.uid === selectedUid) addOutline(g);
    stampUid(g, p.uid);
    partsGroup.add(g);
    // 선택 시 핀 마커(리드 연결/재연결 핸들) — 보정된 커넥터 시작점에.
    // 보정 모드면 현재 찍을 핀을 초록으로 강조.
    if (p.uid === selectedUid) {
      const lp = freeLeadPins(p.defId, p.bodyPos, p.rot ?? 0, bbMatrix, p.leadAnchors);
      const ends = freeLeadEnds(lp, p.bodyPos, bbMatrix);
      const calibrating = calibratingUid === p.uid;
      def.pins.forEach((pin, i) => {
        const color = calibrating
          ? i === calibratePin
            ? TOKEN.ok
            : TOKEN.amber
          : eps[i]
            ? leadColor(pin.role)
            : TOKEN.amber;
        const m = leadMarker(color);
        // 보정 모드면 본체 커넥터(lp, 약간 띄움), 평소엔 선 끝(핀=연결 지점)에 정확히 붙임
        const at = calibrating ? lp[i] : ends[i];
        m.position.set(at.x, at.y + (calibrating ? 2 : 0), at.z);
        m.userData.leadUid = p.uid;
        m.userData.leadPin = i;
        partsGroup.add(m);
      });
    }
  };

  const syncParts = (parts: PlacedPart[], selectedUid: string | null) => {
    for (const id of [...connectionEndpoints.keys()]) {
      if (parseLeadConnectionId(id)) connectionEndpoints.delete(id);
    }
    lastParts = parts;
    lastSelectedUid = selectedUid;
    clearGroup(partsGroup);
    for (const p of parts) {
      if (p.mount === "free") {
        renderFreePart(p, selectedUid);
        continue;
      }
      const pts = p.pinHoles.map((h) => holeWorld(h));
      if (pts.some((v) => !v)) continue;
      const obj = buildPartMesh(p.defId, pts as THREE.Vector3[]);
      if (!obj) continue;
      if (p.defId === "led") {
        const state = visualStateFromVerdict(lastVerdict);
        setLedDomeState(obj, state.workingLedUids.has(p.uid));
      }
      if (p.uid === selectedUid) {
        addOutline(obj);
        addPolarityMarkers(obj, p);
      }
      // uid 는 외곽선·마커까지 모두 부여(클릭 시 선택 유지)
      stampUid(obj, p.uid);
      partsGroup.add(obj);
    }
    showLeadRing(); // 재동기화 후 대기 링 위치 갱신
    syncLabels(); // 부품 목록 변동 → 이름표 갱신
    updateWireSelectionRings();
    updateDebugLabels();
  };

  const syncVisualState = (verdict: Verdict | null) => {
    lastVerdict = verdict;
    const state = visualStateFromVerdict(verdict);
    partsGroup.children.forEach((child) => {
      const uid = child.userData.uid as string | undefined;
      if (uid) setLedDomeState(child, state.workingLedUids.has(uid));
    });
  };

  // 리드 연결 대기 표시 — 선택 핀 마커 위에 초록 링
  const showLeadRing = () => {
    if (!pendingLead) {
      pendingRing.visible = false;
      return;
    }
    const p = lastParts.find((x) => x.uid === pendingLead!.uid);
    if (!p || !p.bodyPos) {
      pendingRing.visible = false;
      return;
    }
    const lp = freeLeadPins(p.defId, p.bodyPos, p.rot ?? 0, bbMatrix, p.leadAnchors);
    const bp = freeLeadEnds(lp, p.bodyPos, bbMatrix)[pendingLead.pin];
    pendingRing.position.set(bp.x, bp.y + 0.4, bp.z);
    pendingRing.visible = true;
  };

  // 선택된 극성 부품에 +/− 표시 (캡 + 라벨 스프라이트)
  const addPolarityMarkers = (obj: THREE.Object3D, p: PlacedPart) => {
    const def = PARTS[p.defId];
    if (!def?.polarity) return;
    def.pins.forEach((pin, i) => {
      const pos = holeWorld(p.pinHoles[i]);
      if (!pos) return;
      const sign: "+" | "-" = pin.role === "gnd" ? "-" : "+";
      obj.add(polarityMarker(pos, sign));
    });
  };

  const dispose = () => {
    dom.removeEventListener("pointermove", onMove);
    dom.removeEventListener("pointerdown", onDown);
    dom.removeEventListener("pointerup", onUp);
    dom.removeEventListener("contextmenu", onContext);
    window.removeEventListener("keydown", onKey);
    clearGroup(wiresGroup);
    clearGroup(partsGroup);
    clearGroup(wireSelectionGroup);
    clearGhostMesh();
    clearLabels();
    clearSpriteLabels(debugLabelsGroup);
    scene.remove(
      wiresGroup,
      partsGroup,
      ghostGroup,
      labelsGroup,
      debugLabelsGroup,
      wireSelectionGroup,
      hoverRing,
      pendingRing,
      ghostInvalidRing,
    );
  };

  return {
    setSelectedPartDef: (d) => {
      selectedPartDef = d;
      if (d) {
        pendingHoleId = null;
        setRing(pendingRing, null);
      } else {
        updateGhost(null); // 선택 해제 → 고스트 제거
      }
    },
    setOrientation: (o) => {
      orientation = o;
    },
    setCallbacks: (c) => {
      cb = c;
    },
    syncWires,
    syncParts,
    syncVisualState,
    setBoardMatrices: (bb, ad) => {
      bbMatrix.copy(bb);
      adMatrix.copy(ad);
      bbInverse.copy(bb).invert();
      // pose 반영해 부품·배선 재빌드(좌표 함수가 새 행렬을 참조)
      syncWires(lastWires);
      syncParts(lastParts, lastSelectedUid);
    },
    setBoardRelocating: (which) => {
      boardRelocating = which;
    },
    setCalibrating: (uid, pinIndex) => {
      calibratingUid = uid;
      calibratePin = pinIndex;
    },
    setLabelsVisible: (visible) => {
      labelsGroup.visible = visible;
    },
    dispose,
  };
}
