/** 부품 카탈로그 + 배치 계산 — 순수 도메인 (DEC-022/DEC-023). */
import type { PartDef, PlacedPart } from "./types";
import {
  getHoleMap,
  mainHoleId,
  ROW_LETTERS,
  boardDimensions,
} from "./breadboard";

export const PARTS: Record<string, PartDef> = {
  // ── T1 심화 (오개념 대본 풀) ──
  led: {
    id: "led",
    label: "LED",
    category: "output",
    status: "ready",
    render: { kind: "procedural", builder: "led" },
    pins: [
      { role: "signal", label: "애노드(+)" },
      { role: "gnd", label: "캐소드(−)" },
    ],
    needsResistor: true,
    polarity: true,
    span: 2,
    conducts: [[0, 1]],
    operatingV: "5V/3.3V",
    currentMa: 20,
    protocol: "onoff",
    description: "긴 다리=애노드(+), 짧은 다리=캐소드(−). 직렬 저항 필수.",
  },
  resistor: {
    id: "resistor",
    label: "저항 220Ω",
    category: "passive",
    status: "ready",
    render: { kind: "procedural", builder: "resistor" },
    pins: [
      { role: "signal", label: "1" },
      { role: "signal", label: "2" },
    ],
    span: 4,
    conducts: [[0, 1]],
    // 수동소자 — 동작전압 개념 N/A. 분압/직렬 회로 맥락에서 사용.
    description: "극성 없음. 색띠로 값을 읽어요(빨강·빨강·갈색·금=220Ω).",
  },
  // ── T2 배치 + 범용 진단 ──
  button: {
    id: "button",
    label: "버튼",
    category: "input",
    status: "ready",
    render: { kind: "procedural", builder: "button" },
    pins: [
      { role: "signal", label: "A" },
      { role: "signal", label: "B" },
    ],
    span: 2,
    conducts: [[0, 1]],
    operatingV: "5V/3.3V",
    protocol: "onoff",
    needsPullup: true,
    description: "실물은 4핀이지만 대각선 2쌍이 내부 연결돼 사실상 2접점. 입력엔 풀업 저항(또는 INPUT_PULLUP)이 필요해요.",
  },
  pot: {
    id: "pot",
    label: "가변저항",
    category: "input",
    status: "ready",
    render: { kind: "procedural", builder: "pot" },
    pins: [
      { role: "power", label: "VCC" },
      { role: "analog", label: "와이퍼" },
      { role: "gnd", label: "GND" },
    ],
    span: 1,
    conducts: [
      [0, 1],
      [1, 2],
    ],
    operatingV: "5V/3.3V",
    protocol: "analog",
    description: "양끝=VCC/GND, 가운데 와이퍼=아날로그 출력(분압). 와이퍼를 A0 같은 아날로그 핀에 연결해요.",
  },
  piezo: {
    id: "piezo",
    label: "피에조 부저 (능동)",
    category: "output",
    status: "ready",
    render: { kind: "procedural", builder: "piezo" },
    pins: [
      { role: "signal", label: "+" },
      { role: "gnd", label: "−" },
    ],
    polarity: true,
    span: 2,
    conducts: [[0, 1]],
    operatingV: "5V/3.3V",
    protocol: "onoff",
    description: "스타터킷 표준=능동 부저(내부 발진, DC만으로 소리). 긴 다리=+. 수동 부저는 별도.",
  },
  rgb: {
    id: "rgb",
    label: "RGB LED",
    category: "output",
    status: "ready",
    render: { kind: "procedural", builder: "rgb" },
    pins: [
      { role: "signal", label: "R" },
      { role: "gnd", label: "공통(−)" },
      { role: "signal", label: "G" },
      { role: "signal", label: "B" },
    ],
    needsResistor: true,
    polarity: true,
    span: 1,
    conducts: [
      [0, 1],
      [2, 1],
      [3, 1],
    ],
    operatingV: "5V/3.3V",
    currentMa: 20,
    protocol: "onoff",
    description: "스타터킷 표준=공통 캐소드(가장 긴 다리=공통 −). R·G·B 각각에 저항 필요. 공통 애노드 버전도 시중에 있어요.",
  },

  // ── GLB 복잡부품 (배포·렌더됨 = ready, 미배포 = staged). DEC-030 단계2에서 배치 활성 ──
  dht11: {
    id: "dht11",
    label: "DHT11 온습도",
    category: "sensor",
    status: "ready",
    render: { kind: "glb", assetId: "dht11" },
    pins: [
      { role: "power", label: "VCC" },
      { role: "digital", label: "DATA" },
      { role: "gnd", label: "GND" },
    ],
    span: 1,
    conducts: [],
    operatingV: "5V/3.3V",
    protocol: "1-wire",
    needsPullup: true,
    description: "단일 데이터선(1-wire) 온습도 센서. DATA에 풀업(약 10kΩ) 권장.",
  },
  pir: {
    id: "pir",
    label: "PIR 모션",
    category: "sensor",
    status: "ready",
    render: { kind: "glb", assetId: "pir-presence" },
    pins: [
      { role: "power", label: "VCC" },
      { role: "digital", label: "OUT" },
      { role: "gnd", label: "GND" },
    ],
    span: 1,
    conducts: [],
    operatingV: "5V",
    protocol: "onoff",
    description: "인체 적외선 감지. 움직이면 OUT이 HIGH. 디지털 입력으로 읽어요.",
  },
  ldr: {
    id: "ldr",
    label: "광센서 (LDR)",
    category: "input",
    status: "ready",
    render: { kind: "glb", assetId: "ldr" },
    pins: [
      { role: "signal", label: "1" },
      { role: "signal", label: "2" },
    ],
    span: 2,
    conducts: [[0, 1]],
    protocol: "analog",
    // 수동소자 — 동작전압 개념 N/A. 분압 회로 맥락에서 사용.
    description: "빛 세기에 따라 저항 변화. 저항과 분압해 아날로그 핀(A0)으로 읽어요.",
  },
  oled: {
    id: "oled",
    label: "OLED (SSD1306)",
    category: "output",
    status: "ready",
    render: { kind: "glb", assetId: "oled-ssd1306" },
    pins: [
      { role: "gnd", label: "GND" },
      { role: "power", label: "VCC" },
      { role: "signal", label: "SCL" },
      { role: "signal", label: "SDA" },
    ],
    span: 1,
    conducts: [],
    operatingV: "5V/3.3V",
    protocol: "i2c",
    description: "I2C 0.96인치 디스플레이. SCL/SDA 2선으로 제어(주소 보통 0x3C).",
  },
  servo: {
    id: "servo",
    label: "서보 모터",
    category: "output",
    status: "ready",
    mount: "free", // 본체는 보드 밖, 3선(신호·VCC·GND)을 점퍼로 홀에 연결
    render: { kind: "glb", assetId: "servo-mg923b" },
    pins: [
      { role: "pwm", label: "신호" },
      { role: "power", label: "VCC" },
      { role: "gnd", label: "GND" },
    ],
    span: 1,
    conducts: [],
    operatingV: "5V",
    protocol: "pwm",
    description: "PWM(약 50Hz)으로 각도 제어. 소비전류 커서 외부전원 권장.",
  },
  neopixel: {
    id: "neopixel",
    label: "네오픽셀 (WS2812)",
    category: "output",
    status: "staged",
    render: { kind: "procedural", builder: "neopixel" },
    pins: [
      { role: "power", label: "5V" },
      { role: "digital", label: "DIN" },
      { role: "gnd", label: "GND" },
    ],
    span: 1,
    conducts: [],
    operatingV: "5V",
    description: "주소지정 RGB LED. 단일 데이터선(WS2812 800kHz 시리얼 신호)으로 다수 제어. DIN→DOUT 체인.",
  },

  // ── 액추에이터(외부전원 구동) — DEC-027 고전류 부품 ──
  relay: {
    id: "relay",
    label: "릴레이 1채널",
    category: "output",
    status: "ready",
    mount: "free", // 모듈은 보드 밖, 제어 3선 + 부하 3단자를 점퍼로 연결(서보처럼)
    render: { kind: "procedural", builder: "relay" },
    // 제어측(IN/VCC/GND) + 부하측 접점(COM/NO/NC). 인덱스 0~5.
    pins: [
      { role: "signal", label: "IN" }, // 0 제어 신호
      { role: "power", label: "VCC" }, // 1 모듈 전원
      { role: "gnd", label: "GND" }, // 2 접지
      { role: "switch", label: "COM" }, // 3 부하 공통
      { role: "switch", label: "NO" }, // 4 상시개방(ON=연결)
      { role: "switch", label: "NC" }, // 5 상시폐쇄(OFF=연결)
    ],
    span: 1,
    conducts: [], // 도통은 relay 접점(net.ts가 COM↔NO/NC 간선화)으로 표현
    relay: { com: 3, no: 4, nc: 5 },
    operatingV: "5V",
    protocol: "onoff",
    description:
      "코일(IN/VCC/GND)이 부하측 접점을 단속: 여자=COM-NO 연결. 부하(펌프·모터)는 COM·NO로 외부전원과 스위칭하고 공통 GND로 묶어요. 모듈에 따라 active-low(LOW=ON)도 있어요.",
  },
  pump: {
    id: "pump",
    label: "워터펌프",
    category: "output",
    status: "ready",
    mount: "free", // 펌프는 보드 밖, +/− 2선을 외부전원·릴레이로 연결(서보처럼)
    render: { kind: "procedural", builder: "pump" },
    pins: [
      { role: "signal", label: "+" },
      { role: "gnd", label: "−" },
    ],
    polarity: true,
    span: 2,
    conducts: [[0, 1]],
    operatingV: "5V",
    protocol: "onoff",
    currentMa: 500,
    description:
      "DC 워터펌프. 소비전류가 커서 아두이노 핀 직결 불가 — 릴레이/모터드라이버 + 외부전원으로 구동해요.",
  },
};

