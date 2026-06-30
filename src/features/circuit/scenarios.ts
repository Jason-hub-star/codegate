/** 데모 시나리오 프리셋 + 단위테스트 픽스처. 순수 도메인. */
import { computePinHoles } from "./parts";
import type { CircuitModel, PlacedPart, Wire } from "./types";
import { autoPlace, type LogicalCircuit } from "./autoPlace";
import { BREADBOARDS, type BreadboardId } from "./breadboard";

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

/** 보드밖(free) 부품 인스턴스 — leads 는 def.pins 순서대로 끝점(미연결=null). */
function freePart(
  uid: string,
  defId: string,
  leads: (string | null)[],
  bodyPos: { x: number; z: number } = { x: 0, z: 70 },
): PlacedPart {
  return {
    uid,
    defId,
    pinHoles: [],
    orientation: 0,
    anchorHoleId: "",
    mount: "free",
    bodyPos,
    leads,
  };
}

/** 서보(free) — leads = [신호, VCC, GND] (def.pins 순서: pwm·power·gnd) */
function servo(
  uid: string,
  signal: string | null,
  vcc: string | null,
  gnd: string | null,
  bodyPos: { x: number; z: number } = { x: 0, z: 70 },
): PlacedPart {
  return freePart(uid, "servo", [signal, vcc, gnd], bodyPos);
}

export interface Scenario {
  id: string;
  label: string;
  description: string;
  /**
   * 물리 회로(홀 좌표 고정). 항상 존재 — 직렬화·코드생성·테스트가 이걸 소비.
   * 논리 예제는 이 값이 **기본 빵판(half) 배치 결과**다(logical 로 빵판별 재배치 가능).
   */
  model: CircuitModel;
  /** 논리 예제(빵판-무관) — 있으면 로드 시 현재 빵판으로 autoPlace 재배치. */
  logical?: LogicalCircuit;
  /** 논리 예제가 지원하는 빵판(기본 전체). 첫 항목 = 미지원 빵판일 때 선호 빵판. */
  breadboards?: BreadboardId[];
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

// 릴레이 leads 순서 = def.pins: [IN, VCC, GND, COM, NO, NC]
/** 릴레이 정상 제어(free): IN→D8·VCC→5V·GND→GND. 부하측 미사용(COM/NO/NC=null). */
const relayControl: CircuitModel = {
  parts: [
    freePart("relay1", "relay", ["AD_D8", "AD_5V", "AD_GND_P1", null, null, null]),
  ],
  wires: [],
};

/**
 * 레이저 트립와이어 — 빵판-무관 논리 정의(autoPlace 가 빵판별로 실현).
 * 핀 인덱스: laserTx/laserRx = [S(0), +VCC(1), −GND(2)] · buzzerModule = [−(0), +(1), S(2)].
 * 송신 S→D4 · 수신 S→D2(인터럽트) · 부저 S→D8 · 부저+ 와 레이저 VCC = 5V net · 모든 −/GND = GND net.
 * 레일 빵판이면 5V/GND가 레일로, 미니(레일 없음)면 본체 버스 열로 자동 분배.
 */
export const LASER_TRIPWIRE_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "laserTx1", defId: "laserTx" },
    { uid: "laserRx1", defId: "laserRx" },
    { uid: "buzzer1", defId: "buzzerModule" },
  ],
  nets: [
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "laserTx1", pin: 1 },
        { uid: "laserRx1", pin: 1 },
        { uid: "buzzer1", pin: 1 }, // 부저 + = 상시 전원
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "laserTx1", pin: 2 },
        { uid: "laserRx1", pin: 2 },
        { uid: "buzzer1", pin: 0 }, // 부저 −
      ],
    },
    { name: "D4", board: "AD_D4", terminals: [{ uid: "laserTx1", pin: 0 }] },
    { name: "D2", board: "AD_D2", terminals: [{ uid: "laserRx1", pin: 0 }] },
    { name: "D8", board: "AD_D8", terminals: [{ uid: "buzzer1", pin: 2 }] }, // 부저 S = 신호
  ],
};

/**
 * 버튼으로 레이저 켜기 — 빵판-무관 논리 정의(autoPlace 가 빵판별로 실현).
 * 가장 단순한 입력→출력: 버튼을 누르면 아두이노가 레이저 송신 모듈을 켠다.
 * 핀 인덱스: button = [A(0), B(1)] · laserTx = [S(0,신호), VCC(1), GND(2)].
 * 버튼 A→D2(입력, INPUT_PULLUP) · 버튼 B→GND · 레이저 S→D8(제어 출력) · VCC→5V · GND 공통.
 * 5V/GND 단자가 적어 아두이노 핀에 직결(레일 불필요) — 빵판 3종에서 동일하게 동작.
 */
