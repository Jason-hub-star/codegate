# 3D 모델 하베스트 — 검증 결과 (Opus 검수, 2026-06-18)

> 하이쿠 4에이전트 병렬 수확 → Opus 라이선스/디스크 검증. 에이전트 라이선스 주장은 일부 틀려서 **gh API로 재확인**함.

## ✅ 사용 가능 (라이선스 검증 완료) — 전부 STEP (→ GLB 변환 필요)
KiCad packages3D = **CC-BY-SA 4.0**(라이브러리 예외로 작품에 카피레프트 강제 없음, 출처표기 의무). Adafruit_CAD_Parts = **MIT**(gh API 확인).

| 부품 | 파일 | 출처 | 라이선스 |
|---|---|---|---|
| LED 5mm ×3(tall/mid/short) | `passives/led/LED_5mm_clear_*.step` | KiCad | CC-BY-SA 4.0 |
| 저항 axial | `passives/resistor/R_Axial_DIN0207_horizontal.step` | KiCad | CC-BY-SA 4.0 |
| 택트 버튼 ×2 | `passives/button/Button_6mm_tactile*.step` | KiCad | CC-BY-SA 4.0 |
| 가변저항(Bourns) | `passives/potentiometer/Potentiometer_Bourns_3006P.step` | KiCad | CC-BY-SA 4.0 |
| RGB LED ×2 | `passives/rgb-led/LED_RGB_*.step` | KiCad | CC-BY-SA 4.0 |
| 피에조 부저 | `passives/buzzer/Buzzer_12x9.5_piezo.step` | KiCad | CC-BY-SA 4.0 |
| 광센서 LDR | `sensors/photoresistor-ldr/R_LDR_*.step` | KiCad | CC-BY-SA 4.0 |
| DHT11 | `sensors/dht11-dht22/DHT11.step` | KiCad | CC-BY-SA 4.0 |
| OLED(SSD1306, LCD 대용) | `sensors/lcd1602/SSD1306_OLED.step` | KiCad | CC-BY-SA 4.0 |
| WS2812/SK6812 | `sensors/neopixel-ws2812/*.step` | KiCad | CC-BY-SA 4.0 |
| NeoPixel strip/ring×2 | `sensors/neopixel-ws2812/{1376,1463,2643}_*.step` | Adafruit | MIT |
| 빵판(하프) | `boards/breadboard/adafruit_halfsize.step` | Adafruit | MIT |
| ESP32 huzzah | `boards/esp32/adafruit_huzzah32.step` | Adafruit | MIT |
| 서보 ×2(MG923B/SG51R) | `boards/servo/adafruit_*.step` | Adafruit | MIT |
| PIR presence | `boards/pir/adafruit_presence_sensor.step` | Adafruit | MIT |

- ⚠️ **전부 STEP(CAD NURBS)** → Three.js용 **GLB 변환 + 디시메이션** 필요(`step-to-glb`/FreeCAD/Blender). 변환 후 폴리 과다 → 경량화(gltf-transform/meshopt). 
- ⚠️ 이건 **PCB footprint 모델**이라 핀이 SMD/실측 위주 — 입문 시각화엔 **복잡 부품(ESP32·서보·센서·빵판)에 유용**, LED·저항·버튼 같은 단순부품은 **절차 생성이 더 깔끔·가벼움**(DEC-024).

## ⛔ 격리 (사용 금지)
`_QUARANTINE-no-license/` — MaherLahlouh GLB 37개. **라이선스 없음(All Rights Reserved)**. 형태 참고용만, 코드 포함 금지. 상세 = 해당 폴더 README.

## ❌ 못 구함 (오픈 CAD 부재 → 수동 or 절차/대체)
- **Arduino UNO**: 우리 보유분(`assets/3d/arduino/arduino_uno_board.glb`, CC-BY) 사용. Nano/Mega = 오픈 CAD 없음.
- **HC-SR04, HC-SR501(정확모델), SG90(정확모델), micro:bit, 풀 빵판**: 제조사 CAD 미공개/로그인 벽(Sketchfab·Thingiverse). 대체: Adafruit 유사품(서보 MG923B·PIR presence) 또는 절차 생성. 필요 시 수동 다운로드.

## 결론 / 다음
1. **단순부품(LED·저항·버튼·pot·부저)** = 절차 생성(DEC-024 품질바). STEP은 형태 레퍼런스로만.
2. **복잡부품(ESP32·서보·센서·빵판)** = STEP→GLB 변환 후 경량화, DEC-024 톤 확인.
3. 격리 GLB는 형태 참고 후 삭제.
4. 크레딧 의무: KiCad(CC-BY-SA)·Adafruit(MIT)·Arduino UNO(crimsonfalcon CC-BY) → 앱 푸터/about.