export const PART_LIST: PartDef[] = Object.values(PARTS);

/**
 * 배치 시 각 핀이 꽂히는 홀 id 계산. 불가능하면 null.
 * orientation 0 = 가로(열 방향), 1 = 세로(행 방향, 중앙 홈 가로지르기 가능).
 */
export function computePinHoles(
  defId: string,
  anchorHoleId: string,
  orientation: 0 | 1,
): string[] | null {
  const def = PARTS[defId];
  if (!def) return null;
  const anchor = getHoleMap().get(anchorHoleId);
  if (!anchor || anchor.kind !== "main" || !anchor.row) return null;

  const rowIdx = ROW_LETTERS.indexOf(anchor.row);
  const out: string[] = [];
  for (let i = 0; i < def.pins.length; i++) {
    if (orientation === 0) {
      const id = mainHoleId(anchor.row, anchor.col + i * def.span);
      if (!id) return null;
      out.push(id);
    } else {
      const idx = rowIdx + i * def.span;
      if (idx < 0 || idx >= ROW_LETTERS.length) return null;
      out.push(`${ROW_LETTERS[idx]}${anchor.col}`);
    }
  }
  return out;
}

let _uid = 0;
/** 새 배치 인스턴스 생성 (배치 불가면 null) */
export function placePart(
  defId: string,
  anchorHoleId: string,
  orientation: 0 | 1 = 0,
): PlacedPart | null {
  const pinHoles = computePinHoles(defId, anchorHoleId, orientation);
  if (!pinHoles) return null;
  _uid += 1;
  return {
    uid: `p${_uid}`,
    defId,
    pinHoles,
    orientation,
    anchorHoleId,
  };
}

