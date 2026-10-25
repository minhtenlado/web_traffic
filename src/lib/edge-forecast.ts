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
