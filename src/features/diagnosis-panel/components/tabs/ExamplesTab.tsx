"use client";

import { SCENARIOS, type Scenario } from "@/features/circuit";

const EXAMPLES = [
  "ledCorrect",
  "ledNoResistor",
  "ledReversed",
  "shortCircuit",
  "servoButtonViaRails",
  "relayControl",
  "relayPumpExternal",
  "laserTripwire",
  "laserButton",
  "ldrAutoLight",
  "pirBuzzerAlarm",
  "pirServoDoor",
  "potServoKnob",
  "dht11OledWeather",
  "ldrNeopixelNightLight",
  "ultrasonicParkingAlarm",
  "soilPumpAutoWatering",
] as const;

/** 예제 탭 — 프리셋 회로 불러오기(물리·논리 공존, 논리는 빵판 적응). */
export function ExamplesTab({ onLoad }: { onLoad: (sc: Scenario) => void }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">예제 불러오기</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {EXAMPLES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onLoad(SCENARIOS[id])}
            className="border border-border-soft bg-card px-2 py-1.5 text-left text-[11px] hover:bg-surface-2"
          >
            {SCENARIOS[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}
