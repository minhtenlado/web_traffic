"use client";

import { useMemo } from "react";
import { Activity, AlertTriangle, Camera, CarFront, CloudRain, MapPinned, Radio, Sun } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS, DIRECTIONS, SIGNAL_PHASES } from "@/lib/constants";
import { cameraView, edgeCameraView, edgePayloadIsFresh } from "@/lib/traffic-status";
import { formatNumber } from "@/lib/formatters";
import { SectionCard, StatCard, StatusBadge } from "@/components/shared/ui";
import { IntersectionMap } from "@/components/shared/IntersectionMap";
import { TrafficHistoryChart } from "./TrafficHistoryChart";

function WeatherPanel({ weather, weatherStatus }: { weather: Record<string, any> | null; weatherStatus?: string }) {
  const sourceTime = weather?.source_time || weather?.fetched_at || weather?.timestamp;
  const sourceEpoch = sourceTime ? Date.parse(String(sourceTime)) / 1000 : NaN;
  const derivedAge = Number.isFinite(sourceEpoch) ? Date.now() / 1000 - sourceEpoch : NaN;
  const reportedAge = Number(weather?.weather_age_seconds);
  const ageSeconds = Number.isFinite(derivedAge) ? derivedAge
    : Number.isFinite(reportedAge) && reportedAge >= 0 ? reportedAge : null;
  const available = weatherStatus === "AVAILABLE" && Boolean(weather) && ageSeconds !== null && ageSeconds >= 0 && ageSeconds <= 3600;
  const rate = typeof weather?.precipitation === "number" && Number.isFinite(weather.precipitation) ? weather.precipitation : null;
  const amount = typeof weather?.raw_precipitation_mm === "number" && Number.isFinite(weather.raw_precipitation_mm) ? weather.raw_precipitation_mm : null;
  const interval = typeof weather?.interval_seconds === "number" && Number.isFinite(weather.interval_seconds) ? weather.interval_seconds : null;
  const rainValue = weather?.is_raining;
  const isRaining = typeof rainValue === "boolean" ? rainValue : rainValue === 0 || rainValue === 1 ? Boolean(rainValue) : null;
  const rawTemperature = weather?.temperature_c ?? weather?.temperature ?? weather?.temperature_2m;
  const rawHumidity = weather?.humidity_percent ?? weather?.humidity ?? weather?.relative_humidity_2m;
  const temperature = typeof rawTemperature === "number" && Number.isFinite(rawTemperature) ? rawTemperature : null;
  const humidity = typeof rawHumidity === "number" && Number.isFinite(rawHumidity) ? rawHumidity : null;
  const ageText = ageSeconds === null ? "không rõ tuổi dữ liệu" : ageSeconds < 60 ? `${Math.floor(ageSeconds)} giây trước` : `${Math.floor(ageSeconds / 60)} phút trước`;
  return <SectionCard title="Thời tiết tại Hàng Xanh" subtitle="Ước tính từ API thời tiết, không phải thiết bị đo tại chỗ" icon={isRaining ? CloudRain : Sun}>
    {!available ? <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">{weather ? "Bản tin thời tiết đã quá cũ." : "Chưa nhận được bản tin thời tiết từ Genio."} Hệ thống không tự điền số liệu thiếu.</div> : <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Điều kiện hiện tại</p><p className="mt-1 text-2xl font-semibold">{isRaining === null ? "Chưa xác định" : isRaining ? "Có mưa" : "Không ghi nhận mưa"}</p></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-y border-border py-3 sm:grid-cols-5">
        <WeatherMetric label="Nhiệt độ · 2 m" value={temperature === null ? "Thiếu từ API" : `${temperature.toFixed(1)} °C`} />
        <WeatherMetric label="Mưa" value={rate === null ? "—" : `${rate.toFixed(2)} mm/giờ`} />
        <WeatherMetric label={interval === 900 ? "Lượng mưa / 15 phút" : "Lượng mưa theo kỳ"} value={amount === null ? "—" : `${amount.toFixed(2)} mm${interval === null ? "" : ` / ${interval}s`}`} />
        <WeatherMetric label="Độ ẩm · 2 m" value={humidity === null ? "Thiếu từ API" : `${humidity.toFixed(0)}%`} />
        <WeatherMetric label="Nguồn" value={String(weather?.source || "API thời tiết")} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Bản tin API lúc {sourceTime ? new Date(String(sourceTime)).toLocaleString("vi-VN") : "không có thời điểm"} · {ageText}</p>
    </>}</SectionCard>;
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-medium tabular-nums" title={value}>{value}</p></div>;
}

