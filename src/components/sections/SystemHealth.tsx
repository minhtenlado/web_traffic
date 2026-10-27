"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Camera, Cloud, Cpu, MemoryStick, Radio, ServerCog, Thermometer } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { selectedCameraView } from "@/lib/traffic-status";
import { isControllerOnline } from "@/lib/controller";
import { telemetryIsFresh } from "@/lib/hardware-telemetry";
import { SectionCard, StatusBadge } from "@/components/shared/ui";

type Point = { timestamp: number; cpu: number | null; ram: number | null; time: string };
function display(value: number | null | undefined, unit: string) {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${value.toFixed(value < 10 && unit !== "%" ? 1 : 0)}${unit}`;
}
function duration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return days ? `${days} ngày ${hours} giờ` : hours ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export function SystemHealth() {
  const health = useTrafficStore((state) => state.healthMetrics);
  const edgeAI = useTrafficStore((state) => state.edgeAI);
  const modelStatus = useTrafficStore((state) => state.modelStatus);
  const realtimeCams = useTrafficStore((state) => state.realtimeCams);
  const controller = useTrafficStore((state) => state.controllerStatus);
  const lastRealtimeUpdate = useTrafficStore((state) => state.lastRealtimeUpdate);
  const tick = useTrafficStore((state) => state._tickCount);
  void tick;
  const [points, setPoints] = useState<Point[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const telemetryFresh = telemetryIsFresh(health, now);
  const telemetryAge = health?.observedAt ? Math.max(0, Math.floor((now - health.observedAt) / 1000)) : null;

  useEffect(() => {
    if (!health?.observedAt || !telemetryFresh) return;
    setPoints((old) => {
      if (old.at(-1)?.timestamp === health.observedAt) return old;
      return [...old, { timestamp: health.observedAt!, cpu: health.cpu, ram: health.ram,
        time: new Date(health.observedAt!).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }].slice(-60);
    });
  }, [health, telemetryFresh]);

  const edgeAt = Number(edgeAI?.generated_at);
  const nowSeconds = Date.now() / 1000;
  const genioFresh = edgeAI?.status?.online === true && Number.isFinite(edgeAt) && nowSeconds >= edgeAt && nowSeconds - edgeAt <= 30;
  const freshCameras = CAMERAS.filter((camera) => camera.aiInput && selectedCameraView(camera.id, realtimeCams, edgeAI, now).fresh).length;
  const firebaseFresh = lastRealtimeUpdate > 0 && Date.now() - lastRealtimeUpdate < 45000;
  const statuses = [
    { name: "Genio 350", detail: "Heartbeat của dịch vụ AI", icon: Cpu, ok: genioFresh, known: Boolean(edgeAI) },
    { name: "Camera AI", detail: `${freshCameras}/5 camera có ảnh trong 45 giây gần nhất`, icon: Camera, ok: freshCameras > 0, known: Boolean(edgeAI || realtimeCams) },
    { name: "STM32", detail: "Telemetry từ bộ điều khiển đèn", icon: Radio, ok: isControllerOnline(controller), known: Boolean(controller) },
    { name: "Bản tin giao thông", detail: "Dữ liệu mới từ Firebase", icon: Cloud, ok: firebaseFresh, known: lastRealtimeUpdate > 0 },
  ];
  const cards = [
    { label: "CPU Genio", value: display(telemetryFresh ? health?.cpu : null, "%"), icon: Cpu },
    { label: "RAM Genio", value: display(telemetryFresh ? health?.ram : null, "%"), icon: MemoryStick },
    { label: "Nhiệt độ CPU", value: display(telemetryFresh ? health?.temperature : null, " °C"), icon: Thermometer },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Giám sát thiết bị</p><h2 className="mt-1 text-2xl font-semibold">Tình trạng vận hành</h2></div>
      <div className="text-right text-xs text-muted-foreground">
        <p>{telemetryFresh && health?.observedAt ? `Đo lúc ${new Date(health.observedAt).toLocaleTimeString("vi-VN")}` : "Chưa có telemetry phần cứng mới"}</p>
        <p className="mt-1">{telemetryFresh ? health?.source : telemetryAge !== null ? `Mẫu gần nhất cách đây ${telemetryAge} giây · đã hết hạn` : "Nguồn: chưa xác định"}</p>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(({ label, value, icon: Icon }) => <article key={label} className="flex items-center justify-between rounded-xl border border-border bg-card/90 p-4">
        <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p></div><Icon className="h-5 w-5 text-primary" />
      </article>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <SectionCard title="Mức sử dụng CPU và RAM" icon={ServerCog}>
        {points.length < 2 ? <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border px-6 text-center text-sm text-muted-foreground">Cần nhận thêm telemetry phần cứng để vẽ diễn biến. Không có chuỗi lịch sử dài hạn trong nguồn dữ liệu hiện tại.</div> : <div className="h-64">
          <ResponsiveContainer width="100%" height="100%"><AreaChart data={points} margin={{ top: 8, right: 12, bottom: 2, left: -16 }}>
            <defs><linearGradient id="cpuArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--primary)" stopOpacity={0.26} /><stop offset="100%" stopColor="var(--primary)" stopOpacity={0} /></linearGradient><linearGradient id="ramArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} /><YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--foreground)" }} formatter={(value: number, name: string) => [`${Number(value).toFixed(1)}%`, name.toUpperCase()]} />
            <Area type="monotone" dataKey="ram" name="RAM" stroke="var(--chart-2)" fill="url(#ramArea)" connectNulls={false} isAnimationActive={false} /><Area type="monotone" dataKey="cpu" name="CPU" stroke="var(--primary)" fill="url(#cpuArea)" connectNulls={false} isAnimationActive={false} />
          </AreaChart></ResponsiveContainer>
          <div className="mt-2 flex justify-end gap-4 text-xs text-muted-foreground"><span>CPU</span><span>RAM</span></div>
        </div>}
      </SectionCard>

      <SectionCard title="Kết nối thiết bị" icon={Radio}>
        <div className="divide-y divide-border">
          {statuses.map(({ name, detail, icon: Icon, ok, known }) => <div key={name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">{detail}</p></div>
            <StatusBadge color={!known ? "cyan" : ok ? "green" : "amber"}>{!known ? "Chưa có dữ liệu" : ok ? "Đang kết nối" : "Dữ liệu cũ"}</StatusBadge>
          </div>)}
        </div>
      </SectionCard>
    </div>

    <SectionCard title="Thời gian hoạt động" icon={Activity}>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Genio 350</p><p className="mt-1 text-2xl font-semibold tabular-nums">{duration(telemetryFresh ? health?.uptime : null)}</p></div><StatusBadge color={genioFresh && telemetryFresh ? "green" : "amber"}>{genioFresh && telemetryFresh ? "Heartbeat và telemetry mới" : genioFresh ? "AI còn heartbeat · telemetry phần cứng cũ" : "Chưa xác nhận hoạt động"}</StatusBadge></div>
      {modelStatus?.runtime_version && <p className="mt-3 text-xs text-muted-foreground">Runtime: {modelStatus.runtime_version}</p>}
    </SectionCard>
  </div>;
}
