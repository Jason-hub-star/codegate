/**
 * 부품 팔레트 썸네일 — 실제 3D 절차 메시(buildPartMesh)를 오프스크린 렌더 → PNG dataUrl.
 * 씬에 배치되는 메시와 1:1(라이선스 free, 모노크롬 KITvibe 일관). 모듈 캐시로 1회만 렌더.
 */
import * as THREE from "three";
import { BREADBOARDS, CATALOG, PITCH, type PartDef } from "@/features/circuit";
import { ASSET_CREDITS } from "@/lib/assetCredits";
import { buildPartMesh } from "./parts";
import { glbSpecFor } from "./glbParts";
import { loadGlbSource } from "./loadGlb";
import { buildEsp32Board, buildBreadboardThumb } from "./fixtures";
import { TOKEN } from "./theme3d";

const SIZE = 192; // 캔버스 한 변(px)
const cache = new Map<string, string>(); // 절차 부품
const glbCache = new Map<string, string>(); // GLB 부품
const URL_BY_ID = new Map(ASSET_CREDITS.map((a) => [a.id, a.glb]));

/**
 * 핀 없는 픽스처(보드·빵판) 절차 메시 — render.builder 키로 디스패치.
 * 부품(BUILDERS)과 달리 핀 footprint 가 없는 독립 메시(원점 중심).
 */
const FIXTURE_MESH: Record<string, () => THREE.Object3D> = {
  esp32: buildEsp32Board,
  // 빵판 종류는 레지스트리에서 파생 — 새 빵판 추가 시 자동 썸네일(Add=one entry)
  ...Object.fromEntries(
    Object.values(BREADBOARDS).map((d) => [
      `breadboard-${d.id}`,
      () => buildBreadboardThumb(d.cols, d.hasRails),
    ]),
  ),
};

/** geometry 만 dispose(머티리얼은 공유/일회성이라 단순 정리) */
function disposeGeom(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
}

/** 부품 핀수·span 으로 실제 footprint 와 같은 합성 핀좌표(월드, y=0) 생성 */
function syntheticPins(pinCount: number, span: number): THREE.Vector3[] {
  const step = span * PITCH; // 인접 핀 간 월드 거리(computePinHoles 와 동일 규칙)
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pinCount; i++) {
    out.push(new THREE.Vector3((i - (pinCount - 1) / 2) * step, 0, 0));
  }
  return out;
}

/** obj 를 등각 프레이밍해 1장 렌더 → dataUrl. obj 는 mutate/dispose 하지 않음. */
function renderFramed(renderer: THREE.WebGLRenderer, obj: THREE.Object3D): string {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(6, 12, 8);
  scene.add(key);
  scene.add(obj);

  // 메시 바운딩으로 등각 카메라 프레이밍
  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fov = 32;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 1000);
  const dist = (sphere.radius / Math.sin((fov / 2) * (Math.PI / 180))) * 1.2;
  const dir = new THREE.Vector3(1, 0.8, 1).normalize();
  camera.position.copy(sphere.center).add(dir.multiplyScalar(dist));
  camera.lookAt(sphere.center);

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  scene.remove(obj); // 캐시 소스 보존(재사용 위해 detach만)
  return url;
}

/** 절차 부품 1개 렌더 → dataUrl (임시 메시 → 렌더 후 geometry 정리) */
function renderOne(
  renderer: THREE.WebGLRenderer,
  defId: string,
  pinCount: number,
  span: number,
): string | null {
  const obj = buildPartMesh(defId, syntheticPins(pinCount, span));
  if (!obj) return null;
  const url = renderFramed(renderer, obj);
  // 메시 지오메트리 정리(머티리얼은 모듈 공유라 보존)
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
  });
  return url;
}

function makeThumbRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(TOKEN.background, 0); // 투명 배경(카드 위에 얹힘)
  return renderer;
}

/**
 * 모든 부품 썸네일을 한 번 생성해 캐시. 클라이언트(브라우저)에서만 호출할 것.
 * 첫 호출에서 임시 WebGL 컨텍스트 1개를 만들고 즉시 정리한다.
 */
export function getPartThumbnails(): Record<string, string> {
  if (typeof window === "undefined") return {};
  if (cache.size > 0) return Object.fromEntries(cache);

  // WebGL 불가 환경(컨텍스트 생성 실패 등)에선 빈 맵 반환 → 카드가 "3D" 폴백 표시
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = makeThumbRenderer();
    for (const item of CATALOG) {
      if (item.render.kind !== "procedural") continue; // GLB 는 비동기 패스에서
      const fixture = FIXTURE_MESH[item.render.builder];
      let url: string | null = null;
      if (fixture) {
        // 핀 없는 픽스처(보드·빵판): 독립 메시 → 프레이밍 후 지오메트리 정리
        const obj = fixture();
        url = renderFramed(renderer, obj);
        disposeGeom(obj);
      } else {
        // 핀 기반 부품: 합성 핀좌표로 실제 배치 메시 렌더
        const def = item as PartDef;
        url = renderOne(renderer, def.id, def.pins.length, def.span);
      }
      if (url) cache.set(item.id, url);
    }
  } catch {
    cache.clear();
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return Object.fromEntries(cache);
}

/**
 * GLB 부품 썸네일을 비동기로 1회 생성(소스 fetch 필요). 클라이언트 전용.
 * 실모델을 씬 배치와 동일 소스(loadGlbSource 캐시)로 렌더 → 카드 미리보기 일관.
 */
export async function getGlbThumbnails(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  if (glbCache.size > 0) return Object.fromEntries(glbCache);

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = makeThumbRenderer();
    for (const def of CATALOG) {
      if (def.render.kind !== "glb") continue;
      const url = URL_BY_ID.get(def.render.assetId);
      if (!url) continue; // 배포 GLB 없음 → "3D" 폴백 유지
      const src = await loadGlbSource(url, {
        scaleLen: glbSpecFor(def.render.assetId).scaleLen,
        removeFloor: true,
      });
      if (!src) continue;
      glbCache.set(def.id, renderFramed(renderer, src));
    }
  } catch {
    glbCache.clear();
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return Object.fromEntries(glbCache);
}
