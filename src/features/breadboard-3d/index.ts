export { Scene } from "./components/Scene";
export { Workbench } from "./components/Workbench";
export { getPartThumbnails, getGlbThumbnails } from "./three/thumbnails";
// GLB 변환 보정(DEC-031) — glb-calibrator 가 소비하는 공개 스펙 API
export { GLB_PART_SPECS, glbSpecFor } from "./three/glbParts";
export type { GlbPartSpec } from "./three/glbParts";
