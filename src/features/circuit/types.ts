/** 회로 논리 모델 — 순수 도메인. 3D·React·LLM 의존 0. M3 net/diagnose 가 소비. */

/** 부품 핀 역할 (DEC-022 일반화: 거의 모든 센서 = VCC/GND/signal) */
export type PinRole =
  | "power"
  | "gnd"
  | "digital"
  | "analog"
  | "pwm"
  | "signal"
  | "switch"; // 릴레이 부하측 접점(COM/NO/NC)

/** 동작 전압 — 시중 부품 1:1 매칭 (DEC-027, research/16) */
export type OperatingV = "5V" | "3.3V" | "5V/3.3V";

/** 통신/신호 방식 — 시중 부품 1:1 매칭 (DEC-027, research/16) */
export type Protocol = "onoff" | "analog" | "pwm" | "i2c" | "1-wire";

/** 카탈로그 분류 (DEC-030) — 보드·빵판·입력·센서·출력·수동. 팔레트 그룹 = 이 값 */
export type ComponentCategory =
  | "board"
  | "breadboard"
  | "input"
  | "sensor"
  | "output"
  | "passive";

/**
 * 배치/적용 상태 — ready=즉시 배치, active=현재 작업대에 적용됨(보드·빵판),
 * glb-pending=배포 GLB 배치 대기(2단계), staged=미배포(스테이징). ready 외엔 비활성 표시.
 */
export type ComponentStatus = "ready" | "active" | "glb-pending" | "staged";

/**
 * 렌더 전략 (DEC-030) — 부품 메시를 어떻게 그릴지 선언만(구현은 breadboard-3d).
 * 새 렌더 종류가 생겨도 소비자(팔레트·씬·썸네일)는 kind 디스패치로 흡수.
 */
export type RenderStrategy =
  | { kind: "procedural"; builder: string } // three/parts BUILDERS 키
  | { kind: "glb"; assetId: string }; // assetCredits + CALIBRATIONS 키

export interface PartPin {
  role: PinRole;
  label: string;
}

/**
 * 카탈로그 표시 단위 (DEC-030) — 팔레트가 소비하는 공통 형태.
 * 부품(PartDef)·보드·빵판이 모두 이 형태로 표시된다. 배치 전용 필드(pins/span/conducts)는
 * 부품에서만 필수(PartDef). 보드/빵판은 표시 메타만 갖는다.
 */
export interface CatalogItem {
  id: string;
  label: string; // 한국어
  /** 카탈로그 분류 (팔레트 그룹) */
  category: ComponentCategory;
  /** 배치/적용 상태 */
  status: ComponentStatus;
  /** 렌더 전략 (절차 메시 | GLB) */
  render: RenderStrategy;
  /** 실물 유의사항 / 설명 (툴팁) */
  description?: string;
  // ── 표시 메타 (보드/빵판은 없음) ──
  /** 핀 정의 (부품) */
  pins?: PartPin[];
  /** 동작 전압 (실물 사양) */
  operatingV?: OperatingV;
  /** 신호 방식 */
  protocol?: Protocol;
  /** 직렬 저항 필요 (LED 등) */
  needsResistor?: boolean;
}

