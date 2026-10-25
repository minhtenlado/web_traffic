const HORIZONS = [5, 15, 30] as const;
const CAMERA_IDS = new Set(["cam_01", "cam_02", "cam_03", "cam_04"]);
const TRAFFIC_CLASSES = new Set(["Khong_ket", "Dong", "Ket_nhe", "Ket_nang"]);

export type EdgeForecastRow = {
  camera_id: string;
  horizon_minutes: 5 | 15 | 30;
  predicted_class: string;
  confidence: number;
};

export function edgeHistoryProgress(status: Record<string, unknown> | null | undefined) {
  const rawSteps = Number(status?.history_steps);
  const rawRequired = Number(status?.history_required);
  const required = Number.isFinite(rawRequired) && rawRequired > 0 ? Math.floor(rawRequired) : 0;
  const steps = Number.isFinite(rawSteps) && rawSteps >= 0 ? Math.floor(rawSteps) : 0;
  return {
    steps,
    required,
    remaining: Math.max(0, required - steps),
    percent: required ? Math.min(100, Math.round((steps / required) * 100)) : 0,
  };
}

const HISTORY_REASONS: Record<string, string> = {
  loading_snapshot: "Đang kiểm tra lịch sử đã lưu.",
  restored: "Đã khôi phục lịch sử; đang chờ kết quả dự báo mới.",
  history_gap: "Lịch sử bị gián đoạn; đang thu thập lại chuỗi dữ liệu liên tục.",
  stale_history: "Lịch sử đã cũ; đang chờ dữ liệu mới từ camera.",
  incompatible_checkpoint: "Lịch sử đã lưu không phù hợp với mô hình hiện tại; đang thu thập lại.",
  invalid_snapshot: "Không khôi phục được lịch sử đã lưu; đang thu thập lại.",
  weather_unavailable: "Chưa có dữ liệu thời tiết để tạo dự báo mới.",
};

export function edgeTcnRecovery(status: Record<string, unknown> | null | undefined, live: boolean) {
  const progress = edgeHistoryProgress(status);
  const historyComplete = progress.required > 0 && progress.steps === progress.required;
  // Old devices omit tcn_state. Explicit recovery/invalid states always take precedence
  // over a cached forecast_status, so an interrupted history cannot appear as ready.
  const forecastReady = live && historyComplete && status?.weather_status === "AVAILABLE" &&
    status?.forecast_status === "EXPERIMENTAL" &&
    (status?.tcn_state === "FORECASTING" || status?.tcn_state === undefined);
  const state = forecastReady ? "FORECASTING" : live && status?.tcn_state === "RESTORING"
    ? "RESTORING" : "INSUFFICIENT_DATA";
  const label = state === "FORECASTING" ? "Đang dự báo" : state === "RESTORING"
    ? "Đang khôi phục" : "Chưa đủ dữ liệu";
  const reason = !live ? "Đang chờ bản tin mới từ Genio."
    : forecastReady ? "Lịch sử đầu vào đã sẵn sàng."
    : HISTORY_REASONS[String(status?.history_reason)] || (state === "RESTORING"
      ? "Đang kiểm tra lịch sử đã lưu."
      : status?.weather_status !== "AVAILABLE" ? HISTORY_REASONS.weather_unavailable
      : historyComplete ? "Đã đủ lịch sử; đang chờ kết quả dự báo mới."
      : "Đang thu thập lịch sử camera liên tục.");
  return { state, label, forecastReady, reason };
}

export function groupEdgeForecasts(value: unknown) {
  const groups: Record<5 | 15 | 30, EdgeForecastRow[]> = { 5: [], 15: [], 30: [] };
  if (!Array.isArray(value)) return groups;
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const horizon = Number(item.horizon_minutes);
    const confidence = Number(item.confidence);
    if (!HORIZONS.includes(horizon as 5 | 15 | 30) ||
        typeof item.camera_id !== "string" || !CAMERA_IDS.has(item.camera_id) ||
        typeof item.predicted_class !== "string" || !TRAFFIC_CLASSES.has(item.predicted_class) ||
        !Number.isFinite(confidence) || confidence < 0 || confidence > 1) continue;
    groups[horizon as 5 | 15 | 30].push({
      camera_id: item.camera_id,
      horizon_minutes: horizon as 5 | 15 | 30,
      predicted_class: item.predicted_class,
      confidence,
    });
  }
  for (const horizon of HORIZONS) {
    groups[horizon].sort((a, b) => a.camera_id.localeCompare(b.camera_id));
  }
  return groups;
}