/** 보드 밖(free) 부품 생성 — 본체만 두고 핀은 전부 미연결(leads=null). */
export function placeFreePart(
  defId: string,
  bodyPos: { x: number; z: number },
  rot: 0 | 1 | 2 | 3 = 0,
): PlacedPart | null {
  const def = PARTS[defId];
  if (!def) return null;
  _uid += 1;
  return {
    uid: `p${_uid}`,
    defId,
    pinHoles: [],
    orientation: 0,
    anchorHoleId: "",
    mount: "free",
    bodyPos,
    rot,
    leads: def.pins.map(() => null),
  };
}

/** free 본체를 새 위치(빵판 로컬 mm)로 이동 — 리드 연결은 보존(순수). */
export function moveFreeBody(
  part: PlacedPart,
  bodyPos: { x: number; z: number },
): PlacedPart {
  if (part.mount !== "free") return part;
  return { ...part, bodyPos };
}

/** free 본체를 90° 회전(rot+1, 순수). board 부품은 무시. */
export function rotateFreeBody(part: PlacedPart): PlacedPart {
  if (part.mount !== "free") return part;
  return { ...part, rot: ((((part.rot ?? 0) + 1) % 4) as 0 | 1 | 2 | 3) };
}

/** free 리드 i 의 시작점 보정좌표(모델 로컬 mm)를 설정한 새 인스턴스(순수). */
export function setLeadAnchor(
  part: PlacedPart,
  pinIndex: number,
  coord: [number, number, number],
): PlacedPart {
  if (part.mount !== "free") return part;
  const n = PARTS[part.defId]?.pins.length ?? 0;
  const anchors = (part.leadAnchors ?? Array.from({ length: n }, () => null)).slice();
  anchors[pinIndex] = coord;
  return { ...part, leadAnchors: anchors };
}

