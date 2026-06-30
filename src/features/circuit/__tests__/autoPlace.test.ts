import { describe, it, expect } from "vitest";
import { autoPlace } from "../autoPlace";
import {
  LASER_TRIPWIRE_LOGICAL,
  LASER_BUTTON_LOGICAL,
  SERVO_BUTTON_LOGICAL,
  RELAY_PUMP_LOGICAL,
  LDR_AUTO_LIGHT_LOGICAL,
  PIR_BUZZER_ALARM_LOGICAL,
  PIR_SERVO_DOOR_LOGICAL,
  POT_SERVO_KNOB_LOGICAL,
  DHT11_OLED_WEATHER_LOGICAL,
  LDR_NEOPIXEL_NIGHT_LIGHT_LOGICAL,
  ULTRASONIC_PARKING_ALARM_LOGICAL,
  SOIL_PUMP_AUTO_WATERING_LOGICAL,
} from "../scenarios";
import { BREADBOARDS } from "../breadboard";
import { diagnose } from "../diagnose";
import { buildNetlist } from "../netlist";

function boardHoles(model: ReturnType<typeof autoPlace>): string[] {
  const isBoardHole = (e: string) => /^[a-j]\d+$|^[TB][+-]_\d+$/.test(e);
  return [
    ...model.parts.flatMap((p) =>
      p.mount === "free" ? (p.leads ?? []) : p.pinHoles,
    ),
    ...model.wires.flatMap((w) => [w.a, w.b]),
  ].filter((e): e is string => !!e && isBoardHole(e));
}

function expectCleanPlacement(
  logical: Parameters<typeof autoPlace>[0],
  bb: (typeof BREADBOARDS)[keyof typeof BREADBOARDS],
  allowedUnconnected: string[] = [],
) {
  const model = autoPlace(logical, bb);
  const v = diagnose(model, { breadboard: bb });
  const nl = buildNetlist(model, { breadboard: bb });
  expect(v.ok).toBe(true);
  expect(v.findings).toEqual([]);
  expect(Object.values(v.energizedRails)).not.toContain("short");
  expect(nl.unconnected.map((u) => u.pin)).toEqual(allowedUnconnected);
  const holes = boardHoles(model);
  expect(new Set(holes).size).toBe(holes.length);
}

