"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Camera, CarFront, CloudRain, MapPinned, Radio, Sun } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS, SIGNAL_PHASES } from "@/lib/constants";
import { selectedCameraView } from "@/lib/traffic-status";
import { describeWeatherCode, fetchOpenMeteoCurrent, type OpenMeteoCurrent } from "@/lib/open-meteo";
import { formatNumber } from "@/lib/formatters";
import { SectionCard, StatCard, StatusBadge } from "@/components/shared/ui";
import { IntersectionMap } from "@/components/shared/IntersectionMap";
import { TrafficHistoryChart } from "./TrafficHistoryChart";

function WeatherPanel() {
  const [weather, setWeather] = useState<OpenMeteoCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const result = await fetchOpenMeteoCurrent(fetch, controller.signal);
        if (active) { setWeather(result); setError(false); setLoading(false); }
      } catch {
        if (active && !controller.signal.aborted) { setError(true); setLoading(false); }
      }
    };
    void refresh();
    const intervalId = window.setInterval(() => { void refresh(); }, 5 * 60 * 1000);
    return () => { active = false; controller.abort(); window.clearInterval(intervalId); };
  }, []);

  const sourceTime = weather?.sourceTime;
  const sourceEpoch = sourceTime ? Date.parse(sourceTime) / 1000 : NaN;
  const ageSeconds = Number.isFinite(sourceEpoch) ? Date.now() / 1000 - sourceEpoch : null;
  const available = Boolean(weather) && ageSeconds !== null && ageSeconds >= 0 && ageSeconds <= 3600;
  const condition = weather ? describeWeatherCode(weather.weatherCode) : "Chưa xác định";
  const isRaining = weather ? weather.rainMm > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weather.weatherCode) : false;
  const ageText = ageSeconds === null ? "chưa có thời điểm" : ageSeconds < 60 ? `${Math.floor(ageSeconds)} giây trước` : `${Math.floor(ageSeconds / 60)} phút trước`;
  return <SectionCard title="Thời tiết tại Hàng Xanh" subtitle="Open-Meteo · dữ liệu mô hình tại khu vực, không phải trạm đo tại chỗ" icon={isRaining ? CloudRain : Sun}>
    {!available ? <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">{loading ? "Đang lấy bản tin thời tiết hiện tại…" : weather ? "Bản tin Open-Meteo đã quá cũ." : error ? "Chưa lấy được bản tin thời tiết từ Open-Meteo." : "Chưa có dữ liệu thời tiết."} Dữ liệu không khả dụng sẽ không được thay bằng số liệu giả.</div> : <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Điều kiện hiện tại</p><p className="mt-1 text-2xl font-semibold">{condition}</p></div>
        {error && <StatusBadge color="amber">Không tải được bản tin mới</StatusBadge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-y border-border py-3 sm:grid-cols-5">
        <WeatherMetric label="Nhiệt độ · 2 m" value={`${weather!.temperatureC.toFixed(1)} °C`} />
        <WeatherMetric label="Độ ẩm · 2 m" value={`${weather!.humidityPercent.toFixed(0)}%`} />
        <WeatherMetric label={`Lượng mưa / ${Math.round(weather!.intervalSeconds / 60)} phút`} value={`${weather!.precipitationMm.toFixed(2)} mm`} />
        <WeatherMetric label="Gió · 10 m" value={`${weather!.windSpeedKmh.toFixed(1)} km/h`} />
        <WeatherMetric label="Nguồn" value={weather!.source} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Bản tin API lúc {new Date(sourceTime!).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {ageText} · cập nhật lại mỗi 5 phút</p>
      <p className="mt-1 text-xs text-muted-foreground">Mưa trong kỳ {Math.round(weather!.intervalSeconds / 60)} phút: {weather!.rainMm.toFixed(2)} mm · <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p>
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
  const cameras = useMemo(() => CAMERAS.filter((camera) => camera.aiInput).map((camera) => ({
    ...camera, view: selectedCameraView(camera.id, realtimeCams, edgeAI),
  })), [realtimeCams, edgeAI, tick]);
  const freshCameras = cameras.filter((camera) => camera.view.fresh).length;
  const countedCameras = cameras.filter((camera) => camera.view.count !== null);
  const vehicleCount = countedCameras.length ? countedCameras.reduce((sum, camera) => sum + (camera.view.count ?? 0), 0) : null;
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
        <WeatherPanel />
        <SectionCard title="Tình trạng các hướng" subtitle="Nhãn phân loại và số xe từ các camera còn dữ liệu mới" icon={Activity}>
          <div className="space-y-4">
            {routeStats.map((route) => {
              const fill = route.severity === null ? 0 : Math.max(8, Math.min(100, route.severity / 3 * 100));
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
          const { view } = camera;
          const status = view.fresh ? "Ảnh mới" : view.available ? "Dữ liệu cũ" : "Đang chờ";
          return <article key={camera.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/30 px-3 py-3">
            <div className="min-w-0"><p className="font-medium">{camera.name}</p><p className="truncate text-xs text-muted-foreground" title={camera.label}>{camera.label}</p><p className="mt-1 truncate text-xs font-medium text-foreground" title={view.text}>{view.text}</p></div>
            <div className="shrink-0 text-right"><StatusBadge color={view.cls}>{status}</StatusBadge><p className="mt-1 text-xs tabular-nums text-muted-foreground">{view.count === null ? "—" : `${view.count} xe`}</p></div>
          </article>;
        })}
      </div>
    </SectionCard>
  </div>;
}
