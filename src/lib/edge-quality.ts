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

export type EdgeMinuteHistoryValue = { count: number | null; source: "observed" | "imputed" | "missing" | "unknown" };
export type EdgeMinuteHistoryPoint = { timestamp: number; counts: Record<string, EdgeMinuteHistoryValue> };

/** Parse the existing /chart_data/latest history without treating estimates as observations. */
export function readEdgeMinuteHistory(data: any, nowMs = Date.now()): EdgeMinuteHistoryPoint[] {
  const rows = Array.isArray(data?.history) ? data.history
    : data?.history && typeof data.history === "object" ? Object.values(data.history) : [];
  const byTimestamp = new Map<number, EdgeMinuteHistoryPoint>();
  for (const row of rows) {
    const timestamp = epochSeconds(row?.timestamp);
    if (timestamp === null || timestamp <= 0 || timestamp > nowMs / 1000) continue;
    const counts: Record<string, EdgeMinuteHistoryValue> = {};
    for (const camera of MINUTE_CAMERA_IDS) {
      const rawSource = row?.data_sources?.[camera];
      const source: EdgeMinuteHistoryValue["source"] = rawSource === "observed" || rawSource === "imputed" || rawSource === "missing"
        ? rawSource : "unknown";
      const value = row?.counts?.[camera];
      const count = (source === "observed" || source === "imputed") && Number.isInteger(value) && value >= 0
        ? Number(value) : null;
      counts[camera] = { count, source };
    }
    if (Object.values(counts).some(value => value.count !== null)) byTimestamp.set(timestamp, { timestamp, counts });
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-120);
}

/** The current marker is the latest fresh YOLO image count, not a minute average. */
export function readEdgeCurrentCount(data: any, camera: string, nowMs = Date.now()) {
  const empty = null;
  const item = data?.cameras?.[camera];
  const timestamp = epochSeconds(item?.observed_at);
  if (!MINUTE_CAMERA_IDS.includes(camera as typeof MINUTE_CAMERA_IDS[number]) || !edgeSystemHealth(data, nowMs).fresh ||
      item?.status !== "fresh" || item?.data_source !== "observed" || timestamp === null || timestamp > nowMs / 1000 ||
      nowMs / 1000 - timestamp > 90 || !Number.isInteger(item?.vehicle_count) || item.vehicle_count < 0) return empty;
  return { timestamp, count: Number(item.vehicle_count) };
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

export type ForecastComparisonPoint = { timestamp: number; actual: number; forecast: number };

/** Return only same-target forecast/observed pairs and compute metrics for that camera/horizon. */
export function readEdgeForecastComparison(data: any, camera: string, horizon: number) {
  const empty = { points: [] as ForecastComparisonPoint[], samples: 0, mae: null as number | null, rmse: null as number | null };
  if (!MINUTE_CAMERA_IDS.includes(camera as typeof MINUTE_CAMERA_IDS[number]) || ![1, 5, 15, 30].includes(horizon) ||
      data?.source !== "observed_only_visible_count") return empty;
  const rows = data?.points?.[String(horizon)];
  if (!Array.isArray(rows)) return empty;
  const points: ForecastComparisonPoint[] = [];
  for (const row of rows) {
    const timestamp = epochSeconds(row?.target_minute);
    const actual = row?.observed_counts?.[camera];
    const forecast = row?.forecast_counts?.[camera];
    if (timestamp === null || !Number.isInteger(actual) || actual < 0 ||
        !Number.isInteger(forecast) || forecast < 0) continue;
    points.push({ timestamp, actual, forecast });
  }
  points.sort((a, b) => a.timestamp - b.timestamp);
  const errors = points.map(point => point.forecast - point.actual);
  return { points, samples: points.length,
    mae: errors.length ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length : null,
    rmse: errors.length ? Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length) : null };
}

/** Align historical forecasts to the visible minute-history window and preserve missing minutes as gaps. */
export function alignForecastComparisonToHistory(history: EdgeMinuteHistoryPoint[], points: ForecastComparisonPoint[]) {
  const empty = { points: [] as Array<{ timestamp: number; predicted: number | null }>,
    samples: 0, mae: null as number | null, rmse: null as number | null };
  if (!history.length) return empty;

  const start = history[0].timestamp;
  const end = history[history.length - 1].timestamp;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return empty;

  // History rows represent minute buckets. Start on an epoch-minute boundary so
  // target_minute values remain aligned even if an upstream timestamp has seconds.
  const firstMinute = Math.ceil(start / 60) * 60;
  const lastMinute = Math.floor(end / 60) * 60;
  const forecasts = new Map<number, ForecastComparisonPoint>();
  for (const point of points) {
    if (Number.isFinite(point.timestamp) && Number.isInteger(point.forecast) && point.forecast >= 0 &&
        Number.isInteger(point.actual) && point.actual >= 0 && point.timestamp >= start && point.timestamp <= end) {
      forecasts.set(point.timestamp, point);
    }
  }

  const aligned: Array<{ timestamp: number; predicted: number | null }> = [];
  const visibleComparisons: ForecastComparisonPoint[] = [];
  for (let timestamp = firstMinute; timestamp <= lastMinute; timestamp += 60) {
    const comparison = forecasts.get(timestamp);
    aligned.push({ timestamp, predicted: comparison?.forecast ?? null });
    if (comparison) visibleComparisons.push(comparison);
  }
  const errors = visibleComparisons.map(point => point.forecast - point.actual);
  return { points: aligned, samples: visibleComparisons.length,
    mae: errors.length ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length : null,
    rmse: errors.length ? Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length) : null };
}
