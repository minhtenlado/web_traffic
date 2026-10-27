"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { Brain, Camera, ShieldCheck } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { CurrentWeatherCard } from "@/components/shared/CurrentWeatherCard";
import { edgeForecastHistoryCanRetain, edgeForecastIssuedAt, edgeForecastSession, edgeHistoryProgress, edgeTcnRecovery, groupEdgeForecasts } from "@/lib/edge-forecast";
import { selectedCameraView, EDGE_TRAFFIC_LABELS } from "@/lib/traffic-status";

const FORECAST_CAMERA_IDS = ["cam_01", "cam_02", "cam_03", "cam_04"] as const;
const FORECAST_COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc"];
const FORECAST_LEVELS = ["Thông thoáng", "Trung bình", "Đông đúc", "Rất đông"];
const FORECAST_SEVERITY: Record<string, number> = {
  Khong_ket: 0,
  Dong: 1,
  Ket_nhe: 2,
  Ket_nang: 3,
};

type ForecastCameraId = (typeof FORECAST_CAMERA_IDS)[number];
type ForecastChartPoint = { horizon: number } & Partial<Record<ForecastCameraId, number | null>>;
type ForecastCameraPoint = { horizon: number; severity: number | null };

const ForecastCameraChart = memo(function ForecastCameraChart({
  cameraId,
  data,
}: {
  cameraId: ForecastCameraId;
  data: ForecastCameraPoint[];
}) {
  const cameraIndex = FORECAST_CAMERA_IDS.indexOf(cameraId);
  const cameraName = CAMERAS.find((camera) => camera.id === cameraId)?.name || cameraId;
  const hasValues = data.some((point) => point.severity !== null);

  return <article className="min-w-0 rounded-xl border border-border/80 bg-background/25 p-3 sm:p-4">
    <div className="mb-2 flex items-center justify-between gap-3">
      <h3 className="font-medium">{cameraName}</h3>
      <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FORECAST_COLORS[cameraIndex] }} />Dự báo</span>
    </div>
    <div role="img" aria-label={`Dự báo mức độ ùn tắc ${cameraName} tại các mốc 5, 15 và 30 phút`} className="h-[230px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 2, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="horizon" type="number" domain={[5, 30]} ticks={[5, 15, 30]} tickFormatter={(value) => `${value}p`} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis type="number" domain={[0, 3]} ticks={[0, 1, 2, 3]} tickFormatter={(value) => FORECAST_LEVELS[Number(value)] || ""} width={92} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={(value) => `Sau ${value} phút`} formatter={(value) => [value === null ? "Chưa có dự báo" : FORECAST_LEVELS[Number(value)] || "Chưa có nhãn", "Mức độ"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
          <Line type="stepAfter" dataKey="severity" name={cameraName} stroke={FORECAST_COLORS[cameraIndex]} strokeWidth={3} dot={{ r: 5, fill: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 7 }} connectNulls={false} isAnimationActive animationDuration={500} animationEasing="ease-in-out" />
        </LineChart>
      </ResponsiveContainer>
    </div>
    {!hasValues && <p className="-mt-5 text-center text-xs text-muted-foreground">Chưa có dữ liệu dự báo</p>}
  </article>;
});

const ForecastTrafficCharts = memo(function ForecastTrafficCharts({
  data,
  cameraIds,
  message,
}: {
  data: ForecastChartPoint[];
  cameraIds: readonly ForecastCameraId[];
  message: string | null;
}) {
  return <div>
    {message && <p aria-live="polite" className="mb-3 min-h-5 text-sm text-muted-foreground">{message}</p>}
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {cameraIds.map((cameraId) => <ForecastCameraChart key={cameraId} cameraId={cameraId} data={data.map((point) => ({ horizon: point.horizon, severity: point[cameraId] ?? null }))} />)}
    </div>
  </div>;
});

