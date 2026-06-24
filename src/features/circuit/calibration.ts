/**
 * 보정 대상 레지스트리 — /calibrate 가 읽는다.
 * 새 GLB 모델 배선이 필요하면 여기 항목만 추가하면 보정 도구가 재사용된다.
 */
import { ARDUINO_PIN_DEFS } from "./board";

export interface CalibPoint {
  id: string; // 노드 id (배선 엔드포인트)
  label: string;
}

export interface CalibTarget {
  key: string; // calibration-data 의 키
  label: string; // 한국어 이름
  glbUrl: string;
  scaleLen: number; // 스케일-투-핏 기준 길이(mm)
  removeFloor?: boolean; // GLB 내장 바닥/배경 평면 제거
  points: CalibPoint[];
}

export const CALIB_TARGETS: CalibTarget[] = [
  {
    key: "arduino-uno",
    label: "아두이노 UNO",
    glbUrl: "/assets/arduino/arduino_uno_board.opt.glb",
    scaleLen: 68.6,
    removeFloor: true,
    points: ARDUINO_PIN_DEFS.map((d) => ({ id: d.id, label: d.label })),
  },
  {
    // free 부품(서보) 3선 리드 시작점 보정 — key=GLB assetId, point id=pin{인덱스}.
    // freeLeadPins(picking.ts)가 이 보정좌표를 리드 마커·배선 시작점에 사용(미보정=합성 폴백).
    key: "servo-mg923b",
    label: "서보 모터 (MG923b)",
    glbUrl: "/assets/components/adafruit_mg923b.glb",
    scaleLen: 37,
    removeFloor: true,
    points: [
      { id: "pin0", label: "신호 (PWM)" },
      { id: "pin1", label: "VCC" },
      { id: "pin2", label: "GND" },
    ],
  },
  // 새 모델 추가 예:
  // { key: "hc-sr04", label: "초음파 HC-SR04", glbUrl: "/assets/.../hcsr04.opt.glb",
  //   scaleLen: 45, points: [{id:"S_VCC",label:"VCC"},{id:"S_TRIG",label:"TRIG"}, ...] },
];

export function getCalibTarget(key: string): CalibTarget | undefined {
  return CALIB_TARGETS.find((t) => t.key === key);
}
