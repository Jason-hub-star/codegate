"use client";

import { useCallback, useRef, useState } from "react";
import {
  PARTS,
  placePart,
  placeFreeAtAnchor,
  placeFreePart,
  moveFreeBody,
  rotateFreeBody,
  setLeadAnchor,
  reanchorPart,
  withLead,
  computePinHoles,
  DEFAULT_POSE,
  type PlacedPart,
  type Wire,
  type CircuitModel,
  type BoardPose,
  type Layout,
} from "@/features/circuit";

export type BoardId = "breadboard" | "arduino";

export interface WiringApi {
  wires: Wire[];
  parts: PlacedPart[];
  selectedPartDef: string | null;
  selectedPartUid: string | null;
  selectedWireId: string | null;
  orientation: 0 | 1;
  model: CircuitModel;
  relocating: boolean;
  // 보드(빵판·아두이노) 이동/회전 (pose, DEC-039 후속)
  breadboardPose: BoardPose;
  arduinoPose: BoardPose;
  selectedBoard: BoardId | null;
  relocatingBoard: BoardId | null;
  // in-page 리드 보정 — 보정 중인 free 부품 uid + 현재 찍을 핀 인덱스
  calibratingUid: string | null;
  calibratePin: number;
  layout: Layout;
  selectPartDef: (defId: string | null) => void;
  placeAt: (anchorHoleId: string) => void;
  placeFreeAt: (x: number, z: number) => void;
  addWire: (a: string, b: string) => void;
  selectPart: (uid: string | null) => void;
  selectWire: (id: string | null) => void;
  removePart: (uid: string) => void;
  deleteSelected: () => void;
  beginRelocate: () => void;
  connectLead: (uid: string, pinIndex: number, endpoint: string) => void;
  beginCalibrateLead: () => void;
  setLeadAnchorAt: (
    uid: string,
    pinIndex: number,
    coord: [number, number, number],
  ) => void;
  cancel: () => void;
  rotate: () => void;
  selectBoard: (which: BoardId | null) => void;
  moveBoardBy: (which: BoardId, dx: number, dz: number) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  load: (model: CircuitModel, layout?: Layout) => void;
}

interface Snapshot {
  wires: Wire[];
  parts: PlacedPart[];
  breadboardPose: BoardPose;
  arduinoPose: BoardPose;
}

