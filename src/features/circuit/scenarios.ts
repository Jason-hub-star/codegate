/** 데모 시나리오 프리셋 + 단위테스트 픽스처. 순수 도메인. */
import { computePinHoles } from "./parts";
import type { CircuitModel, PlacedPart, Wire } from "./types";

function part(
  uid: string,
  defId: string,
  anchor: string,
  orientation: 0 | 1 = 0,
): PlacedPart {
  const pinHoles = computePinHoles(defId, anchor, orientation);
  if (!pinHoles) throw new Error(`배치 불가: ${defId}@${anchor}`);
  return { uid, defId, pinHoles, orientation, anchorHoleId: anchor };
}

function wire(id: string, a: string, b: string): Wire {
  return { id, a, b };
}

/** 보드밖(free) 서보 인스턴스 — leads = [신호, VCC, GND] (def.pins 순서: pwm·power·gnd) */
function servo(
  uid: string,
  signal: string | null,
  vcc: string | null,
  gnd: string | null,
  bodyPos: { x: number; z: number } = { x: 0, z: 70 },
): PlacedPart {
  return {
    uid,
    defId: "servo",
    pinHoles: [],
    orientation: 0,
    anchorHoleId: "",
    mount: "free",
    bodyPos,
    leads: [signal, vcc, gnd],
  };
}

export interface Scenario {
  id: string;
  label: string;
  description: string;
  model: CircuitModel;
}

/** 정상: 5V → LED(e5→e7) → 저항(a7→a11) → GND */
const ledCorrect: CircuitModel = {
  parts: [part("led1", "led", "e5"), part("r1", "resistor", "a7")],
  wires: [wire("w1", "AD_5V", "a5"), wire("w2", "a11", "AD_GND_P1")],
};

/** 저항 누락: LED 직결 (과전류) */
const ledNoResistor: CircuitModel = {
  parts: [part("led1", "led", "e5")],
  wires: [wire("w1", "AD_5V", "a5"), wire("w2", "a7", "AD_GND_P1")],
};

/** 극성 반대: 애노드가 GND, 캐소드가 5V */
const ledReversed: CircuitModel = {
  parts: [part("led1", "led", "e5")],
  wires: [wire("w1", "AD_GND_P1", "a5"), wire("w2", "AD_5V", "a7")],
};

/** 단락: 5V ↔ GND 가 부하 없이 직결 */
const shortCircuit: CircuitModel = {
  parts: [],
  wires: [wire("w1", "AD_5V", "a13"), wire("w2", "AD_GND_P1", "a13")],
};

/** 열린 회로: 전원만 연결, 그라운드 미완결 */
const openCircuit: CircuitModel = {
  parts: [part("led1", "led", "e5"), part("r1", "resistor", "a7")],
  wires: [wire("w1", "AD_5V", "a5")], // 그라운드 측 점퍼 없음
};

/** 빈 회로 */
const empty: CircuitModel = { parts: [], wires: [] };

/** 버튼 정상: 디지털핀(D2) → 버튼 → GND (INPUT_PULLUP 정석) */
const buttonCorrect: CircuitModel = {
  parts: [part("btn1", "button", "e5")],
  wires: [wire("w1", "AD_D2", "a5"), wire("w2", "a7", "AD_GND_P1")],
};

/** 버튼 floating: 버튼만 배치, 전원·GND 미연결 */
const buttonFloating: CircuitModel = {
  parts: [part("btn1", "button", "e5")],
  wires: [],
};

/** 버튼 오배선: 5V↔GND 사이만 연결 — 입력핀 미연결이라 눌림을 못 읽음 */
const buttonNoInput: CircuitModel = {
  parts: [part("btn1", "button", "e5")],
  wires: [wire("w1", "AD_5V", "a5"), wire("w2", "a7", "AD_GND_P1")],
};

/** 서보 정상: 신호→D9(PWM)·VCC→5V·GND→GND */
const servoCorrect: CircuitModel = {
  parts: [servo("servo1", "AD_D9", "AD_5V", "AD_GND_P1")],
  wires: [],
};

/** 서보 오배선: 신호가 PWM 아닌 D2에 연결 */
const servoSignalNotPwm: CircuitModel = {
  parts: [servo("servo1", "AD_D2", "AD_5V", "AD_GND_P1")],
  wires: [],
};

/** 서보+D9, 버튼+D2: 아두이노가 빵판 rail을 먹이고 서보/버튼이 그 rail을 공유 */
const servoButtonViaRails: CircuitModel = {
  parts: [
    servo("servo1", "e10", "T+_5", "T-_5"),
    part("btn1", "button", "e20"),
  ],
  wires: [
    wire("w1", "AD_5V", "T+_1"),
    wire("w2", "AD_GND_P1", "T-_1"),
    wire("w3", "AD_D9", "a10"),
    wire("w4", "AD_D2", "a20"),
    wire("w5", "a22", "T-_10"),
  ],
};

export const SCENARIOS: Record<string, Scenario> = {
  ledCorrect: {
    id: "ledCorrect",
    label: "정상 LED 회로",
    description: "전원 → LED → 저항 → 그라운드가 올바르게 완결된 회로",
    model: ledCorrect,
  },
  ledNoResistor: {
    id: "ledNoResistor",
    label: "저항 누락",
    description: "LED를 저항 없이 직결 — 과전류 위험",
    model: ledNoResistor,
  },
  ledReversed: {
    id: "ledReversed",
    label: "극성 반대",
    description: "LED 애노드·캐소드를 거꾸로 연결",
    model: ledReversed,
  },
  shortCircuit: {
    id: "shortCircuit",
    label: "단락",
    description: "전원과 그라운드를 부하 없이 직결",
    model: shortCircuit,
  },
  openCircuit: {
    id: "openCircuit",
    label: "열린 회로",
    description: "그라운드 측 연결이 빠져 회로가 완결되지 않음",
    model: openCircuit,
  },
  empty: {
    id: "empty",
    label: "빈 회로",
    description: "부품·배선 없음",
    model: empty,
  },
  buttonCorrect: {
    id: "buttonCorrect",
    label: "정상 버튼 회로",
    description: "전원 → 버튼 → 그라운드가 올바르게 완결된 회로",
    model: buttonCorrect,
  },
  buttonFloating: {
    id: "buttonFloating",
    label: "버튼 floating",
    description: "버튼이 전원·그라운드에 미연결",
    model: buttonFloating,
  },
  buttonNoInput: {
    id: "buttonNoInput",
    label: "버튼 입력핀 미연결",
    description: "버튼이 5V↔GND 사이만 연결돼 눌림을 읽을 수 없음",
    model: buttonNoInput,
  },
  servoCorrect: {
    id: "servoCorrect",
    label: "정상 서보 회로",
    description: "신호선→PWM핀(D9)·VCC→5V·GND→GND로 올바르게 연결",
    model: servoCorrect,
  },
  servoSignalNotPwm: {
    id: "servoSignalNotPwm",
    label: "서보 신호 PWM 아님",
    description: "서보 신호선이 PWM 아닌 디지털핀(D2)에 연결됨",
    model: servoSignalNotPwm,
  },
  servoButtonViaRails: {
    id: "servoButtonViaRails",
    label: "서보 + 버튼 rail 회로",
    description:
      "아두이노 5V/GND가 빵판 rail을 먹이고, 서보는 D9(PWM), 버튼은 D2↔GND로 연결",
    model: servoButtonViaRails,
  },
};
