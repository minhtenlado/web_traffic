import { CAMERAS, DIRECTIONS, TRAFFIC_LABELS, EDGE_TRAFFIC_LABELS, type TrafficLabelKey } from "./constants";

export const CAMERA_TTL_SECONDS = 45;
export const EDGE_TTL_SECONDS = 30;
export const EDGE_CAMERA_TTL_SECONDS = 45;
export const ACTIVE_CAMERA_IDS = CAMERAS.filter(c => c.aiInput).map(c => c.id);

export { EDGE_TRAFFIC_LABELS } from "./constants";

export function edgePayloadIsFresh(data: any, nowMs = Date.now()) {
  const generatedAt = Number(data?.generated_at);
  const now = nowMs / 1000;
  return data?.status?.online === true && Number.isFinite(generatedAt) && generatedAt > 0 &&
    now >= generatedAt && now - generatedAt <= EDGE_TTL_SECONDS;
}

/** Live Genio output is shown separately from the legacy, ten-vote traffic state. */
export function edgeCameraView(record: any, payloadFresh: boolean, nowMs = Date.now()) {
  const observedAt = Number(record?.observed_at);
  const now = nowMs / 1000;
  const hasTimestamp = Number.isFinite(observedAt) && observedAt > 0 && now >= observedAt;
  const ageSeconds = hasTimestamp ? now - observedAt : null;
  const status = String(record?.status || "").toLowerCase();
  const rawCount = Number.isInteger(record?.vehicle_count) && record.vehicle_count >= 0
    ? Number(record.vehicle_count) : null;
  const rawLabel = String(record?.label || "");
  const validRawLabel = EDGE_TRAFFIC_LABELS[rawLabel] ? rawLabel : null;
  const stability = record?.classification_stability || null;
  const stabilizationMode = ["disabled", "shadow", "display"].includes(String(stability?.mode))
    ? String(stability.mode) : "legacy";
  const stableState = String(stability?.stable_state || "");
  const stableLabel = stability?.data_status === "VALID" && stability?.data_valid === true &&
    EDGE_TRAFFIC_LABELS[stableState] ? stableState : null;
  const stableAt = Number(stability?.last_valid_timestamp);
  const stableAge = Number(stability?.observation_age_seconds);
  const stableFresh = payloadFresh && stabilizationMode === "display" && stableLabel !== null &&
    Number.isFinite(stableAge) && stableAge >= 0 && stableAge <= EDGE_TTL_SECONDS &&
    Number.isFinite(stableAt) && stableAt > 0 && now >= stableAt && now - stableAt <= EDGE_TTL_SECONDS;
  // A reused image may retain its result until expiry, but never advances observation time.
  const observationFresh = payloadFresh && hasTimestamp && ageSeconds !== null &&
    ageSeconds <= EDGE_CAMERA_TTL_SECONDS && ["fresh", "reused"].includes(status);
  const count = observationFresh ? rawCount : null;
  const label = stabilizationMode === "display" ? (stableFresh ? stableLabel : null)
    : observationFresh ? validRawLabel : null;
  const effectiveObservedAt = hasTimestamp ? observedAt : stableFresh ? stableAt : NaN;
  const effectiveAge = Number.isFinite(effectiveObservedAt) ? now - effectiveObservedAt : null;
  const available = Number.isFinite(effectiveObservedAt) && (rawCount !== null || stableLabel !== null || validRawLabel !== null);
  const fresh = count !== null || label !== null;
  const pending = stability?.pending_transition;
  const stabilizationText = stabilizationMode !== "display" ? null
    : stability?.data_status === "STALE" ? "Nhãn ổn định đã cũ"
    : pending?.state ? `Đang xác nhận (${pending.count}/${pending.required} ảnh)`
    : "Chưa đủ ảnh xác nhận";
  return {
    available, fresh, count, label, newObservation: observationFresh && status === "fresh", labelInfo: label ? EDGE_TRAFFIC_LABELS[label] : null,
    rawLabel: validRawLabel, rawLabelInfo: validRawLabel ? EDGE_TRAFFIC_LABELS[validRawLabel] : null,
    stableLabel, stableLabelInfo: stableLabel ? EDGE_TRAFFIC_LABELS[stableLabel] : null,
    stableConfidence: Number.isFinite(stability?.stable_confidence) && stability.stable_confidence >= 0 && stability.stable_confidence <= 1 ? Number(stability.stable_confidence) : null,
    stabilizationMode, stabilizationStatus: stability?.data_status || "UNKNOWN", stabilizationText,
    pendingTransition: pending || null, observedAt: Number.isFinite(effectiveObservedAt) ? effectiveObservedAt : null,
    ageSeconds: effectiveAge, status,
    labelSource: typeof record?.label_source === "string" ? record.label_source : null,
  };
}

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

