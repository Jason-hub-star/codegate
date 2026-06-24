"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "pinmate.favorites";

export interface FavoritesApi {
  /** 즐겨찾기한 부품 defId 목록 (추가 순) */
  favorites: string[];
  isFavorite: (defId: string) => boolean;
  toggle: (defId: string) => void;
}

/**
 * 부품 즐겨찾기 — 팔레트 전용 UI 취향(회로/LLM 데이터 아님 → useWiring 비종속, 드리프트 0).
 * localStorage 영속(새로고침 유지). SSR 하이드레이션 안전(마운트 후 로드).
 */
export function useFavorites(): FavoritesApi {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    // SSR 하이드레이션 안전: 서버=빈 목록 렌더 → 마운트 후 localStorage 반영.
    // (lazy 초기화는 서버/클라 첫 렌더 불일치를 유발하므로 effect 패턴이 정석)
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      // 손상/차단 시 빈 목록 유지
    }
  }, []);

  const toggle = useCallback((defId: string) => {
    setFavorites((cur) => {
      const next = cur.includes(defId)
        ? cur.filter((d) => d !== defId)
        : [...cur, defId];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // 저장 실패해도 메모리 상태는 갱신
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (defId: string) => favorites.includes(defId),
    [favorites],
  );

  return { favorites, isFavorite, toggle };
}
