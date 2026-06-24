"use client";

import { useMemo, useState } from "react";
import { CATALOG, CATEGORIES } from "@/features/circuit";
import { type WiringApi } from "@/features/wiring";
import { type WorkbenchApi } from "@/features/workbench";
import { useFavorites } from "@/features/favorites";
import { PartItem } from "./PartItem";
import { BoardSwitcher } from "./BoardSwitcher";
import { BreadboardSwitcher } from "./BreadboardSwitcher";
import { FavoritesTray } from "./FavoritesTray";
import { PaletteFooter } from "./PaletteFooter";
import { usePartThumbnails } from "../hooks/usePartThumbnails";

interface Props {
  w: WiringApi;
  bench: WorkbenchApi;
}

/** 좌측 패널 셸 — 헤더 + 검색 + 카테고리 그룹(썸네일 카드) + 푸터 조립. */
export function PartsPalette({ w, bench }: Props) {
  const thumbs = usePartThumbnails();
  const fav = useFavorites();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG;
    return CATALOG.filter((p) => p.label.toLowerCase().includes(q));
  }, [query]);

  const toggle = (id: string) =>
    w.selectPartDef(w.selectedPartDef === id ? null : id);

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          부품 팔레트
        </p>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          부품을 고르고 빵판 홀을 클릭해 배치. 다시 누르면 해제.
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="부품 검색…"
        className="w-full border border-border-soft bg-card px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground focus:border-foreground"
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {/* 즐겨찾기 트레이 — 최상단 quick-place (검색 중엔 숨김) */}
        {!query.trim() && <FavoritesTray fav={fav} w={w} thumbs={thumbs} />}
        {CATEGORIES.map(({ id, label }) => {
          const items = filtered.filter((p) => p.category === id);
          if (items.length === 0) return null; // 빈 카테고리 자동 숨김
          // 보드·빵판은 스왑 카드로 위임 — 클릭 시 작업대 전환(회로 있으면 확인창)
          if (id === "board") {
            return <BoardSwitcher key={id} bench={bench} thumbs={thumbs} />;
          }
          if (id === "breadboard") {
            return (
              <BreadboardSwitcher key={id} bench={bench} thumbs={thumbs} />
            );
          }
          return (
            <div key={id} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {label}
              </p>
              {items.map((p) => (
                <PartItem
                  key={p.id}
                  part={p}
                  active={w.selectedPartDef === p.id}
                  thumbnail={thumbs[p.id]}
                  onToggle={() => toggle(p.id)}
                  isFavorite={fav.isFavorite(p.id)}
                  onToggleFavorite={fav.toggle}
                />
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">
            “{query}” 검색 결과 없음.
          </p>
        )}
      </div>

      <PaletteFooter
        orientation={w.orientation}
        partCount={w.parts.length}
        wireCount={w.wires.length}
        onRotate={w.rotate}
        onClear={w.clear}
      />
    </div>
  );
}
