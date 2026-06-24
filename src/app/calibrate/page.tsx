"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { createScene } from "@/features/breadboard-3d/three/createScene";
import { loadGlbInto } from "@/features/breadboard-3d/three/loadGlb";
import { TOKEN, POLARITY } from "@/features/breadboard-3d/three/theme3d";
import { CALIB_TARGETS, getCalibTarget, getCalibration } from "@/features/circuit";
import { cn } from "@/lib/utils";

type Coords = Record<string, [number, number, number]>;

export default function CalibratePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [targetKey, setTargetKey] = useState(CALIB_TARGETS[0]?.key ?? "");
  const [coords, setCoords] = useState<Coords>({});
  const [current, setCurrent] = useState(0);
  const [placeMode, setPlaceMode] = useState(true);
  const [exported, setExported] = useState("");

  const points = useMemo(
    () => getCalibTarget(targetKey)?.points ?? [],
    [targetKey],
  );

  const ref = useRef({ coords, current, placeMode, points });
  useEffect(() => {
    ref.current = { coords, current, placeMode, points };
  });

  const sceneRef = useRef<ReturnType<typeof createScene> | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const markersRef = useRef<THREE.Group | null>(null);
  const setCoordRef = useRef<(id: string, p: THREE.Vector3) => void>(() => {});
  useEffect(() => {
    setCoordRef.current = (id, p) =>
      setCoords((c) => ({
        ...c,
        [id]: [
          Math.round(p.x * 100) / 100,
          Math.round(p.y * 100) / 100,
          Math.round(p.z * 100) / 100,
        ],
      }));
  });

  // 씬 1회 구성
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handle = createScene(container);
    sceneRef.current = handle;
    handle.controls.autoRotate = false;
    handle.controls.target.set(0, 4, 0);
    handle.camera.position.set(55, 48, 70);
    handle.controls.update();

    const model = new THREE.Group();
    handle.scene.add(model);
    modelRef.current = model;
    const markers = new THREE.Group();
    handle.scene.add(markers);
    markersRef.current = markers;

    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let dragging = false;

    const pick = (e: PointerEvent): THREE.Vector3 | null => {
      const r = container.getBoundingClientRect();
      ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ptr, handle.camera);
      const hit = ray.intersectObject(model, true)[0];
      return hit ? hit.point.clone() : null;
    };
    const place = (e: PointerEvent) => {
      const { current: idx, placeMode: pm, points: pts } = ref.current;
      if (!pm) return;
      const def = pts[idx];
      if (!def) return;
      const p = pick(e);
      if (p) setCoordRef.current(def.id, p);
    };
    const onDown = (e: PointerEvent) => {
      if (!ref.current.placeMode) return;
      dragging = true;
      place(e);
    };
    const onMove = (e: PointerEvent) => {
      if (dragging) place(e);
    };
    const onUp = () => {
      dragging = false;
    };
    container.addEventListener("pointerdown", onDown);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerup", onUp);
    handle.start();
    const ro = new ResizeObserver(() => handle.resize());
    ro.observe(container);

    return () => {
      ro.disconnect();
      container.removeEventListener("pointerdown", onDown);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerup", onUp);
      handle.dispose();
    };
  }, []);

  // 타깃 변경 → 모델 재로드 + 기존 보정값 프리필
  useEffect(() => {
    const model = modelRef.current;
    const t = getCalibTarget(targetKey);
    if (!model || !t) return;
    for (const ch of [...model.children]) {
      model.remove(ch);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    loadGlbInto(model, t.glbUrl, {
      scaleLen: t.scaleLen,
      removeFloor: t.removeFloor,
    });
    setCoords({ ...getCalibration(targetKey) });
    setCurrent(0);
    setExported("");
  }, [targetKey]);

  // placeMode → 궤도회전 토글
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.controls.enabled = !placeMode;
  }, [placeMode]);

  // 마커 동기화
  useEffect(() => {
    const markers = markersRef.current;
    if (!markers) return;
    for (const ch of [...markers.children]) {
      markers.remove(ch);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    }
    points.forEach((def, i) => {
      const c = coords[def.id];
      if (!c) return;
      const isCur = i === current;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(isCur ? 1.1 : 0.8, 14, 12),
        new THREE.MeshBasicMaterial({ color: isCur ? TOKEN.ok : POLARITY.blue }),
      );
      sphere.position.set(c[0], c[1], c[2]);
      markers.add(sphere);
    });
  }, [coords, current, points]);

  const placedCount = Object.keys(coords).filter((k) =>
    points.some((p) => p.id === k),
  ).length;
  const curDef = points[current];

  const exportJson = () => {
    const ordered: Coords = {};
    for (const d of points) if (coords[d.id]) ordered[d.id] = coords[d.id];
    const s = JSON.stringify(ordered, null, 2);
    setExported(s);
    navigator.clipboard?.writeText(s).catch(() => {});
  };

  return (
    <div className="flex h-dvh w-full">
      <main className="relative min-w-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] text-muted-foreground">
          {placeMode
            ? "배치 모드: 모델 표면을 클릭/드래그해 현재 점 지정"
            : "회전 모드: 드래그로 시점 회전"}
        </div>
      </main>

      <aside className="flex w-[320px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-border-soft bg-card p-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            모델 핀 보정
          </p>
          <select
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            className="mt-2 w-full border border-border-soft bg-card px-2 py-1 text-xs"
          >
            {CALIB_TARGETS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            점 선택 → 모델의 해당 위치 클릭/드래그. 끝나면 JSON 내보내기.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaceMode((v) => !v)}
            className={cn(
              "border px-2 py-1 text-xs",
              placeMode
                ? "border-foreground bg-foreground text-background"
                : "border-border-soft bg-card",
            )}
          >
            {placeMode ? "배치 모드 ●" : "회전 모드 ○"}
          </button>
          <span className="font-mono text-[11px] text-muted-foreground">
            {placedCount}/{points.length}
          </span>
        </div>

        <div className="flex items-center justify-between border-y border-border-soft py-2">
          <button
            type="button"
            onClick={() => setCurrent((i) => Math.max(0, i - 1))}
            className="border border-border-soft px-2 py-1 text-xs hover:bg-surface-2"
          >
            ◀ 이전
          </button>
          <div className="text-center">
            <div className="text-sm font-bold">{curDef?.label}</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {curDef?.id}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCurrent((i) => Math.min(points.length - 1, i + 1))}
            className="border border-border-soft px-2 py-1 text-xs hover:bg-surface-2"
          >
            다음 ▶
          </button>
        </div>

        <ul className="grid grid-cols-2 gap-1">
          {points.map((d, i) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setCurrent(i)}
                className={cn(
                  "flex w-full items-center justify-between border px-2 py-1 text-left text-[11px]",
                  i === current
                    ? "border-foreground bg-foreground text-background"
                    : coords[d.id]
                      ? "border-[color:var(--ok)] text-ok"
                      : "border-border-soft text-muted-foreground",
                )}
              >
                <span>{d.label}</span>
                <span className="font-mono text-[9px]">
                  {coords[d.id] ? "●" : "○"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-auto space-y-2 border-t border-border-soft pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportJson}
              className="flex-1 bg-foreground py-2 text-xs font-semibold text-background hover:opacity-90"
            >
              JSON 내보내기(복사)
            </button>
            <button
              type="button"
              onClick={() => {
                setCoords({});
                setExported("");
              }}
              className="border border-border-soft px-2 py-1 text-xs text-error hover:bg-surface-2"
            >
              초기화
            </button>
          </div>
          {exported && (
            <textarea
              readOnly
              value={exported}
              className="h-40 w-full resize-none border border-border-soft bg-surface-2 p-2 font-mono text-[10px]"
            />
          )}
        </div>
      </aside>
    </div>
  );
}
