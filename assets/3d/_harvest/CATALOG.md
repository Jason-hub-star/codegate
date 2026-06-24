# GLB-Native Arduino Electronics Components Catalog

**Harvested**: June 18, 2026
**Source**: MaherLahlouh/3D-Part-Simulator (GitHub)
**License**: Unlicensed (educational use / no explicit CC/MIT stated - verification needed)
**Total Files**: 37 GLB models
**Total Size**: ~35 MB

---

## Core Components (Downloaded)

| Component | File | Size | Status | License | Author | Notes |
|-----------|------|------|--------|---------|--------|-------|
| Arduino UNO | basic_arduino_uno.glb | 213 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Standard blue board, good detail |
| Breadboard | breadboard.glb | 366 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Full-size breadboard, realistic |
| LED | led_light.glb | 200 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Standard 5mm LED with leads |
| Resistor 1K Ohm | 1k_ohm_resistor.glb | 52 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Standard axial resistor |
| Resistor 10K Ohm | 10k_ohm_resistor.glb | 52 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Standard axial resistor |
| Servo Motor | servo.glb | 3.3 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | Full servo model with horn |
| HC-SR04 Sensor | hc_sr04.glb | 1.2 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | Ultrasonic distance sensor |
| PIR Sensor | pir_sensor.glb | 134 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Motion sensor module |
| MQ-2 Gas Sensor | mq2_lpg_co_smoke_gas_sensor.glb | 1.1 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | Smoke/gas detection |
| IR Sensor Module | ir_sensor_module.glb | 2.7 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | Infrared sensor |
| DHT11 Module | modulo_sensor_de_umidade_e_temperatura_dht11.glb | 5.7 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | Temp + humidity sensor |
| RFID RC522 | rfid_readwrite_module_rc522.glb | 1.1 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | RFID reader module |
| Button | part_15.glb | 14 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Small tactile button |
| N20 DC Motor | N20DCMotor.glb | 1.0 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | Micro DC motor |
| Motor Driver (L293D) | L293D.glb | 719 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Dual motor driver IC |
| LCD Display (16x2) | 162__lcd_display.glb | 525 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Character LCD module |
| Buzzer Module | arduino_module_buzzer.glb | 620 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | Piezo buzzer module |
| 9V Battery | battery_9v.glb | 5.2 MB | DOWNLOADED | UNLICENSED | MaherLahlouh | 9V battery model |
| Battery Holder | holding_board__9V.glb | 149 KB | DOWNLOADED | UNLICENSED | MaherLahlouh | 9V battery connector |

---

## Generic Parts (Unidentified - part_*.glb)

| File | Size | Status | Notes |
|------|------|--------|-------|
| part_2.glb | 91 KB | DOWNLOADED | Unknown component |
| part_3.glb | 451 KB | DOWNLOADED | Unknown component |
| part_4.glb | 28 KB | DOWNLOADED | Small unknown part |
| part_5.glb | 243 KB | DOWNLOADED | Unknown component |
| part_6.glb | 197 KB | DOWNLOADED | Unknown component |
| part_7.glb | 191 KB | DOWNLOADED | Unknown component |
| part_8.glb | 451 KB | DOWNLOADED | Unknown component |
| part_9.glb | 691 KB | DOWNLOADED | Unknown component |
| part_10.glb | 489 KB | DOWNLOADED | Unknown component |
| part_11.glb | 482 KB | DOWNLOADED | Unknown component |
| part_12.glb | 243 KB | DOWNLOADED | Unknown component |
| part_13.glb | 191 KB | DOWNLOADED | Unknown component |
| part_14.glb | 168 KB | DOWNLOADED | Unknown component |

---

## Robotics Kit Parts (Robot-specific)

| File | Size | Status | Notes |
|------|------|--------|-------|
| chassis_-SL.glb | 2.8 MB | DOWNLOADED | Robot chassis (left) |
| master_wheel.glb | 3.1 MB | DOWNLOADED | Large robot wheel |
| slave_wheel_SL.glb | 1.8 MB | DOWNLOADED | Robot wheel variant |
| Mechacnical_track_Yellow.glb | 644 KB | DOWNLOADED | Treaded wheel/track |

---

## Quality Assessment

### Poly Count & Tone
- **Arduino UNO**: Medium-poly (realistic), good educational tone
- **Breadboard**: Detailed, realistic texture
- **LED/Resistors**: Low-poly but clear and suitable for three.js
- **Servo/Motors**: High-poly detailed models (~3 MB each) - good for visualization
- **Sensors**: Medium to high-poly, commercially modeled appearance (NOT cheap/AI-slop)

### Suitability for Three.js
- ✅ All files are valid GLB (magic bytes: `676c5446` = "glTF")
- ✅ No STEP/CAD-only files
- ✅ Directly loadable with three.js `GLTFLoader`
- ⚠️ Some large files (5+ MB) - consider optimization for web
- ✅ Good variety of component types

---

## License Status

⚠️ **CRITICAL**: These models come from a GitHub repo with **NO EXPLICIT LICENSE**. 
- Repository owner: **MaherLahlouh**
- Repository created: March 9, 2026
- README states: "This project is provided for educational and development purposes. Refer to the repository license file if available."
- No LICENSE.md, LICENSE.txt, or license field in GitHub API response

**Recommended action**: 
1. Contact author (MaherLahlouh on GitHub) for explicit permission/license clarification
2. Do NOT distribute commercially without permission
3. For CODEGATE 2026 hackathon: use under educational/attribution basis with explicit credit

---

## Additional Sources Investigated (No Native GLBs Found)

| Source | Status | Notes |
|--------|--------|-------|
| Khronos glTF-Sample-Assets | ✓ Verified | No electronics models (furniture, structural only) |
| Wokwi-Elements (wokwi/wokwi-elements) | ✓ Verified | Web component library, not GLB files |
| Poly Haven | ✓ Verified | CC0 but no electronics (general art/furniture) |
| Sketchfab (CC0 + downloadable) | ✓ Verified | Requires manual login; auto-converts to glTF but not native GLB storage |
| Thingiverse | ✓ Verified | Cloudflare-protected; primarily STL, not GLB native |
| GitHub code search (filename:.glb) | ✓ Verified | No Arduino/electronics-specific results |
| CircuitVerse | ✓ Verified | Online simulator but no downloadable 3D assets |
| Hugging Face (3D models) | ✓ Verified | Arduino datasets (code/docs only, no 3D) |
| tscircuit/jscad-electronics | ✓ Verified | Function library for JSCAD, not pre-made models |

---

## Summary

**GLB-native Arduino electronics models are EXTREMELY RARE on the open internet.** This single repository (`MaherLahlouh/3D-Part-Simulator`) appears to be one of the few open-source collections with production-ready GLB electronics components suitable for Three.js.

**Critical Findings**:
1. ✅ 37 valid GLB files downloaded successfully
2. ✅ Covers core Arduino ecosystem (boards, breadboard, basic sensors, motors, drivers)
3. ⚠️ License status undefined - educational use only until clarified
4. ⚠️ Quality varies: some parts are high-poly (5MB+), some very low-poly (14KB) - optimization needed for web
5. ⚠️ 13 generic "part_*.glb" files - identity/purpose unknown

**For CODEGATE 2026 (PinMate)**:
- **Use with attribution** to MaherLahlouh/3D-Part-Simulator
- Optimize large files (servo, motors, battery) for web delivery
- Consider requesting explicit CC-BY or MIT license from author
- Focus on: Arduino UNO, breadboard, LED, resistors, sensors (most essential)

