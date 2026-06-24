# 3D Assets Manifest — PinMate

> 마지막 업데이트: 2026-06-18 | 검증: 직접 테스트 또는 URL 확인

## 요약

| 자산 | 상태 | 포맷 | 라이선스 | 비고 |
|------|------|------|---------|------|
| Arduino UNO | ✅ **받음** `arduino_uno_board.glb` | GLB(9.4MB) | **CC-BY-4.0** (crimsonfalcon) — 출처표기 의무 | Y-up·평면·중앙. 경량화 권장. LICENSE.txt |
| Breadboard | 📝 절차적 생성 | Three.js | MIT | 에디토리얼 톤 |
| LED (5mm) | 📝 **절차 생성**(DEC-014) | Three.js | MIT | 실린더+돔+다리2(2.54mm·극성). MVP 필수 |
| Resistor (axial) | 📝 **절차 생성**(DEC-014) | Three.js | MIT | 실린더+**색띠**(값 읽기 교육). MVP 필수 |
| Jump Wire | 📝 절차적 생성 | Three.js | MIT | CatmullRom Tube |
| 부품 아이콘 5종 | ❌ 필요(DEC-015) | SVG | MIT | 커스텀 모노크롬 라인 |
| Button·Sensor | ⏳ Later | Three.js | MIT | 절차, MVP 제외 |

---

## 개별 자산 상세

### 1. Arduino UNO (MCU 보드)

**✅ 받음 (2026-06-18, 주인님 제공)**
- 파일: `assets/3d/arduino/arduino_uno_board.glb` (9.4MB)
- 또: `assets/3d/arduino/Arduino-Uno.dwg` (AutoCAD 2004~2006 2D 도면, 723KB — 웹 비사용, 치수 레퍼런스만. 파싱엔 ODA/AutoCAD 필요)
- 출처: **Sketchfab** (generator 메타: Sketchfab-12.67). 26메시·8머티리얼·9텍스처(PBR).
- 방향: **Y-up ✓**, XZ 평면에 평평, 원점 중앙(min[-4.7,-0.673,-4.7]~max[4.7,0.488,4.7]). Three.js GLTFLoader 바로 적합.
- 단위: 임의(bbox 9.4유닛). → 런타임 bbox 측정 후 **scale-to-fit**(목표 ~68.6mm). 코드: 로드 후 `Box3().setFromObject` → 스케일 정규화.
- ⚠️ **bbox 9.4×9.4 정사각**(실물 68.6×53.4 직사각) → 로드 후 형태 육안 확인. 왜곡/불필요 지오메트리면 다른 모델 검토.
- ✅ **라이선스 확정: CC-BY-4.0** (저작자 crimsonfalcon, Sketchfab). 전문·attribution 문구 = `arduino/LICENSE.txt`. **출처표기 의무** → 앱 /about 또는 푸터 "오픈소스 에셋"에 크레딧 표기 필수.
- ⚠️ **9.4MB 무거움**: M1에서 `gltf-transform`/meshopt로 경량화(텍스처 리사이즈·draco/meshopt) 권장.

**(이하: 대체·추가 소스 — 위 모델 문제 시)**

**직접 다운로드 가능한 소스**:
- ❌ **Meshy (meshy.ai)** — CC0 Arduino GLB 있음 → **로그인 필요** (수동 다운로드)
  - URL: https://www.meshy.ai/tags/arduino
  - 라이선스: CC0
  - 포맷: GLB (web 최적화)
  
- ❌ **Sketchfab** — 저폴리 Arduino 저장소
  - URL 예: https://sketchfab.com/3d-models/arduino-breadboard-low-poly-497ee275a25e4166b98c7be3105b4ad9 (research/08에서 언급)
  - 다운로드: 페이지 우측 "Download" 클릭 필요 (수동)
  - 라이선스: CC-BY 또는 CC0 (모델별 상이)
  - 추천: 저폴리(300~1000 폴리곤) 모델 선택

- ❌ **GrabCAD** — 커뮤니티 엔지니어링 모델
  - URL: https://grabcad.com/search/arduino+uno
  - 다운로드: 회원 가입 후 클릭 필요 (수동)
  - 라이선스: 모델별 상이 (CC-BY, CC0)

