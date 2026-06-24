---
name: pinmate-add-part
description: 핀메이트 카탈로그에 새 부품(또는 보드/빵판 픽스처)을 누락 조인 없이 추가하는 스킬. "부품 추가", "부품 하나 넣어줘", "센서 추가", "카탈로그에 ~ 추가", "GLB 부품 등록", "팔레트에 부품 넣기" 같은 요청에 발동. DEC-030 "Add = one entry" 철학을 강제하되, 실제로는 parts(도메인)·render 전략(절차 빌더 또는 GLB)·assetCredits(라이선스)·CREDITS.md(정본)·CATEGORIES(분류)가 조인돼야 하므로 그 체크리스트와 무라이선스 금지 가드를 닫는다.
user_invocable: true
tags: [pinmate, catalog, part, glb, license-guard, ssot, extensibility]
trigger: "새 부품/센서/액추에이터/보드/빵판을 카탈로그에 추가할 때 / GLB 모델을 씬에 등록할 때"
version: 1
---

<!-- pinmate-add-part/SKILL.md · 핀메이트 부품 추가 절차 정본. frontmatter는 반드시 첫 줄. -->

# PinMate Add Part

새 부품을 **한 흐름**으로 추가한다. DEC-030 SSOT 철학은 "한 항목 추가"지만, 누락 시 조용히 깨지는 조인이 여럿이라(라이선스 누락=법적 리스크, 빌더/스펙 누락=렌더 실패) 이 스킬이 전부를 강제한다.

## Use When

- "부품/센서/액추에이터 추가해줘" 류 요청 (1차 트리거)
- 새 GLB 모델을 씬에 등록할 때
- 보드/빵판 픽스처(작업대 종류)를 카탈로그에 노출할 때

## 핵심 사실 (정본 위치)

| 무엇 | 파일 | 비고 |
|---|---|---|
| 부품 정의 | `src/features/circuit/parts.ts` `PARTS` | 여기 한 항목 → `PART_LIST`→`CATALOG` 자동 파생 |
| 픽스처(보드/빵판) | `src/features/circuit/catalog.ts` `FIXTURES` | 부품 아닌 작업대 종류 |
| 카테고리 | `src/features/circuit/catalog.ts` `CATEGORIES` | 없는 카테고리면 여기 먼저 추가. 빈 카테고리는 팔레트가 자동 숨김 |
| 상태 타입 | `src/features/circuit/types.ts` `ComponentStatus` | `ready`(배치가능)·`active`(현재적용)·`staged`(보유·미배포)·`glb-pending` |
| 렌더 전략 | `types.ts` `RenderStrategy` | `{kind:"procedural", builder}` \| `{kind:"glb", assetId}` |
| 절차 빌더 | `src/features/breadboard-3d/three/parts.ts` `BUILDERS` | `render.builder` 문자열 = 이 맵의 키여야 함 |
| GLB 변환 스펙 | `src/features/breadboard-3d/three/glbParts.ts` `GLB_PART_SPECS` | assetId별 `scaleLen/yLift/rotationY`. 없으면 `DEFAULT_SPEC` |
| 라이선스 레지스트리 | `src/lib/assetCredits.ts` `ASSET_CREDITS` | GLB의 `assetId`·경로·라이선스·`rendered` |
| 라이선스 정본 문서 | `docs/ref/CREDITS.md` | `ASSET_CREDITS`와 **항상 일치** |
| 보드 핀 좌표(조건부) | `src/features/circuit/calibration-data.ts` `CALIBRATIONS` | 보드/헤더 핀의 월드좌표 보정용. 일반 빵판 부품은 홀 스냅이라 보통 불필요 |

## Steps

1. **분류(직접)** — 절차(procedural)인가 GLB인가? DEC-024 기준: 단순부품(LED·저항·버튼류)=절차, 복잡부품(센서·디스플레이·모터)=GLB. 카테고리(`CATEGORIES`)에 속하나, 없으면 카테고리부터.
2. **⛔ 라이선스 게이트(GLB만, 직접)** — GLB면 **반드시 먼저**: 모델이 CC0/CC-BY/CC-BY-SA/MIT + 출처표기 가능한가? `assets/3d/_harvest/_QUARANTINE-no-license/`(무라이선스 37종)이면 **중단**. 저작권은 대회 규정과 무관한 법적 의무.
3. **PARTS 항목 추가(직접)** — `parts.ts`에 entry: `id·label·category·status·render·pins(role+label)·span·conducts` + 전기 메타(`operatingV·protocol·needsResistor·polarity·needsPullup` 등 해당 시). 진단 규칙(DEC-016)이 이 메타를 읽으므로 정확히.
4. **렌더 배선(직접)** —
   - **절차**: `render.builder` 문자열이 `BUILDERS`에 있나? 없으면 빌더 함수 추가.
   - **GLB**: ① `ASSET_CREDITS`에 항목(경로·author·license·`rendered:true`) ② `CREDITS.md` 표에 같은 행 ③ `GLB_PART_SPECS`에 스케일/오프셋(없으면 DEFAULT로 뜨나 크기 안 맞을 수 있음 → DEC-031 조작기 또는 코드 튜닝).
