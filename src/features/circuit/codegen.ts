/**
 * 결정론 코드 추천 — 회로 → 아두이노 스케치(.ino) (Phase A, 키 0원).
 * netlist 의 "보드 제어핀 ↔ 부품" 바인딩에서 스케치를 조립한다. LLM 의존 0.
 * ★ 정오 판정은 diagnose, 다음-단계는 recommendation, "어떤 코드를 올리나"는 여기.
 *
 * ponytail: v1 은 핀↔부품 직결(+수동소자 1홉 추적)만 다룬다.
 *   ceiling — I2C/1-Wire 라이브러리 본문·저항값 계산·핀당 다중부품은 미생성(notes 로 안내).
 *   upgrade — Phase C 에서 LLM 이 이 스케치에 주석·설명을 덧댄다.
 */
import { buildNetlist, type NetlistEntry } from "./netlist";
import { getBoardPinMap, boardRefLabel, type BoardPinRole } from "./board";
import { PARTS, partEndpoints } from "./parts";
import type { CircuitModel, PartDef } from "./types";

export interface SketchResult {
  /** 완성된 아두이노 스케치(.ino) 텍스트 */
  code: string;
  /** 자동 생성이 닿지 못한 부분(미연결 부품·I2C 등) 한국어 안내 */
  notes: string[];
}

// 보드 제어핀(MCU 입출력)인 역할만. 전원/접지/기타는 코드 제어 대상이 아니다.
const CONTROL_ROLES: ReadonlySet<BoardPinRole> = new Set(["digital", "pwm", "analog"]);

// defId → 변수명 어간(ASCII). 한국어 라벨을 코드 식별자로 못 쓰므로 매핑.
const VAR_STEM: Record<string, string> = {
  led: "led",
  button: "button",
  pot: "pot",
  piezo: "buzzer",
  rgb: "rgb",
  dht11: "dht",
  pir: "pir",
  ldr: "ldr",
  oled: "oled",
  servo: "servo",
  neopixel: "pixel",
  relay: "relay",
  pump: "pump",
};
const stemOf = (defId: string): string =>
  VAR_STEM[defId] ?? (defId.replace(/[^a-zA-Z0-9]/g, "") || "part");

/** 부품을 어떤 코드 패턴으로 다룰지 — protocol 우선, 그다음 category. */
type Kind = "digital-out" | "digital-in" | "analog-in" | "servo" | "i2c" | "1wire";
function classify(def: PartDef): Kind {
  if (def.protocol === "i2c") return "i2c";
  if (def.protocol === "1-wire") return "1wire";
  if (def.protocol === "pwm") return "servo";
  if (def.protocol === "analog") return "analog-in";
  // onoff / 미지정 → 카테고리로 입출력 방향 결정
  return def.category === "input" || def.category === "sensor"
    ? "digital-in"
    : "digital-out";
}

interface Binding {
  /** 보드 핀 표현식 — 디지털 '8' | 아날로그 'A0' (둘 다 유효한 핀 인자) */
  pinExpr: string;
  role: BoardPinRole;
  def: PartDef;
  partUid: string;
}

/** 핀 정렬: 디지털/PWM 번호 오름차순 → 아날로그(A0..). 출력 안정성. */
function pinOrder(b: Binding): number {
  if (b.role === "analog") return 1000 + Number(b.pinExpr.replace(/\D/g, "") || 0);
  return Number(b.pinExpr) || 0;
}