- ❌ **KiCad packages3D** (STEP 형식)
  - URL: https://gitlab.com/kicad/libraries/kicad-packages3D 
  - 경로: `/Connector_PinHeader/PinHeader_1x40_P2.54mm/`
  - 포맷: WRL / STEP (GLB 아님 → `step-to-glb` 스킬로 변환 필요)
  - 라이선스: CC-BY-SA
  - 상태: **아직 직접 받지 못함** (GitLab API 요청 실패)

**권장사항**:
1. **즉시**: Sketchfab에서 저폴리(300~1000폴리곤) Arduino 모델 1~2개 다운로드
2. **대체**: Meshy CC0 모델 (라이선스 가장 깨끗함)
3. **Y축 확인**: 다운로드 후 Y축 방향 확인 (Three.js는 Y-up)
4. **스케일**: 실측 확인 필요 (보통 1 unit = 1mm 가정하되, 모델별 상이)

---

### 2. Breadboard (빵판)

**필요성**: 핵심 상호작용 대상. 너비 ~63.5mm, 깊이 ~80mm, 높이 ~9mm

**방식**: **절차적 Three.js 생성** (이미 ARCHITECTURE.md §C에서 권장)
- 파일: `src/features/breadboard-3d/three/breadboard.ts`
- 2.54mm 정밀 그리드 (정규 빵판 표준)
- 에디토리얼 톤: 흑/회색, 금색 핀
- 라이선스: MIT (우리 저작)
- 폴리곤: 최소한 (~1000)

**참고**:
- 3D 모델 vs 절차적 생성: 모델은 정확하지만 UI·인터랙션 경계 모호. 절차적은 핀 위치·노드 경계를 코드로 제어 가능.
- wokwi-elements의 빵판 2D SVG는 스타일 레퍼런스용.

---

### 3. LED (5mm, 표준 발광다이오드)

**필요성**: 회로 피드백. 높이 ~5mm, 렌즈 직경 ~5mm

**후보**:
- ❌ **Thingiverse** — 3D 프린팅 모델 (STL 형식)
  - URL: https://www.thingiverse.com/search?q=led+5mm&type=things
  - 포맷: STL → GLB 변환 필요
  - 라이선스: 모델별 상이 (CC0, CC-BY 다수)
  - 상태: 로그인 없이 다운로드 가능하나, STL이라 변환 수작업 필요

- ❌ **KiCad packages3D** (LED Diode)
  - URL: https://gitlab.com/kicad/libraries/kicad-packages3D / `Diode_THD/`
  - 포맷: WRL / STEP → GLB 변환 필요
  - 라이선스: CC-BY-SA
  - 상태: **직접 받지 못함**

- ❌ **wokwi-elements** — 2D SVG (3D 아님)
  - 스타일 레퍼런스로만 사용 가능

**권장**:
- 단기: Thingiverse에서 CC0/CC-BY LED STL 1~2개 다운 → `step-to-glb` 또는 Blender로 변환
- 장기: 절차적 생성 (실린더 + 반구, 에디토리얼 톤)

---

### 4. Resistor (축형 저항, axial 형식)

**필요성**: 회로 완성도. 길이 ~8mm, 직경 ~2.5mm

**후보**:
- ❌ **KiCad packages3D**
  - URL: https://gitlab.com/kicad/libraries/kicad-packages3D / `Resistor_THD/Resistor_Axial_DIN0204_L3.6mm_D1.6mm_P7.62mm_Horizontal/`
  - 포맷: WRL / STEP → GLB 변환 필요
  - 라이선스: CC-BY-SA
  - 상태: **직접 받지 못함**

- ❌ **Thingiverse** — 마찬가지로 STL
  - URL: https://www.thingiverse.com/search?q=resistor+axial&type=things
  - 변환 필요

**권장**:
- KiCad STEP → `step-to-glb` 변환 (공식 정확도)
- 또는 절차적 생성 (원통+텍스처)

---

### 5. Jump Wire (점퍼선)

**필요성**: 배선 시각화. 끝 커넥터 포함

