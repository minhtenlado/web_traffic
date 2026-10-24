/** Explicit count contract. Legacy class indices never become vehicle counts. */
export const TCN_OUTPUT_CAMERAS = ["cam_01", "cam_02", "cam_03", "cam_04"] as const;
export type CountPoint = { timestamp: number; time: string } & Record<string, number | string | null>;

export function readTCNChart(data: any, now = Date.now() / 1000) {
  const empty = { rawHistory: [] as CountPoint[], rawPredictions: [] as CountPoint[],
    validUntil: 0, status: "UNAVAILABLE", kind: "vehicle_count", experimental: true,
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
  return { ...result, rawHistory: history as CountPoint[], rawPredictions: predictions as CountPoint[],
    validUntil: data.valid_until, status: "EXPERIMENTAL" };
}
