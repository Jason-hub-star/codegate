---
name: pinmate-upload
description: >-
  핀메이트(PinMate) 추천 스케치(.ino)를 개발 단계에서 실물 아두이노 보드에
  arduino-cli 로 컴파일→업로드→검증한다. 보드 자동 감지(FQBN·포트)·스케치 폴더
  규칙·avrdude 성공 판정까지 한 호흡. 트리거 — "보드에 올려줘", "아두이노 업로드",
  "이 코드 올려줘", "flash 해줘", "스케치 업로드", 추천 코드를 실물에서 돌려볼 때.
  ★ 이건 개발용 CLI 업로드(arduino-cli)지, 앱 내 WebSerial 펌웨어 브리지(DEC-045)가 아니다.
---

# pinmate-upload — 추천 스케치 실물 업로드(개발용)

## 언제
codegen(`buildSketch`)이 뽑은 `.ino`나 손수정본을 **실물 보드에서 돌려볼 때**.
앱 사용자용 인-앱 업로드(브라우저)는 **범위 밖** → 그건 DEC-045 펌웨어 브리지(Phase B).

## 전제 (한 번만 점검)
- `arduino-cli` 설치 + 보드 코어 설치 여부:
  ```bash
  arduino-cli version
  arduino-cli core list          # UNO=arduino:avr 있어야 함. 없으면 core install arduino:avr
  ```
- 보드가 USB로 연결돼 있을 것. 클론보드(CH340)는 macOS 드라이버 선설치 필요.

## 절차
1. **보드 감지 + 정체 확인** — FQBN·포트를 사람이 추측하지 말고 CLI로 확정:
   ```bash
   arduino-cli board list
   ```
   USB 행에서 `Board Name`·`FQBN`·`포트`를 읽는다(예: Arduino UNO / `arduino:avr:uno` / `/dev/cu.usbmodem1101`).
   - **★ `Board Name`이 `Unknown`이면 무작정 FQBN을 찍지 말고 VID/PID로 정체부터 확인**:
     ```bash
     arduino-cli board list --format json | grep -iE '"vid"|"pid"|"address"'
     ```
     `vid` 가 **`0x2341`(정품 Arduino)·`0x1A86`(CH340 클론)·`0x10C4`/`0x0403`(USB-시리얼)** 면 보드일 가능성.
     **`0x04E8`(삼성)·`0x05AC`(애플) 등은 폰·주변기기 → 절대 업로드 금지**(`usbmodem...` 이름이 보드처럼 보여도 폰일 수 있음 — 실제로 갤럭시를 UNO로 착각해 쏠 뻔한 사례).
   - 여러 `usbmodem*` 포트가 보이면 **VID로 진짜 보드를 골라** 그 포트로만 업로드.
   - USB 포트 자체가 안 보이면 **연결/케이블/드라이버** 문제 → 사용자에게 알리고 중단.
2. **스케치 폴더 규칙** — arduino-cli 는 **폴더명 == .ino 파일명**을 요구. repo 오염 방지로 `/tmp` 에:
   ```bash
   # /tmp/<name>/<name>.ino 형태로 Write
   ```
3. **컴파일** (업로드 전 게이트):
   ```bash
   arduino-cli compile --fqbn <FQBN> /tmp/<name>
   ```
   메모리 사용률(플래시/RAM %)이 100% 미만인지 확인.
4. **업로드**:
   ```bash
   arduino-cli upload -p <PORT> --fqbn <FQBN> /tmp/<name>
   ```
5. **검증** (★ 성역 — 추측 금지). 업로드는 출력이 빈약하니 `-v` 로 재확인:
   ```bash
   arduino-cli upload -p <PORT> --fqbn <FQBN> -v /tmp/<name> 2>&1 \
     | grep -iE "bytes written|Avrdude done|error"; echo "exit=$?"
   ```
   `N bytes of flash written` + `Avrdude done. Thank you.` + `exit=0` 이면 성공.

## 규칙
- 스케치는 `/tmp/<name>/` 에 — repo·src 에 .ino 만들지 않는다(칩 위 C++는 `src/` 금지, firmware 외).
- FQBN·포트는 **`board list` 로 확정**하고 하드코딩하지 않는다(포트 번호·시리얼은 재연결마다 바뀜).
- **`Unknown` 보드엔 VID/PID 확인 전 업로드 금지** — 폰·버즈 같은 비-아두이노 USB 기기에 펌웨어를 쏘면 안 된다(VID `0x2341`/`0x1A86` 등 아두이노 계열만). 동기 실패(`not in sync`)는 대개 "그 포트가 보드가 아님" 신호.
- 업로드는 실물에 쓰는 비가역 작업 → 사용자가 명시 요청했을 때만. 코드 안전성(핀·전류) 먼저 확인.
- `arduino-cli monitor` 는 비대화형 stdin EOF로 즉시 종료됨 → 시리얼 확인은 OS 직접 read
  (`stty -f <port> 9600 raw` 후 디바이스 read) 또는 앱 `/serial-test` WebSerial 로(DEC-037 참고).
- 업로드 후 동작 확인(버튼 누름→서보 등)은 **사람 손이 필요** → 사용자에게 확인 요청.

## 참고
- 코드 출처: `src/features/circuit/codegen.ts` `buildSketch(model)`
- 펌웨어 프로브 예시: `firmware/pinmate-probe/`
- 스모크 선례: DEC-037(정품 UNO `arduino:avr:uno`, avrdude exit 0, OS 레벨 시리얼 수신)
- 인-앱 업로드 방향(별개): DEC-045 PinMate 펌웨어 브리지(WebSerial)
- 변경 후 `/docsync` 로 정본 갱신.
