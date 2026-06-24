export {
  PITCH,
  ROW_LETTERS,
  RAILS,
  BREADBOARDS,
  activeBreadboard,
  setActiveBreadboard,
  colX,
  getHoles,
  getHoleMap,
  mainHoleId,
  boardDimensions,
  railZForStripe,
  nodeIdForHole,
} from "./breadboard";
export type {
  Hole,
  HoleKind,
  Rail,
  RowLetter,
  BreadboardId,
  BreadboardDef,
} from "./breadboard";

export {
  PARTS,
  PART_LIST,
  computePinHoles,
  placePart,
  placeFreePart,
  placeFreeAtAnchor,
  reanchorPart,
  moveFreeBody,
  rotateFreeBody,
  setLeadAnchor,
  freeBodyPos,
  partEndpoints,
  withLead,
} from "./parts";

export { CATEGORIES, STATUS_LABEL, FIXTURES, CATALOG } from "./catalog";
export type { CategoryMeta } from "./catalog";

export type {
  PinRole,
  PartPin,
  PartDef,
  CatalogItem,
  PlacedPart,
  Wire,
  CircuitModel,
  BoardPose,
  Layout,
  OperatingV,
  Protocol,
  ComponentCategory,
  ComponentStatus,
  RenderStrategy,
} from "./types";
export { DEFAULT_POSE } from "./types";

export { buildNet } from "./net";
export type { NetGraph, PartEdge } from "./net";

export { energizedRailsForNet } from "./powerVisualization";
export type { EnergizedRails, RailEnergization } from "./powerVisualization";

export { diagnose } from "./diagnose";
export type {
  Verdict,
  Finding,
  ErrorType,
  Misconception,
  Severity,
} from "./diagnose";

export { buildBom } from "./bom";
export type { BomItem } from "./bom";

export { buildNetlist } from "./netlist";
export type { Netlist, NetlistEntry, NetlistTerminal } from "./netlist";

export {
  serialize,
  serializeBom,
  serializeNetlist,
  holeLabel,
} from "./serialize";

export { encodeCircuit, decodeCircuit } from "./codec";

export { recommendNextStep } from "./recommendation";
export type { NextStep, StepPriority } from "./recommendation";

export {
  SUPPLY_V,
  LED_VF,
  DEFAULT_RESISTOR_OHM,
  ARDUINO_PIN_MAX_MA,
  ARDUINO_3V3_MAX_MA,
  ARDUINO_PWM_PINS,
  ARDUINO_PULLUP_OHM,
  LOGIC_HIGH_MIN_V,
  LOGIC_LOW_MAX_V,
  ledCurrentMa,
  recommendedResistor,
  isOvercurrent,
} from "./rules";

export { SCENARIOS } from "./scenarios";
export type { Scenario } from "./scenarios";

export {
  BOARDS,
  ARDUINO_MODEL_KEY,
  ARDUINO_PIN_DEFS,
  ESP32_PIN_DEFS,
  activeBoard,
  setActiveBoard,
  boardRefLabel,
  getBoardPins,
  getBoardPinMap,
  isBoardPowerPin,
  isBoardPinId,
} from "./board";
export type { BoardId, BoardDef, BoardPin, BoardPinDef, BoardPinRole } from "./board";

export { CALIB_TARGETS, getCalibTarget } from "./calibration";
export type { CalibTarget, CalibPoint } from "./calibration";
export { CALIBRATIONS, getCalibration } from "./calibration-data";
export type { Vec3 } from "./calibration-data";

export { occupiedHoles, synthesizeCircuit } from "./generate";
export type { PartSpec, SynthesisResult } from "./generate";
