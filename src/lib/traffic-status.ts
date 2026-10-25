import { CAMERAS, DIRECTIONS, TRAFFIC_LABELS, LABEL_SEVERITY, type TrafficLabelKey } from "./constants";

export const CAMERA_TTL_SECONDS = 45;
export const ACTIVE_CAMERA_IDS = CAMERAS.filter(c => c.aiInput).map(c => c.id);

export function cameraView(record: any, nowMs = Date.now()) {
  const now = nowMs / 1000;
  const observed = Number(record?.last_update);
  const fresh = record?.status === "ONLINE" && Number.isFinite(observed) && observed > 0 &&
    now >= observed && now - observed <= CAMERA_TTL_SECONDS &&
    (record?.valid_until == null || Number(record.valid_until) > now);
  const aggregation = record?.aggregation;
  const label = record?.mapped_label as TrafficLabelKey;
  const votes = Object.values(aggregation?.counts || {});
  const validVotes = aggregation?.window_size === 10 && aggregation?.sample_count === 10 &&
    votes.length === 5 && votes.every(v => Number.isInteger(v) && Number(v) >= 0) &&
    votes.reduce<number>((sum, v) => sum + Number(v), 0) === 10;
  const ready = fresh && validVotes && aggregation?.status === "READY" &&
    aggregation?.label === label && !!TRAFFIC_LABELS[label];
  const count = fresh && Number.isFinite(record?.count) && record.count >= 0 ? Number(record.count) : null;
  const text = ready ? TRAFFIC_LABELS[label].text : !record ? "Chưa có dữ liệu AI" :
    record.status === "ERROR" ? "Lỗi thu thập" : !fresh ? "Chưa có dữ liệu mới" :
    aggregation?.status === "TIE" ? "Chưa rõ (hòa phiếu)" :
    `Đang thu thập ${aggregation?.sample_count ?? 0}/10`;
  const cls = ready ? TRAFFIC_LABELS[label].cls : record?.status === "ERROR" ? "red" : "cyan";
  return { fresh, ready, label: ready ? label : null, count, text, cls,
    aggregation: fresh ? aggregation : null };
}

export function buildRouteStats(records: Record<string, any>, nowMs = Date.now()) {
  return DIRECTIONS.map(direction => {
    const cameras = CAMERAS.filter(c => c.direction === direction.id && c.aiInput);
    const views = cameras.map(c => cameraView(records[c.id], nowMs));
    const labels = views.flatMap(v => v.label ? [v.label] : []);
    const worst = labels.sort((a, b) => LABEL_SEVERITY[b] - LABEL_SEVERITY[a])[0];
    const severity = worst ? LABEL_SEVERITY[worst] : null;
    return {
      id: direction.id, name: direction.name, cameras: cameras.map(c => c.name),
      isReference: cameras.length === 0,
      vehicleCount: views.reduce((sum, v) => sum + (v.count ?? 0), 0),
      hasData: views.some(v => v.count !== null), hasStatus: !!worst,
      coverage: labels.length, expectedCameras: cameras.length,
      // Ordinal severity, never measured road occupancy or confidence.
      density: severity === null ? 0 : severity * 25, severity,
      status: worst ? TRAFFIC_LABELS[worst].text : "Chưa đủ dữ liệu",
      statusColor: worst ? TRAFFIC_LABELS[worst].cls : "cyan" as const,
    };
  });
}

export function buildCameraAlerts(records: Record<string, any>, previous: any[], nowMs = Date.now()) {
  return ACTIVE_CAMERA_IDS.flatMap(id => {
    const view = cameraView(records[id], nowMs);
    const error = !!records[id] && !view.fresh;
    const congestion = view.ready && (view.label === "Ket_xe" || view.label === "Sap_ket");
    if (!error && !congestion) return [];
    const key = `alert-${id}-${error ? "err" : "cong"}`;
    const old = previous.find(a => a.id === key);
    const sourceAt = Number(records[id]?.last_update) * 1000;
    const estimatedAt = Number.isFinite(sourceAt) && sourceAt > 0
      ? error ? sourceAt + CAMERA_TTL_SECONDS * 1000 : sourceAt
      : nowMs;
    return [{ id: key, type: error ? "camera_error" : "congestion", label: error ? "Dữ liệu camera" : "Ùn tắc",
      color: error ? "amber" : "red", severity: error ? "warning" : "critical",
      message: `${CAMERAS.find(c => c.id === id)?.name}: ${view.text}`,
      timestamp: old?.timestamp ?? new Date(Math.min(estimatedAt, nowMs)).toISOString(), acknowledged: old?.acknowledged ?? false, camera: id }];
  });
}
