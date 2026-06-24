"use client";

import { useEffect, useState } from "react";
import { getPartThumbnails, getGlbThumbnails } from "@/features/breadboard-3d";

/**
 * 부품 썸네일(defId → PNG dataUrl). 마운트 시 생성(클라이언트 전용).
 * 절차 부품은 동기 즉시, GLB 부품은 소스 fetch 후 비동기로 병합(준비되면 카드 갱신).
 */
export function usePartThumbnails(): Record<string, string> {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    // WebGL 컨텍스트는 클라이언트 전용 → 마운트 후 생성(SSR 결과와 일치 유지).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThumbs(getPartThumbnails());

    let alive = true;
    getGlbThumbnails().then((glb) => {
      if (alive && Object.keys(glb).length > 0) {
        setThumbs((prev) => ({ ...prev, ...glb }));
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  return thumbs;
}
