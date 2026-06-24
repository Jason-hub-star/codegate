---
name: pinmate-mcp
description: >-
  핀메이트(PinMate) 카카오 MCP 서버의 빌드·로컬 검증·컨테이너·대회 등록을 한 절차로
  몬다. server/mcp.ts(Streamable HTTP·stateless·도구 5종)를 건드린 뒤 호출하면
  `pnpm mcp:smoke`로 14항목(도구·체인·딥링크·SLA·동시성)을 실호출 검증하고,
  Docker(amd64)·카카오 PlayMCP 등록 체크리스트까지 안내한다. 트리거 — "MCP 테스트",
  "MCP 배포", "대회 신청/등록", "스모크", server/ 수정 후, "/pinmate-mcp".
---

# pinmate-mcp — MCP 서버 검증·배포·등록

PinMate 회로 두뇌를 카카오 PlayMCP "AGENTIC PLAYER 10" 출품작으로 노출하는 MCP 서버
(`server/`)의 운영 루틴. 결정 근거=[[DECISION-LOG]] DEC-036, 상세 런북·신청 가이드=`docs/ref/MCP-DEPLOY.md`.

## 구성 (정본)
| 파일 | 역할 |
|---|---|
| `server/tools.ts` | **순수 도구 코어** — 회로 도메인(`src/features/circuit`) 순수 함수만 호출. 로직 수정은 여기. |
| `server/mcp.ts` | **MCP 배선** — `McpServer`+Streamable HTTP(stateless)·도구 5종 등록·HTTP 서버. |
| `server/build.mjs` | esbuild 번들 → `dist/mcp.mjs`(SDK·zod·도메인 인라인, 외부 의존 0). |
| `server/smoke.mjs` | 서버 spawn → 14항목 실호출 검증. |
| `server/__tests__/tools.test.ts` | 도구 코어 단위테스트(결정론·동시성·매칭·에러). |
| `Dockerfile` / `.dockerignore` | linux/amd64 컨테이너(런타임=node:slim+번들만). |

## 절차

### 1. 로컬 검증 (코드 바꿨으면 항상)
```bash
pnpm mcp:smoke     # 빌드→서버 spawn→14항목 실호출→결과표→종료
pnpm test          # tools.test 포함 전체
pnpm typecheck && pnpm lint
```
- `mcp:smoke`가 검증하는 것: health·tools/list(5종+annotations 5종+"kakao"명 금지)·generate→diagnose/suggest/bom 체인·explain·에러(isError)·딥링크 Vercel 200·SLA(avg≤100ms·p99≤3s)·**동시 100요청 격리(오염 0)**.
- 전부 ✅ 아니면 등록 금지. 딥링크 항목은 네트워크 없으면 SKIP.

### 2. 도구 수정 시 불변식
- 로직은 `server/tools.ts`만, 배선 `server/mcp.ts`는 가급적 그대로.
- **무상태 규약(절대)**: 핸들러에서 `setActiveBoard/setActiveBreadboard` 호출 금지. 보드/빵판은 `code`를 `decodeCircuit`→`CircuitContext{breadboard,board}`로 만들어 **인자 주입**(server/tools.ts `ctxFor`). 동시요청 오염 0의 근거(DEC-036 M0).
- 새 도구: read-only·비파괴·멱등·closed-world면 `READONLY` annotations 재사용. 도구명·서버명에 "kakao" 금지. 설명은 영문+「PinMate(핀메이트)」.
- 응답 ≤24k·동기·외부 I/O 금지(SLA).

### 3. 컨테이너 (M4, Docker Desktop 필요)
```bash
docker build --platform=linux/amd64 -t pinmate-mcp .
docker run --platform=linux/amd64 -p 8080:8080 pinmate-mcp
curl -s localhost:8080/health
```
- 카카오 클라우드는 **linux/amd64만**. Apple Silicon은 `--platform` 필수.

### 4. 대회 등록 (M5, 주인님 수동)
`docs/ref/MCP-DEPLOY.md` §M5 신청 가이드 따라: KC 배포→Endpoint 발급→PlayMCP 등록
("정보 불러오기"→임시등록→AI채팅 테스트→심사요청)→전체공개→비즈폼 제출. **실질 마감 7/7.**

## 규칙
- 검증(스모크·게이트)은 성역 — 통과 못 하면 "됐다" 금지.
- 코드/절차 바뀌면 [[docsync]]로 PROJECT-STATUS·WORK-BOARD·DEC-036 갱신.
- haiku 조사 수치(일정·상금·SLA)는 등록 전 공식 페이지 재확인(research/21 표기 보존).