export const LASER_BUTTON_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "btn1", defId: "button" },
    { uid: "laserTx1", defId: "laserTx" },
  ],
  nets: [
    { name: "D2", board: "AD_D2", terminals: [{ uid: "btn1", pin: 0 }] }, // 버튼 A → 입력핀
    { name: "D8", board: "AD_D8", terminals: [{ uid: "laserTx1", pin: 0 }] }, // 레이저 S → 제어 출력
    { name: "5V", kind: "power", terminals: [{ uid: "laserTx1", pin: 1 }] }, // 레이저 VCC
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "btn1", pin: 1 }, // 버튼 B
        { uid: "laserTx1", pin: 2 }, // 레이저 GND
      ],
    },
  ],
};

/**
 * 서보 + 버튼 — 빵판-무관 논리 정의(autoPlace 가 빵판별로 실현).
 * 핀 인덱스: servo = [신호(0,PWM), VCC(1), GND(2)] · button = [A(0), B(1)].
 * 서보 신호→D9(PWM) · VCC→5V · GND 공통 · 버튼 A→D2(INPUT_PULLUP) · 버튼 B→GND.
 * 레일 빵판이면 5V/GND가 레일로, 미니(레일 없음)면 본체 버스 열로 자동 분배.
 */
export const SERVO_BUTTON_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "servo1", defId: "servo" },
    { uid: "btn1", defId: "button" },
  ],
  nets: [
    { name: "D9", board: "AD_D9", terminals: [{ uid: "servo1", pin: 0 }] }, // 서보 신호(PWM)
    { name: "5V", kind: "power", terminals: [{ uid: "servo1", pin: 1 }] },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "servo1", pin: 2 },
        { uid: "btn1", pin: 1 }, // 버튼 B
      ],
    },
    { name: "D2", board: "AD_D2", terminals: [{ uid: "btn1", pin: 0 }] }, // 버튼 A → 입력핀
  ],
};

/**
 * 릴레이 + 펌프 — 빵판-무관 논리 정의(autoPlace 가 빵판별로 실현).
 * 핀 인덱스: relay = [IN(0), VCC(1), GND(2), COM(3), NO(4), NC(5)] · pump = [+(0), −(1)].
 * 제어: IN→D8 · VCC→5V · GND 공통. 부하: COM=5V net · NO→펌프+(LOAD net) · 펌프−→GND.
 * 펌프+는 릴레이 NO–COM 접점 간선(net.ts)을 거쳐 5V에 도달 — 릴레이가 펌프를 진짜 단속.
 * NC(pin5)는 의도적 미사용. 레일 빵판이면 5V가 레일로, 미니(레일 없음)면 본체 버스 열로 분배.
 */
export const RELAY_PUMP_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "relay1", defId: "relay" },
    { uid: "pump1", defId: "pump" },
  ],
  nets: [
    { name: "D8", board: "AD_D8", terminals: [{ uid: "relay1", pin: 0 }] }, // IN
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "relay1", pin: 1 }, // VCC
        { uid: "relay1", pin: 3 }, // COM = 부하측 공급
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "relay1", pin: 2 }, // 릴레이 GND
        { uid: "pump1", pin: 1 }, // 펌프 −
      ],
    },
    {
      name: "LOAD",
      terminals: [
        { uid: "relay1", pin: 4 }, // NO 접점
        { uid: "pump1", pin: 0 }, // 펌프 +
      ],
    },
  ],
};

export const LDR_AUTO_LIGHT_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "ldr1", defId: "ldr" },
    { uid: "senseR1", defId: "resistor" },
    { uid: "led1", defId: "led" },
    { uid: "ledR1", defId: "resistor" },
  ],
  nets: [
    { name: "5V", kind: "power", terminals: [{ uid: "ldr1", pin: 0 }] },
    {
      name: "A0_DIV",
      board: "AD_A0",
      terminals: [
        { uid: "ldr1", pin: 1 },
        { uid: "senseR1", pin: 0 },
      ],
    },
    { name: "GND", kind: "ground", terminals: [{ uid: "senseR1", pin: 1 }, { uid: "ledR1", pin: 1 }] },
    { name: "D9", board: "AD_D9", terminals: [{ uid: "led1", pin: 0 }] },
    {
      name: "LED_LIMIT",
      terminals: [
        { uid: "led1", pin: 1 },
        { uid: "ledR1", pin: 0 },
      ],
    },
  ],
};

export const PIR_BUZZER_ALARM_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "pir1", defId: "pir" },
    { uid: "piezo1", defId: "piezo" },
  ],
  nets: [
    { name: "5V", kind: "power", terminals: [{ uid: "pir1", pin: 0 }] },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "pir1", pin: 2 },
        { uid: "piezo1", pin: 1 },
      ],
    },
    { name: "D2", board: "AD_D2", terminals: [{ uid: "pir1", pin: 1 }] },
    { name: "D8", board: "AD_D8", terminals: [{ uid: "piezo1", pin: 0 }] },
  ],
};

