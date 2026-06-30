/**
 * MCP 도구 코어 — 순수 함수 (HTTP·SDK 의존 0).
 *
 * MCP 배선(server/mcp.ts)과 분리한 이유:
 *  ① 동시성·결정론을 HTTP 없이 단위테스트(server/__tests__/tools.test.ts).
 *  ② 각 도구가 회로 도메인(src/features/circuit)의 순수 함수만 호출 →
 *     setActive* 를 절대 부르지 않고 codec 에서 디코드한 보드/빵판을
 *     CircuitContext 로 **주입**(DEC-036 무상태 근본 리팩터). 동시요청 오염 0.
 *
 * 출력은 전부 입문자용 한국어 텍스트(차별점). 한 줄 결과 = 사람이 보는 것과 동일.
 */
import {
  diagnose,
  serialize,
  recommendNextStep,
  buildBom,
  serializeBom,
  decodeCircuit,
  encodeCircuit,
  SCENARIOS,
  PARTS,
  PART_LIST,
  BREADBOARDS,
  BOARDS,
  type CircuitContext,
  type CircuitModel,
  type BreadboardId,
  type BoardId,
  type Layout,
  type PartDef,
  type PinRole,
  type Protocol,
  type Scenario,
} from "../src/features/circuit/index";

/** 도구 결과 — mcp.ts 가 { content:[{type:text}], isError } 로 감싼다. */
export interface ToolResult {
  text: string;
  isError?: boolean;
}

/** 3D 뷰어 베이스 URL — 배포 시 PINMATE_BASE_URL 로 오버라이드(기본=Vercel 라이브). */
export const BASE_URL =
  process.env.PINMATE_BASE_URL?.replace(/\/$/, "") ??
  "https://codegate-eta.vercel.app";

/** 회로 → 모바일 3D 뷰 딥링크(/view?c=). M2. */
export function viewUrl(
  model: CircuitModel,
  board: BreadboardId = "half",
  devBoard: BoardId = "arduino-uno",
  layout?: Layout,
): { url: string; code: string } {
  const code = encodeCircuit(model, board, layout, devBoard);
  return { url: `${BASE_URL}/view?c=${code}`, code };
}

/** 디코드된 봉투 → CircuitContext (전역 setActive 호출 금지, 인자 주입). */
function ctxFor(board: BreadboardId, devBoard: BoardId): CircuitContext {
  return { breadboard: BREADBOARDS[board], board: BOARDS[devBoard] };
}

/** 시나리오는 전부 아두이노+half 빵판 기준(AD_* 핀). 명시 컨텍스트로 주입. */
const SCENARIO_CTX: CircuitContext = ctxFor("half", "arduino-uno");

// ───────────────────────── generate_circuit (M1.5) ─────────────────────────

/**
 * 자연어 → 시나리오 동의어 보강 매칭표. 키워드가 들어오면 해당 시나리오 id 를 가산.
 * ponytail: 키워드 휴리스틱(천장). 한국어 띄어쓰기·오타에 약함 →
 *   업그레이드 경로 = 임베딩/LLM 매칭. 해커톤 데모엔 결정론·0비용이 더 적합.
 */
const SYNONYMS: ReadonlyArray<readonly [string, string]> = [
  ["저항 없", "ledNoResistor"],
  ["저항없", "ledNoResistor"],
  ["과전류", "ledNoResistor"],
  ["극성", "ledReversed"],
  ["거꾸로", "ledReversed"],
  ["반대로", "ledReversed"],
  ["단락", "shortCircuit"],
  ["쇼트", "shortCircuit"],
  ["열린", "openCircuit"],
  ["오픈", "openCircuit"],
  ["버튼", "buttonCorrect"],
  ["스위치", "buttonCorrect"],
  ["서보", "servoCorrect"],
  ["모터", "servoCorrect"],
  ["자동문", "pirServoDoor"],
  ["노브", "potServoKnob"],
  ["가변저항", "potServoKnob"],
  ["포텐쇼미터", "potServoKnob"],
  ["릴레이", "relayControl"],
  ["펌프", "relayPumpExternal"],
  ["물", "relayPumpExternal"],
  ["급수", "soilPumpAutoWatering"],
  ["화분", "soilPumpAutoWatering"],
  ["토양", "soilPumpAutoWatering"],
  ["수분", "soilPumpAutoWatering"],
  ["초음파", "ultrasonicParkingAlarm"],
  ["거리", "ultrasonicParkingAlarm"],
  ["주차", "ultrasonicParkingAlarm"],
  ["경보기", "pirBuzzerAlarm"],
  ["알람", "pirBuzzerAlarm"],
  ["pir", "pirBuzzerAlarm"],
  ["모션", "pirBuzzerAlarm"],
  ["움직임", "pirBuzzerAlarm"],
  ["온습도", "dht11OledWeather"],
  ["날씨", "dht11OledWeather"],
  ["oled", "dht11OledWeather"],
  ["조도", "ldrAutoLight"],
  ["빛", "ldrAutoLight"],
  ["어두", "ldrAutoLight"],
  ["네오픽셀", "ldrNeopixelNightLight"],
  ["야간등", "ldrNeopixelNightLight"],
  ["레이저", "laserTripwire"],
  ["트립와이어", "laserTripwire"],
  ["led", "ledCorrect"],
  ["엘이디", "ledCorrect"],
];