/**
 * 부품의 핀별 연결 끝점(holeId | AD_핀 | null). net/serialize/netlist 의 **단일 분기점**.
 * board=pinHoles, free=leads. 이 헬퍼만 쓰면 보드/보드밖을 똑같이 다룰 수 있다.
 */
export function partEndpoints(part: PlacedPart): (string | null)[] {
  return part.mount === "free" ? (part.leads ?? []) : part.pinHoles;
}

/** free 부품의 한 핀(리드)을 끝점에 연결/해제한 새 인스턴스 반환(순수). */
export function withLead(
  part: PlacedPart,
  pinIndex: number,
  endpoint: string | null,
): PlacedPart {
  if (part.mount !== "free" || !part.leads) return part;
  const leads = part.leads.slice();
  leads[pinIndex] = endpoint;
  return { ...part, leads };
}

/** 앵커 홀에서 본체 위치(보드 앞)를 파생 — 본체는 보드 밖, x는 앵커 정렬. */
export function freeBodyPos(anchorHoleId: string): { x: number; z: number } | null {
  const anchor = getHoleMap().get(anchorHoleId);
  if (!anchor) return null;
  return { x: anchor.x, z: boardDimensions().width / 2 + 20 }; // 보드 앞쪽 20mm
}

/**
 * 보드밖(free) 부품을 앵커 홀 기준으로 배치 — 본체는 보드 앞, 리드는 그 홀 묶음에 연결.
 * (Phase 2: 리드=연속 홀 묶음 자동연결. 핀별 임의 라우팅은 Phase 3.)
 */
export function placeFreeAtAnchor(
  defId: string,
  anchorHoleId: string,
  orientation: 0 | 1 = 0,
): PlacedPart | null {
  const def = PARTS[defId];
  if (!def) return null;
  const leads = computePinHoles(defId, anchorHoleId, orientation);
  const bodyPos = freeBodyPos(anchorHoleId);
  if (!leads || !bodyPos) return null;
  _uid += 1;
  return {
    uid: `p${_uid}`,
    defId,
    pinHoles: [],
    orientation,
    anchorHoleId,
    mount: "free",
    bodyPos,
    leads,
  };
}

/** 이동: 기존 인스턴스를 새 앵커로 재배치(불가=null). board/free 모두 처리. */
export function reanchorPart(
  part: PlacedPart,
  anchorHoleId: string,
  orientation: 0 | 1,
): PlacedPart | null {
  if (part.mount === "free") {
    const leads = computePinHoles(part.defId, anchorHoleId, orientation);
    const bodyPos = freeBodyPos(anchorHoleId);
    if (!leads || !bodyPos) return null;
    return { ...part, anchorHoleId, orientation, leads, bodyPos };
  }
  const pinHoles = computePinHoles(part.defId, anchorHoleId, orientation);
  if (!pinHoles) return null;
  return { ...part, anchorHoleId, orientation, pinHoles };
}
