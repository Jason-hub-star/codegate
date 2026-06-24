"use client";

/**
 * 경량 클립보드 복사 — 라이브러리 0. Clipboard API + execCommand 폴백 + 1.5s copied 상태.
 * 비보안 컨텍스트(http)·구형 브라우저에서도 동작. 이벤트 핸들러에서만 호출(SSR 안전).
 */
import { useCallback, useEffect, useRef, useState } from "react";

function fallbackCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  ta.style.pointerEvents = "none";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy"); // 폐기 API지만 폴백 표준
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function useCopyToClipboard(resetMs = 1500): {
  copied: boolean;
  copy: (text: string) => Promise<void>;
} {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flash = useCallback(
    (ok: boolean) => {
      if (!ok) return;
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), resetMs);
    },
    [resetMs],
  );

  const copy = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          flash(true);
          return;
        }
      } catch {
        // 보안 컨텍스트 아님/권한 거부 → 폴백
      }
      flash(fallbackCopy(text));
    },
    [flash],
  );

  return { copied, copy };
}
