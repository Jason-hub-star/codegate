---
name: pinmate-asset-gen
description: >-
  핀메이트(PinMate)용 에디토리얼-안전 이미지 자산을 gpt-image-2로 생성한다. 브랜드
  마크/favicon, OG 공유이미지, empty/success 스팟 일러스트, 빵판·PCB 텍스처 등
  미리 정의된 템플릿 + 커스텀 프롬프트 지원. 모든 프롬프트에 에디토리얼 아카데믹
  제약(모노크롬·직각·타이포, 네온·캐릭터·마스코트 금지)이 자동 부착된다. 트리거 —
  "핀메이트 자산 생성", "OG 이미지 만들어", "favicon 생성", "브랜드 마크", "스팟
  일러스트", "빵판 텍스처 생성", "이미지 자산 만들어줘". 기본은 드라이런(과금 0),
  실제 생성은 --go 필요(~$1/장).
---

# 핀메이트 자산 생성 (gpt-image-2)

에디토리얼 아카데믹 제약이 박힌 이미지 자산을 생성한다. Vtube `generate_master_sheets.py`의
검증된 gpt-image-2 호출을 재사용하되, **캐릭터/마스코트가 아닌 에디토리얼 자산 전용**이다.

> ⚠️ Vtube의 vtuber-autorig(캐릭터) 파이프라인은 핀메이트에 쓰지 않는다 — AI슬롭(DEC-004).
> 계획·근거: `docs/ref/ASSET-PLAN.md` §2.

## 사용법

```bash
cd /Users/family/jason/codegate
SK=.claude/skills/pinmate-asset-gen/gen_asset.py

# 1) 드라이런 — 프롬프트만 확인 (과금 0). 항상 먼저.
python3 $SK --type brand-mark --name pinmate

# 2) 실제 생성 — --go (~$1/장). 산출: assets/generated/<type>-<name>.png + .json
python3 $SK --type og-image --name pinmate --go

# 3) 커스텀 프롬프트 (STYLE/AVOID 자동 부착)
python3 $SK --prompt "A minimal diagram of a jumper wire arc" --name wire --go

# 4) 이미지 edit (참조 PNG 기반 — 변형/정제)
python3 $SK --type brand-mark --name pinmate --ref draft.png --go
```

## 자산 타입 (템플릿)

| --type | 용도 | 기본 크기 |
|---|---|---|
| `brand-mark` | 브랜드 마크 / favicon (핀+짝꿍) | 1024² |
| `og-image` | OG/공유 배너 (1200×630은 후처리 크롭) | 1536×1024 |
| `spot-empty` | empty 상태 라인 일러스트 (빈 빵판) | 1024² |
| `spot-success` | success 상태 (켜진 LED, 은은) | 1024² |
| `texture-breadboard` | 빵판 매트 텍스처 (타일링 후확인) | 1024² |
| `texture-pcb` | PCB 매트 텍스처 | 1024² |
| (없음) `--prompt` | 임의 프롬프트 | 1024² |

## 옵션
`--name` 파일접두 · `--size`(1024x1024|1536x1024|1024x1536) · `--quality`(low|medium|high) ·
`--ref`(images/edits) · `--out`(기본 `assets/generated`) · `--go`(실제 생성).

## 제약 (자동 부착 — 스크립트 STYLE/AVOID)
- ✅ 따뜻한흰 #faf9f7 · 블랙 · 모노크롬 · 직각 · 타이포/기술도해 · 여백.
- ❌ 네온 · 보라/파랑 그라데이션 · 글래스모피즘 · 글로우 · 캐릭터/마스코트/얼굴 ·
  애니 · 광택 3D · 포토리얼 · 컬러풀 아이콘 · 이모지.

## 가드레일
- **키 비노출**: `~/.config/vtube/openai_api_key`(없으면 env `OPENAI_API_KEY`)에서만 읽음. 커밋·로그 금지.
- **과금 주의**: 기본 드라이런. `--go`만 호출. 청구 SSOT = OpenAI 콘솔.
- **에디토리얼 우선**: 아이콘은 lucide SVG, 빵판은 절차생성, 모델은 다운로드가 1순위. 이미지 생성은 *소수의 래스터*에만(ASSET-PLAN §2).
- **온보딩/스크린샷**: 실제 앱 화면 캡처가 생성 일러스트보다 정직·온브랜드 → 캡처 우선.
- 생성 후 PNG 존재·용량(>0) 확인하고 보고.