export function ModelManagement() {
  const edgeAI = useTrafficStore((state) => state.edgeAI);
  const edgeStatus = edgeAI?.status || {};
  const edgeWeather = edgeAI?.weather;
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 5000); return () => clearInterval(timer); }, []);
  const generatedAt = Number(edgeAI?.generated_at);
  const age = Number.isFinite(generatedAt) ? Math.max(0, now - generatedAt) : null;
  const edgeLive = edgeStatus.online === true && age !== null && age <= 30 && now >= generatedAt;
  const progress = edgeHistoryProgress(edgeStatus);
  const recovery = edgeTcnRecovery(edgeStatus, edgeLive);
  const forecastSession = edgeForecastSession(edgeStatus);
  const issuedAt = edgeForecastIssuedAt(edgeStatus, edgeAI?.forecasts);
  const forecasts = groupEdgeForecasts(edgeAI?.forecasts);
  const forecastHasRows = ([5, 15, 30] as const).some((horizon) => forecasts[horizon].length > 0);
  const forecastClassSignature = JSON.stringify(([5, 15, 30] as const).flatMap((horizon) =>
    forecasts[horizon].map((row) => [horizon, row.camera_id, row.predicted_class]),
  ));
  const forecastChart = useMemo(() => {
    const rows = JSON.parse(forecastClassSignature) as Array<[5 | 15 | 30, ForecastCameraId, string]>;
    const classes = new Map(rows.map(([horizon, cameraId, predictedClass]) => [`${horizon}:${cameraId}`, FORECAST_SEVERITY[predictedClass] ?? null]));
    const cameraIds = [...FORECAST_CAMERA_IDS];
    const data = ([5, 15, 30] as const).map((horizon) => ({
      horizon,
      ...Object.fromEntries(FORECAST_CAMERA_IDS.map((cameraId) => [
        cameraId,
        classes.get(`${horizon}:${cameraId}`) ?? null,
      ])),
    })) as ForecastChartPoint[];
    return { data, cameraIds };
  }, [forecastClassSignature]);
  const currentForecastValid = recovery.forecastReady && forecastHasRows && issuedAt !== null &&
    now >= issuedAt && now - issuedAt <= 90;
  const historyCanRetain = progress.required > 0 && progress.steps === progress.required && edgeForecastHistoryCanRetain(edgeStatus);
  const [lastForecastChart, setLastForecastChart] = useState<{ session: string; issuedAt: number; signature: string; chart: typeof forecastChart } | null>(null);
  useEffect(() => {
    if (!historyCanRetain) {
      setLastForecastChart(null);
      return;
    }
    if (currentForecastValid && issuedAt !== null) {
      setLastForecastChart((previous) => previous?.session === forecastSession && previous.issuedAt === issuedAt && previous.signature === forecastClassSignature
        ? previous : { session: forecastSession, issuedAt, signature: forecastClassSignature, chart: forecastChart });
    }
  }, [historyCanRetain, currentForecastValid, issuedAt, forecastSession, forecastClassSignature, forecastChart]);
  const retainedForecastValid = Boolean(lastForecastChart && historyCanRetain && lastForecastChart.session === forecastSession &&
    now >= lastForecastChart.issuedAt && now - lastForecastChart.issuedAt <= 90);
  const hasCurrentForecast = currentForecastValid;
  const chartToShow = hasCurrentForecast ? forecastChart : retainedForecastValid && lastForecastChart ? lastForecastChart.chart : null;
  const forecastStatusLabel = hasCurrentForecast ? "Đang dự báo" : retainedForecastValid ? "Kết quả gần nhất" : recovery.label;
  const chartMessage = hasCurrentForecast ? null : retainedForecastValid
    ? `Đang chờ kết quả mới · bản trước lúc ${new Date(lastForecastChart!.issuedAt * 1000).toLocaleTimeString("vi-VN")}`
    : progress.remaining > 0 ? `Cần thêm ${progress.remaining} mẫu lịch sử để tạo dự báo.`
    : recovery.reason;
  const cameras = Object.entries(edgeAI?.cameras || {}).sort(([a], [b]) => a.localeCompare(b));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nhận dạng & dự báo</p><h2 className="mt-1 text-2xl font-semibold">AI tại Hàng Xanh</h2></div>
      <StatusBadge color={edgeLive ? "green" : edgeAI ? "amber" : "cyan"}>{edgeLive ? "Genio có tín hiệu mới" : edgeAI ? "Đang chờ tín hiệu mới" : "Chưa nhận dữ liệu AI"}</StatusBadge>
    </div>

    <CurrentWeatherCard title="Thời tiết hiện tại" />

    <SectionCard title="Nhận dạng từ camera" icon={Camera}>
      {cameras.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cameras.map(([id, value]: [string, any]) => {
          const camera = selectedCameraView(id, null, edgeAI, now * 1000);
          const stability = value?.classification_stability;
          const labelText = camera.text;
          const cameraFresh = camera.fresh;
          return <article key={id} className="rounded-lg border border-border/80 bg-background/35 p-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{CAMERAS.find((item) => item.id === id)?.name || id.replace("_", " ")}</h3><p className="text-xs text-muted-foreground">{CAMERAS.find((item) => item.id === id)?.label || ""}</p></div><StatusBadge color={cameraFresh ? "green" : "amber"}>{cameraFresh ? "Ảnh mới" : "Đang chờ"}</StatusBadge></div>
            <div className="mt-4 flex items-end justify-between border-t border-border/70 pt-3"><div><p className="text-xs text-muted-foreground">Tình trạng{camera.stabilizationMode === "display" ? " ổn định" : " nhận diện"}</p><p className="mt-1 text-lg font-semibold">{labelText}</p></div><p className="text-right text-sm tabular-nums">{camera.count ?? "—"}<span className="ml-1 text-xs text-muted-foreground">xe trong ảnh</span></p></div>
            <p className="mt-2 text-xs text-muted-foreground">YOLO: {EDGE_TRAFFIC_LABELS[value.label]?.text || "Chưa phân loại"} · tin cậy {Number.isFinite(value.classification_confidence) && value.classification_confidence >= 0 && value.classification_confidence <= 1 ? `${(value.classification_confidence * 100).toFixed(0)}%` : "—"} · ảnh {Number.isFinite(value.image_age_seconds) ? `${Number(value.image_age_seconds).toFixed(0)} giây trước` : "chưa rõ thời điểm"}</p>
            {stability && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Chi tiết trạng thái theo thời gian</summary><p className="mt-1">Chế độ: {stability.mode || "legacy"} · dữ liệu: {stability.data_status || "UNKNOWN"}</p><p>YOLO hiện tại: {EDGE_TRAFFIC_LABELS[stability.raw_state]?.text || EDGE_TRAFFIC_LABELS[value.label]?.text || "Chưa phân loại"} · {Number.isFinite(stability.raw_confidence) ? `${(Number(stability.raw_confidence) * 100).toFixed(0)}%` : "—"}</p><p>Ổn định: {stability.data_status === "VALID" ? EDGE_TRAFFIC_LABELS[stability.stable_state]?.text || "—" : "Chưa hợp lệ"} · {Number.isFinite(stability.stable_confidence) ? `${(Number(stability.stable_confidence) * 100).toFixed(0)}%` : "—"}</p><p>Ảnh hợp lệ gần nhất: {Number.isFinite(stability.last_valid_timestamp) ? new Date(Number(stability.last_valid_timestamp) * 1000).toLocaleString("vi-VN") : "—"}</p>{stability.pending_transition && <p>Đang xác nhận: {EDGE_TRAFFIC_LABELS[stability.pending_transition.state]?.text || stability.pending_transition.state} ({stability.pending_transition.count}/{stability.pending_transition.required} ảnh)</p>}</details>}
            {value.label_source && <p className="mt-1 text-[11px] text-muted-foreground">Nhãn tự động từ YOLO</p>}
          </article>;
        })}
      </div> : <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Chưa nhận được kết quả nhận dạng mới.</p>}
    </SectionCard>

    <SectionCard title="Dự báo ùn tắc" icon={Brain}>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3"><StatusBadge color={hasCurrentForecast ? "green" : retainedForecastValid || recovery.state === "RESTORING" ? "amber" : "cyan"}>{forecastStatusLabel}</StatusBadge></div>
      <div className="mb-4 rounded-lg border border-border/80 bg-background/35 p-4">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>Mẫu đầu vào đã nạp{!edgeLive ? " ở bản tin cuối" : ""}</span><span className="tabular-nums">{progress.required > 0 ? `${progress.steps}/${progress.required} mẫu · ${progress.percent}%` : "Chưa nhận được tiến độ"}</span></div>
        {progress.required > 0 && <div role="progressbar" aria-label="Tiến độ mẫu đầu vào TCN" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={Math.min(progress.steps, progress.required)} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.percent}%` }} /></div>}
      </div>
      <ForecastTrafficCharts data={chartToShow?.data || forecastChart.data.map((point) => ({ ...point, cam_01: null, cam_02: null, cam_03: null, cam_04: null }))} cameraIds={FORECAST_CAMERA_IDS} message={chartMessage} />
    </SectionCard>

    <details className="rounded-xl border border-border bg-card/70 p-4 text-sm"><summary className="cursor-pointer font-medium"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />Thông tin kỹ thuật</summary><div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p>Kiểm định TCN: {String(edgeStatus.validation_status || "chưa có")}</p><p>Trạng thái thời tiết: {String(edgeStatus.weather_status || "chưa có")}</p><p>Trạng thái dự báo: {String(edgeStatus.forecast_status || "chưa có")}</p><p>Thời tiết code: {edgeWeather?.weather_code ?? "—"}</p><p>Khôi phục TCN: {String(edgeStatus.tcn_state || "chưa có")}</p><p>Lý do: {String(edgeStatus.history_reason || "chưa có")}</p><p>Bước lịch sử cuối: {String(edgeStatus.history_last_timestamp || "chưa có")}</p></div></details>
  </div>;
}