/** 빵판에 배치 가능한 부품 — CatalogItem + 배치/전기 메타 (DEC-022/027) */
export interface PartDef extends CatalogItem {
  /** 핀 정의 (배치엔 필수) */
  pins: PartPin[];
  /** 기본 배치 시 핀 사이 열 간격 */
  span: number;
  /** 내부 도통 쌍 [pinA, pinB] — net 그래프 간선. 첫 핀이 +/애노드 관례 */
  conducts: [number, number][];
  /** 극성 있음 (방향 중요) */
  polarity?: boolean;
  /** 대표 소비 전류 (mA) */
  currentMa?: number;
  /** 입력 안정화에 풀업 저항이 필요한 부품 (택트 버튼 등) */
  needsPullup?: boolean;
  /**
   * 장착 방식 — "board"(기본): 핀을 빵판 홀에 직접 꽂음 / "free": 본체는 보드 밖,
   * 각 핀이 점퍼 리드로 홀에 연결(서보·모터 등). 전기적으론 둘 다 "핀→홀 끝점"이라
   * net/진단은 partEndpoints() 로 단일 처리(DEC: 보드밖 부품).
   */
  mount?: "board" | "free";
  /**
   * 릴레이형 스위칭 접점 (pins 인덱스). 코일(제어 IN/VCC/GND)이 부하측 접점을 단속:
   * 여자(ON)=COM↔NO 도통, 휴지(OFF)=COM↔NC 도통. net.ts 가 이를 **간선**(병합 X)으로
   * 깔아 부하 회로가 접점을 통해 완결된다(거짓 단락 없음).
   * ⚠️ 정적 모델 한계: 펌웨어를 안 돌리므로 "지금 ON/OFF"는 모름 → 두 접점 경로를 모두
   *   깔아 배선 구조를 검증한다. 실시간 딸깍은 WebSerial 디지털 트윈(DEC-037) 영역.
   */
  relay?: { com: number; no: number; nc: number };
}

/** 빵판에 배치된 부품 인스턴스 */
export interface PlacedPart {
  uid: string;
  defId: string;
  /** 각 핀이 꽂힌 홀 id (def.pins 와 같은 순서). 보드밖(free)에선 빈 배열 — leads 사용 */
  pinHoles: string[];
  /** 0 | 1 : 가로(열 방향) | 세로(행 방향) */
  orientation: 0 | 1;
  /** 보드 장착 앵커 홀. 보드밖(free)에선 "" */
  anchorHoleId: string;
  // ── 보드밖(free) 전용 ──
  /** 장착 방식 (없으면 board) */
  mount?: "board" | "free";
  /** 보드 밖 본체 위치(보드 평면 mm, 음수·범위밖 허용) */
  bodyPos?: { x: number; z: number };
  /** 핀별 연결 끝점(holeId | AD_핀 | null=미연결). def.pins 와 같은 순서 */
  leads?: (string | null)[];
  /** free 본체 90° 스텝 회전(y축 yaw, 기본 0). board 장착 부품은 무시(orientation 사용) */
  rot?: 0 | 1 | 2 | 3;
  /**
   * free 리드(3선 등) 시작점 보정 — def.pins 순서, 모델 로컬 mm `[x,y,z]`(null=미보정).
   * 인스턴스별 in-page 보정값. 우선순위: 이 값 → CALIBRATIONS[assetId] → 합성.
   */
  leadAnchors?: ([number, number, number] | null)[];
}

/** 점퍼선 (홀 ↔ 홀) */
export interface Wire {
  id: string;
  a: string; // hole id
  b: string; // hole id
}

export interface CircuitModel {
  wires: Wire[];
  parts: PlacedPart[];
}

/**
 * 보드(빵판·아두이노)의 배치 — 기본 레이아웃 대비 델타.
 * 평면 이동(x,z mm)과 90° 스텝 회전(rot=0|1|2|3, y축 yaw)만 지원.
 * CircuitModel(전기 모델)에 넣지 않고 codec 봉투·뷰 상태에서만 다룬다(진단 무영향).
 */
export interface BoardPose {
  x: number; // mm, 기본 0
  z: number; // mm, 기본 0
  rot: 0 | 1 | 2 | 3; // 90° 스텝(반시계/시계는 렌더에서 정의)
}

/** 빵판·아두이노 배치 묶음 (둘 다 선택적, 생략=기본 레이아웃) */
export interface Layout {
  breadboard?: BoardPose;
  arduino?: BoardPose;
}

/** 기본 pose(이동·회전 없음) — 우발적 변형 방지 위해 동결 */
export const DEFAULT_POSE: BoardPose = Object.freeze({ x: 0, z: 0, rot: 0 });
