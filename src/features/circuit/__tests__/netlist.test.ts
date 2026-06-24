import { describe, it, expect } from "vitest";
import { buildNetlist } from "../netlist";
import { buildNet } from "../net";
import { serializeNetlist } from "../serialize";
import { placePart, placeFreePart, withLead } from "../parts";
import type { CircuitModel, PlacedPart } from "../types";

const must = (p: PlacedPart | null): PlacedPart => {
  if (!p) throw new Error("place 실패(픽스처)");
  return p;
};
const model = (parts: PlacedPart[], wires: CircuitModel["wires"] = []): CircuitModel => ({
  parts,
  wires,
});

describe("buildNetlist — 넷 중심 연결 구조", () => {
  it("빈 회로 → 넷·미연결 모두 없음", () => {
    expect(buildNetlist(model([]))).toEqual({ nets: [], unconnected: [] });
  });

  it("LED 단독(저항 도통쌍) → 같은 부품 두 핀이 각 노드에 묶임", () => {
    // led span2 → e5, e7 (서로 다른 열 노드). conducts [[0,1]]는 net 간선(노드 병합 X)
    const led = must(placePart("led", "e5", 0));
    const nl = buildNetlist(model([led]));
    // 두 핀이 각자 다른 넷(열5상단/열7상단)에 단자로 등장
    const allTerms = nl.nets.flatMap((n) => n.terminals);
    expect(allTerms.map((t) => t.pin).sort()).toEqual(["애노드(+)", "캐소드(−)"].sort());
    expect(nl.unconnected).toEqual([]);
  });

  it("점퍼선으로 두 부품이 한 넷에 합류", () => {
    // LED 애노드(e5)와 저항 한쪽(a5) — 같은 열5상단? a5,e5 둘 다 COL5_T → 이미 한 노드
    const led = must(placePart("led", "e5", 0)); // e5,e7
    const res = must(placePart("resistor", "a5", 0)); // a5,a9 (span4)
    const nl = buildNetlist(model([led, res]));
    // 열5상단 넷에 LED 애노드 + 저항 1번이 함께
    const col5 = nl.nets.find((n) =>
      n.terminals.some((t) => t.ref.startsWith("LED")) &&
      n.terminals.some((t) => t.ref.startsWith("저항")),
    );
    expect(col5).toBeTruthy();
  });

  it("보드밖 서보 미연결 → unconnected 에 3핀, net 격리(간선 0)", () => {
    const servo = placeFreePart("servo", { x: 0, z: -40 });
    expect(servo).toBeTruthy();
    const m = model([servo!]);
    const nl = buildNetlist(m);
    expect(nl.nets).toEqual([]); // 어디에도 안 묶임
    expect(nl.unconnected).toHaveLength(3); // 신호·VCC·GND
    // 전기 그래프도 간선 0 (격리 확인)
    expect(buildNet(m).partEdges).toHaveLength(0);
  });

  it("서보 리드 1개 연결 → 그 핀만 넷에 합류, 나머지는 미연결", () => {
    let servo = placeFreePart("servo", { x: 0, z: -40 })!;
    servo = withLead(servo, 1, "e10"); // VCC를 e10에
    const nl = buildNetlist(model([servo]));
    expect(nl.unconnected).toHaveLength(2); // 신호·GND 남음
    const joined = nl.nets.flatMap((n) => n.terminals).filter((t) => t.ref.startsWith("서보"));
    expect(joined).toHaveLength(1);
    expect(joined[0].pin).toBe("VCC");
    expect(joined[0].endpoint).toBe("e10");
  });

  it("serializeNetlist 형식: 넷별 한 줄 + 미연결 줄", () => {
    const servo = withLead(placeFreePart("servo", { x: 0, z: 0 })!, 1, "e10");
    const txt = serializeNetlist(buildNetlist(model([servo])));
    expect(txt).toContain("미연결:");
    expect(txt).toContain("서보 모터#1");
  });

  it("serializeNetlist 빈 회로 → '연결 없음'", () => {
    expect(serializeNetlist(buildNetlist(model([])))).toBe("- 연결 없음");
  });
});
