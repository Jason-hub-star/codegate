/**
 * 회로 코덱 — CircuitModel ↔ URL-safe base64 문자열 변환.
 * 순수 함수, 브라우저(useSearchParams) + Node(vitest) 양쪽 호환.
 * 악성/깨진 입력은 throw 금지 → null 반환으로 안전처리.
 */

import { z } from "zod";
import type { CircuitModel, Layout } from "./types";
import type { BreadboardId } from "./breadboard";
import type { BoardId } from "./board";

/**
 * Wire 스키마.
 * CircuitModel.wires 형태 그대로.
 */
const WireSchema = z.object({
  id: z.string(),
  a: z.string(),
  b: z.string(),
});

/**
 * PlacedPart 스키마.
 * 필수: uid, defId, pinHoles, orientation, anchorHoleId
 * 선택: mount, bodyPos, leads
 */
const PlacedPartSchema = z.object({
  uid: z.string(),
  defId: z.string(),
  pinHoles: z.array(z.string()),
  orientation: z.union([z.literal(0), z.literal(1)]),
  anchorHoleId: z.string(),
  mount: z.enum(["board", "free"]).optional(),
  bodyPos: z
    .object({
      x: z.number(),
      z: z.number(),
    })
    .optional(),
  leads: z.array(z.union([z.string(), z.null()])).optional(),
  rot: z
    .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
    .optional(),
  leadAnchors: z
    .array(
      z.union([
        z.tuple([z.number(), z.number(), z.number()]),
        z.null(),
      ]),
    )
    .optional(),
});

/**
 * CircuitModel 스키마.
 */
const CircuitModelSchema = z.object({
  wires: z.array(WireSchema),
  parts: z.array(PlacedPartSchema),
});

/**
 * Breadboard ID 스키마.
 */
const BreadboardIdSchema = z.enum(["half", "full"]);

/**
 * Board(개발보드) ID 스키마 — 봉투에서 선택(생략 = 아두이노, 하위호환).
 */
const BoardIdSchema = z.enum(["arduino-uno", "esp32-huzzah32"]);
const DEFAULT_BOARD: BoardId = "arduino-uno";

/**
 * 보드 pose 스키마 (이동 x,z + 90° 회전 rot).
 */
const PoseSchema = z.object({
  x: z.number(),
  z: z.number(),
  rot: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

/**
 * 레이아웃 스키마 (빵판·아두이노 pose, 둘 다 선택).
 */
const LayoutSchema = z.object({
  breadboard: PoseSchema.optional(),
  arduino: PoseSchema.optional(),
});

/**
 * 코덱 봉투: { v: 1, b: BreadboardId, bd?: BoardId, m: CircuitModel, l?: Layout }
 * bd(보드)·l(레이아웃)은 선택 필드 — 생략 시 기본(아두이노/기본 배치). 기존 링크와 하위호환.
 */
const EnvelopeSchema = z.object({
  v: z.literal(1),
  b: BreadboardIdSchema,
  bd: BoardIdSchema.optional(),
  m: CircuitModelSchema,
  l: LayoutSchema.optional(),
});

type Envelope = z.infer<typeof EnvelopeSchema>;

/**
 * Base64 인코더/디코더 — 브라우저·Node 호환.
 * UTF-8 안전하게 처리.
 */
function encodeBase64(str: string): string {
  // 브라우저와 Node.js 양쪽에서 동작하는 방식
  // UTF-8 문자열 → Uint8Array → base64 (URL-safe)
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function decodeBase64(str: string): string | null {
  try {
    // URL-safe base64 → 표준 base64
    const standard = str
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    // 패딩 복원 (4의 배수로)
    const padded = standard + "=".repeat((4 - (standard.length % 4)) % 4);
    const binary = atob(padded);
    // 바이너리 → UTF-8 텍스트
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * 회로를 URL-safe base64 문자열로 인코딩.
 *
 * @param model 회로 모델
 * @param board 빵판 종류 (기본값: "half")
 * @returns URL 쿼리에 사용 가능한 문자열
 *
 * @example
 * const code = encodeCircuit(SCENARIOS.ledCorrect.model, "half");
 * // → 길이 수십~수백 문자의 base64 문자열
 */
export function encodeCircuit(
  model: CircuitModel,
  board: BreadboardId = "half",
  layout?: Layout,
  devBoard: BoardId = DEFAULT_BOARD,
): string {
  // 레이아웃은 실제 내용이 있을 때만 봉투에 담는다(레이아웃 없는 링크는 기존과 동일).
  const hasLayout = !!layout && (!!layout.breadboard || !!layout.arduino);
  // 기본 보드(아두이노)는 봉투에 담지 않는다 — 기존 링크와 바이트 동일(하위호환).
  const hasBoard = devBoard !== DEFAULT_BOARD;
  const envelope: Envelope = {
    v: 1,
    b: board,
    ...(hasBoard ? { bd: devBoard } : {}),
    m: model,
    ...(hasLayout ? { l: layout } : {}),
  };
  const json = JSON.stringify(envelope);
  return encodeBase64(json);
}

/**
 * URL-safe base64 문자열을 회로로 디코딩.
 *
 * 모든 실패 케이스(빈 문자열, 깨진 base64, 비JSON, 스키마 위반, 버전 불일치)에서
 * null 을 반환한다. throw 금지.
 *
 * @param code 코덱된 문자열
 * @returns { model, board } 또는 null
 *
 * @example
 * const result = decodeCircuit(encodedString);
 * if (!result) {
 *   console.error("회로를 불러올 수 없어요");
 *   return;
 * }
 * const { model, board } = result;
 */
export function decodeCircuit(
  code: string,
): {
  model: CircuitModel;
  board: BreadboardId;
  devBoard: BoardId;
  layout?: Layout;
} | null {
  // 빈 문자열 처리
  if (!code || code.length === 0) {
    return null;
  }

  // Base64 디코딩
  const json = decodeBase64(code);
  if (!json) {
    return null;
  }

  // JSON 파싱
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  // 스키마 검증 (zod)
  const validation = EnvelopeSchema.safeParse(parsed);
  if (!validation.success) {
    return null;
  }

  const envelope = validation.data;
  return {
    model: envelope.m,
    board: envelope.b,
    devBoard: envelope.bd ?? DEFAULT_BOARD, // 생략된 옛 링크 = 아두이노
    ...(envelope.l ? { layout: envelope.l } : {}),
  };
}