/** 논리 레이저 트립와이어를 빵판별로 배치 → 단락 없는 정상 회로여야 한다. */
describe("autoPlace — 레이저 트립와이어", () => {
  for (const bbId of ["half", "full", "mini"] as const) {
    const bb = BREADBOARDS[bbId];

    it(`${bbId}: diagnose ok·미연결 0·단락 없음`, () => {
      const model = autoPlace(LASER_TRIPWIRE_LOGICAL, bb);
      const v = diagnose(model, { breadboard: bb });
      const nl = buildNetlist(model, { breadboard: bb });

      // 모든 핀 연결 + 오류 없음
      expect(nl.unconnected).toEqual([]);
      expect(v.ok).toBe(true);
      expect(v.findings).toEqual([]);
      // 단락 부재 — 어떤 레일/노드도 short 가 아님
      expect(Object.values(v.energizedRails)).not.toContain("short");
    });

    it(`${bbId}: 부품 3개 배치 + 논리 net 보존`, () => {
      const model = autoPlace(LASER_TRIPWIRE_LOGICAL, bb);
      expect(model.parts.map((p) => p.uid).sort()).toEqual([
        "buzzer1",
        "laserRx1",
        "laserTx1",
      ]);
      // 레이저 2종은 free(보드 밖), 부저는 board
      const tx = model.parts.find((p) => p.uid === "laserTx1")!;
      const buzzer = model.parts.find((p) => p.uid === "buzzer1")!;
      expect(tx.mount).toBe("free");
      expect(buzzer.mount).toBeUndefined(); // board 기본

      // net 묶임: 5V net 에 두 레이저 VCC, GND net 에 둘 + 부저 −
      const nl = buildNetlist(model, { breadboard: bb });
      const powerNet = nl.nets.find((n) => n.role === "power" && n.terminals.length >= 2);
      expect(powerNet).toBeTruthy();
    });
  }

  // ★ 물리 불변식: 한 빵판 홀엔 끝점 하나만(부품 다리·점퍼·리드가 겹치면 안 됨)
  for (const bbId of ["half", "full", "mini"] as const) {
    it(`${bbId}: 빵판 홀에 끝점이 겹치지 않는다`, () => {
      const model = autoPlace(LASER_TRIPWIRE_LOGICAL, BREADBOARDS[bbId]);
      const isBoardHole = (e: string) => /^[a-j]\d+$|^[TB][+-]_\d+$/.test(e);
      const holes = [
        ...model.parts.flatMap((p) =>
          p.mount === "free" ? (p.leads ?? []) : p.pinHoles,
        ),
        ...model.wires.flatMap((w) => [w.a, w.b]),
      ].filter((e): e is string => !!e && isBoardHole(e));
      // 중복 홀이 없어야 한다
      expect(new Set(holes).size).toBe(holes.length);
    });
  }

  // 전원/접지 공급: 아두이노 5V·GND 가 회로에 실제로 물려야(빠지면 전원 안 들어옴)
  for (const bbId of ["half", "full", "mini"] as const) {
    it(`${bbId}: 아두이노 5V·GND 공급 배선 존재`, () => {
      const bb = BREADBOARDS[bbId];
      const model = autoPlace(LASER_TRIPWIRE_LOGICAL, bb);
      // wire 끝점 + free 리드 — 직결(pins)이면 리드/점퍼에, 버스면 공급 wire에 잡힌다
      const ends = [
        ...model.wires.flatMap((w) => [w.a, w.b]),
        ...model.parts.flatMap((p) => p.leads ?? []),
      ];
      expect(ends).toContain("AD_5V");
      expect(ends).toContain("AD_GND_P1");
      // 5V 와 GND 가 한 노드로 합쳐지면 단락 — 그래선 안 됨
      const nl = buildNetlist(model, { breadboard: bb });
      const powerNet = nl.nets.find((n) =>
        n.terminals.some((t) => t.endpoint === "AD_5V"),
      );
      const gndNet = nl.nets.find((n) =>
        n.terminals.some((t) => t.endpoint === "AD_GND_P1"),
      );
      expect(powerNet).toBeTruthy();
      expect(gndNet).toBeTruthy();
      expect(powerNet!.nodeId).not.toBe(gndNet!.nodeId);
    });
  }

  // 서보+버튼(서보=GLB free, 버튼=board)도 빵판별 자동 배치 — 미니 포함
  for (const bbId of ["half", "mini"] as const) {
    it(`서보+버튼 ${bbId}: diagnose ok·미연결 0·겹침 없음`, () => {
      const bb = BREADBOARDS[bbId];
      const model = autoPlace(SERVO_BUTTON_LOGICAL, bb);
      const v = diagnose(model, { breadboard: bb });
      const nl = buildNetlist(model, { breadboard: bb });
      expect(nl.unconnected).toEqual([]);
      expect(v.ok).toBe(true);
      expect(Object.values(v.energizedRails)).not.toContain("short");
      const isBoardHole = (e: string) => /^[a-j]\d+$|^[TB][+-]_\d+$/.test(e);
      const holes = [
        ...model.parts.flatMap((p) =>
          p.mount === "free" ? (p.leads ?? []) : p.pinHoles,
        ),
        ...model.wires.flatMap((w) => [w.a, w.b]),
      ].filter((e): e is string => !!e && isBoardHole(e));
      expect(new Set(holes).size).toBe(holes.length);
    });
  }

  it("레일 없는 미니는 본체 열 버스를 쓴다(레일 홀 미사용)", () => {
    const model = autoPlace(LASER_TRIPWIRE_LOGICAL, BREADBOARDS.mini);
    const endpoints = [
      ...model.wires.flatMap((w) => [w.a, w.b]),
      ...model.parts.flatMap((p) => p.leads ?? []),
    ].filter(Boolean) as string[];
    // 미니엔 레일 홀(T+/T-)이 없으므로 어떤 끝점도 레일 홀이면 안 됨
    expect(endpoints.some((e) => /^[TB][+-]_/.test(e))).toBe(false);
  });
});

/**
 * 릴레이+펌프(둘 다 free)를 빵판별로 배치 → 펌프가 접점(NO–COM) 경유로 전원에 닿아
 * 진단 통과. NC(부하측 미사용)만 미연결로 남는 게 정상.
 */
