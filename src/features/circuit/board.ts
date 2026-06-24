/**
 * 개발보드 레지스트리 — 아두이노·ESP32 등 작업대 보드의 SSOT.
 * 빵판(BREADBOARDS)과 같은 패턴: BOARDS 레지스트리 + activeBoard()/setActiveBoard().
 * 핀맵·전원모델·치수·렌더전략을 보드별로 정의 → diagnose·net·씬·직렬화가 활성 보드를 파생.
 *
 * 좌표계: 보드 그룹 로컬 mm(보드 위치 무관). GLB 보드(아두이노)는 /calibrate 보정값
 * (calibration-data), 절차 보드(ESP32)는 빌더 기하에서 계산(resolveCoords, 보정 불필요).
 */
import { getCalibration, type Vec3 } from "./calibration-data";
import type { RenderStrategy } from "./types";

export type BoardId = "arduino-uno" | "esp32-huzzah32";

/** 보드 핀 역할 — 전원/접지/입출력. net·diagnose 가 role 기반으로 보드 무관 동작 */
export type BoardPinRole =
  | "power5" // 5V
  | "power3v3" // 3.3V
  | "vin"
  | "gnd"
  | "digital"
  | "pwm"
  | "analog"
  | "other";

export interface BoardPinDef {
  /** 안정 키 = 노드 id (예 'AD_D13' | 'ESP_13') */
  id: string;
  label: string;
  role: BoardPinRole;
}
export interface BoardPin extends BoardPinDef {
  x: number; // 보드 그룹 로컬 mm
  y: number;
  z: number;
}

export interface BoardDef {
  id: BoardId;
  /** calibration-data / CALIB_TARGETS 키(= 핀 좌표 저장소 키) */
  modelKey: string;
  label: string;
  /** 직렬화/넷리스트에서 단자 출처를 가리키는 짧은 이름("아두이노"·"ESP32") */
  refLabel: string;
  /** 본체 치수 mm (length=x, width=z) — 씬 폴백·뷰포트용 */
  dims: { length: number; width: number };
  /** 로직 전압(V) — 전압 호환 진단(5V 전용 부품을 3.3V 보드에 연결 시 경고) */
  logicV: number;
  /** 3D 렌더 전략 — GLB(아두이노) | 절차 메시(ESP32) */
  render: RenderStrategy;
  pinDefs: BoardPinDef[];
  /**
   * 핀 좌표 해석기 — 없으면 calibration-data[modelKey] 사용(GLB 보정값).
   * 절차 보드는 빌더 기하에서 계산한 좌표를 반환(보정 라운드 불필요).
   */
  resolveCoords?: () => Record<string, Vec3>;
}

// ── 아두이노 UNO 핀 모델 ───────────────────────────────────
export const ARDUINO_MODEL_KEY = "arduino-uno";
const PWM_UNO = new Set([3, 5, 6, 9, 10, 11]);
function unoDigital(n: number): BoardPinDef {
  return { id: `AD_D${n}`, label: String(n), role: PWM_UNO.has(n) ? "pwm" : "digital" };
}
/** 배치(보정) 순서대로의 핀 정의 — 좌표는 calibration-data('arduino-uno')에서 채움 */
export const ARDUINO_PIN_DEFS: BoardPinDef[] = [
  { id: "AD_AREF", label: "AREF", role: "other" },
  { id: "AD_GND_D", label: "GND", role: "gnd" },
  unoDigital(13),
  unoDigital(12),
  unoDigital(11),
  unoDigital(10),
  unoDigital(9),
  unoDigital(8),
  unoDigital(7),
  unoDigital(6),
  unoDigital(5),
  unoDigital(4),
  unoDigital(3),
  unoDigital(2),
  { id: "AD_3V3", label: "3V3", role: "power3v3" },
  { id: "AD_5V", label: "5V", role: "power5" },
  { id: "AD_GND_P1", label: "GND", role: "gnd" },
  { id: "AD_GND_P2", label: "GND", role: "gnd" },
  { id: "AD_VIN", label: "VIN", role: "vin" },
  { id: "AD_A0", label: "A0", role: "analog" },
  { id: "AD_A1", label: "A1", role: "analog" },
  { id: "AD_A2", label: "A2", role: "analog" },
  { id: "AD_A3", label: "A3", role: "analog" },
  { id: "AD_A4", label: "A4", role: "analog" },
  { id: "AD_A5", label: "A5", role: "analog" },
];

// ── ESP32 (Adafruit HUZZAH32) 핀 모델 ──────────────────────
// 절차 보드 — 좌표를 buildEsp32Board(fixtures.ts)의 헤더핀 기하에서 그대로 계산한다.
// ⚠️ 아래 상수는 fixtures.ts buildEsp32Board / pinRow 와 동일해야 함(좌표 드리프트 차단).
const ESP_L = 51;
const ESP_W = 23;
const ESP_H = 1.6;
const ESP_ROW = 14; // 한 행 핀 수(양측 2행 = 28)
const ESP_START_X = -ESP_L / 2 + 5;
const ESP_STEP_X = (ESP_L - 10) / (ESP_ROW - 1);
const ESP_ROW_Z = ESP_W / 2 - 1.5; // 헤더행 z(±)
const ESP_PIN_Y = ESP_H + 1.3; // pinRow: topY + 1.3 (핀 중심)

