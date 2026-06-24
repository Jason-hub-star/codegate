# _converted — STEP→GLB 일괄 변환본 (2026-06-18)

> `scripts/step2glb.py`(cascadio, tol_linear=0.1)로 `_harvest`의 합법 STEP 23개를 GLB 변환. 합계 2.1MB. 재질/파츠색 보존. 라이선스는 출처 상속.

## 라이선스 (크레딧 의무 — 앱 푸터/about)
- **KiCad packages3D = CC-BY-SA 4.0** / **Adafruit CAD Parts = MIT** (gh API 확인)

| GLB | tris | KB | 출처 | 라이선스 | 채택 권고 |
|---|---|---|---|---|---|
| adafruit_huzzah32 (ESP32) | 30,621 | 914 | Adafruit | MIT | ✅ 복잡부품 — 경량화 후 |
| adafruit_presence_sensor (PIR) | 7,068 | 234 | Adafruit | MIT | ✅ |
| adafruit_mg923b (서보) | 1,280 | 47 | Adafruit | MIT | ✅ SG90 대용 |
| adafruit_sg51r (서보 소형) | 1,566 | 55 | Adafruit | MIT | ✅ |
| SSD1306_OLED (디스플레이) | 3,664 | 106 | KiCad | CC-BY-SA | ✅ LCD 대용 |
| DHT11 (온습도) | 1,264 | 52 | KiCad | CC-BY-SA | ✅ |
| R_LDR (광센서) | 1,230 | 38 | KiCad | CC-BY-SA | ✅ |
| Potentiometer_Bourns | 1,090 | 32 | KiCad | CC-BY-SA | ✅ |
| Buzzer_12x9.5_piezo | 1,868 | 43 | KiCad | CC-BY-SA | ◯ 절차도 가능 |
| Button_6mm_tactile(_H5) | 1,648 | 51 | KiCad | CC-BY-SA | ◯ 절차 권장(DEC-024) |
| R_Axial_DIN0207 (저항) | 2,072 | 49 | KiCad | CC-BY-SA | ◯ 절차 권장 |
| LED_5mm_clear (tall/mid/short) | 467 | 15 | KiCad | CC-BY-SA | ◯ 절차 권장 |
| LED_RGB_4pin/5050 | 632/1,156 | 23/40 | KiCad | CC-BY-SA | ◯ |
| WS2812B_SMD / SK6812MINI | 870/470 | 31/19 | KiCad | CC-BY-SA | ◯ |
| 1376 NeoPixel Strip | 3,852 | 122 | Adafruit | MIT | ◯ |
| 1463/2643 NeoPixel Ring | 540/6,264 | 22/148 | Adafruit | MIT | ◯ |
| **adafruit_halfsize (빵판)** | **60** | **4** | Adafruit | MIT | ❌ 슬랩뿐(구멍X) → **절차 생성**(DEC-013) |

## 채택 가이드 (DEC-024 품질바)
- ✅ **복잡 부품**(ESP32·서보·PIR·OLED·DHT11·LDR·pot) → 이 GLB 채택, Three.js에서 에디토리얼 재질 재도색. ESP32만 meshopt 경량화.
- ◯ **단순 부품**(LED·저항·버튼) → 절차 생성이 더 깔끔·가벼움. 이 GLB는 형태 레퍼런스로만.
- ❌ **빵판** → STEP이 슬랩이라 무용. 절차 생성 확정.
- ⛔ `../_QUARANTINE-no-license/` 37개 = 무라이선스, 사용 금지.

## 재변환 (정밀도 조절)
`/tmp/step2glb/bin/python scripts/step2glb.py <input.step> [out.glb] [--dense]`
