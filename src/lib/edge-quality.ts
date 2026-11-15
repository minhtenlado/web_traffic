/** Additive /traffic/edgeAI recovery contract. All timestamps are UTC epoch seconds. */
export const EDGE_HEARTBEAT_TTL_SECONDS = 30;
export const MINUTE_CAMERA_IDS = ["cam_01", "cam_02", "cam_03", "cam_04", "cam_05"] as const;

const stepCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;

function epochSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // Require a timezone; browser locale must not move recovered minute timestamps.
  if (typeof value === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const parsed = Date.parse(value) / 1000;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function edgeHistoryQuality(status: Record<string, unknown> | null | undefined) {
  const required = stepCount(status?.history_required);
  const steps = stepCount(status?.history_steps);
  const observed = stepCount(status?.history_observed_steps);
  const imputed = stepCount(status?.history_imputed_steps);
  const missing = stepCount(status?.history_missing_steps);
  const interval = stepCount(status?.sample_interval_seconds) ?? (required === 720 ? 10 : null);
  const minuteContract = required === 120 && interval === 60;
  // Unknown provenance stays unknown; it must never become an observed count.
  const known = required !== null && steps !== null && observed !== null && imputed !== null && missing !== null &&
    steps <= required && observed + imputed + missing === steps;
  const eligible = status?.history_quality_eligible !== false && (!minuteContract ||
    (known && status?.history_quality_eligible === true && missing === 0));
  return { observed, imputed, missing, known, eligible, interval, minuteContract,
    imputedRatio: known && steps ? imputed! / steps : null };
}

export function edgeSystemHealth(data: any, nowMs = Date.now()) {
  const at = data?.generated_at;
  const now = nowMs / 1000;
  const ageSeconds = typeof at === "number" && Number.isFinite(at) && at > 0 && now >= at ? now - at : null;
  const fresh = data?.status?.online === true && ageSeconds !== null && ageSeconds <= EDGE_HEARTBEAT_TTL_SECONDS &&
    data?.status?.system_state !== "OFFLINE";
  const quality = edgeHistoryQuality(data?.status);
  const explicit = data?.status?.system_state;
  const state = !fresh ? "OFFLINE" : explicit === "DEGRADED" || data?.status?.clock_synchronized === false ? "DEGRADED"
    : explicit === "WARMUP" ? "WARMUP"
    : quality.minuteContract && !quality.eligible ? "DEGRADED"
    : data?.status?.history_ready === false || data?.status?.tcn_state === "RESTORING" ||
      (typeof data?.status?.history_required === "number" && data.status.history_steps < data.status.history_required) ? "WARMUP"
    : "ONLINE";
  const labels = { ONLINE: "ONLINE · đang hoạt động", OFFLINE: "OFFLINE · mất heartbeat", DEGRADED: "DEGRADED · dữ liệu chưa đạt", WARMUP: "WARMUP · đang tích lũy / khôi phục" };
  return { state, fresh, ageSeconds, label: labels[state], color: state === "ONLINE" ? "green" as const : "amber" as const };
}

export function edgeMinuteView(record: any, nowMs = Date.now()) {
  const timestamp = epochSeconds(record?.timestamp);
  const validTimestamp = timestamp !== null && timestamp > 0 && timestamp <= nowMs / 1000;
  const source = ["observed", "imputed", "missing"].includes(record?.data_source) ? String(record.data_source) : "unknown";
  const count = validTimestamp && source !== "missing" && source !== "unknown" &&
    Number.isInteger(record?.vehicle_count) && record.vehicle_count >= 0 ? Number(record.vehicle_count) : null;
  return { timestamp: validTimestamp ? timestamp as number : null, count, source,
    label: source === "observed" ? "Quan sát · trung bình phút" : source === "imputed" ? "Ước lượng bù" : source === "missing" ? "Thiếu dữ liệu" : "Chưa rõ nguồn",
    ageSeconds: validTimestamp ? nowMs / 1000 - timestamp! : null,
    confidence: typeof record?.confidence === "number" && Number.isFinite(record.confidence) && record.confidence >= 0 && record.confidence <= 1 ? Number(record.confidence) : null,
    method: typeof record?.imputation_method === "string" ? record.imputation_method : null };
}

export type MinuteForecastPoint = { horizon: number; timestamp: number } & Record<string, number>;

/** Select the count-only UI for V3 payloads; never infer counts from class forecasts. */
export function usesMinuteCountForecast(data: any) {
  if (data?.status?.history_required === 120) return true;
  return Array.isArray(data?.forecast?.points) && data.forecast.points.some((row: any) =>
    row?.counts && typeof row.counts === "object" && MINUTE_CAMERA_IDS.some(id => Object.hasOwn(row.counts, id)));
}

/** V3 counts have their own chart; count-derived labels are never classifier output. */
export function readEdgeMinuteForecast(data: any, nowMs = Date.now()) {
  const empty = { ready: false, points: [] as MinuteForecastPoint[], issuedAt: null as number | null };
  const status = data?.status;
  const quality = edgeHistoryQuality(status);
  const forecast = data?.forecast;
  const now = nowMs / 1000;
  const issuedAt = forecast?.issued_at;
  if (!edgeSystemHealth(data, nowMs).fresh || !quality.minuteContract || !quality.eligible ||
      status?.history_steps !== 120 || status?.history_contiguous_steps !== 120 || status?.history_ready !== true || status?.history_fresh === false ||
      status?.clock_synchronized !== true || status?.history_gaps_detected === true ||
      status?.system_state === "WARMUP" || String(status?.weather_status).toLowerCase() !== "available" ||
      forecast?.valid !== true || typeof issuedAt !== "number" || !Number.isFinite(issuedAt) ||
      issuedAt <= 0 || now < issuedAt || now - issuedAt > 90 || !Array.isArray(forecast.points) || forecast.points.length !== 30) return empty;
  const points: MinuteForecastPoint[] = [];
  for (let i = 0; i < 30; i++) {
    const row = forecast.points[i];
    const at = epochSeconds(row?.target_minute);
    if (row?.horizon !== i + 1 || at !== issuedAt + (i + 1) * 60 ||
        !MINUTE_CAMERA_IDS.every(id => Number.isInteger(row?.counts?.[id]) && row.counts[id] >= 0)) return empty;
    points.push({ horizon: i + 1, timestamp: at, ...Object.fromEntries(MINUTE_CAMERA_IDS.map(id => [id, row.counts[id]])) });
  }
  return { ready: true, points, issuedAt };
}
