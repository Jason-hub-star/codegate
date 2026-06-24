"use client";

/*
 * WebSerial 스모크 테스트 (임시·폐기 예정) — DEC-037 사전준비 ⓑ
 * 목적: 브라우저가 실물 아두이노 포트를 잡고 시리얼 한 줄("D13=1")이라도 읽는가만 검증.
 * 파싱·3D 점등 없음. 통과 후 src/features/serial/ 로 본격 구현.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Status = "idle" | "connecting" | "connected" | "error";

// navigator는 서버에 없으므로 클라이언트 스냅샷으로만 지원 여부 판정(SSR 불일치·effect setState 회피)
function useSerialSupported(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => "serial" in navigator,
    () => true,
  );
}

export default function SerialTestPage() {
  const supported = useSerialSupported();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [log, setLog] = useState("");

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const disconnect = useCallback(async () => {
    try {
      await readerRef.current?.cancel();
    } catch {
      /* 이미 닫힘 */
    }
    readerRef.current = null;
    try {
      await portRef.current?.close();
    } catch {
      /* 이미 닫힘 */
    }
    portRef.current = null;
    setStatus("idle");
  }, []);

  const connect = useCallback(async () => {
    setError("");
    setStatus("connecting");
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;

      if (!port.readable) throw new Error("포트에 readable 스트림이 없습니다.");

      const reader = port.readable.getReader();
      readerRef.current = reader;
      setStatus("connected");

      // 읽기 루프 — 수신 바이트를 디코드해 raw 텍스트 그대로 누적
      const decoder = new TextDecoder();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            setLog((prev) => (prev + text).slice(-4000));
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      await disconnect();
    }
  }, [disconnect]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  const connected = status === "connected" || status === "connecting";

  return (
    <div className="flex h-dvh w-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border-soft px-5 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-black tracking-tight">핀메이트</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            / serial-test
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          WebSerial 스모크 테스트
        </span>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        {!supported ? (
          <p className="rounded border border-border-soft bg-surface-2 p-4 text-sm">
            이 브라우저는 WebSerial을 지원하지 않습니다. Chrome/Edge(크로미움)에서
            <span className="font-mono"> localhost </span>또는 HTTPS로 열어주세요.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={connected ? () => void disconnect() : () => void connect()}
                className="rounded border border-border-soft bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-3"
              >
                {connected ? "연결 해제" : "연결"}
              </button>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                상태: {status}
              </span>
            </div>

            {error && (
              <p className="rounded border border-border-soft bg-surface-2 p-3 text-sm text-red-600">
                {error}
              </p>
            )}

            <pre className="min-h-0 flex-1 overflow-auto rounded border border-border-soft bg-surface-1 p-3 font-mono text-xs leading-relaxed">
              {log || "수신 대기 중… [연결]을 눌러 포트를 선택하세요."}
            </pre>
          </>
        )}
      </main>
    </div>
  );
}
