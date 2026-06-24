"use client";

import { useEffect, useRef } from "react";
import {
  createCalibratorScene,
  type CalibratorSceneHandle,
} from "../three/calibratorScene";
import type { DraftSpec } from "../hooks/useCalibrator";

/** 3D 캔버스 — 씬 1회 구성, spec 변경 시 실시간 변환 적용. */
interface Props {
  assetId: string | null;
  spec: DraftSpec;
  onPartLoaded?: (baseLongest: number) => void;
}

export function CalibratorScene({ assetId, spec, onPartLoaded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CalibratorSceneHandle | null>(null);

  // onPartLoaded 최신값을 1회 구성 effect 가 보도록 ref 보관
  const loadedRef = useRef(onPartLoaded);
  useEffect(() => {
    loadedRef.current = onPartLoaded;
  });

  // 씬 1회 구성
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = createCalibratorScene(container, {
      onPartLoaded: (b) => loadedRef.current?.(b),
    });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // 선택/값 변경 → 실시간 적용
  useEffect(() => {
    sceneRef.current?.applySpec(assetId, spec);
  }, [assetId, spec]);

  return <div ref={containerRef} className="h-full w-full" />;
}