/** 쿼리에 가장 잘 맞는 시나리오를 고른다. 매칭 0 이면 기본 LED 정상회로. */
export function matchScenario(query: string): { scenario: Scenario; score: number } {
  const q = query.toLowerCase();
  const tokens = q.split(/[\s,./()[\]{}]+/).filter((t) => t.length >= 2);

  let best: Scenario = SCENARIOS.ledCorrect;
  let bestScore = 0;
  for (const s of Object.values(SCENARIOS)) {
    const hay = `${s.id} ${s.label} ${s.description}`.toLowerCase();
    let score = 0;
    for (const tok of tokens) if (hay.includes(tok)) score += 2;
    for (const [syn, id] of SYNONYMS) if (q.includes(syn) && s.id === id) score += 3;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return { scenario: best, score: bestScore };
}

export function runGenerate(query: string): ToolResult {
  if (!query.trim()) {
    return { text: "회로 요청을 한국어로 적어 주세요 (예: \"저항 없이 LED 연결\").", isError: true };
  }
  const { scenario, score } = matchScenario(query);
  const verdict = diagnose(scenario.model, SCENARIO_CTX);
  const body = serialize(scenario.model, verdict, SCENARIO_CTX);
  const { url, code } = viewUrl(scenario.model, "half", "arduino-uno");

  const head =
    score === 0
      ? `「PinMate(핀메이트)」: 딱 맞는 예제를 못 찾아 기본 회로를 보여드려요 — ${scenario.label}`
      : `「PinMate(핀메이트)」 추천 회로 — ${scenario.label}`;

  return {
    text: [
      head,
      scenario.description,
      "",
      body,
      "",
      `📱 3D로 보기: ${url}`,
      `🔑 회로 코드(code, 다른 도구에 전달): ${code}`,
    ].join("\n"),
  };
}

// ───────────────── 공통: code → {model, ctx} 디코드 ─────────────────

function decodeOrNull(
  code: string,
): { model: CircuitModel; ctx: CircuitContext; board: BreadboardId; devBoard: BoardId; layout?: Layout } | null {
  const d = decodeCircuit(code);
  if (!d) return null;
  return {
    model: d.model,
    ctx: ctxFor(d.board, d.devBoard),
    board: d.board,
    devBoard: d.devBoard,
    layout: d.layout,
  };
}

const BAD_CODE =
  "회로 코드(code)를 해석할 수 없어요. generate_circuit 가 준 code 또는 PinMate 빌더의 공유 링크 c= 값을 그대로 넣어 주세요.";

// ───────────────────────── diagnose_circuit ─────────────────────────

export function runDiagnose(code: string): ToolResult {
  const d = decodeOrNull(code);
  if (!d) return { text: BAD_CODE, isError: true };
  const verdict = diagnose(d.model, d.ctx);
  const body = serialize(d.model, verdict, d.ctx);
  const { url } = viewUrl(d.model, d.board, d.devBoard, d.layout);
  const head = verdict.ok ? "✅ 진단: 문제 없음" : `⚠️ 진단: 문제 ${verdict.findings.length}건 발견`;
  return { text: [head, "", body, "", `📱 3D로 보기: ${url}`].join("\n") };
}

// ───────────────────────── suggest_next_step ─────────────────────────

export function runSuggest(code: string): ToolResult {
  const d = decodeOrNull(code);
  if (!d) return { text: BAD_CODE, isError: true };
  const verdict = diagnose(d.model, d.ctx);
  const step = recommendNextStep(d.model, verdict, d.ctx);
  if (!step) {
    return { text: "회로가 완성된 것 같아요. 더 추가할 단계가 없어 보여요. 👍" };
  }
  const tag =
    step.priority === "critical"
      ? "🔴 지금 고칠 것"
      : step.priority === "high"
        ? "🟠 다음 단계"
        : "🟢 다음 단계";
  return { text: `${tag}: ${step.message}` };
}

// ───────────────────────── get_bom ─────────────────────────

export function runBom(code: string): ToolResult {
  const d = decodeOrNull(code);
  if (!d) return { text: BAD_CODE, isError: true };
  const bom = buildBom(d.model);
  return { text: ["[부품 명세 (BOM)]", serializeBom(bom)].join("\n") };
}

// ───────────────────────── explain_component ─────────────────────────

const PIN_ROLE_LABEL: Record<PinRole, string> = {
  power: "전원(VCC)",
  gnd: "그라운드(GND)",
  digital: "디지털",
  analog: "아날로그",
  pwm: "PWM",
  signal: "신호",
  switch: "접점(스위치)",
};

const PROTOCOL_LABEL: Record<Protocol, string> = {
  onoff: "디지털 On/Off",
  analog: "아날로그",
  pwm: "PWM",
  i2c: "I2C",
  "1-wire": "1-Wire",
  addressable: "주소지정 LED",
  pulse: "펄스 거리측정",
};

/** 부품 이름/별칭 → PartDef. id 정확 → 라벨 부분일치 → 한국어 동의어 순. */
export function findPart(name: string): PartDef | null {
  const q = name.trim().toLowerCase();
  if (!q) return null;
  if (PARTS[q]) return PARTS[q];
  const byLabel = PART_LIST.find(
    (p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
  );
  if (byLabel) return byLabel;
  const ALIASES: Record<string, string> = {
    엘이디: "led",
    저항: "resistor",
    버튼: "button",
    스위치: "button",
    가변저항: "pot",
    포텐쇼미터: "pot",
    부저: "piezo",
    서보: "servo",
    릴레이: "relay",
    펌프: "pump",
    모터: "servo",
    네오픽셀: "neopixel",
    초음파: "ultrasonicHcsr04",
    거리센서: "ultrasonicHcsr04",
    토양수분: "soilMoisture",
    수분센서: "soilMoisture",
  };
  for (const [alias, id] of Object.entries(ALIASES)) {
    if (q.includes(alias) && PARTS[id]) return PARTS[id];
  }
  return null;
}

function serializePart(def: PartDef): string {
  const lines: string[] = [];
  lines.push(`[부품] ${def.label} (${def.category})`);
  if (def.operatingV) lines.push(`- 동작 전압: ${def.operatingV}`);
  if (def.protocol) lines.push(`- 신호 방식: ${PROTOCOL_LABEL[def.protocol]}`);
  lines.push(
    `- 핀(${def.pins.length}): ` +
      def.pins.map((p) => `${p.label}[${PIN_ROLE_LABEL[p.role]}]`).join(", "),
  );
  if (def.polarity) lines.push("- 극성: 있음 (연결 방향 중요)");
  if (def.needsResistor) lines.push("- 직렬 저항 필요 (예: 220Ω)");
  if (def.needsPullup) lines.push("- 풀업 저항(또는 INPUT_PULLUP) 권장");
  if (def.relay) lines.push("- 부하측 접점: COM/NO/NC (코일이 단속)");
  if (def.description) lines.push(`- 설명: ${def.description}`);
  return lines.join("\n");
}

export function runExplain(component: string): ToolResult {
  const def = findPart(component);
  if (!def) {
    const names = PART_LIST.map((p) => p.label).join(", ");
    return {
      text: `"${component}" 부품을 찾지 못했어요. 지원 부품: ${names}`,
      isError: true,
    };
  }
  return { text: `「PinMate(핀메이트)」 부품 설명\n${serializePart(def)}` };
}