/** 회로 → 추천 아두이노 스케치(결정론). */
export function buildSketch(model: CircuitModel): SketchResult {
  const nl = buildNetlist(model);
  const pinMap = getBoardPinMap();
  const boardRef = boardRefLabel();
  const partByUid = new Map(model.parts.map((p) => [p.uid, p]));
  const isPassive = (uid?: string): boolean =>
    !!uid && PARTS[partByUid.get(uid)?.defId ?? ""]?.category === "passive";

  // endpoint → 그 끝점이 속한 넷 (수동소자 1홉 추적용)
  const netByEndpoint = new Map<string, NetlistEntry>();
  for (const net of nl.nets)
    for (const t of net.terminals) netByEndpoint.set(t.endpoint, net);

  // 넷의 부품 단자 중 "구동 대상"을 고른다. 능동부품 우선, 수동소자만이면 1홉 추적.
  const drivenUid = (net: NetlistEntry): string | null => {
    const parts = net.terminals.filter((t) => t.partUid);
    const active = parts.find((t) => !isPassive(t.partUid));
    if (active) return active.partUid!;
    for (const t of parts) {
      const p = partByUid.get(t.partUid!);
      if (!p) continue;
      for (const ep of partEndpoints(p)) {
        if (!ep || ep === t.endpoint) continue;
        const beyond = netByEndpoint.get(ep);
        if (!beyond || beyond.nodeId === net.nodeId) continue;
        const found = beyond.terminals.find((u) => u.partUid && !isPassive(u.partUid));
        if (found) return found.partUid!;
      }
    }
    return parts[0]?.partUid ?? null;
  };

  // 넷별 (보드 제어핀 ↔ 구동 부품) 바인딩 추출
  const bindings: Binding[] = [];
  const boundPins = new Set<string>();
  for (const net of nl.nets) {
    const ctrlPins = net.terminals.filter((t) => {
      const pin = t.ref === boardRef ? pinMap.get(t.endpoint) : undefined;
      return pin && CONTROL_ROLES.has(pin.role);
    });
    if (ctrlPins.length === 0) continue;
    const uid = drivenUid(net);
    const part = uid ? partByUid.get(uid) : undefined;
    const def = part && PARTS[part.defId];
    if (!part || !def) continue;
    for (const bp of ctrlPins) {
      if (boundPins.has(bp.endpoint)) continue;
      boundPins.add(bp.endpoint);
      const pin = pinMap.get(bp.endpoint)!;
      bindings.push({ pinExpr: pin.label, role: pin.role, def, partUid: part.uid });
    }
  }
  bindings.sort((a, b) => pinOrder(a) - pinOrder(b) || a.def.id.localeCompare(b.def.id));

  const notes: string[] = [];
  const boundUids = new Set(bindings.map((b) => b.partUid));

  // 같은 어간이 여러 개면 번호 접미(relay1Pin/relay2Pin), 하나면 접미 없음.
  const stemTotal = new Map<string, number>();
  for (const b of bindings) stemTotal.set(stemOf(b.def.id), (stemTotal.get(stemOf(b.def.id)) ?? 0) + 1);
  const stemUsed = new Map<string, number>();
  const nameFor = (def: PartDef): string => {
    const stem = stemOf(def.id);
    if ((stemTotal.get(stem) ?? 0) <= 1) return stem;
    const n = (stemUsed.get(stem) ?? 0) + 1;
    stemUsed.set(stem, n);
    return `${stem}${n}`;
  };

  const includes = new Set<string>();
  const globals: string[] = [];
  const consts: string[] = [];
  const setup: string[] = [];
  const loop: string[] = [];
  let serial = false;

  for (const b of bindings) {
    const kind = classify(b.def);
    if (kind === "i2c" || kind === "1wire") {
      const lib = kind === "i2c" ? "Wire(I2C) 라이브러리" : "전용 1-Wire 라이브러리";
      notes.push(`${b.def.label}는 ${lib}가 필요해 자동 코드 생성에서 제외했어요(핀 ${prettyPin(b)} 연결).`);
      continue;
    }
    const name = nameFor(b.def);
    const pinVar = `${name}Pin`;
    consts.push(`const int ${pinVar} = ${b.pinExpr};`);

    switch (kind) {
      case "digital-out":
        setup.push(`  pinMode(${pinVar}, OUTPUT);`);
        loop.push(`  digitalWrite(${pinVar}, HIGH);  // ${b.def.label} 켜기`);
        loop.push(`  delay(2000);`);
        loop.push(`  digitalWrite(${pinVar}, LOW);   // ${b.def.label} 끄기`);
        loop.push(`  delay(2000);`);
        break;
      case "digital-in":
        serial = true;
        setup.push(`  pinMode(${pinVar}, ${b.def.needsPullup ? "INPUT_PULLUP" : "INPUT"});`);
        loop.push(`  int ${name}State = digitalRead(${pinVar});  // ${b.def.label} 읽기`);
        loop.push(`  Serial.println(${name}State);`);
        loop.push(`  delay(100);`);
        break;
      case "analog-in":
        serial = true;
        loop.push(`  int ${name}Value = analogRead(${pinVar});  // ${b.def.label} 읽기`);
        loop.push(`  Serial.println(${name}Value);`);
        loop.push(`  delay(100);`);
        break;
      case "servo":
        includes.add("#include <Servo.h>");
        globals.push(`Servo ${name};`);
        setup.push(`  ${name}.attach(${pinVar});`);
        loop.push(`  ${name}.write(0);    // ${b.def.label} 0도`);
        loop.push(`  delay(1000);`);
        loop.push(`  ${name}.write(90);   // ${b.def.label} 90도`);
        loop.push(`  delay(1000);`);
        break;
    }
  }

  // 아두이노 제어핀에 닿지 않은 능동부품(예: 릴레이로 구동되는 펌프) 안내
  for (const p of model.parts) {
    const def = PARTS[p.defId];
    if (!def || def.category === "passive" || boundUids.has(p.uid)) continue;
    notes.push(`${def.label}는 아두이노 제어핀에 직접 연결되지 않아 코드에 포함하지 않았어요(다른 부품으로 구동되거나 미연결).`);
  }

  const code = assemble({ includes, globals, consts, setup, loop, serial });
  return { code, notes };
}

function prettyPin(b: Binding): string {
  return b.role === "analog" ? b.pinExpr : `D${b.pinExpr}`;
}

function assemble(s: {
  includes: Set<string>;
  globals: string[];
  consts: string[];
  setup: string[];
  loop: string[];
  serial: boolean;
}): string {
  const out: string[] = [];
  out.push("// PinMate 자동 생성 — 결정론 코드 추천");
  out.push("// 회로의 아두이노 핀 연결에서 만든 기본 스케치예요. 동작은 자유롭게 바꾸세요.");
  if (s.includes.size) {
    out.push("");
    out.push(...[...s.includes].sort());
  }
  if (s.globals.length) {
    out.push("");
    out.push(...s.globals);
  }
  if (s.consts.length) {
    out.push("");
    out.push(...s.consts);
  } else {
    out.push("");
    out.push("// 아직 아두이노 제어핀(D2~D13, A0~A5)에 연결된 부품이 없어요.");
  }
  out.push("");
  out.push("void setup() {");
  if (s.serial) out.push("  Serial.begin(9600);");
  out.push(...s.setup);
  out.push("}");
  out.push("");
  out.push("void loop() {");
  out.push(...s.loop);
  out.push("}");
  return out.join("\n") + "\n";
}
