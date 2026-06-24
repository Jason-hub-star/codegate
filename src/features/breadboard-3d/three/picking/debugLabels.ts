import * as THREE from "three";
import {
  PARTS,
  connectionDebugId,
  partEndpoints,
  pinRoleDebugLabel,
  type PlacedPart,
} from "@/features/circuit";
import { makeTextLabel } from "./decor";
import { freeLeadEnds, freeLeadPins } from "./freeLeads";
import { wireMidpoint, type WireLike } from "./wireSelection";

interface SyncDebugLabelsOptions {
  group: THREE.Group;
  parts: PlacedPart[];
  wires: WireLike[];
  selectedPartUid: string | null;
  selectedWireId: string | null;
  hoveredWireId: string | null;
  endpointPos: (id: string) => THREE.Vector3 | null;
  connectionMidpoint?: (id: string) => THREE.Vector3 | null;
  breadboardMatrix: THREE.Matrix4;
}

export function clearSpriteLabels(group: THREE.Group) {
  for (const ch of [...group.children]) {
    group.remove(ch);
    const m = (ch as THREE.Sprite).material as THREE.SpriteMaterial;
    m.map?.dispose();
    m.dispose();
  }
}

function addLabel(group: THREE.Group, text: string, pos: THREE.Vector3, yLift = 10) {
  const spr = makeTextLabel(text);
  spr.position.set(pos.x, pos.y + yLift, pos.z);
  group.add(spr);
}

export function syncDebugLabels({
  group,
  parts,
  wires,
  selectedPartUid,
  selectedWireId,
  hoveredWireId,
  endpointPos,
  connectionMidpoint,
  breadboardMatrix,
}: SyncDebugLabelsOptions) {
  clearSpriteLabels(group);

  const selectedPart = selectedPartUid
    ? parts.find((p) => p.uid === selectedPartUid)
    : null;
  if (selectedPart) {
    const def = PARTS[selectedPart.defId];
    if (def) {
      const eps = partEndpoints(selectedPart);
      def.pins.forEach((pin, i) => {
        let pos: THREE.Vector3 | null = null;
        if (selectedPart.mount === "free" && selectedPart.bodyPos) {
          const starts = freeLeadPins(
            selectedPart.defId,
            selectedPart.bodyPos,
            selectedPart.rot ?? 0,
            breadboardMatrix,
            selectedPart.leadAnchors,
          );
          pos = freeLeadEnds(starts, selectedPart.bodyPos, breadboardMatrix)[i] ?? null;
        } else if (eps[i]) {
          pos = endpointPos(eps[i]!);
        }
        if (!pos) return;
        const role = pinRoleDebugLabel(pin);
        const text = pin.label === role ? role : `${pin.label} ${role}`;
        addLabel(group, text, pos, 7);
      });
    }
  }

  const addWireLabel = (id: string | null, lift: number) => {
    if (!id) return;
    const wire = wires.find((w) => w.id === id);
    const pos = wire
      ? wireMidpoint(wire, endpointPos)
      : (connectionMidpoint?.(id) ?? null);
    if (!pos) return;
    addLabel(group, connectionDebugId(id), pos, lift);
  };
  addWireLabel(selectedWireId, 12);
  if (hoveredWireId && hoveredWireId !== selectedWireId) {
    addWireLabel(hoveredWireId, 16);
  }
}
