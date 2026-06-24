---
name: docsync
description: >-
  핀메이트(PinMate) 정본 문서 동기화. 코드·결정·계획이 바뀐 직후 호출하면
  PROJECT-STATUS·WORK-BOARD·DECISION-LOG 등 정본을 일관되게 갱신하고
  같은 사실이 여러 곳에 어긋나게 적힌 드리프트를 점검한다. "정본 1곳 원칙"을
  강제한다. 트리거 — 변경 작업을 끝낸 뒤, "문서 갱신", "드리프트 점검",
  "상태 업데이트", "/docsync" 요청 시.
---

# docsync — 정본 문서 동기화

## 목적
변경(코드/결정/계획) 직후, 흩어진 정본 문서를 **한 번에·일관되게** 갱신하고
드리프트(같은 사실이 두 곳에 다르게)를 잡는다. CLAUDE.md "정본 1곳 원칙"의 실행 루틴.

## 정본 위치 (단일 진실 — 중복 금지)
| 무엇 | 정본 |
|---|---|
| 결정 | `docs/status/DECISION-LOG.md` |
| 현재 상태(대시보드) | `docs/status/PROJECT-STATUS.md` |
| 작업 보드 | `docs/status/WORK-BOARD.md` |
| 계획 | `docs/ref/PROJECT-PLAN.md`, `docs/ref/MVP-PLAN.md` |
| 제품 정의 | `docs/ref/PRD.md` |
| 구조 | `docs/ref/ARCHITECTURE.md` |
| 심사 준비도 | `docs/deliverables/JUDGE-READINESS.md` |

## 절차
1. **무엇이 바뀌었나 수집** — 직전 대화 맥락 + working tree(코드/문서 변경). 추측 금지, 실제 변경만.
2. **오늘 날짜 확인** — `currentDate` 컨텍스트 사용(없으면 `date +%F`). 상대 날짜는 절대 날짜로 변환.
3. **PROJECT-STATUS.md** 갱신:
   - `## Recent Changes` 맨 위에 `- YYYY-MM-DD: <핵심 변경 + 근거/검증>` 한 줄 추가.
   - `## Active Tracks` / `## Next Actions` / `## Handoff Capsule` 현행화(완료 항목 정리, next entrypoint 갱신).
4. **WORK-BOARD.md** — 영향받은 work unit status(`todo`/`doing`/`blocked`/`done`) 갱신, 필요 시 신규 행(ID 이어서).
5. **결정이 있었으면 DECISION-LOG.md** — 다음 번호로 `DEC-xxx`(또는 예선/행정은 `DEC-Pxx`) 추가: 결정·근거·대안·상태. 기존 결정을 뒤집으면 옛 항목을 `Superseded`로 표시(삭제 X).
6. **사실이 바뀐 ref 문서만** 갱신(PRD/ARCHITECTURE/PLAN). 안 바뀐 문서는 건드리지 않는다.
7. **드리프트 점검** — 바뀐 핵심 사실(스택·수치·슬라이드수·팀·날짜 등)을 `grep -rin`으로 전 문서 검색해 어긋난 곳 정정.

## 규칙 (반드시)
- **정본 1곳**: 같은 사실을 두 곳에 쓰지 않는다. 보조 문서는 `[[정본-파일명]]`으로 링크만.
- **추측 금지**: 실제로 일어난 변경만 기록. 안 한 일을 "완료"로 쓰지 않는다.
- **haiku 조사 수치**(SimulIDE 스타·arXiv 번호·HF 벤치 등)는 "재검증 필요" 표기를 보존.
- **인용 주의**: 기획안에 논문 번호 직접 인용 금지, 경쟁사 "한국어 미지원" 단정 금지(`docs/research` §8).
- 마지막에 **무엇을 바꿨는지 요약** + 글로벌 규칙대로 **한줄정리** 블록.

## 빠른 점검 명령 (참고)
```bash
# 다음 DEC 번호
grep -oE "DEC-[0-9]+" docs/status/DECISION-LOG.md | sort -t- -k2 -n | tail -1
# 드리프트 후보(예: 스택/수치가 여러 곳에)
grep -rin "<바뀐키워드>" docs/
```

## 안티패턴
- Recent Changes에 같은 내용 중복 누적 → 핵심만 한 줄.
- 정본과 보조 문서에 같은 표를 복붙 → 정본만 두고 링크.
- 코드만 바꾸고 PROJECT-STATUS 미갱신 → CLAUDE.md 위반.
