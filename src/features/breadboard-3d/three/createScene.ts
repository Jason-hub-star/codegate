/**
 * 씬 셋업 — 순수 Three.js (drei 미사용, DEC-002).
 * research/14 성공패턴: ② 중립 스튜디오 조명(Hemi+Dir+Amb+Env, ACES) ③ 부드러운 카메라.
 * 금지: 네온·블룸·글래스·컬러 스카이박스.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TOKEN, MAT } from "./theme3d";

export interface SceneHandle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  /** 매 프레임 호출자(예: 피킹 하이라이트)가 끼어들 수 있는 훅 */
  onFrame: (cb: (dt: number) => void) => () => void;
  start: () => void;
  stop: () => void;
  resize: () => void;
  dispose: () => void;
}

const BG = TOKEN.background; // 에디토리얼 배경 (globals.css --background)

export function createScene(container: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = false; // 접지는 가짜 컨택트섀도로 (research/14 A1)
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);

  // 중립 스튜디오 환경맵 (은은한 반사, 무채색)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;

  // 조명 (research/14 B)
  const hemi = new THREE.HemisphereLight(MAT.lightWarm, MAT.lightCool, 0.55);
  hemi.position.set(0, 200, 0);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(MAT.lightWarm, 1.6);
  key.position.set(80, 140, 100);
  scene.add(key);

  const fill = new THREE.AmbientLight(MAT.lightWarm, 0.25);
  scene.add(fill);

  // 카메라 — 3/4 아이소메트릭 기본 앵글 (research/14 C)
  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / Math.max(1, container.clientHeight),
    1,
    3000,
  );
  camera.position.set(85, 78, 118);

  // OrbitControls — 부드러운 댐핑 + 대기 오토로테이트 (research/14 C·F)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12; // 부품 커넥터까지 근접 확대 허용
  controls.maxDistance = 520;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(175); // 아래에서 위로 올려다보기 허용(DEC-041 QA). 정확한 바닥 특이점만 회피
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5; // 느리게 (어지럽지 않게)
  controls.addEventListener("start", () => {
    controls.autoRotate = false; // 만지면 즉시 정지
  });
  controls.update();

  // 프레임 훅 레지스트리
  const frameCbs = new Set<(dt: number) => void>();
  const onFrame = (cb: (dt: number) => void) => {
    frameCbs.add(cb);
    return () => frameCbs.delete(cb);
  };

  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = clock.getDelta();
    controls.update();
    frameCbs.forEach((cb) => cb(dt));
    renderer.render(scene, camera);
  };

  const start = () => {
    if (running) return;
    running = true;
    clock.start();
    loop();
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const resize = () => {
    const w = container.clientWidth;
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    stop();
    controls.dispose();
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };

  return { scene, camera, renderer, controls, onFrame, start, stop, resize, dispose };
}
