# pinmate-probe — WebSerial 스모크 펌웨어

PinMate가 실물 아두이노와 통신(DEC-037)하는 첫 단계를 검증하는 최소 펌웨어.
빌드 밖(`firmware/`)에 둔다 — 아두이노 칩 위에서 도는 C++라 Next.js `pnpm build`와 무관.

## 출력 계약 (웹 파서와의 약속)
- 한 줄 = `D<pin>=<0|1>` + 개행(`\n`)
- baud rate = **9600**
- 예: `D13=1` / `D13=0` (1초 주기 토글)

웹 스모크 라우트(`src/app/serial-test/`)는 이 raw 텍스트를 그대로 화면에 출력해
"포트를 잡고 한 줄이라도 읽는가"만 검증한다. 파싱·3D 점등은 이후 단계(`src/features/serial/`).

## 업로드 (arduino-cli)
환경에 `arduino-cli` + `arduino:avr` 코어가 이미 설치돼 있다(2026-06-22 확인).

```bash
# 1) 보드 연결 후 포트 확인
arduino-cli board list
#   정품 UNO  → /dev/cu.usbmodemXXXX (드라이버 불필요, 내장 AppleUSBSerial)
#   클론(CH340) → 포트가 안 뜨면 macOS CH340 드라이버 선설치 필요

# 2) 컴파일
arduino-cli compile --fqbn arduino:avr:uno firmware/pinmate-probe

# 3) 업로드 (<PORT>를 1)에서 본 값으로)
arduino-cli upload -p <PORT> --fqbn arduino:avr:uno firmware/pinmate-probe
```

업로드 후 보드의 온보드 LED(D13)가 1초 주기로 깜빡이면 정상.

## 스모크 검증
1. 위로 업로드 → 보드 LED 깜빡임 확인
2. `pnpm dev` → Chrome에서 `localhost:3000/serial-test`
3. **[연결]** → 포트 선택 → raw 로그에 `D13=1`/`D13=0`가 1초 주기로 찍히면 통과
