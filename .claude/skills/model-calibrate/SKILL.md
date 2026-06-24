---
name: model-calibrate
description: >-
  핀메이트(PinMate) GLB 모델의 핀/단자 좌표를 재사용 가능하게 보정한다. GLB는
  고정이라 코드로 핀 구멍 좌표를 알 수 없으므로 /calibrate 드래그드랍 도구로 한 번
  찍어 calibration-data 에 저장하고 배선·net 에 쓴다. 트리거 — 새 GLB 부품(보드/
  센서/서보 등)을 빵판과 배선해야 할 때, "모델 보정", "핀 좌표 찍기", "새 모델 배선",
  "calibrate", "보정 도구" 요청 시.
---

# model-calibrate — GLB 모델 핀 좌표 보정(재사용)

## 언제
새 GLB 부품(아두이노 외 센서·서보·디스플레이 등)을 빵판과 **배선**해야 할 때.
절차 부품(LED·저항 등 코드 생성)은 좌표를 이미 알므로 **불필요**.

## 핵심 개념
- 좌표는 **모델 그룹 로컬 mm**(원점·바닥 y=0). 보드 위치와 무관 → 어디 놓아도 정렬됨.
- 보정 결과는 `src/features/circuit/calibration-data.ts` 의 `CALIBRATIONS[modelKey]` 에 저장 → 런타임 재사용.
- 보정 도구는 `/calibrate`, 레지스트리는 `src/features/circuit/calibration.ts` 의 `CALIB_TARGETS`.

## 절차
1. **GLB 최적화** (필수 점검):
   - `KHR_materials_pbrSpecularGlossiness` 쓰면 three r184에서 **흰색**으로 뜸 → `gltf-transform metalrough` 로 변환.
   - 무거우면 텍스처 `resize`(예 1024) + `webp`. 결과를 `public/assets/<...>/<name>.opt.glb` 로.
   - GLB 내장 `Floor`/배경 평면 있으면 `removeFloor:true`(loadGlb 가 제거).
   ```bash
   npx @gltf-transform/cli metalrough in.glb _mr.glb
   npx @gltf-transform/cli resize _mr.glb _rs.glb --width 1024 --height 1024
   npx @gltf-transform/cli webp _rs.glb out.opt.glb
   ```
2. **레지스트리 등록** — `calibration.ts` 의 `CALIB_TARGETS` 에 항목 추가:
   ```ts
   { key:"hc-sr04", label:"초음파 HC-SR04", glbUrl:"/assets/.../hcsr04.opt.glb",
     scaleLen:45, removeFloor:true,
     points:[{id:"SR_VCC",label:"VCC"},{id:"SR_TRIG",label:"TRIG"},
             {id:"SR_ECHO",label:"ECHO"},{id:"SR_GND",label:"GND"}] }
   ```
   - `id` = 배선 엔드포인트 노드 id. 모델별 접두사로 충돌 방지(아두이노=`AD_`).
3. **보정** — `/calibrate` 열고 상단 드롭다운에서 모델 선택 → **배치 모드** → 점 목록에서
   하나 고르고 모델 표면의 해당 위치 클릭/드래그(표면 스냅) → 전부 찍으면 **JSON 내보내기(복사)**.
   (시점 돌릴 땐 회전 모드 토글)
4. **저장** — 복사된 JSON을 `calibration-data.ts` 의 `CALIBRATIONS["<key>"]` 에 붙여넣기.
5. **소비(배선·진단)**:
   - 렌더: `getCalibration(key)` 좌표 + 모델 오프셋으로 클릭 가능한 핀 마커 InstancedMesh 생성(예 `Scene.tsx` 의 아두이노 핀).
   - 배선: 점 id를 엔드포인트로 → `picking.ts` 가 빵판 홀과 동일하게 처리.
   - 진단: `net.ts` 에서 점 id를 노드로. 전원/그라운드/신호 역할 부여(아두이노 `POWER_ROLES`/`gnd` 참고).
6. **검증**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, `/calibrate`·`/build` 확인.

## 규칙
- 좌표를 페이지에 하드코딩 금지 → 반드시 `calibration-data.ts` 저장소 경유(재사용).
- 좌표계는 모델 그룹 로컬(원점·바닥 y=0). `loadGlbInto` 가 스케일-핏·바닥정렬 보장.
- 라이선스: 외부 GLB는 출처·라이선스 확인, CC-BY면 화면 크레딧 표기(아두이노 `/build` 푸터 참고).
- 변경 후 `/docsync` 로 정본 갱신.

## 참고 파일
- 도구: `src/app/calibrate/page.tsx`
- 레지스트리: `src/features/circuit/calibration.ts`
- 저장소: `src/features/circuit/calibration-data.ts`
- 로더: `src/features/breadboard-3d/three/loadGlb.ts`
- 레퍼런스 구현(아두이노): `src/features/circuit/arduino.ts`, DEC-025
