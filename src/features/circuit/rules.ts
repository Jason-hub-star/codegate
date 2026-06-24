/** 전기 규칙·상수 — research/11 (검증됨). 순수 도메인. */

export const SUPPLY_V = 5; // 빵판 + 레일 = +5V 가정 (MVP 전원 모델)

/** LED 색별 순방향 전압 Vf (V) */
export const LED_VF: Record<string, number> = {
  red: 2.0,
  orange: 2.0,
  yellow: 2.0,
  green: 2.1,
  blue: 3.2,
  white: 3.2,
};
export const DEFAULT_LED_VF = LED_VF.red;

export const LED_IF_TYP_A = 0.02; // 표준 동작 20mA

/** 아두이노 UNO 핀 한계 (research/11 B · 16 — ATmega328P 데이터시트) */
export const ARDUINO_PIN_MAX_MA = 40; // 핀당 절대최대(source/sink)
export const ARDUINO_PIN_REC_MA = 20; // 핀당 권장
export const ARDUINO_TOTAL_MA = 200; // 칩 합산 절대최대
export const ARDUINO_3V3_MAX_MA = 50; // 온보드 3.3V 레귤레이터 한계

/** PWM(~) 가능 디지털 핀 — analogWrite 대상 (research/16) */
export const ARDUINO_PWM_PINS = [3, 5, 6, 9, 10, 11] as const;

/** 내장 풀업(INPUT_PULLUP) 저항 범위 Ω (research/16, 배치별 편차) */
export const ARDUINO_PULLUP_OHM = { min: 20_000, max: 50_000 } as const;

/** 5V 로직 레벨 인식 임계 (V) — 전압 불일치 진단용 (research/16) */
export const LOGIC_HIGH_MIN_V = 3.0; // 이 이상이면 HIGH 인식
export const LOGIC_LOW_MAX_V = 1.5; // 이 이하면 LOW 인식

export const DEFAULT_RESISTOR_OHM = 220;

/** E12 표준 저항값 ×10ⁿ */
export const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

/** LED 전류 (mA): I = (V − Vf) / R */
export function ledCurrentMa(
  resistanceOhm: number,
  vf: number = DEFAULT_LED_VF,
  supply: number = SUPPLY_V,
): number {
  if (resistanceOhm <= 0) return Infinity;
  return ((supply - vf) / resistanceOhm) * 1000;
}

/** 권장 전류제한 저항 (Ω), E12 올림 */
export function recommendedResistor(
  vf: number = DEFAULT_LED_VF,
  ifA: number = LED_IF_TYP_A,
  supply: number = SUPPLY_V,
): number {
  const raw = (supply - vf) / ifA;
  for (let n = 0; n <= 6; n++) {
    for (const base of E12) {
      const val = base * 10 ** n;
      if (val >= raw) return Math.round(val);
    }
  }
  return Math.round(raw);
}

/** 전류 과대(>핀 한계)면 위험 */
export function isOvercurrent(currentMa: number): boolean {
  return currentMa > ARDUINO_PIN_MAX_MA;
}