export const PIR_SERVO_DOOR_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "pir1", defId: "pir" },
    { uid: "servo1", defId: "servo" },
  ],
  nets: [
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "pir1", pin: 0 },
        { uid: "servo1", pin: 1 },
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "pir1", pin: 2 },
        { uid: "servo1", pin: 2 },
      ],
    },
    { name: "D2", board: "AD_D2", terminals: [{ uid: "pir1", pin: 1 }] },
    { name: "D9", board: "AD_D9", terminals: [{ uid: "servo1", pin: 0 }] },
  ],
};

export const POT_SERVO_KNOB_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "pot1", defId: "pot" },
    { uid: "servo1", defId: "servo" },
  ],
  nets: [
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "pot1", pin: 0 },
        { uid: "servo1", pin: 1 },
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "pot1", pin: 2 },
        { uid: "servo1", pin: 2 },
      ],
    },
    { name: "A0", board: "AD_A0", terminals: [{ uid: "pot1", pin: 1 }] },
    { name: "D9", board: "AD_D9", terminals: [{ uid: "servo1", pin: 0 }] },
  ],
};

export const DHT11_OLED_WEATHER_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "dht1", defId: "dht11" },
    { uid: "oled1", defId: "oled" },
  ],
  nets: [
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "dht1", pin: 0 },
        { uid: "oled1", pin: 1 },
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "dht1", pin: 2 },
        { uid: "oled1", pin: 0 },
      ],
    },
    { name: "D2", board: "AD_D2", terminals: [{ uid: "dht1", pin: 1 }] },
    { name: "SCL", board: "AD_A5", terminals: [{ uid: "oled1", pin: 2 }] },
    { name: "SDA", board: "AD_A4", terminals: [{ uid: "oled1", pin: 3 }] },
  ],
};

export const LDR_NEOPIXEL_NIGHT_LIGHT_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "ldr1", defId: "ldr" },
    { uid: "senseR1", defId: "resistor" },
    { uid: "pixel1", defId: "neopixel" },
  ],
  nets: [
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "ldr1", pin: 0 },
        { uid: "pixel1", pin: 0 },
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "senseR1", pin: 1 },
        { uid: "pixel1", pin: 2 },
      ],
    },
    {
      name: "A0_DIV",
      board: "AD_A0",
      terminals: [
        { uid: "ldr1", pin: 1 },
        { uid: "senseR1", pin: 0 },
      ],
    },
    { name: "D6", board: "AD_D6", terminals: [{ uid: "pixel1", pin: 1 }] },
  ],
};

export const ULTRASONIC_PARKING_ALARM_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "ultra1", defId: "ultrasonicHcsr04" },
    { uid: "buzzer1", defId: "buzzerModule" },
  ],
  nets: [
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "ultra1", pin: 0 },
        { uid: "buzzer1", pin: 1 },
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "ultra1", pin: 3 },
        { uid: "buzzer1", pin: 0 },
      ],
    },
    { name: "D7", board: "AD_D7", terminals: [{ uid: "ultra1", pin: 1 }] },
    { name: "D6", board: "AD_D6", terminals: [{ uid: "ultra1", pin: 2 }] },
    { name: "D8", board: "AD_D8", terminals: [{ uid: "buzzer1", pin: 2 }] },
  ],
};

