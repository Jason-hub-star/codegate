# syntax=docker/dockerfile:1
#
# PinMate MCP 서버 — 카카오 클라우드(amd64) 컨테이너.
# 빌드:  docker build --platform=linux/amd64 -t pinmate-mcp .
# 실행:  docker run --platform=linux/amd64 -p 8080:8080 \
#          -e PINMATE_BASE_URL=https://codegate-eta.vercel.app pinmate-mcp
# 엔드포인트:  POST http://<host>:8080/mcp   (헬스: GET /health)
#
# 2단계 빌드. esbuild 가 SDK·zod·회로 도메인을 단일 파일로 인라인하므로
# 런타임 스테이지는 node + dist/mcp.mjs 만 있으면 된다(node_modules 불필요).

FROM --platform=$BUILDPLATFORM node:20-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
# 의존성 먼저(레이어 캐시) — 빌드엔 전체 devDeps 필요(esbuild 등).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
# 번들에 필요한 소스만 복사 후 빌드.
COPY tsconfig.json ./
COPY server ./server
COPY src ./src
RUN pnpm mcp:build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
# 3D 뷰 딥링크 베이스(배포 시 오버라이드 가능).
ENV PINMATE_BASE_URL=https://codegate-eta.vercel.app
COPY --from=builder /app/dist/mcp.mjs ./dist/mcp.mjs
EXPOSE 8080
# 비루트 실행(node:slim 기본 제공 user).
USER node
CMD ["node", "dist/mcp.mjs"]
