---
name: free-part-leads
description: >-
  핀메이트(PinMate) free 부품(서보 등 보드밖 GLB)의 리드선(피그테일)을 본체에
  정확히 붙이고 보정한다. GLB 변환(seatModel 오프셋 포함)을 리드가 1:1로 복제해야
  회전·이동·빵판 pose 에 무관하게 커넥터에 붙는다 — 이 계약을 어기면 "배치 땐 붙는데
  회전하면 어긋남" 버그가 난다. 트리거 — 서보 같은 free 부품 리드가 본체에서
  떨어지거나/엉뚱한 데 붙을 때, free 부품 추가·리드 보정·회전 정합, "선이 안 붙어",
  "회전하면 위치 변함", "리드 보정" 요청 시.
---

# free-part-leads — free 부품(GLB) 리드 정합·보정

## 언제
서보·외부전원부품 등 **보드밖(`mount:"free"`) GLB 부품**의 3선(신호·VCC·GND) 리드선을
본체 커넥터에 붙이거나, 회전/이동 시 어긋남을 고칠 때. 절차 부품(LED·저항)·보드장착
부품은 해당 없음(그건 [[model-calibrate]] / pinHoles).

## 핵심 아키텍처 (파일·흐름)
- 데이터: `circuit/parts.ts`(서보 def `mount:free`·`render.glb`) · `circuit/types.ts`
  (`PlacedPart.leadAnchors?`·`rot?`·`bodyPos`·`leads`) · `circuit/calibration-data.ts`
  (`CALIBRATIONS[assetId]` 기본 보정).
- 좌표 수학: **`three/picking/freeLeads.ts`** — `freeBodyPins`(본체 합성핀)·`leadBasis`·
  `freeLeadPins`(리드 시작점)·`freeLeadEnds`(피그테일 끝=암컷 커넥터)·`worldToLeadLocal`(역).
- 본체 렌더: `three/glbParts.ts` `buildGlbPart`(GLB 변환의 **단일 진실**)·`glbSpecFor`·`glbUrlFor`.
- 로더: `three/loadGlb.ts` `fitModel`/`seatModel`(bbox중심·바닥0 정렬) → `getGlbSourceSync`.
- 조립/인터랙션: `three/picking/createInteraction.ts` `buildFreeVisual`(피그테일+점퍼)·
  `renderFreePart`(마커)·리드 보정 모드 · `wiring/useWiring.ts` · `components/Scene.tsx`.

## ⚠️ 좌표 변환 계약 (성역 — 어기면 회전 버그)
리드(마커·피그테일 시작점)는 **본체 GLB와 글자 그대로 같은 변환**으로 배치해야 한다.
`buildGlbPart` 가 모델 로컬점 `V` 를 world 로 놓는 식 = `freeLeads.leadBasis` 가 복제하는 식:

```
world = (centroid + seat) + R_y(rotY)·(calib − seat)
  centroid = centroid(freeBodyPins(rot))        // = group.position (y=0)
  rotY     = spec.rotationY − axisAngle(bp)      // buildGlbPart 와 동일
  seat     = getGlbSourceSync(url).position      // seatModel 의 bbox중심 오프셋 ★
  yLift    = spec.yLift
  calib    = CALIBRATIONS[assetId].pin{i} 또는 인스턴스 leadAnchors[i]
```

★ **가장 중요**: `seat`(bbox중심 오프셋)는 `buildGlbPart` 에서 `inst.position`(=**회전과
무관한 고정 평행이동**)으로 들어간다. 따라서 리드도 `seat` 를 **회전에서 제외**해야 한다.
케이블 달린 서보는 bbox중심이 본체에서 멀어 `seat` 가 크다 → 빠뜨리면 회전 시
`[R(rotY)−I]·seat` 만큼 확 튄다.

- `glbParts.buildGlbPart` 와 `freeLeads.leadBasis/freeLeadPins/worldToLeadLocal` 는
  **좌표 계약을 공유** — 한쪽(centroid·rotY·yLift·seat·inst.position 처리)을 바꾸면
  반드시 양쪽 같이 갱신.

## 보정 방법 (둘, in-page 권장)
1. **in-page ⌖ 리드보정 (권장·자기일관)** — `/build`에서 free 부품 선택 → GuideBar
   "⌖ 리드보정" → **실제 본체의 커넥터를 직접 클릭**(pin0→1→2). `worldToLeadLocal`↔
   `freeLeadPins` 가 같은 `leadBasis` 짝이라 **클릭한 자리에 무조건 붙는다**(프레임 불일치
   원천 차단). 인스턴스 `leadAnchors` 에 저장 → codec/undo/`/view` 영속, `CALIBRATIONS` override.
2. **/calibrate (기본값용)** — 별도 씬에서 GLB 찍어 `CALIBRATIONS[assetId]` 에 붙여넣기
   ([[model-calibrate]] 파이프라인). 신규 인스턴스의 기본값. 프레임은 같지만 별도 씬이라
   오차 가능 → 어긋나면 in-page 로 덮어쓴다.

## 디버깅 체크리스트 (이번에 물린 함정들)
- **"배치 땐 붙는데 회전하면 어긋남"** = `seat` 오프셋을 회전에서 안 뺐다(위 ★). rot=0 에서
  `R−I=0` 이라 안 보이고 회전하면 드러나는 게 시그니처.
- **"고쳤는데 화면은 그대로"** = **HMR 은 이미 떠 있는 3D 씬(`createInteraction`, 마운트
  `useEffect`서 1회 생성)을 재생성하지 않는다.** 코드 고친 뒤 반드시 **하드 새로고침(⌘⇧R)**.
  dev 포트가 바뀌었을 수 있으니(3000↔3002) 로그 확인.
- **"선이 안 보임"** = 리드 미연결이어도 피그테일은 항상 그려야(실물 서보=선 상시). 캡은
  홀에 꽂힐 때만(`buildWire {capA,capB}`), 피그테일엔 캡 없음.
- **마커·구슬이 큼/확대 제한** = 마커 반지름·`OrbitControls.minDistance` 확인.
- 본체 배치는 합성핀(`freeBodyPins`) 유지(centroid=bodyPos·yaw=rot). 리드만 `leadBasis`로 분리.

## 검증
1. `pnpm typecheck && lint && test && build` exit 0.
2. 브라우저(하드 새로고침): ①서보 배치→리드 3선이 커넥터에 붙음 ②**R 0→1→2→3 회전마다
   리드가 본체 따라 붙어 돎** ③빵판 이동/회전 상태에서도 붙음 ④`/view?c=` 왕복 보존.
3. 진단 무영향 확인: `bodyPos/rot/leadAnchors` 는 geometry-only(net=leads, ID 기반).

## 관련 결정
DEC-041(free 소환·이동·90°회전) · DEC-041b(리드 보정 in-page) · DEC-042(이름표) ·
DEC-043(picking 분할). 상세 = `docs/status/DECISION-LOG.md`.
