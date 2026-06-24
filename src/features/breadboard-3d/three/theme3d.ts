/**
 * 3D 색 단일 출처 — Three.js 머티리얼 색을 한곳에서 관리(정본 1곳 원칙).
 *
 * - TOKEN.*   : globals.css `:root` 디자인 토큰과 값을 1:1 일치(드리프트 금지).
 *               토큰을 바꾸면 여기 hex 도 함께 갱신할 것.
 *               (런타임 CSS 변수 동기화는 향후 과제 — 현재는 모듈 평가 시점에 색을 굳힘)
 * - POLARITY.*: 전기 색(+빨강 / −파랑 / 신호 중립). 레일·점퍼·극성 마커 공용.
 * - MAT.*     : UI 토큰에 대응이 없는 3D 전용 머티리얼 팔레트.
 */

/** globals.css 디자인 토큰과 1:1 (값 변경 시 globals.css 와 동기화) */
export const TOKEN = {
  background: 0xfaf9f7, // --background
  foreground: 0x1a1c1b, // --foreground
  muted: 0xf4f3f1, // --muted (빵판 플라스틱)
  ok: 0x2f7d32, // --ok
  amber: 0xb06d00, // --amber
  error: 0xba1a1a, // --error
} as const;

/** 전기 색 — +/live, −/gnd, 신호 중립 */
export const POLARITY = {
  red: 0xc0392b,
  blue: 0x2b5cba,
  neutral: 0x3b3f45,
} as const;

/** 3D 전용 머티리얼 (UI 토큰 없음) */
export const MAT = {
  hole: 0x111317,
  ravine: 0xe7e5e2,
  metalLeg: 0xc4c7cb,
  metalCap: 0x9a9a9a,
  pinGold: 0xc9a227,
  // LED
  ledBase: POLARITY.red,
  ledDome: 0xe74c3c,
  // 저항
  resistorBody: 0xd9c39a,
  resistorBands: [0x8b5a2b, 0x111111, 0x8b1a1a, 0xc9a227] as const,
  // 버튼
  buttonBase: 0x2b2d33,
  buttonCap: 0xd8d6d2,
  // 가변저항
  potBody: 0x2a6cc0,
  potKnob: 0xe8e6e2,
  // 피에조
  piezoDisc: 0x14151a,
  piezoPort: 0x5a5a5a,
  // RGB
  rgbBase: 0xdadada,
  rgbDome: 0xf2f2f2,
  // 조명
  lightWarm: 0xffffff,
  lightCool: 0xcfcdca,
  // 가짜 컨택트 섀도 베이스 (rgb 문자열, canvas gradient 용)
  shadowRgb: "20,22,20",
} as const;
