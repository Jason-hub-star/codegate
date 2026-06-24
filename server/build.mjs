// PinMate MCP 서버 번들러 — server/mcp.ts + 회로 도메인 + SDK 를 단일 파일로.
// 컨테이너 런타임에 TS 툴체인이 필요 없게(node:slim 에서 `node dist/mcp.mjs`).
import { build } from "esbuild";

await build({
  entryPoints: ["server/mcp.ts"],
  outfile: "dist/mcp.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // 네이티브/builtin 은 esbuild 가 자동 external. 외부 의존 0(전부 인라인).
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: "info",
});
