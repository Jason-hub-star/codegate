/**
 * PinMate MCP 서버 — Streamable HTTP (stateless). 카카오 PlayMCP 출품용.
 *
 * 무상태 규약(DEC-036): 요청마다 McpServer+Transport 를 새로 만들고
 * sessionIdGenerator=undefined 로 세션을 끈다. 도구는 src/features/circuit 의
 * 순수 함수만 호출하며 전역 setActive* 를 절대 부르지 않는다 → 동시요청 오염 0.
 *
 * 식별자=pinmate. 도구명에 "kakao" 없음. 설명은 영어 + 「핀메이트 — 3D 개발보드 튜터」.
 * 도구 5종 전부 read-only·비파괴·멱등·closed-world (annotations 5종 명시).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  runDiagnose,
  runGenerate,
  runExplain,
  runSuggest,
  runBom,
  type ToolResult,
} from "./tools";

const PORT = Number(process.env.PORT ?? 3030);
const MCP_PATH = "/mcp";

/** 모든 도구가 같은 성격: 읽기 전용·비파괴·멱등·외부세계 접근 없음. */
const READONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/** ToolResult → MCP CallToolResult. */
function wrap(r: ToolResult) {
  return {
    content: [{ type: "text" as const, text: r.text }],
    ...(r.isError ? { isError: true } : {}),
  };
}

/** 요청마다 새 서버 인스턴스(무상태). 도구 등록은 가볍다. */
function buildServer(): McpServer {
  const server = new McpServer({ name: "pinmate", version: "0.1.0" });

  server.registerTool(
    "generate_circuit",
    {
      title: "Generate a beginner breadboard circuit",
      description:
        "「핀메이트 — 3D 개발보드 튜터」 Suggest a beginner-friendly Arduino breadboard circuit from a natural-language request (Korean). Returns the parts, wiring, a Korean diagnosis, a 3D-view deep link, and a reusable circuit `code` you can pass to the other tools.",
      inputSchema: {
        query: z
          .string()
          .describe("자연어 회로 요청 (예: \"저항 없이 LED 연결\", \"릴레이로 펌프 켜기\")"),
      },
      annotations: READONLY,
    },
    async ({ query }) => wrap(runGenerate(query)),
  );

  server.registerTool(
    "diagnose_circuit",
    {
      title: "Diagnose a breadboard circuit",
      description:
        "「핀메이트 — 3D 개발보드 튜터」 Diagnose a breadboard circuit encoded as a PinMate `code` (from generate_circuit or a builder share link). Returns a deterministic Korean report: parts, connections, and any errors (short, polarity, missing resistor, open circuit, voltage mismatch, …).",
      inputSchema: {
        code: z.string().describe("PinMate 회로 코드(code) 또는 공유 링크의 c= 값"),
      },
      annotations: READONLY,
    },
    async ({ code }) => wrap(runDiagnose(code)),
  );

  server.registerTool(
    "explain_component",
    {
      title: "Explain an electronic component",
      description:
        "「핀메이트 — 3D 개발보드 튜터」 Explain a supported electronic component (LED, resistor, button, servo, relay, pump, …) in beginner Korean: pins, operating voltage, signal type, and wiring cautions.",
      inputSchema: {
        component: z
          .string()
          .describe("부품 이름 또는 id (예: led, 저항, 버튼, 서보, 릴레이)"),
      },
      annotations: READONLY,
    },
    async ({ component }) => wrap(runExplain(component)),
  );

  server.registerTool(
    "suggest_next_step",
    {
      title: "Suggest the next wiring step",
      description:
        "「핀메이트 — 3D 개발보드 튜터」 Given a circuit `code`, suggest the single most useful next wiring step in Korean (fix the top error first, otherwise guide toward completion). Deterministic, no LLM.",
      inputSchema: {
        code: z.string().describe("PinMate 회로 코드(code) 또는 공유 링크의 c= 값"),
      },
      annotations: READONLY,
    },
    async ({ code }) => wrap(runSuggest(code)),
  );

  server.registerTool(
    "get_bom",
    {
      title: "Get the bill of materials",
      description:
        "「핀메이트 — 3D 개발보드 튜터」 Given a circuit `code`, return the bill of materials (parts list with counts and key specs) in Korean.",
      inputSchema: {
        code: z.string().describe("PinMate 회로 코드(code) 또는 공유 링크의 c= 값"),
      },
      annotations: READONLY,
    },
    async ({ code }) => wrap(runBom(code)),
  );

  return server;
}

/** POST 본문을 읽어 JSON 파싱(없으면 undefined). */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  return JSON.parse(raw);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const httpServer = createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];

  // 헬스체크(KC LB / 사람 확인용) — 인증 없음.
  if (req.method === "GET" && (path === "/" || path === "/health")) {
    sendJson(res, 200, { status: "ok", service: "pinmate", endpoint: MCP_PATH });
    return;
  }

  if (path !== MCP_PATH) {
    sendJson(res, 404, { error: "not found" });
    return;
  }

  // Stateless: 세션 없음 → GET/DELETE 는 허용 안 함.
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json", allow: "POST" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method Not Allowed. Use POST." },
        id: null,
      }),
    );
    return;
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true, // SSE 없이 직접 JSON 응답(단순·저지연)
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    const body = await readJsonBody(req);
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
    console.error("[pinmate-mcp] request error:", err);
  }
});

httpServer.listen(PORT, () => {
  console.log(`[pinmate-mcp] listening on :${PORT}${MCP_PATH}`);
});
