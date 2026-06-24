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
1. **보드 감지** — FQBN·포트를 사람이 추측하지 말고 CLI로 확정:
   ```bash
   arduino-cli board list
   ```
   USB 행에서 `Board Name`·`FQBN`·`포트`를 읽는다(예: Arduino UNO / `arduino:avr:uno` / `/dev/cu.usbmodem1101`).
   보드가 안 보이면(USB 포트만 `Unknown`) **연결/케이블/드라이버** 문제 → 사용자에게 알리고 중단.
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
- FQBN·포트는 **`board list` 로 확정**하고 하드코딩하지 않는다(포트 번호는 재연결마다 바뀜).
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
