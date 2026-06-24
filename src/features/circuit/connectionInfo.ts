import { getBoardPinMap, type BoardPin, type BoardPinRole } from "./board";
import { getHoleMap, nodeIdForHole } from "./breadboard";
import { buildNet } from "./net";
import { PARTS, partEndpoints } from "./parts";
import type { CircuitModel, PartDef, PartPin, PlacedPart, Wire } from "./types";

export interface EndpointInfo {
  id: string;
  label: string;
  shortLabel: string;
  role: string;
}

export interface PinConnectionInfo {
  pin: string;
  role: string;
  endpoint: string;
  endpointLabel: string;
}

export interface PartConnectionInfo {
  title: string;
  rows: PinConnectionInfo[];
}

export interface WireConnectionInfo {
  title: string;
  label: string;
  from: EndpointInfo;
  to: EndpointInfo;
}

export interface ConnectionListItem {
  id: string;
  label: string;
  title: string;
}

interface PartTerminal {
  part: PlacedPart;
  def: PartDef;
  pin: PartPin;
  pinIndex: number;
  endpoint: string;
}

const roleLabel = (role: string): string => {
  if (role === "power") return "VCC";
  if (role === "gnd") return "GND";
  if (role === "pwm") return "SIG/PWM";
  if (role === "digital") return "DIGITAL";
  if (role === "analog") return "ANALOG";
  return "SIG";
};

const boardRoleLabel = (role: BoardPinRole, peer?: PartTerminal): string => {
  if (role === "power5") return "5V";
  if (role === "power3v3") return "3.3V";
  if (role === "vin") return "VIN";
  if (role === "gnd") return "GND";
  if (role === "pwm") return "PWM";
  if (role === "analog") return "ANALOG";
  if (role === "digital" && peer?.def.category === "input") return "INPUT";
  if (role === "digital" && peer?.def.category === "output") return "OUTPUT";
  return "DIGITAL";
};

const boardPinLabel = (pin: BoardPin, peer?: PartTerminal): EndpointInfo => {
  const role = boardRoleLabel(pin.role, peer);
  const pinLabel =
    (pin.role === "digital" || pin.role === "pwm") && /^\d+$/.test(pin.label)
      ? `D${pin.label}`
      : pin.label;
  return {
    id: pin.id,
    label: `${pinLabel} ${role}`,
    shortLabel: role === pinLabel ? role : `${pinLabel} ${role}`,
    role,
  };
};

const compactPartLabel = (label: string): string =>
  label.replace(/\s*\(.+\)\s*$/, "").replace(" 모터", "");

const partTerminalLabel = (t: PartTerminal): EndpointInfo => {
  const role = roleLabel(t.pin.role);
  const name = compactPartLabel(t.def.label);
  return {
    id: t.endpoint,
    label: `${t.def.label} ${t.pin.label} (${role})`,
    shortLabel: `${name} ${role}`,
    role,
  };
};

export function connectionIdForLead(partUid: string, pinIndex: number): string {
  return `lead:${partUid}:${pinIndex}`;
}

export function parseLeadConnectionId(
  id: string | null,
): { uid: string; pinIndex: number } | null {
  if (!id) return null;
  const m = /^lead:([^:]+):(\d+)$/.exec(id);
  if (!m) return null;
  return { uid: m[1], pinIndex: Number(m[2]) };
}

export function connectionDebugId(id: string): string {
  const lead = parseLeadConnectionId(id);
  return lead ? `${lead.uid}-L${lead.pinIndex + 1}` : id;
}

const railLabel = (id: string): EndpointInfo | null => {
  const m = /^([TB])([+-])_(\d+)$/.exec(id);
  if (!m) return null;
  const sign = m[2] === "+" ? "+" : "-";
  const role = sign === "+" ? "rail +" : "rail -";
  return {
    id,
    label: `${sign} rail (${m[1]}${m[3]})`,
    shortLabel: `${sign} rail`,
    role,
  };
};

const holeLabel = (id: string): EndpointInfo => ({
  id,
  label: `빵판 ${id}`,
  shortLabel: id,
  role: "hole",
});

function partTerminals(model: CircuitModel): PartTerminal[] {
  const out: PartTerminal[] = [];
  for (const part of model.parts) {
    const def = PARTS[part.defId];
    if (!def) continue;
    partEndpoints(part).forEach((endpoint, pinIndex) => {
      if (!endpoint) return;
      out.push({ part, def, pin: def.pins[pinIndex], pinIndex, endpoint });
    });
  }
  return out;
}

function terminalOnEndpoint(
  model: CircuitModel,
  endpoint: string,
): PartTerminal | undefined {
  const terminals = partTerminals(model);
  const exact = terminals.find((t) => t.endpoint === endpoint);
  if (exact) return exact;
  const hole = getHoleMap().get(endpoint);
  if (hole) {
    const rawNode = nodeIdForHole(hole);
    const sameBreadboardNode = terminals.find((t) => {
      const terminalHole = getHoleMap().get(t.endpoint);
      return terminalHole ? nodeIdForHole(terminalHole) === rawNode : false;
    });
    if (sameBreadboardNode) return sameBreadboardNode;
  }
  const net = buildNet(model);
  const root = net.nodeOfHole(endpoint);
  if (!root) return undefined;
  return terminals.find((t) => net.nodeOfHole(t.endpoint) === root);
}

