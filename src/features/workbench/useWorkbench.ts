"use client";

/**
 * 작업대 선택 상태 허브 — 빵판 스왑(하프↔풀) + 보드 스왑(아두이노↔ESP32)을 담당.
 * useWiring(회로 상태)과 분리. 두 스왑 모두 같은 규약: 도메인 활성 교체 + 회로 초기화(결정③).
 *  · 빵판: setActiveBreadboard / currentBreadboard / pendingSwap
 *  · 보드: setActiveBoard / currentBoard / pendingBoardSwap
 * 회로 비었으면 즉시 스왑, 아니면 확인창(pending) 대기.
 */
import { useCallback, useState } from "react";
import {
  setActiveBreadboard,
  setActiveBoard,
  type BreadboardId,
  type BoardId,
} from "@/features/circuit";

export interface WorkbenchApi {
  currentBreadboard: BreadboardId;
  /** 확인 대기 중인 빵판 스왑 대상 (null = 없음) */
  pendingSwap: BreadboardId | null;
  /** 빵판 스왑 요청 — 회로 비었으면 즉시, 아니면 확인창 대기 */
  requestSwap: (id: BreadboardId) => void;
  confirmSwap: () => void;
  cancelSwap: () => void;
  // ── 보드 스왑 (빵판 미러) ──
  currentBoard: BoardId;
  /** 확인 대기 중인 보드 스왑 대상 (null = 없음) */
  pendingBoardSwap: BoardId | null;
  requestBoardSwap: (id: BoardId) => void;
  confirmBoardSwap: () => void;
  cancelBoardSwap: () => void;
}

interface Options {
  /** 회로 초기화 (useWiring.clear) */
  resetCircuit: () => void;
  /** 현재 회로가 비었는가 (비었으면 확인 없이 즉시 스왑) */
  isEmpty: boolean;
}

export function useWorkbench({ resetCircuit, isEmpty }: Options): WorkbenchApi {
  const [currentBreadboard, setCurrent] = useState<BreadboardId>("half");
  const [pendingSwap, setPendingSwap] = useState<BreadboardId | null>(null);
  const [currentBoard, setCurrentBoard] = useState<BoardId>("arduino-uno");
  const [pendingBoardSwap, setPendingBoardSwap] = useState<BoardId | null>(null);

  const doSwap = useCallback(
    (id: BreadboardId) => {
      setActiveBreadboard(id); // 도메인 레이아웃 교체(+ getHoleMap 캐시 무효화)
      setCurrent(id); // Scene 재마운트 트리거(prop)
      resetCircuit(); // 결정③: 스왑 시 회로 초기화
    },
    [resetCircuit],
  );

  const requestSwap = useCallback(
    (id: BreadboardId) => {
      if (id === currentBreadboard) return;
      if (isEmpty) doSwap(id);
      else setPendingSwap(id);
    },
    [currentBreadboard, isEmpty, doSwap],
  );

  const confirmSwap = useCallback(() => {
    if (pendingSwap) doSwap(pendingSwap);
    setPendingSwap(null);
  }, [pendingSwap, doSwap]);

  const cancelSwap = useCallback(() => setPendingSwap(null), []);

  // ── 보드 스왑 (빵판과 동일 규약) ──
  const doBoardSwap = useCallback(
    (id: BoardId) => {
      setActiveBoard(id); // 활성 보드 교체(+ 핀 캐시 무효화)
      setCurrentBoard(id); // Scene 재마운트 트리거(board prop)
      resetCircuit(); // 결정③: 스왑 시 회로 초기화(핀 매핑 변환 안 함)
    },
    [resetCircuit],
  );

  const requestBoardSwap = useCallback(
    (id: BoardId) => {
      if (id === currentBoard) return;
      if (isEmpty) doBoardSwap(id);
      else setPendingBoardSwap(id);
    },
    [currentBoard, isEmpty, doBoardSwap],
  );

  const confirmBoardSwap = useCallback(() => {
    if (pendingBoardSwap) doBoardSwap(pendingBoardSwap);
    setPendingBoardSwap(null);
  }, [pendingBoardSwap, doBoardSwap]);

  const cancelBoardSwap = useCallback(() => setPendingBoardSwap(null), []);

  return {
    currentBreadboard,
    pendingSwap,
    requestSwap,
    confirmSwap,
    cancelSwap,
    currentBoard,
    pendingBoardSwap,
    requestBoardSwap,
    confirmBoardSwap,
    cancelBoardSwap,
  };
}