export const SOIL_PUMP_AUTO_WATERING_LOGICAL: LogicalCircuit = {
  parts: [
    { uid: "soil1", defId: "soilMoisture" },
    { uid: "relay1", defId: "relay" },
    { uid: "pump1", defId: "pump" },
  ],
  nets: [
    { name: "A0", board: "AD_A0", terminals: [{ uid: "soil1", pin: 1 }] },
    { name: "D8", board: "AD_D8", terminals: [{ uid: "relay1", pin: 0 }] },
    {
      name: "5V",
      kind: "power",
      terminals: [
        { uid: "soil1", pin: 0 },
        { uid: "relay1", pin: 1 },
        { uid: "relay1", pin: 3 },
      ],
    },
    {
      name: "GND",
      kind: "ground",
      terminals: [
        { uid: "soil1", pin: 2 },
        { uid: "relay1", pin: 2 },
        { uid: "pump1", pin: 1 },
      ],
    },
    {
      name: "LOAD",
      terminals: [
        { uid: "relay1", pin: 4 },
        { uid: "pump1", pin: 0 },
      ],
    },
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
    label: "서보 + 버튼",
    description:
      "버튼(D2)으로 서보(D9·PWM)를 제어. 빵판을 바꾸면 배치가 자동 적응(레일↔본체 버스)",
    model: autoPlace(SERVO_BUTTON_LOGICAL, BREADBOARDS.half),
    logical: SERVO_BUTTON_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  relayControl: {
    id: "relayControl",
    label: "릴레이 제어",
    description: "디지털핀(D8)→IN·VCC→5V·GND→GND로 릴레이를 ON/OFF 제어",
    model: relayControl,
  },
  relayPumpExternal: {
    id: "relayPumpExternal",
    label: "릴레이 + 펌프",
    description:
      "릴레이 접점(COM→NO)으로 펌프를 단속. 빵판을 바꾸면 배치가 자동 적응(레일↔본체 버스)",
    model: autoPlace(RELAY_PUMP_LOGICAL, BREADBOARDS.half),
    logical: RELAY_PUMP_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  laserTripwire: {
    id: "laserTripwire",
    label: "레이저 트립와이어 + 부저",
    description:
      "레이저 송신(D4)→수신(D2) 빔이 차단되면 부저(D8) 경보. 빵판을 바꾸면 배치가 자동 적응(레일↔본체 버스)",
    model: autoPlace(LASER_TRIPWIRE_LOGICAL, BREADBOARDS.half), // 기본 배치(half)
    logical: LASER_TRIPWIRE_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  laserButton: {
    id: "laserButton",
    label: "버튼으로 레이저 켜기",
    description:
      "버튼(D2)을 누르면 레이저 송신 모듈(D8)이 켜지는 단순 입력→출력 회로. 빵판을 바꿔도 동일 동작",
    model: autoPlace(LASER_BUTTON_LOGICAL, BREADBOARDS.half),
    logical: LASER_BUTTON_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  ldrAutoLight: {
    id: "ldrAutoLight",
    label: "LDR 자동 조명",
    description: "광센서 분압(A0)으로 어두움을 읽고 LED(D9)를 켜는 자동 조명",
    model: autoPlace(LDR_AUTO_LIGHT_LOGICAL, BREADBOARDS.half),
    logical: LDR_AUTO_LIGHT_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  pirBuzzerAlarm: {
    id: "pirBuzzerAlarm",
    label: "PIR 모션 경보기",
    description: "PIR 모션 센서(D2)가 움직임을 감지하면 피에조 부저(D8)로 알림",
    model: autoPlace(PIR_BUZZER_ALARM_LOGICAL, BREADBOARDS.half),
    logical: PIR_BUZZER_ALARM_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  pirServoDoor: {
    id: "pirServoDoor",
    label: "PIR 자동문 서보",
    description: "PIR 모션 센서(D2)가 움직임을 감지하면 서보(D9)가 문을 여는 회로",
    model: autoPlace(PIR_SERVO_DOOR_LOGICAL, BREADBOARDS.half),
    logical: PIR_SERVO_DOOR_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  potServoKnob: {
    id: "potServoKnob",
    label: "가변저항 서보 노브",
    description: "가변저항 와이퍼(A0) 값을 읽어 서보(D9) 각도를 조절",
    model: autoPlace(POT_SERVO_KNOB_LOGICAL, BREADBOARDS.half),
    logical: POT_SERVO_KNOB_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  dht11OledWeather: {
    id: "dht11OledWeather",
    label: "DHT11 + OLED 날씨판",
    description: "DHT11 온습도(DATA D2)를 읽어 OLED(I2C A4/A5)에 표시",
    model: autoPlace(DHT11_OLED_WEATHER_LOGICAL, BREADBOARDS.half),
    logical: DHT11_OLED_WEATHER_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  ldrNeopixelNightLight: {
    id: "ldrNeopixelNightLight",
    label: "LDR 네오픽셀 야간등",
    description: "광센서 분압(A0)으로 어두움을 읽고 NeoPixel(D6)을 켜는 야간등",
    model: autoPlace(LDR_NEOPIXEL_NIGHT_LIGHT_LOGICAL, BREADBOARDS.half),
    logical: LDR_NEOPIXEL_NIGHT_LIGHT_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  ultrasonicParkingAlarm: {
    id: "ultrasonicParkingAlarm",
    label: "초음파 주차 경보기",
    description: "HC-SR04(TRIG D7·ECHO D6)로 거리를 재고 가까우면 부저(D8) 알림",
    model: autoPlace(ULTRASONIC_PARKING_ALARM_LOGICAL, BREADBOARDS.half),
    logical: ULTRASONIC_PARKING_ALARM_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
  soilPumpAutoWatering: {
    id: "soilPumpAutoWatering",
    label: "토양 수분 자동 급수",
    description: "토양 수분 센서(A0)가 마르면 릴레이(D8)가 펌프를 단속하는 자동 급수",
    model: autoPlace(SOIL_PUMP_AUTO_WATERING_LOGICAL, BREADBOARDS.half),
    logical: SOIL_PUMP_AUTO_WATERING_LOGICAL,
    breadboards: ["half", "full", "mini"],
  },
};