/** Display-only adapter for the historic five-bin aggregate. Raw IDs stay untouched. */
const LEGACY_DISPLAY_CLASS: Record<string, string> = {
  Duong_vang: "Khong_ket", Binh_thuong: "Khong_ket", Dong_xe: "Dong", Sap_ket: "Ket_nhe", Ket_xe: "Ket_nang",
};
export const EDGE_LABEL_SEVERITY: Record<string, number> = { Khong_ket: 0, Dong: 1, Ket_nhe: 2, Ket_nang: 3 };

/** The Genio feed owns all current views once present, including missing/expired cameras. */
export function selectedCameraView(id: string, records: Record<string, any> | null | undefined,
  edgeAI: any, nowMs = Date.now()) {
  if (edgeAI != null) {
    const view = edgeCameraView(edgeAI.cameras?.[id], edgePayloadIsFresh(edgeAI, nowMs), nowMs);
    const text = view.labelInfo?.text || (!view.fresh ? view.available ? "Dữ liệu AI đã cũ" : "Chưa có kết quả AI"
      : view.stabilizationMode === "display" ? view.stabilizationText || "Đang xác nhận nhãn" : "Chưa phân loại");
    return { ...view, ready: view.label !== null, text,
      cls: view.labelInfo?.cls || (!view.fresh && view.available ? "amber" as const : "cyan" as const),
      source: "edge" as const, aggregation: null };
  }
  const record = records?.[id];
  const legacy = cameraView(record, nowMs);
  const label = legacy.label ? LEGACY_DISPLAY_CLASS[legacy.label] ?? null : null;
  const observedAt = Number(record?.last_update);
  const at = Number.isFinite(observedAt) && observedAt > 0 && observedAt <= nowMs / 1000 ? observedAt : null;
  return { ...edgeCameraView(null, false, nowMs), ...legacy, label,
    labelInfo: label ? EDGE_TRAFFIC_LABELS[label] : null, text: label ? EDGE_TRAFFIC_LABELS[label].text : legacy.text,
    cls: label ? EDGE_TRAFFIC_LABELS[label].cls : legacy.cls,
    source: "legacy" as const, available: at !== null, observedAt: at,
    ageSeconds: at === null ? null : nowMs / 1000 - at, newObservation: legacy.fresh };
}

