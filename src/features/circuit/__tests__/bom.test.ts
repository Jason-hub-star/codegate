import { describe, it, expect } from "vitest";
import { buildBom } from "../bom";
import { serializeBom } from "../serialize";
import { placePart } from "../parts";
import type { CircuitModel, PlacedPart } from "../types";

const model = (parts: PlacedPart[]): CircuitModel => ({ wires: [], parts });
const must = (p: PlacedPart | null): PlacedPart => {
  if (!p) throw new Error("placePart 실패(테스트 픽스처)");
  return p;
};

describe("buildBom — 회로 자동 파생 명세", () => {
  it("빈 회로 → 빈 명세", () => {
    expect(buildBom(model([]))).toEqual([]);
  });

  it("같은 부품 2개 → count 2, uids 2 (개체 지목 가능)", () => {
    const a = must(placePart("led", "e5", 0));
    const b = must(placePart("led", "e10", 0));
    const bom = buildBom(model([a, b]));
    expect(bom).toHaveLength(1);
    expect(bom[0].defId).toBe("led");
    expect(bom[0].count).toBe(2);
    expect(bom[0].uids).toHaveLength(2);
    expect(bom[0].uids).toEqual([a.uid, b.uid]); // 배치 순서 보존
  });

  it("여러 종류 → 카테고리 순 정렬(출력 LED 먼저, 수동 저항 뒤)", () => {
    const led = must(placePart("led", "e5", 0));
    const res = must(placePart("resistor", "a3", 0));
    const bom = buildBom(model([res, led])); // 입력 순서 무관
    expect(bom.map((b) => b.defId)).toEqual(["led", "resistor"]);
  });

  it("자기설명적 메타 포함 (LED=저항 필요)", () => {
    const bom = buildBom(model([must(placePart("led", "e5", 0))]));
    expect(bom[0].needsResistor).toBe(true);
  });

  it("serializeBom 형식: `- 라벨 ×개수 (메타)`", () => {
    const txt = serializeBom(buildBom(model([must(placePart("led", "e5", 0))])));
    expect(txt.startsWith("- ")).toBe(true);
    expect(txt).toContain("×1");
    expect(txt).toContain("저항 필요");
  });

  it("serializeBom 빈 회로 → '부품: 없음'", () => {
    expect(serializeBom(buildBom(model([])))).toBe("- 부품: 없음");
  });
});