export function useWiring(): WiringApi {
  const [wires, setWires] = useState<Wire[]>([]);
  const [parts, setParts] = useState<PlacedPart[]>([]);
  const [selectedPartDef, setSelectedPartDef] = useState<string | null>(null);
  const [selectedPartUid, setSelectedPartUid] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<0 | 1>(0);
  // 이동(relocate) 중인 부품 uid — 설정 시 배치-유사 모드로 진입(고스트·스냅 재사용),
  // 다음 홀 클릭이 새 배치가 아니라 이 부품의 재배치가 된다.
  const [relocateUid, setRelocateUid] = useState<string | null>(null);
  // 보드 pose + 보드 선택/이동 모드
  const [breadboardPose, setBreadboardPose] = useState<BoardPose>(DEFAULT_POSE);
  const [arduinoPose, setArduinoPose] = useState<BoardPose>(DEFAULT_POSE);
  const [selectedBoard, setSelectedBoard] = useState<BoardId | null>(null);
  const [relocatingBoard, setRelocatingBoard] = useState<BoardId | null>(null);
  // in-page 리드 보정 — 보정 중 free 부품 uid + 현재 핀
  const [calibratingUid, setCalibratingUid] = useState<string | null>(null);
  const [calibratePin, setCalibratePin] = useState(0);

  const wireSeq = useRef(0);
  const history = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);

  const pushHistory = useCallback(() => {
    history.current.push({ wires, parts, breadboardPose, arduinoPose });
    if (history.current.length > 50) history.current.shift();
    future.current = []; // 새 동작 → redo 분기 폐기
  }, [wires, parts, breadboardPose, arduinoPose]);

  const selectPartDef = useCallback((defId: string | null) => {
    setSelectedPartDef(defId);
    setRelocateUid(null); // 새 부품 선택 → 이동 모드 해제
    setCalibratingUid(null); // 새 부품 선택 → 보정 모드 해제
    if (defId) {
      setSelectedPartUid(null);
      setSelectedWireId(null);
      setSelectedBoard(null);
      setRelocatingBoard(null);
    }
  }, []);

  const placeAt = useCallback(
    (anchorHoleId: string) => {
      // 이동 모드: 새 앵커로 기존 부품 재배치(board/free 모두 reanchorPart 가 처리)
      if (relocateUid) {
        const part = parts.find((x) => x.uid === relocateUid);
        if (part) {
          const moved = reanchorPart(part, anchorHoleId, orientation);
          if (moved) {
            pushHistory();
            setParts((p) => p.map((x) => (x.uid === relocateUid ? moved : x)));
            setSelectedPartDef(null);
            setRelocateUid(null);
            setSelectedPartUid(relocateUid); // 이동 후 다시 선택 유지
          }
          // null(보드 밖) → 무시, 이동 모드 유지
        }
        return;
      }
      if (!selectedPartDef) return;
      // 보드밖(free) 부품은 본체를 보드 옆에 두고 리드를 홀 묶음에 연결
      const placed =
        PARTS[selectedPartDef]?.mount === "free"
          ? placeFreeAtAnchor(selectedPartDef, anchorHoleId, orientation)
          : placePart(selectedPartDef, anchorHoleId, orientation);
      if (!placed) return; // 배치 불가(보드 밖 등) → 무시
      pushHistory();
      setParts((p) => [...p, placed]);
      setSelectedPartDef(null); // 배치 후 모드 종료
      setSelectedPartUid(placed.uid); // 방금 놓은 부품 선택 → 즉시 회전/이동
    },
    [relocateUid, parts, selectedPartDef, orientation, pushHistory],
  );

  // free 부품을 빵판 로컬 좌표에 소환(신규) 또는 이동(relocate 중) — leads 보존
  const placeFreeAt = useCallback(
    (x: number, z: number) => {
      // 이동 모드: 기존 free 본체만 새 위치로(연결 유지)
      if (relocateUid) {
        const part = parts.find((p) => p.uid === relocateUid);
        if (part && part.mount === "free") {
          pushHistory();
          setParts((ps) =>
            ps.map((p) =>
              p.uid === relocateUid ? moveFreeBody(p, { x, z }) : p,
            ),
          );
          setSelectedPartDef(null);
          setRelocateUid(null);
          setSelectedPartUid(relocateUid);
        }
        return;
      }
      // 신규 소환: free 부품만(leads 전부 미연결로 시작)
      if (!selectedPartDef || PARTS[selectedPartDef]?.mount !== "free") return;
      const placed = placeFreePart(selectedPartDef, { x, z });
      if (!placed) return;
      pushHistory();
      setParts((p) => [...p, placed]);
      setSelectedPartDef(null);
      setSelectedPartUid(placed.uid);
    },
    [relocateUid, parts, selectedPartDef, pushHistory],
  );

  const addWire = useCallback(
    (a: string, b: string) => {
      wireSeq.current += 1;
      const id = `w${wireSeq.current}`;
      pushHistory();
      setWires((w) => [...w, { id, a, b }]);
      setSelectedWireId(id);
      setSelectedPartUid(null);
      setSelectedBoard(null);
    },
    [pushHistory],
  );

  const selectPart = useCallback((uid: string | null) => {
    setSelectedPartUid(uid);
    setSelectedWireId(null);
    setRelocateUid(null); // 선택 변경 → 이동 모드 해제
    setCalibratingUid(null); // 선택 변경 → 보정 모드 해제
    if (uid) {
      setSelectedPartDef(null);
      setSelectedBoard(null);
      setRelocatingBoard(null);
    }
  }, []);

  const selectWire = useCallback((id: string | null) => {
    setSelectedWireId(id);
    setRelocateUid(null);
    setCalibratingUid(null);
    if (id) {
      setSelectedPartUid(null);
      setSelectedPartDef(null);
      setSelectedBoard(null);
      setRelocatingBoard(null);
    }
  }, []);

  // 보드(빵판·아두이노) 선택 — 부품 선택/모드 해제
  const selectBoard = useCallback((which: BoardId | null) => {
    setSelectedBoard(which);
    setSelectedWireId(null);
    setRelocatingBoard(null);
    setCalibratingUid(null);
    if (which) {
      setSelectedPartUid(null);
      setSelectedPartDef(null);
      setRelocateUid(null);
    }
  }, []);

  // 보드를 (dx,dz) 만큼 이동(이동 모드 클릭 결과) — pose 누적
  const moveBoardBy = useCallback(
    (which: BoardId, dx: number, dz: number) => {
      pushHistory();
      const upd = (p: BoardPose): BoardPose => ({ ...p, x: p.x + dx, z: p.z + dz });
      if (which === "breadboard") setBreadboardPose(upd);
      else setArduinoPose(upd);
      setRelocatingBoard(null);
    },
    [pushHistory],
  );

  // 선택 부품 또는 선택 보드를 이동 모드로 — 보드 우선
  const beginRelocate = useCallback(() => {
    if (selectedBoard) {
      setRelocatingBoard(selectedBoard);
      return;
    }
    if (!selectedPartUid) return;
    const part = parts.find((x) => x.uid === selectedPartUid);
    if (!part) return;
    setRelocateUid(selectedPartUid);
    setSelectedPartDef(part.defId); // 고스트·스냅 머신 재사용
    setOrientation(part.orientation);
    setSelectedPartUid(null); // 배치-유사 모드
  }, [selectedBoard, selectedPartUid, parts]);

  // free 부품의 한 리드를 끝점(홀/아두이노핀)에 연결/재연결
  const connectLead = useCallback(
    (uid: string, pinIndex: number, endpoint: string) => {
      pushHistory();
      setParts((p) =>
        p.map((x) => (x.uid === uid ? withLead(x, pinIndex, endpoint) : x)),
      );
    },
    [pushHistory],
  );

  // in-page 리드 보정 시작 — 선택된 free 부품의 본체를 클릭해 3선 시작점을 찍는다
  const beginCalibrateLead = useCallback(() => {
    if (!selectedPartUid) return;
    const part = parts.find((x) => x.uid === selectedPartUid);
    if (!part || part.mount !== "free") return;
    setCalibratingUid(selectedPartUid);
    setCalibratePin(0);
  }, [selectedPartUid, parts]);

  // 본체 클릭점(모델 로컬좌표)을 해당 핀 시작점에 저장 → 다음 핀으로, 끝이면 종료
  const setLeadAnchorAt = useCallback(
    (uid: string, pinIndex: number, coord: [number, number, number]) => {
      const part = parts.find((x) => x.uid === uid);
      if (!part || part.mount !== "free") return;
      pushHistory();
      setParts((ps) =>
        ps.map((p) => (p.uid === uid ? setLeadAnchor(p, pinIndex, coord) : p)),
      );
      const n = PARTS[part.defId]?.pins.length ?? 0;
      if (pinIndex + 1 < n) setCalibratePin(pinIndex + 1);
      else setCalibratingUid(null); // 마지막 핀 → 보정 종료
    },
    [parts, pushHistory],
  );

  // 배치/이동 취소 — 이동 중이면 원래 선택으로 복귀
  const cancel = useCallback(() => {
    setSelectedPartDef(null);
    if (relocateUid) setSelectedPartUid(relocateUid);
    setRelocateUid(null);
    setRelocatingBoard(null); // 보드 이동 모드도 취소
    setCalibratingUid(null); // 리드 보정 모드도 취소
  }, [relocateUid]);

  // 특정 부품 인스턴스 제거 (BOM 명세 삭제·향후 핫링크 공용)
  const removePart = useCallback(
    (uid: string) => {
      pushHistory();
      setParts((p) => p.filter((x) => x.uid !== uid));
      setSelectedPartUid((cur) => (cur === uid ? null : cur));
    },
    [pushHistory],
  );

  const deleteSelected = useCallback(() => {
    if (selectedWireId) {
      const isModelWire = wires.some((wire) => wire.id === selectedWireId);
      if (!isModelWire) {
        setSelectedWireId(null);
        return;
      }
      pushHistory();
      setWires((w) => w.filter((wire) => wire.id !== selectedWireId));
      setSelectedWireId(null);
    } else if (selectedPartUid) {
      pushHistory();
      setParts((p) => p.filter((x) => x.uid !== selectedPartUid));
      setSelectedPartUid(null);
    } else if (wires.length) {
      pushHistory();
      setWires((w) => w.slice(0, -1));
    }
  }, [selectedWireId, selectedPartUid, wires, pushHistory]);

  const rotate = useCallback(() => {
    // 보드가 선택돼 있으면 보드를 90° 회전(부품 회전보다 우선)
    if (selectedBoard) {
      pushHistory();
      const rot90 = (p: BoardPose): BoardPose => ({
        ...p,
        rot: (((p.rot + 1) % 4) as 0 | 1 | 2 | 3),
      });
      if (selectedBoard === "breadboard") setBreadboardPose(rot90);
      else setArduinoPose(rot90);
      return;
    }
    // free 부품: 본체 90° 회전(rot+1) — board 부품의 orientation 토글과 분리
    if (selectedPartUid) {
      const part = parts.find((p) => p.uid === selectedPartUid);
      if (part?.mount === "free") {
        pushHistory();
        setParts((ps) =>
          ps.map((p) => (p.uid === selectedPartUid ? rotateFreeBody(p) : p)),
        );
        return;
      }
    }
    const next: 0 | 1 = orientation === 0 ? 1 : 0;
    setOrientation(next);
    if (selectedPartUid) {
      setParts((p) =>
        p.map((part) => {
          if (part.uid !== selectedPartUid) return part;
          const pinHoles = computePinHoles(
            part.defId,
            part.anchorHoleId,
            next,
          );
          if (!pinHoles) return part; // 회전 시 보드 밖이면 유지
          return { ...part, orientation: next, pinHoles };
        }),
      );
    }
  }, [selectedBoard, pushHistory, orientation, selectedPartUid, parts]);

  const restoreBoardSelection = () => {
    setSelectedPartUid(null);
    setSelectedWireId(null);
    setRelocateUid(null);
    setSelectedBoard(null);
    setRelocatingBoard(null);
    setCalibratingUid(null);
  };

  const undo = useCallback(() => {
    const snap = history.current.pop();
    if (!snap) return;
    future.current.push({ wires, parts, breadboardPose, arduinoPose }); // redo 스택
    setWires(snap.wires);
    setParts(snap.parts);
    setBreadboardPose(snap.breadboardPose);
    setArduinoPose(snap.arduinoPose);
    restoreBoardSelection();
  }, [wires, parts, breadboardPose, arduinoPose]);

  const redo = useCallback(() => {
    const snap = future.current.pop();
    if (!snap) return;
    history.current.push({ wires, parts, breadboardPose, arduinoPose });
    setWires(snap.wires);
    setParts(snap.parts);
    setBreadboardPose(snap.breadboardPose);
    setArduinoPose(snap.arduinoPose);
    restoreBoardSelection();
  }, [wires, parts, breadboardPose, arduinoPose]);

  const clear = useCallback(() => {
    pushHistory();
    setWires([]);
    setParts([]);
    restoreBoardSelection();
  }, [pushHistory]);

  const load = useCallback(
    (model: CircuitModel, layout?: Layout) => {
      pushHistory();
      setWires(model.wires);
      setParts(model.parts);
      setBreadboardPose(layout?.breadboard ?? DEFAULT_POSE);
      setArduinoPose(layout?.arduino ?? DEFAULT_POSE);
      setSelectedPartDef(null);
      setSelectedWireId(null);
      restoreBoardSelection();
    },
    [pushHistory],
  );

  const isDefaultPose = (p: BoardPose) => p.x === 0 && p.z === 0 && p.rot === 0;
  // 공유/저장용 레이아웃 — 기본 pose는 생략(기존 링크 하위호환·링크 길이 절약)
  const layout: Layout = {
    ...(isDefaultPose(breadboardPose) ? {} : { breadboard: breadboardPose }),
    ...(isDefaultPose(arduinoPose) ? {} : { arduino: arduinoPose }),
  };

  return {
    wires,
    parts,
    selectedPartDef,
    selectedPartUid,
    selectedWireId,
    orientation,
    relocating: relocateUid !== null,
    breadboardPose,
    arduinoPose,
    selectedBoard,
    relocatingBoard,
    calibratingUid,
    calibratePin,
    layout,
    model: { wires, parts },
    selectPartDef,
    placeAt,
    placeFreeAt,
    addWire,
    selectPart,
    selectWire,
    removePart,
    deleteSelected,
    beginRelocate,
    connectLead,
    beginCalibrateLead,
    setLeadAnchorAt,
    cancel,
    rotate,
    selectBoard,
    moveBoardBy,
    undo,
    redo,
    clear,
    load,
  };
}