export function buildRouteStats(records: Record<string, any>, nowMs = Date.now(), edgeAI: any = null) {
  return DIRECTIONS.map(direction => {
    const cameras = CAMERAS.filter(c => c.direction === direction.id && c.aiInput);
    const views = cameras.map(c => selectedCameraView(c.id, records, edgeAI, nowMs));
    const labels = views.flatMap(v => v.label ? [v.label] : []);
    const worst = labels.sort((a, b) => EDGE_LABEL_SEVERITY[b] - EDGE_LABEL_SEVERITY[a])[0];
    const severity = worst ? EDGE_LABEL_SEVERITY[worst] : null;
    return {
      id: direction.id, name: direction.name, cameras: cameras.map(c => c.name),
      isReference: cameras.length === 0,
      vehicleCount: views.reduce((sum, v) => sum + (v.count ?? 0), 0),
      hasData: views.some(v => v.count !== null), hasStatus: !!worst,
      coverage: labels.length, expectedCameras: cameras.length,
      // Ordinal severity, never measured road occupancy or confidence.
      density: severity === null ? 0 : severity / 3 * 100, severity,
      status: worst ? EDGE_TRAFFIC_LABELS[worst].text : "Chưa đủ dữ liệu",
      statusColor: worst ? EDGE_TRAFFIC_LABELS[worst].cls : "cyan" as const,
    };
  });
}

export function buildCameraAlerts(records: Record<string, any>, previous: any[], nowMs = Date.now(), edgeAI: any = null) {
  return ACTIVE_CAMERA_IDS.flatMap(id => {
    const view = selectedCameraView(id, records, edgeAI, nowMs);
    const error = (edgeAI != null || !!records[id]) && !view.fresh;
    const congestion = view.ready && (view.label === "Ket_nang" || view.label === "Ket_nhe");
    if (!error && !congestion) return [];
    const key = `alert-${id}-${error ? "err" : "cong"}`;
    const old = previous.find(a => a.id === key);
    const sourceAt = (view.observedAt ?? 0) * 1000;
    const estimatedAt = sourceAt > 0 ? error ? sourceAt + CAMERA_TTL_SECONDS * 1000 : sourceAt : nowMs;
    return [{ id: key, type: error ? "camera_error" : "congestion", label: error ? "Dữ liệu camera" : "Giao thông đông",
      color: error || view.label === "Ket_nhe" ? "amber" : "red", severity: error || view.label === "Ket_nhe" ? "warning" : "critical",
      message: `${CAMERAS.find(c => c.id === id)?.name}: ${view.text}`,
      timestamp: old?.timestamp ?? new Date(Math.min(estimatedAt, nowMs)).toISOString(), acknowledged: old?.acknowledged ?? false, camera: id }];
  });
}

export type CameraHistoryPoint = { timestamp: number; time: string; total?: number } & Record<string, number | string | undefined>;

/** Sample on new camera observation timestamps, never on SSE arrival or heartbeat. */
export function appendCameraHistory(history: CameraHistoryPoint[], records: Record<string, any>, edgeAI: any, nowMs = Date.now()) {
  const source = edgeAI != null ? "edge" : "legacy";
  const old = history.at(-1)?.source === source ? history : [];
  const previous = old.at(-1);
  const views = ACTIVE_CAMERA_IDS.map(id => ({ id, view: selectedCameraView(id, records, edgeAI, nowMs) }));
  const changed = views.filter(({ id, view }) => view.count !== null && view.observedAt !== null &&
    view.observedAt > Number(previous?.[`${id}_observedAt`] || 0));
  if (!changed.length) return old;
  const at = Math.max(...changed.map(({ view }) => view.observedAt!));
  if (previous && at < previous.timestamp) return old;
  const point: CameraHistoryPoint = { timestamp: at, time: new Date(at * 1000).toLocaleTimeString("vi-VN", { hour12: false }), source };
  for (const { id, view } of views) {
    point[`${id}_observedAt`] = Math.max(Number(previous?.[`${id}_observedAt`] || 0), view.count !== null ? view.observedAt || 0 : 0);
    if (view.count !== null) point[id] = view.count;
  }
  for (const route of buildRouteStats(records, nowMs, edgeAI)) {
    if (route.hasData) point[route.id] = route.vehicleCount;
  }
  point.total = views.reduce((sum, { view }) => sum + (view.count ?? 0), 0);
  // Multiple cameras may publish the same observation timestamp separately.
  return [...(previous?.timestamp === at ? old.slice(0, -1) : old), point].slice(-360);
}
