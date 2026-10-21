/** Names and limits mirror STM32 traffic_app.c; do not infer yellow from time. */
export const CONTROLLER_PHASES = [
  "boot_allred", "ns_green", "ns_yellow", "after_ns_allred", "ns_left",
  "after_ns_left_allred", "ew_green", "ew_yellow", "after_ew_allred",
  "ew_left", "after_ew_left_allred",
] as const;
export type ControllerMode = "auto" | "manual" | "setting" | "emergency";
export type TimingKey = "green" | "yellow" | "left" | "allred";
export const TIMING_LIMITS: Record<TimingKey, [number, number]> = {
  green: [5, 90], yellow: [2, 9], left: [5, 30], allred: [1, 9],
};
export interface ControllerSignal {
  source: "STM32";
  mode: ControllerMode;
  currentPhase: string;
  countdown: number;
  phaseDurations: Record<TimingKey, number>;
  hold: boolean;
  timestamp: number;
  localControl?: boolean; buttonLayout?: number;
  greenEW?: number; leftEW?: number; planId?: number; protocol?: number;
}
export interface ControllerStatus {
  device: string;
  transport: string;
  online: boolean;
  lastSeen: number;
  metrics?: Record<string, number>;
  framesReceived?: number;
  maxHeartbeatGapMs?: number;
  timestamp: number;
}
export interface CommandResult { id: string; status: string; message: string; timestamp: number }
export function isControllerOnline(status: ControllerStatus | null, now = Date.now()) {
  return !!status?.online && now >= status.lastSeen * 1000 - 2000 && now - status.lastSeen * 1000 < 3000;
}
export function isControllerSignal(value: unknown): value is ControllerSignal {
  const s = value as ControllerSignal | null;
  return !!s && s.source === "STM32" &&
    ["auto", "manual", "setting", "emergency"].includes(s.mode) &&
    (CONTROLLER_PHASES as readonly string[]).includes(s.currentPhase) &&
    Number.isInteger(s.countdown) && s.countdown >= 0 && s.countdown <= 99 &&
    Number.isFinite(s.timestamp) && s.timestamp > 0 &&
    typeof s.hold === "boolean" && (s.localControl === undefined || typeof s.localControl === "boolean") && !!s.phaseDurations &&
    Object.entries(TIMING_LIMITS).every(([key, [lo, hi]]) => {
      const n = s.phaseDurations[key as TimingKey];
      return Number.isInteger(n) && n >= lo && n <= hi;
    });
}
export type AxisPlan = { greenNS: number; greenEW: number; leftNS: number; leftEW: number; yellow: number; allred: number };
export type ControllerCommand =
  | { action: "set_mode"; mode: "auto" | "manual" }
  | { action: "next" | "emergency" }
  | { action: "set_plan"; plan: AxisPlan; planId: number; validUntil: number }
  | { action: "set_duration"; phase: TimingKey; duration: number };
export async function sendControllerCommand(command: ControllerCommand): Promise<string> {
  const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const response = await fetch("/api/signal", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...command, id, timestamp: Date.now() }),
  });
  if (!response.ok) throw new Error("Không gửi được yêu cầu điều khiển STM32");
  return id;
}
