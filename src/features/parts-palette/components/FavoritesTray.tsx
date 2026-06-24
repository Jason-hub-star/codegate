"use client";

import { CATALOG } from "@/features/circuit";
import { type WiringApi } from "@/features/wiring";
import { type FavoritesApi } from "@/features/favorites";
import { PartItem } from "./PartItem";

interface Props {
  fav: FavoritesApi;
  w: WiringApi;
  thumbs: Record<string, string | undefined>;
}

/**
 * 즐겨찾기 트레이 — 핀한 부품을 팔레트 최상단에 모아 quick-place(긴 카탈로그 스크롤 마찰 해소).
 * 카드 클릭=배치 선택(카탈로그와 동일), ★=핀 해제. 비어있으면 렌더 안 함.
 */
export function FavoritesTray({ fav, w, thumbs }: Props) {
  const items = fav.favorites
    .map((id) => CATALOG.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  if (items.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground">
        ★ 즐겨찾기
      </p>
      {items.map((p) => (
        <PartItem
          key={p.id}
          part={p}
          active={w.selectedPartDef === p.id}
          thumbnail={thumbs[p.id]}
          onToggle={() =>
            w.selectPartDef(w.selectedPartDef === p.id ? null : p.id)
          }
          isFavorite
          onToggleFavorite={fav.toggle}
        />
      ))}
    </div>
  );
}
