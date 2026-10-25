export type HardwareTelemetry = {
  cpu: number | null;
  ram: number | null;
  temperature: number | null;
  networkLatency: number | null;
  fps: number | null;
  diskUsage: number | null;
  uptime: number | null;
  observedAt: number;
  source: string;
};

function bounded(value: unknown, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function timestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const result = value < 100_000_000_000 ? value * 1000 : value;
    return result > 0 ? result : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return timestampMs(numeric);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function genioTelemetry(data: any): HardwareTelemetry | null {
  if (!data || typeof data !== "object") return null;
  const echoAt = timestampMs(data.echoTimestamp);
  const ageMs = bounded(data.sampleAgeMs, 0, 60_000);
  if (echoAt === null || ageMs === null) return null;
  const observedAt = echoAt - ageMs;
  if (observedAt <= 0) return null;
  return {
    cpu: bounded(data.cpuPercent, 0, 100),
    ram: bounded(data.ramPercent, 0, 100),
    temperature: bounded(data.temperatureC, -20, 125),
    networkLatency: null,
    fps: null,
    diskUsage: bounded(data.dataUsedPercent, 0, 100) ?? bounded(data.rootUsedPercent, 0, 100),
    uptime: bounded(data.linuxUptimeSeconds, 0, 10_000_000_000),
    observedAt,
    source: "Genio 350 · GINFO qua UART STM32",
  };
}

export function legacyHardwareTelemetry(data: any): HardwareTelemetry | null {
  if (!data || typeof data !== "object") return null;
  const observedAt = timestampMs(data.timestamp ?? data.observed_at);
  if (observedAt === null) return null;
  return {
    cpu: bounded(data.cpu_usage, 0, 100),
    ram: bounded(data.ram_percent, 0, 100),
    temperature: bounded(data.cpu_temp, -20, 125),
    networkLatency: bounded(data.latency, 0, 120_000),
    fps: bounded(data.camera_fps, 0, 240),
    diskUsage: bounded(data.data_percent, 0, 100) ?? bounded(data.disk_percent, 0, 100),
    uptime: null,
    observedAt,
    source: "Genio 350 · telemetry hệ thống",
  };
}

export function newestTelemetry(...samples: Array<HardwareTelemetry | null>) {
  return samples.filter((sample): sample is HardwareTelemetry => sample !== null)
    .sort((a, b) => b.observedAt - a.observedAt)[0] ?? null;
}

export function telemetryIsFresh(sample: HardwareTelemetry | null | undefined, nowMs = Date.now(), ttlMs = 20_000) {
  if (!sample) return false;
  const age = nowMs - sample.observedAt;
  return age >= 0 && age <= ttlMs;
}