**방식**: **절차적 Three.js 생성** (이미 ARCHITECTURE.md에서 권장)
- 파일: `src/features/breadboard-3d/three/wire.ts`
- CatmullRomCurve3 + TubeGeometry
- 색: 빨강(+), 파랑(−), 검정(신호), 기타 (Fritzing 색상 체계 참조)
- 라이선스: MIT (우리 저작)

---

## 다운로드 절차

### 자동 다운로드 가능 (현재 미실행)
- 없음 (모든 공식 자산이 로그인/클릭 필요)

### 수동 다운로드 필요

#### 1단계: Sketchfab에서 Arduino UNO GLB 1~2개 받기
```
1. https://sketchfab.com/ 접속
2. "arduino uno" + filter: Free + Low Poly 검색
3. 모델 클릭 → 우측 "Download" → "Download Model" (ZIP)
4. ZIP 풀기 → `scene.glb` 또는 `model.glb` 추출
5. 이름: arduino-uno-sketchfab-v1.glb 등
6. 라이선스 확인: 페이지 하단 "License" (CC-BY/CC0)
```

#### 2단계: Meshy에서 Arduino CC0 GLB 받기 (선택)
```
1. https://www.meshy.ai/tags/arduino 접속 (로그인 필요)
2. CC0로 필터 (가능하면)
3. GLB 다운로드
4. 이름: arduino-uno-meshy-cc0.glb
```

#### 3단계: Thingiverse에서 LED STL 받기 (선택)
```
1. https://www.thingiverse.com/search?q=led+5mm 접속
2. CC0/CC-BY 모델 선택
3. "Download" 클릭 → STL
4. 이름: led-5mm-thingiverse-v1.stl
5. Blender 또는 FreeCAD로 GLB 변환
```

---

## 라이선스 정책

✅ **허용**:
- CC0 (퍼블릭 도메인)
- CC-BY (출처 표기)
- CC-BY-SA (출처 표기 + 동일 라이선스 상속)
- MIT / Apache 2.0
- 퍼블릭 도메인

❌ **금지**:
- CC-NC (non-commercial) — 핸드메이드 교육용이라도 상업적 변형·전시 가능성 제외 안 됨
- CC-ND (no derivatives) — 수정 불가
- 저작권 미표시

**우리 작업물 라이선스**: 
- 절차적 생성물(빵판, 점퍼선): MIT
- 조합(최종 씬): 포함된 자산 라이선스의 최대공약수 (가장 restrictive)

---

## 폴더 구조 (최종)

```
assets/3d/
├── ASSETS.md                      (이 파일)
├── arduino/
│   ├── arduino-uno-sketchfab-v1.glb   (수동 다운로드)
│   └── LICENSE-sketchfab-v1.txt       (라이선스 복사)
├── breadboard/
│   ├── breadboard-auto-gen.ts         (절차적 생성 코드)
│   └── notes.txt
├── led/
│   ├── led-5mm-thingiverse-v1.stl     (수동 다운로드, STL)
│   └── led-5mm-thingiverse-v1.glb     (변환 후)
├── resistor/
│   └── notes.txt
└── jump-wire/
    └── wire-auto-gen.ts               (절차적 생성 코드)
```

---

## 상태 요약 (2026-06-18)

| 자산 | 상태 | 액션 |
|------|------|------|
| Arduino | ✅ 받음 (arduino_uno_board.glb) | ① 라이선스/URL 기록 ② 9.4MB 경량화 ③ 로드 후 형태 확인 |
| Breadboard | 📝 설계 완료 | Three.js 절차적 생성 (MVP) |
| LED | ⏳ 수동 대기 | Thingiverse STL → GLB 변환 |
| Resistor | ⏳ 수동 대기 | KiCad STEP → GLB 변환 |
| Jump Wire | 📝 설계 완료 | Three.js CatmullRom Tube (MVP) |

---

## 참고 자료

- **ARCHITECTURE.md** §C: 원본 요구사항
- **research/08-visualization-assets-verified.md**: 라이선스·출처 검증
- **three.js GLTFLoader**: https://threejs.org/docs/#examples/en/loaders/GLTFLoader
- **step-to-glb 스킬**: Claude Code 내장 변환 도구

