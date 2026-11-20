/** Explicit count contract. Legacy class indices never become vehicle counts. */
export const TCN_OUTPUT_CAMERAS = ["cam_01", "cam_02", "cam_03", "cam_04"] as const;
export type CountPoint = { timestamp: number; time: string } & Record<string, number | string | null>;
export type ForecastRun = { originTimestamp: number; sessionId: string; predictions: CountPoint[] };

function countAt(point: CountPoint | undefined, camera: string) {
  const value = point?.[camera];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Keep a bounded, session-local record of forecasts as they are issued by Firebase. */
export function appendTCNForecastRun(previous: ForecastRun[] = [], forecast: any): ForecastRun[] {
  if (forecast?.status !== "EXPERIMENTAL" || !Array.isArray(forecast.rawHistory) ||
      !Array.isArray(forecast.rawPredictions) || forecast.rawHistory.length !== 120 ||
      forecast.rawPredictions.length !== 30) return previous;
  const originTimestamp = forecast.rawHistory[119]?.timestamp;
  const sessionId = String(forecast.sessionId || "unknown");
  if (!Number.isFinite(originTimestamp)) return previous;
  const sameSession = previous.length > 0 && previous.at(-1)?.sessionId === sessionId
    ? previous : [];
  if (sameSession.some(run => run.originTimestamp === originTimestamp) ||
      (sameSession.length && originTimestamp <= sameSession.at(-1)!.originTimestamp)) return sameSession;
  return [...sameSession, { originTimestamp, sessionId, predictions: forecast.rawPredictions }].slice(-240);
}

export function buildTCNForecastComparison(
  history: CountPoint[], runs: ForecastRun[], camera: string, horizonMinutes: 5 | 15 | 30,
) {
  const actualByTimestamp = new Map<number, number>();
  for (const point of history) {
    const value = countAt(point, camera);
    if (value !== null) actualByTimestamp.set(point.timestamp, value);
  }
  const currentTimestamp = history.at(-1)?.timestamp ?? 0;
  const firstTimestamp = history[0]?.timestamp ?? 0;
  const predictionsByTimestamp = new Map<number, { timestamp: number; predicted: number; originTimestamp: number }>();
  for (const run of runs) {
    const point = run.predictions[horizonMinutes - 1];
    const predicted = countAt(point, camera);
    if (!point || predicted === null || point.timestamp > currentTimestamp || point.timestamp < firstTimestamp) continue;
    const prior = predictionsByTimestamp.get(point.timestamp);
    if (!prior || run.originTimestamp > prior.originTimestamp) {
      predictionsByTimestamp.set(point.timestamp, { timestamp: point.timestamp, predicted, originTimestamp: run.originTimestamp });
    }
  }
  const sortedPredictions = [...predictionsByTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
  const historicalPredictions: Array<{ timestamp: number; predicted: number | null }> = [];
  sortedPredictions.forEach((point, index) => {
    if (index && point.timestamp - sortedPredictions[index - 1].timestamp > 60) {
      historicalPredictions.push({ timestamp: sortedPredictions[index - 1].timestamp + 60, predicted: null });
    }
    historicalPredictions.push({ timestamp: point.timestamp, predicted: point.predicted });
  });
  const errors = sortedPredictions.flatMap(point => {
    const actual = actualByTimestamp.get(point.timestamp);
    return actual === undefined ? [] : [point.predicted - actual];
  });
  const mae = errors.length ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / errors.length : null;
  const rmse = errors.length ? Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / errors.length) : null;
  const combined = history.map((point, index) => ({
    timestamp: point.timestamp,
    actual: countAt(point, camera),
    predicted: index === history.length - 1 ? countAt(point, camera) : null,
  }));
  return { historicalPredictions, combined, matchCount: errors.length, mae, rmse, currentTimestamp };
}

export function readTCNChart(data: any, now = Date.now() / 1000) {
  const empty = { rawHistory: [] as CountPoint[], rawPredictions: [] as CountPoint[],
    validUntil: 0, generatedAt: 0, sessionId: "", status: "UNAVAILABLE", kind: "vehicle_count", experimental: true,
    reason: "Chưa có dự báo mới đủ điều kiện.", modelVersion: "" };
  if (!data || data.schema_version !== 4 || data.kind !== "vehicle_count" ||
      data.experimental !== true || data.advisory_only !== true) return empty;
  const result = { ...empty, reason: String(data.reason || ""), modelVersion: String(data.model_version || "") };
  if (data.status !== "EXPERIMENTAL") return { ...result, status: "NOT_READY" };
  const fresh = Number.isFinite(data.generated_at) && now >= data.generated_at && now - data.generated_at <= 20 &&
    Number.isFinite(data.valid_until) && data.valid_until > now && data.valid_until <= data.generated_at + 60;
  if (!fresh) return { ...result, reason: "Dự báo hết hạn; đang chờ dữ liệu mới." };
  const list = (v: unknown): any[] => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
  const history = list(data.history), predictions = list(data.predictions);
  const validPoints = (rows: any[], future: boolean) => rows.every((row, i) => {
    if (!row || !Number.isFinite(row.timestamp) || typeof row.time !== "string" ||
        (i > 0 && row.timestamp - rows[i-1].timestamp !== 60)) return false;
    return TCN_OUTPUT_CAMERAS.every(c => (!future && (row[c] === null || row[c] === undefined)) ||
      (typeof row[c] === "number" && Number.isFinite(row[c]) && row[c] >= 0));
  });
  if (history.length !== 120 || predictions.length !== 30 || !validPoints(history, false) || !validPoints(predictions, true) ||
      history[119].timestamp > data.generated_at || data.generated_at - history[119].timestamp >= 60 ||
      predictions[0].timestamp !== history[119].timestamp + 60) {
    return { ...result, reason: "Dữ liệu dự báo không đúng hợp đồng 120/30 bước." };
  }
  const sessionParts = [data.boot_id, data.runtime_session_id, data.history_contract_id, data.model_version]
    .filter(value => typeof value === "string" && value.length > 0);
  return { ...result, rawHistory: history as CountPoint[], rawPredictions: predictions as CountPoint[],
    validUntil: data.valid_until, generatedAt: data.generated_at,
    sessionId: sessionParts.join("|") || "unknown", status: "EXPERIMENTAL" };
}
