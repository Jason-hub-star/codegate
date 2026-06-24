import * as THREE from "three";
import { buildWire, WIRE_COLOR } from "../wire";
import { TOKEN } from "../theme3d";

export interface WireLike {
  id: string;
  a: string;
  b: string;
}

interface SyncWireMeshesOptions {
  wires: WireLike[];
  group: THREE.Group;
  selectedWireId: string | null;
  hoveredWireId: string | null;
  endpointPos: (id: string) => THREE.Vector3 | null;
  wireColorFor: (id: string) => number;
  onConnection?: (id: string, a: THREE.Vector3, b: THREE.Vector3) => void;
}

export function setConnectionOpacity(obj: THREE.Object3D, opacity: number) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const mat = mesh.material;
    if (!mat) return;
    const apply = (m: THREE.Material) => {
      m.transparent = opacity < 1;
      m.opacity = opacity;
      m.needsUpdate = true;
    };
    if (Array.isArray(mat)) mat.forEach(apply);
    else apply(mat as THREE.Material);
  });
}

function tintActive(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!mat || !("emissive" in mat)) return;
    mat.emissive.setHex(TOKEN.ok);
    mat.emissiveIntensity = 0.12;
  });
}

export function decorateConnectionMesh(
  obj: THREE.Object3D,
  id: string,
  activeId: string | null,
) {
  const isActive = id === activeId;
  obj.userData.wireId = id;
  obj.traverse((o) => (o.userData.wireId = id));
  if (activeId && !isActive) setConnectionOpacity(obj, 0.28);
  if (isActive) tintActive(obj);
}

export function syncWireMeshes({
  wires,
  group,
  selectedWireId,
  hoveredWireId,
  endpointPos,
  wireColorFor,
  onConnection,
}: SyncWireMeshesOptions) {
  const activeId = selectedWireId ?? hoveredWireId;
  for (const w of wires) {
    const pa = endpointPos(w.a);
    const pb = endpointPos(w.b);
    if (!pa || !pb) continue;
    onConnection?.(w.id, pa.clone(), pb.clone());
    const color =
      wireColorFor(w.a) !== WIRE_COLOR.neutral
        ? wireColorFor(w.a)
        : wireColorFor(w.b);
    const isActive = w.id === activeId;
    const mesh = buildWire(pa, pb, color, { radius: isActive ? 1.25 : 0.85 });
    decorateConnectionMesh(mesh, w.id, activeId);
    group.add(mesh);
  }
}

export function wireMidpoint(
  wire: WireLike,
  endpointPos: (id: string) => THREE.Vector3 | null,
): THREE.Vector3 | null {
  const a = endpointPos(wire.a);
  const b = endpointPos(wire.b);
  if (!a || !b) return null;
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y = Math.max(a.y, b.y) + 8;
  return mid;
}

export function createEndpointRings(
  wire: WireLike,
  endpointPos: (id: string) => THREE.Vector3 | null,
): THREE.Group | null {
  const a = endpointPos(wire.a);
  const b = endpointPos(wire.b);
  if (!a || !b) return null;
  return createEndpointRingsAt(a, b);
}

export function createEndpointRingsAt(
  a: THREE.Vector3,
  b: THREE.Vector3,
): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.TorusGeometry(2.6, 0.42, 8, 24);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: TOKEN.ok,
    roughness: 0.45,
    metalness: 0.05,
  });
  for (const p of [a, b]) {
    const ring = new THREE.Mesh(geo.clone(), mat.clone());
    ring.position.set(p.x, p.y + 0.75, p.z);
    group.add(ring);
  }
  return group;
}