// 교육용 단순화 HUZZAH32 핀맵(28핀, 앞행 14 + 뒷행 14). 역할(전원/접지/PWM/아날로그)
// 정확성 우선, GPIO 번호는 대표값. 앞행 z=+ROW_Z, 뒷행 z=−ROW_Z 순서.
export const ESP32_PIN_DEFS: BoardPinDef[] = [
  // 앞행(i=0..13)
  { id: "ESP_RST", label: "RST", role: "other" },
  { id: "ESP_3V", label: "3V", role: "power3v3" },
  { id: "ESP_GND1", label: "GND", role: "gnd" },
  { id: "ESP_A0", label: "A0", role: "analog" },
  { id: "ESP_A1", label: "A1", role: "analog" },
  { id: "ESP_A2", label: "A2", role: "analog" },
  { id: "ESP_A3", label: "A3", role: "analog" },
  { id: "ESP_A4", label: "A4", role: "analog" },
  { id: "ESP_A5", label: "A5", role: "analog" },
  { id: "ESP_SCK", label: "SCK", role: "digital" },
  { id: "ESP_MOSI", label: "MO", role: "digital" },
  { id: "ESP_MISO", label: "MI", role: "digital" },
  { id: "ESP_RX", label: "RX", role: "digital" },
  { id: "ESP_TX", label: "TX", role: "digital" },
  // 뒷행(i=0..13)
  { id: "ESP_USB", label: "USB", role: "power5" },
  { id: "ESP_EN", label: "EN", role: "other" },
  { id: "ESP_VBAT", label: "BAT", role: "vin" },
  { id: "ESP_GND2", label: "GND", role: "gnd" },
  { id: "ESP_13", label: "13", role: "pwm" },
  { id: "ESP_12", label: "12", role: "pwm" },
  { id: "ESP_27", label: "27", role: "pwm" },
  { id: "ESP_33", label: "33", role: "pwm" },
  { id: "ESP_15", label: "15", role: "pwm" },
  { id: "ESP_32", label: "32", role: "pwm" },
  { id: "ESP_14", label: "14", role: "pwm" },
  { id: "ESP_22", label: "22", role: "digital" },
  { id: "ESP_23", label: "23", role: "digital" },
  { id: "ESP_21", label: "21", role: "digital" },
];

/** ESP32 핀 좌표 — 절차 빌더 헤더행 기하에서 계산(앞행 z=+, 뒷행 z=−). */
function esp32Coords(): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  ESP32_PIN_DEFS.forEach((d, k) => {
    const i = k % ESP_ROW;
    const z = k < ESP_ROW ? ESP_ROW_Z : -ESP_ROW_Z;
    out[d.id] = [ESP_START_X + i * ESP_STEP_X, ESP_PIN_Y, z];
  });
  return out;
}

export const BOARDS: Record<BoardId, BoardDef> = {
  "arduino-uno": {
    id: "arduino-uno",
    modelKey: ARDUINO_MODEL_KEY,
    label: "아두이노 Uno",
    refLabel: "아두이노",
    dims: { length: 68.6, width: 53.4 },
    logicV: 5,
    render: { kind: "glb", assetId: "arduino-uno" },
    pinDefs: ARDUINO_PIN_DEFS,
  },
  "esp32-huzzah32": {
    id: "esp32-huzzah32",
    modelKey: "esp32-huzzah32",
    label: "ESP32 (Huzzah32)",
    refLabel: "ESP32",
    dims: { length: ESP_L, width: ESP_W },
    logicV: 3.3,
    render: { kind: "procedural", builder: "esp32" },
    pinDefs: ESP32_PIN_DEFS,
    resolveCoords: esp32Coords,
  },
};

// ── 활성 보드 상태 (빵판 setActiveBreadboard 와 동일 규약) ──
let _activeId: BoardId = "arduino-uno";
let _pins: BoardPin[] | null = null;
let _pinMap: Map<string, BoardPin> | null = null;

/** 활성 보드 정의 */
export const activeBoard = (): BoardDef => BOARDS[_activeId];
/** 직렬화/넷리스트 단자 출처 짧은 이름 */
export const boardRefLabel = (): string => activeBoard().refLabel;

/** 무상태 불변식: 서버/MCP 진입점은 보드 1종 고정 — 런타임 setActiveBoard 호출 금지. */
/** 활성 보드 교체 — 핀 캐시 무효화 필수(안 하면 옛 보드 잔존) */
export function setActiveBoard(id: BoardId): void {
  _activeId = id;
  _pins = null;
  _pinMap = null;
}

/** 보정/계산 좌표가 있는 핀만 반환(활성 보드). */
export function getBoardPins(): BoardPin[] {
  if (_pins) return _pins;
  const b = activeBoard();
  const coords = b.resolveCoords ? b.resolveCoords() : getCalibration(b.modelKey);
  _pins = b.pinDefs
    .filter((d) => coords[d.id])
    .map((d) => {
      const [x, y, z] = coords[d.id];
      return { ...d, x, y, z };
    });
  return _pins;
}

export function getBoardPinMap(): Map<string, BoardPin> {
  if (!_pinMap) _pinMap = new Map(getBoardPins().map((p) => [p.id, p]));
  return _pinMap;
}

export function isBoardPowerPin(role: BoardPinRole): boolean {
  return role === "power5" || role === "power3v3" || role === "vin";
}

/** 끝점 id 가 활성 보드의 핀인가(빵판 홀과 구분). 핀 id↔홀 id 충돌 없음. */
export function isBoardPinId(id: string): boolean {
  return getBoardPinMap().has(id);
}