export function Dashboard() {
  const metrics = useTrafficStore((state) => state.metrics);
  const realtimeCams = useTrafficStore((state) => state.realtimeCams);
  const edgeAI = useTrafficStore((state) => state.edgeAI);
  const routeStats = useTrafficStore((state) => state.routeStats);
  const isOffline = useTrafficStore((state) => state.isBoardOffline);
  const signalState = useTrafficStore((state) => state.signalState);
  const setActive = useTrafficStore((state) => state.setActiveSection);
  const tick = useTrafficStore((state) => state._tickCount);
  const edgeLive = edgePayloadIsFresh(edgeAI);
  const cameras = useMemo(() => CAMERAS.filter((camera) => camera.aiInput).map((camera) => ({
    ...camera, view: cameraView(realtimeCams?.[camera.id]), edge: edgeCameraView(edgeAI?.cameras?.[camera.id], edgeLive), data: realtimeCams?.[camera.id],
  })), [realtimeCams, edgeAI, edgeLive, tick]);
  const freshCameras = cameras.filter((camera) => camera.edge.fresh || camera.view.fresh).length;
  const freshEdgeCameras = cameras.filter((camera) => camera.edge.fresh);
  const edgeVehicleCount = freshEdgeCameras.reduce((sum, camera) => sum + (camera.edge.count ?? 0), 0);
  const legacyVehicleCount = cameras.reduce((sum, camera) => sum + (camera.view.fresh ? camera.view.count ?? 0 : 0), 0);
  const vehicleCount = freshEdgeCameras.length ? edgeVehicleCount : freshCameras ? legacyVehicleCount : null;
  const weather = edgeAI?.weather ?? null;
  const weatherStatus = edgeAI?.status?.weather_status ?? "UNAVAILABLE";
  const signalFresh = Number.isFinite(signalState.timestamp) && Date.now() / 1000 - signalState.timestamp < 3;
  const activePhase = signalFresh ? SIGNAL_PHASES.find((phase) => phase.id === signalState.currentPhase)?.name : null;

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(115deg,color-mix(in_oklch,var(--card)_96%,var(--primary)),var(--card)_55%)] p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-primary/10" />
      <div className="pointer-events-none absolute -right-4 -top-8 h-40 w-40 rounded-full border border-primary/10" />
      <div className="relative flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Trung tâm điều hành · TP. Hồ Chí Minh</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Ngã tư Hàng Xanh</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Theo dõi ảnh camera, tình trạng các hướng và dự báo giao thông theo dữ liệu đang nhận.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge color={isOffline ? "amber" : "green"}><Radio className="mr-1 h-3.5 w-3.5" />Genio {isOffline ? "chưa có tín hiệu mới" : "đang kết nối"}</StatusBadge>
          <StatusBadge color={signalFresh ? "green" : "amber"}>{signalFresh ? "STM32 có telemetry mới" : "Chưa có telemetry đèn mới"}</StatusBadge>
        </div>
      </div>
      <div className="relative mt-6 grid grid-cols-2 gap-3 border-t border-border/70 pt-5 lg:grid-cols-4">
        <StatCard icon={CarFront} label="Xe trong ảnh mới" value={vehicleCount === null ? "—" : formatNumber(vehicleCount)} unit={`xe · ${freshCameras}/5 camera mới`} color="primary" />
        <StatCard icon={Camera} label="Camera AI có ảnh mới" value={`${freshCameras}/5`} unit="camera" color="cyan" />
        <StatCard icon={Activity} label="Hướng đã có trạng thái" value={`${routeStats.filter((route) => route.hasStatus).length}/4`} unit="hướng" color="green" />
        <StatCard icon={AlertTriangle} label="Cảnh báo hiện tại" value={metrics.activeAlerts} unit="sự kiện" color={metrics.activeAlerts ? "amber" : "green"} onClick={() => setActive("alerts")} />
      </div>
    </section>

    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
      <SectionCard title="Bản đồ giám sát" subtitle={activePhase ? `Pha đèn hiện tại: ${activePhase} · còn ${signalState.countdown}s` : "Sơ đồ vị trí camera và tình trạng giao lộ"} icon={MapPinned} noPadding bodyClassName="p-3 sm:p-4">
        <IntersectionMap />
      </SectionCard>
      <div className="space-y-6">
        <WeatherPanel weather={weather || null} weatherStatus={weatherStatus} />
        <SectionCard title="Tình trạng các hướng" subtitle="Tổng hợp chỉ hiện khi nhãn ổn định; kết quả AI mới được ghi riêng theo camera bên dưới" icon={Activity}>
          <div className="space-y-4">
            {routeStats.map((route) => {
              const fill = route.severity === null ? 0 : Math.max(8, Math.min(100, route.severity / 4 * 100));
              const bar = route.statusColor === "red" ? "bg-destructive" : route.statusColor === "amber" ? "bg-warning" : route.statusColor === "green" ? "bg-success" : "bg-muted-foreground/40";
              return <article key={route.id} className="border-b border-border/70 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{route.name}</h3><StatusBadge color={route.statusColor}>{route.status}</StatusBadge></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${fill}%` }} /></div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>{route.coverage}/{route.expectedCameras} camera có nhãn mới</span><span>{route.hasData ? `${formatNumber(route.vehicleCount)} xe trong ảnh` : "Chưa có số đếm mới"}</span></div>
              </article>;
            })}
          </div>
        </SectionCard>
      </div>
    </div>

    <TrafficHistoryChart />

    <SectionCard title="Camera AI tại giao lộ" subtitle="Số xe và nhãn lấy từ bản tin nhận diện mới nhất trên Genio; nhãn tự động chưa được xác minh độc lập" icon={Camera} action={<button onClick={() => setActive("camera")} className="text-xs font-medium text-primary hover:underline">Mở giám sát camera →</button>}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {cameras.map((camera) => {
          const label = camera.edge.labelInfo?.text || (camera.view.label ? camera.view.text : null);
          const count = camera.edge.fresh ? camera.edge.count : camera.view.fresh ? camera.view.count : camera.edge.count;
          const status = camera.edge.fresh ? "AI mới" : camera.edge.available ? "AI cũ" : camera.view.fresh ? "Nhãn ổn định" : camera.data?.status === "ERROR" ? "Lỗi" : "Đang chờ";
          const color = camera.edge.fresh ? camera.edge.labelInfo?.cls || "green" : camera.edge.available ? "amber" : camera.view.fresh ? camera.view.cls : camera.data?.status === "ERROR" ? "red" : "cyan";
          return <article key={camera.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/30 px-3 py-3">
            <div className="min-w-0"><p className="font-medium">{camera.name}</p><p className="truncate text-xs text-muted-foreground" title={camera.label}>{camera.label}</p><p className="mt-1 truncate text-xs font-medium text-foreground">{label || "Chưa phân loại"}</p></div>
            <div className="shrink-0 text-right"><StatusBadge color={color}>{status}</StatusBadge><p className="mt-1 text-xs tabular-nums text-muted-foreground">{count === null ? "—" : `${count} xe`}</p></div>
          </article>;
        })}
      </div>
    </SectionCard>
  </div>;
}
