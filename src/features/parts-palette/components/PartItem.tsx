"use client";

import { type CatalogItem, type Protocol, STATUS_LABEL } from "@/features/circuit";
import { cn } from "@/lib/utils";

interface Props {
  part: CatalogItem;
  active: boolean;
  thumbnail?: string;
  onToggle: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (defId: string) => void;
}

const PROTOCOL_LABEL: Record<Protocol, string> = {
  onoff: "디지털",
  analog: "아날로그",
  pwm: "PWM",
  i2c: "I2C",
  "1-wire": "1-Wire",
};

/** 표시 메타 한 줄: 전압 · 신호 · 핀수 (보드/빵판은 핀 없음 → 생략) */
function metaLine(part: CatalogItem): string {
  const bits: string[] = [];
  if (part.operatingV) bits.push(part.operatingV);
  if (part.protocol) bits.push(PROTOCOL_LABEL[part.protocol]);
  if (part.pins) bits.push(`${part.pins.length}핀`);
  if (part.needsResistor) bits.push("저항");
  return bits.join(" · ");
}

/** 팔레트 카드 — 썸네일 + 이름 + 메타 + 상태. 선택 토글(현재/준비 중은 비활성). */
export function PartItem({
  part,
  active,
  thumbnail,
  onToggle,
  isFavorite,
  onToggleFavorite,
}: Props) {
  const ready = part.status === "ready";
  const current = part.status === "active";
  const meta = metaLine(part);
  return (
    <div className="group relative">
      {ready && onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(part.id)}
          title={isFavorite ? "즐겨찾기 해제" : "즐겨찾기에 추가"}
          aria-pressed={!!isFavorite}
          className={cn(
            "absolute right-1 top-1 z-10 px-0.5 text-xs leading-none transition-opacity",
            isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            active
              ? "text-background/80 hover:text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      )}
    <button
      type="button"
      onClick={ready ? onToggle : undefined}
      disabled={!ready}
      title={part.description}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2.5 border px-2 py-2 text-left transition-colors",
        ready
          ? active
            ? "border-foreground bg-foreground text-background"
            : "border-border-soft bg-card hover:bg-surface-2"
          : current
            ? "cursor-default border-foreground/35 bg-surface-2" // 현재 적용(보드/빵판)
            : "cursor-not-allowed border-border-soft bg-card opacity-55", // 준비 중
      )}
    >
      {/* 썸네일 스와치(항상 밝은 타일 위 → 선택 반전돼도 보임) */}
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border-soft bg-surface-2">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={`${part.label} 3D 미리보기`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="font-mono text-[9px] text-muted-foreground">3D</span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{part.label}</span>
          {!ready && (
            <span
              className={cn(
                "shrink-0 border px-1 py-px font-mono text-[8px] uppercase tracking-wide",
                current
                  ? "border-foreground/40 text-foreground"
                  : "border-border-soft text-muted-foreground",
              )}
            >
              {STATUS_LABEL[part.status]}
            </span>
          )}
        </span>
        {meta && (
          <span
            className={cn(
              "mt-0.5 block truncate font-mono text-[10px]",
              active ? "text-background/70" : "text-muted-foreground",
            )}
          >
            {meta}
          </span>
        )}
      </span>
    </button>
    </div>
  );
}