5. **상태 의미 확인** — 모델 미배포면 `staged`("준비 중" 칩, 팔레트 비활성). 배치 가능이면 `ready`.
6. **검증(직접)** — `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. 그 뒤 `pnpm dev`→`/build` **하드 새로고침**: 팔레트에 카드+썸네일 뜨나 · 드래그 고스트 · 홀에 배치 · (GLB) 모델 실제 렌더·스케일·방향.

## 불변식 (가드)

- **무라이선스 GLB 절대 등재 금지.** `ASSET_CREDITS`/`CREDITS.md`에 없는 GLB를 씬에 올리지 않는다.
- **GLB assetId 역해소(죽은 assetId 금지).** 모든 `render.kind:glb`의 `assetId`는 `ASSET_CREDITS` 엔트리 **+ 디스크 실파일(경로 글자까지 일치, 예 `.opt.glb`)**로 해소돼야 한다. 미해소 시 **에러 없이 조용히 "3D" 썸네일 폴백 + 씬 프록시 박스**라 놓치기 쉽다. 자산이 없으면 glb로 두지 말고 **절차 메시(DEC-002)로 전환**.
- **픽스처도 썸네일 대상.** 썸네일 생성기(`three/thumbnails.ts`)는 `CATALOG`(부품+픽스처) 순회. 핀 없는 픽스처(보드·빵판) 절차 빌더는 `BUILDERS`가 아니라 `thumbnails.ts` `FIXTURE_MESH`에 등록해야 카드에 미리보기가 뜬다.
- **하드코딩 금지(DEC-030).** 팔레트·씬·썸네일은 부품 목록을 직접 갖지 않는다 — 전부 `PARTS`/`CATALOG`에서 파생. 새 부품 = 레지스트리 항목 추가일 뿐.
- **핀 정밀도(DEC-003) 불변.** `span`은 홀 간격 단위. 스냅 로직(`round(v/2.54)*2.54`)은 건드리지 않는다.
- **정본 1곳.** `ASSET_CREDITS`와 `CREDITS.md`는 항상 일치. 결정이 생기면 DECISION-LOG, 상태는 PROJECT-STATUS.

## Verify

- [ ] `PARTS`(또는 `FIXTURES`)에 항목 1개 추가, `CATALOG` 자동 반영
- [ ] 절차=빌더 키 존재 / GLB=`ASSET_CREDITS`+`CREDITS.md`+`GLB_PART_SPECS` 3곳 조인
- [ ] (GLB) assetId가 `ASSET_CREDITS` 엔트리 + **디스크 실파일**로 해소(경로 글자 일치). 죽은 assetId면 "3D" 폴백으로 조용히 깨짐
- [ ] 팔레트 카드에 "3D" 폴백이 아니라 **실제 썸네일**이 뜨는지 브라우저 확인(픽스처 포함)
- [ ] GLB 라이선스 검증 통과(격리 폴더 아님), 출처표기 가능
- [ ] 게이트 4종 통과(typecheck·lint·test·build) + 브라우저 시각 확인
- [ ] 변경 시 PROJECT-STATUS Recent Changes/Next Actions 갱신(CLAUDE.md 규칙)

## Failure / Fallback

- 라이선스 불명/격리 모델 → **추가 중단**, 절차 모델링(DEC-024) 또는 합법 소싱(research/19) 재검토.
- GLB 스케일·방향 안 맞음 → `GLB_PART_SPECS` 튜닝(코드) 또는 DEC-031 인앱 조작기 구현 대기.
- 새 렌더 종류가 필요(절차·GLB 둘 다 아님) → `RenderStrategy` union 확장은 설계 변경 → DECISION-LOG에 결정 먼저.
