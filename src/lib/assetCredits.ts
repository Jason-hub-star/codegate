/**
 * 3D 에셋 크레딧 레지스트리 — 단일 출처 (SSOT).
 * 라이선스 의무(CC-BY/CC-BY-SA/MIT = 저작자표기)를 한 곳에서 관리.
 * THREE 비의존 순수 데이터 → 랜딩 크레딧 UI·씬 로더·CREDITS.md 가 공유.
 * 무라이선스 에셋은 절대 등재 금지(assets/3d/_harvest/_QUARANTINE-no-license).
 */

export type AssetLicense = "CC-BY-4.0" | "CC-BY-SA-4.0" | "MIT";

export interface AssetCredit {
  id: string;
  /** 한국어 부품명 */
  label: string;
  /** public 경로 (배포·Fetch 가능) */
  glb: string;
  source: string;
  author: string;
  license: AssetLicense;
  sourceUrl: string;
  /** 현재 3D 씬에서 실제 렌더되는지 (false=레지스트리 등재·렌더 대기) */
  rendered: boolean;
}

export const LICENSE_URL: Record<AssetLicense, string> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  MIT: "https://opensource.org/license/mit",
};

/** 채택·배포 중인 라이선스 명시 에셋 전부. */
export const ASSET_CREDITS: AssetCredit[] = [
  {
    id: "arduino-uno",
    label: "아두이노 UNO 보드",
    glb: "/assets/arduino/arduino_uno_board.opt.glb",
    source: "Sketchfab",
    author: "crimsonfalcon",
    license: "CC-BY-4.0",
    sourceUrl:
      "https://sketchfab.com/3d-models/arduino-uno-board-f31feafc5e9743abbdf33c54f9d92669",
    rendered: true,
  },
  {
    id: "dht11",
    label: "DHT11 온습도 센서",
    glb: "/assets/components/DHT11.glb",
    source: "KiCad packages3D",
    author: "KiCad Libraries",
    license: "CC-BY-SA-4.0",
    sourceUrl: "https://gitlab.com/kicad/libraries/kicad-packages3D",
    rendered: true,
  },
  {
    id: "ldr",
    label: "광센서(LDR)",
    glb: "/assets/components/R_LDR_D13.8mm_Vertical.glb",
    source: "KiCad packages3D",
    author: "KiCad Libraries",
    license: "CC-BY-SA-4.0",
    sourceUrl: "https://gitlab.com/kicad/libraries/kicad-packages3D",
    rendered: true,
  },
  {
    id: "oled-ssd1306",
    label: "OLED 디스플레이(SSD1306)",
    glb: "/assets/components/SSD1306_OLED.glb",
    source: "KiCad packages3D",
    author: "KiCad Libraries",
    license: "CC-BY-SA-4.0",
    sourceUrl: "https://gitlab.com/kicad/libraries/kicad-packages3D",
    rendered: true,
  },
  {
    id: "buzzer-piezo",
    label: "피에조 부저",
    glb: "/assets/components/Buzzer_12x9.5_piezo.glb",
    source: "KiCad packages3D",
    author: "KiCad Libraries",
    license: "CC-BY-SA-4.0",
    sourceUrl: "https://gitlab.com/kicad/libraries/kicad-packages3D",
    rendered: true,
  },
  {
    id: "pot-bourns",
    label: "가변저항(Bourns 3006P)",
    glb: "/assets/components/Potentiometer_Bourns_3006P.glb",
    source: "KiCad packages3D",
    author: "KiCad Libraries",
    license: "CC-BY-SA-4.0",
    sourceUrl: "https://gitlab.com/kicad/libraries/kicad-packages3D",
    rendered: true,
  },
  {
    id: "pir-presence",
    label: "PIR 모션 센서",
    glb: "/assets/components/adafruit_presence_sensor.glb",
    source: "Adafruit CAD Parts",
    author: "Adafruit Industries",
    license: "MIT",
    sourceUrl: "https://github.com/adafruit/Adafruit_CAD_Parts",
    rendered: true,
  },
  {
    id: "servo-mg923b",
    label: "서보 모터(MG923B)",
    glb: "/assets/components/adafruit_mg923b.glb",
    source: "Adafruit CAD Parts",
    author: "Adafruit Industries",
    license: "MIT",
    sourceUrl: "https://github.com/adafruit/Adafruit_CAD_Parts",
    rendered: true,
  },
  {
    id: "servo-sg51r",
    label: "서보 모터(SG51R 소형)",
    glb: "/assets/components/adafruit_sg51r.glb",
    source: "Adafruit CAD Parts",
    author: "Adafruit Industries",
    license: "MIT",
    sourceUrl: "https://github.com/adafruit/Adafruit_CAD_Parts",
    rendered: false,
  },
];

/** 출처별 그룹 (앱 크레딧 면·CREDITS.md 공용) */
export function creditsBySource(): { source: string; license: AssetLicense; items: AssetCredit[] }[] {
  const map = new Map<string, AssetCredit[]>();
  for (const a of ASSET_CREDITS) {
    const arr = map.get(a.source) ?? [];
    arr.push(a);
    map.set(a.source, arr);
  }
  return [...map.entries()].map(([source, items]) => ({
    source,
    license: items[0].license,
    items,
  }));
}