export function describeEndpoint(
  model: CircuitModel,
  endpoint: string,
  peer?: PartTerminal,
): EndpointInfo {
  const boardPin = getBoardPinMap().get(endpoint);
  if (boardPin) return boardPinLabel(boardPin, peer);
  const rail = railLabel(endpoint);
  if (rail) return rail;
  const terminal = terminalOnEndpoint(model, endpoint);
  if (terminal) return partTerminalLabel(terminal);
  return holeLabel(endpoint);
}

function describeEndpointLocation(endpoint: string, peer?: PartTerminal): EndpointInfo {
  const boardPin = getBoardPinMap().get(endpoint);
  if (boardPin) return boardPinLabel(boardPin, peer);
  const rail = railLabel(endpoint);
  if (rail) return rail;
  return holeLabel(endpoint);
}

export function describeWireConnection(
  model: CircuitModel,
  wireId: string | null,
): WireConnectionInfo | null {
  return describeConnection(model, wireId);
}

export function describeConnection(
  model: CircuitModel,
  connectionId: string | null,
): WireConnectionInfo | null {
  if (!connectionId) return null;
  const lead = parseLeadConnectionId(connectionId);
  if (lead) return describeLeadConnection(model, lead.uid, lead.pinIndex);

  const wire = model.wires.find((w) => w.id === connectionId);
  if (!wire) return null;
  return describeWire(model, wire);
}

export function describeWire(model: CircuitModel, wire: Wire): WireConnectionInfo {
  const aPeer = terminalOnEndpoint(model, wire.b);
  const bPeer = terminalOnEndpoint(model, wire.a);
  const from = describeEndpoint(model, wire.a, aPeer);
  const to = describeEndpoint(model, wire.b, bPeer);
  const label = `${from.shortLabel} → ${to.shortLabel}`;
  return { title: "선택한 선", label, from, to };
}

export function wireDebugLabel(model: CircuitModel, wire: Wire): string {
  return describeWire(model, wire).label;
}

function describeLeadConnection(
  model: CircuitModel,
  uid: string,
  pinIndex: number,
): WireConnectionInfo | null {
  const part = model.parts.find((p) => p.uid === uid);
  if (!part || part.mount !== "free") return null;
  const def = PARTS[part.defId];
  const pin = def?.pins[pinIndex];
  if (!def || !pin) return null;
  const endpoint = partEndpoints(part)[pinIndex] ?? null;
  const from = partTerminalLabel({
    part,
    def,
    pin,
    pinIndex,
    endpoint: endpoint ?? connectionIdForLead(uid, pinIndex),
  });
  const to = endpoint
    ? describeEndpointLocation(endpoint, { part, def, pin, pinIndex, endpoint })
    : {
        id: "",
        label: "미연결",
        shortLabel: "미연결",
        role: "unconnected",
      };
  return {
    title: "선택한 리드",
    label: `${from.shortLabel} → ${to.shortLabel}`,
    from,
    to,
  };
}

export function listConnections(model: CircuitModel): ConnectionListItem[] {
  const wireItems = model.wires.map((wire) => {
    const info = describeWire(model, wire);
    return { id: wire.id, label: info.label, title: info.title };
  });
  const leadItems = model.parts.flatMap((part) => {
    if (part.mount !== "free") return [];
    const def = PARTS[part.defId];
    if (!def) return [];
    return def.pins
      .map((_, pinIndex) => {
        const id = connectionIdForLead(part.uid, pinIndex);
        const info = describeConnection(model, id);
        return info ? { id, label: info.label, title: info.title } : null;
      })
      .filter((item): item is ConnectionListItem => Boolean(item));
  });
  return [...wireItems, ...leadItems];
}

export function describePartConnection(
  model: CircuitModel,
  uid: string | null,
): PartConnectionInfo | null {
  if (!uid) return null;
  const part = model.parts.find((p) => p.uid === uid);
  if (!part) return null;
  const def = PARTS[part.defId];
  if (!def) return null;
  const endpoints = partEndpoints(part);
  return {
    title: def.label,
    rows: def.pins.map((pin, i) => {
      const endpoint = endpoints[i] ?? "";
      return {
        pin: `${pin.label} (${roleLabel(pin.role)})`,
        role: roleLabel(pin.role),
        endpoint: endpoint || "미연결",
        endpointLabel: endpoint ? describeEndpoint(model, endpoint).label : "미연결",
      };
    }),
  };
}

export function pinRoleDebugLabel(pin: PartPin): string {
  return roleLabel(pin.role);
}