describe("autoPlace — 릴레이+펌프", () => {
  for (const bbId of ["half", "full", "mini"] as const) {
    const bb = BREADBOARDS[bbId];

    it(`${bbId}: diagnose ok·단락 없음·NC만 미연결`, () => {
      const model = autoPlace(RELAY_PUMP_LOGICAL, bb);
      const v = diagnose(model, { breadboard: bb });
      const nl = buildNetlist(model, { breadboard: bb });

      // 제어+부하 회로 완결 → 오류 없음(펌프+ 가 NO–COM 접점 거쳐 전원 도달)
      expect(v.ok).toBe(true);
      expect(v.findings).toEqual([]);
      // 거짓 단락 없음(접점은 union 아닌 edge)
      expect(Object.values(v.energizedRails)).not.toContain("short");
      // 유일한 미연결 = 릴레이 NC(의도적 부하측 미사용)
      expect(nl.unconnected.map((u) => u.pin)).toEqual(["NC"]);
    });

    it(`${bbId}: 부품 2개 + LOAD net 에 NO·펌프+ 가 함께 묶임`, () => {
      const model = autoPlace(RELAY_PUMP_LOGICAL, bb);
      expect(model.parts.map((p) => p.uid).sort()).toEqual(["pump1", "relay1"]);
      // 둘 다 보드 밖(free)
      for (const p of model.parts) expect(p.mount).toBe("free");

      // 릴레이 NO 와 펌프 + 가 같은 net(LOAD)으로 tie 돼야 부하가 단속됨
      const nl = buildNetlist(model, { breadboard: bb });
      const loadNet = nl.nets.find(
        (n) =>
          n.terminals.some((t) => t.partUid === "relay1" && t.pin === "NO") &&
          n.terminals.some((t) => t.partUid === "pump1" && t.pin === "+"),
      );
      expect(loadNet).toBeTruthy();
    });

    it(`${bbId}: 빵판 홀에 끝점이 겹치지 않는다`, () => {
      const model = autoPlace(RELAY_PUMP_LOGICAL, bb);
      const isBoardHole = (e: string) => /^[a-j]\d+$|^[TB][+-]_\d+$/.test(e);
      const holes = [
        ...model.parts.flatMap((p) =>
          p.mount === "free" ? (p.leads ?? []) : p.pinHoles,
        ),
        ...model.wires.flatMap((w) => [w.a, w.b]),
      ].filter((e): e is string => !!e && isBoardHole(e));
      expect(new Set(holes).size).toBe(holes.length);
    });
  }
});

describe("autoPlace — 센서 확장 시나리오", () => {
  const cases = [
    ["LDR 자동 조명", LDR_AUTO_LIGHT_LOGICAL, []],
    ["PIR 모션 경보기", PIR_BUZZER_ALARM_LOGICAL, []],
    ["PIR 자동문 서보", PIR_SERVO_DOOR_LOGICAL, []],
    ["가변저항 서보 노브", POT_SERVO_KNOB_LOGICAL, []],
    ["DHT11 + OLED 날씨판", DHT11_OLED_WEATHER_LOGICAL, []],
    ["LDR 네오픽셀 야간등", LDR_NEOPIXEL_NIGHT_LIGHT_LOGICAL, []],
    ["초음파 주차 경보기", ULTRASONIC_PARKING_ALARM_LOGICAL, []],
    ["토양 수분 자동 급수", SOIL_PUMP_AUTO_WATERING_LOGICAL, ["NC"]],
  ] as const;

  for (const [label, logical, allowedUnconnected] of cases) {
    for (const bbId of ["half", "full", "mini"] as const) {
      it(`${label} ${bbId}: diagnose ok·단락 없음·겹침 없음`, () => {
        expectCleanPlacement(logical, BREADBOARDS[bbId], [...allowedUnconnected]);
      });
    }
  }
});

/** 버튼으로 레이저 켜기 — 버튼(D2)+레이저 송신(D8), 모든 핀 연결(미연결 0). */
describe("autoPlace — 버튼으로 레이저 켜기", () => {
  for (const bbId of ["half", "full", "mini"] as const) {
    it(`${bbId}: diagnose ok·단락 없음·미연결 0`, () => {
      expectCleanPlacement(LASER_BUTTON_LOGICAL, BREADBOARDS[bbId], []);
    });
  }
});
