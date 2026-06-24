/*
 * PinMate Probe — WebSerial 스모크 테스트용 최소 펌웨어
 *
 * 목적: 핀 상태를 시리얼로 내보내 브라우저(WebSerial)가 읽을 수 있는지 검증.
 * 출력 계약(웹 파서와의 약속): 한 줄 = "D<pin>=<0|1>\n", baud 9600.
 *
 * D13(온보드 LED)을 1초 주기로 토글하며 그 상태를 출력한다.
 * → 실물 보드의 LED 깜빡임과 웹 raw 로그가 동기화되는 걸로 연결을 눈으로 확인.
 *
 * 업로드: firmware/pinmate-probe/README.md 참고.
 */

const int PROBE_PIN = 13;  // 온보드 LED 핀
int state = 0;

void setup() {
  Serial.begin(9600);
  pinMode(PROBE_PIN, OUTPUT);
}

void loop() {
  state = !state;
  digitalWrite(PROBE_PIN, state ? HIGH : LOW);

  // 출력 계약: "D<pin>=<0|1>" 한 줄. 추후 외부 핀 추가 시 같은 포맷으로 라인 추가.
  Serial.print("D");
  Serial.print(PROBE_PIN);
  Serial.print("=");
  Serial.println(state);

  delay(1000);
}
