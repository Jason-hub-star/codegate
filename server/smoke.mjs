// PinMate MCP 서버 스모크 — 서버를 띄우고 11항목을 실호출로 검증한다.
// 사용:  pnpm mcp:smoke        (빌드→서버 spawn→검증→종료)
// 의존 0(node 내장만). 딥링크 외부 체크는 네트워크 없으면 건너뛴다(SKIP).
import { spawn } from "node:child_process";
import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT ?? 3030);
const BASE = `http://localhost:${PORT}`;
const pass = [];
const fail = [];
const ok = (n, c) => (c ? pass : fail).push(n);

function post(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  return new Promise((res, rej) => {
    const r = http.request(
      `${BASE}/mcp`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "content-length": Buffer.byteLength(body),
        },
      },
      (p) => {
        let d = "";
        p.on("data", (c) => (d += c));
        p.on("end", () => res(JSON.parse(d)));
      },
    );
    r.on("error", rej);
    r.end(body);
  });
}
const callTool = (name, args) =>
  post("tools/call", { name, arguments: args }).then((r) => r.result);
const textOf = (r) => r.content[0].text;

function getStatus(url) {
  const lib = url.startsWith("https") ? https : http;
  return new Promise((res) => {
    const req = lib.get(url, (r) => {
      r.resume();
      res(r.statusCode);
    });
    req.on("error", () => res(null));
    req.setTimeout(5000, () => {
      req.destroy();
      res(null);
    });
  });
}

async function waitHealth(tries = 40) {
  for (let i = 0; i < tries; i++) {
    const code = await getStatus(`${BASE}/health`);
    if (code === 200) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function run() {
  // 1) health
  ok("1. GET /health 200", (await getStatus(`${BASE}/health`)) === 200);

  // 2) tools/list — 5종 + annotations 5종
  const list = (await post("tools/list", {})).result.tools;
  const names = list.map((t) => t.name);
  const want = ["generate_circuit", "diagnose_circuit", "explain_component", "suggest_next_step", "get_bom"];
  ok("2. tools/list 5종", want.every((n) => names.includes(n)) && names.length === 5);
  const ann5 = list.every(
    (t) =>
      t.annotations &&
      ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"].every(
        (k) => k in t.annotations,
      ),
  );
  ok("2b. annotations 5종(title+4 hint)", ann5 && list.every((t) => t.title));
  ok("2c. 도구명에 'kakao' 없음", names.every((n) => !n.toLowerCase().includes("kakao")));

  // 3) generate_circuit → code 추출
  const gen = textOf(await callTool("generate_circuit", { query: "LED 켜는 회로" }));
  const code = gen.match(/전달\): (\S+)/)?.[1];
  ok("3. generate_circuit + code 반환", !!code && gen.includes("추천 회로"));
  const viewUrl = gen.match(/(https?:\/\/\S+\/view\?c=\S+)/)?.[1];
  ok("3b. 딥링크 URL 포함", !!viewUrl);

  // 4~6) code 체인
  ok("4. diagnose_circuit(code)", textOf(await callTool("diagnose_circuit", { code })).includes("진단"));
  ok("5. suggest_next_step(code)", !!textOf(await callTool("suggest_next_step", { code })));
  ok("6. get_bom(code)", textOf(await callTool("get_bom", { code })).includes("BOM"));

  // 7) explain
  ok("7. explain_component(서보)", textOf(await callTool("explain_component", { component: "서보" })).includes("서보"));

  // 8) 에러
  const err = await callTool("diagnose_circuit", { code: "NOT_A_CODE" });
  ok("8. 깨진 code → isError", err.isError === true);

  // 9) 딥링크 실연결(best-effort)
  if (viewUrl) {
    const status = await getStatus(viewUrl);
    if (status === null) console.log("   9. 딥링크 외부연결 … SKIP(네트워크 없음)");
    else ok("9. 딥링크 Vercel 200", status === 200);
  }

  // 10) SLA
  const t0 = process.hrtime.bigint();
  const N = 50;
  const lat = [];
  for (let i = 0; i < N; i++) {
    const s = process.hrtime.bigint();
    await callTool("diagnose_circuit", { code });
    lat.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  lat.sort((a, b) => a - b);
  const avg = lat.reduce((a, b) => a + b) / N;
  console.log(`   10. SLA: avg=${avg.toFixed(2)}ms p99=${lat[N - 1].toFixed(2)}ms`);
  ok("10. SLA avg≤100ms & p99≤3000ms", avg <= 100 && lat[N - 1] <= 3000);

  // 11) 동시성 격리 — 두 회로 100요청 인터리브
  const c2 = (await callTool("generate_circuit", { query: "릴레이로 펌프 켜기" })).content[0].text.match(/전달\): (\S+)/)[1];
  const baseA = textOf(await callTool("diagnose_circuit", { code }));
  const baseB = textOf(await callTool("diagnose_circuit", { code: c2 }));
  const jobs = Array.from({ length: 100 }, (_, i) =>
    callTool("diagnose_circuit", { code: i % 2 === 0 ? code : c2 }).then((r) => textOf(r)),
  );
  const out = await Promise.all(jobs);
  const clean = out.every((t, i) => t === (i % 2 === 0 ? baseA : baseB));
  ok("11. 동시 100요청 격리(오염0)", clean && baseA !== baseB);

  void t0;
}

const child = spawn(process.execPath, ["dist/mcp.mjs"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "ignore", "inherit"],
});
let code = 1;
try {
  if (!(await waitHealth())) throw new Error("서버가 뜨지 않음 (pnpm mcp:build 먼저?)");
  await run();
  console.log("\n────────── 결과 ──────────");
  pass.forEach((n) => console.log("✅ " + n));
  fail.forEach((n) => console.log("❌ " + n));
  console.log(`\n${pass.length}/${pass.length + fail.length} 통과`);
  code = fail.length === 0 ? 0 : 1;
} catch (e) {
  console.error("스모크 실패:", e.message);
} finally {
  child.kill();
  process.exit(code);
}
