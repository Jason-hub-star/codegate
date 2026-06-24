/**
 * DEC-026 전원 시각화용 순수 계산.
 * 진단 엔진이 만든 net 그래프를 받아 빵판 전원레일의 실제 인가 상태만 판정한다.
 */
import { getHoles, RAILS, type Rail } from "./breadboard";
import type { NetGraph } from "./net";

export type RailEnergization = "power" | "ground" | "short";
export type EnergizedRails = Partial<Record<Rail, RailEnergization>>;

export function energizedRailsForNet(
  net: Pick<NetGraph, "nodeOfHole" | "powerRoots" | "groundRoots">,
): EnergizedRails {
  const holes = getHoles();
  const energized: EnergizedRails = {};

  for (const rail of RAILS) {
    const sample = holes.find((h) => h.rail === rail);
    if (!sample) continue;

    const root = net.nodeOfHole(sample.id);
    if (!root) continue;

    const powered = net.powerRoots.has(root);
    const grounded = net.groundRoots.has(root);
    if (powered && grounded) energized[rail] = "short";
    else if (powered) energized[rail] = "power";
    else if (grounded) energized[rail] = "ground";
  }

  return energized;
}
