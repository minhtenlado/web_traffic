"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Cpu,
  MemoryStick,
  Thermometer,
  Wifi,
  HardDrive,
  ServerCog,
  Activity,
  Clock,
  Video,
  Database,
  Cloud,
  Radio,
  RefreshCw,
  CircleDot,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { StatCard, StatusBadge, SectionCard } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

/* Mock services list */
const SERVICES = [
  { id: "camera", name: "Camera Service", desc: "Đọc frame từ 7 camera realtime", icon: Video, status: "online", latency: 42 },
  { id: "ai", name: "AI Inference", desc: "Mô hình LSTM+CNN v2.3.1", icon: Cpu, status: "online", latency: 38 },
  { id: "firebase", name: "Firebase Sync", desc: "Đồng bộ dữ liệu realtime", icon: Cloud, status: "online", latency: 65 },
  { id: "websocket", name: "WebSocket Gateway", desc: "Phát sói dữ liệu tới client", icon: Radio, status: "degraded", latency: 118 },
  { id: "database", name: "Database (SQLite)", desc: "Lưu lịch sử & cấu hình", icon: Database, status: "online", latency: 12 },
];

function serviceColor(s: string): "green" | "amber" | "red" {
  return s === "online" ? "green" : s === "degraded" ? "amber" : "red";
}
function serviceLabel(s: string) {
  return s === "online" ? "Online" : s === "degraded" ? "Chậm" : "Offline";
}

/* Thresholds: green < 60, amber 60-80, red > 80 */
function thresholdColor(v: number): "green" | "amber" | "red" {
  if (v >= 80) return "red";
  if (v >= 60) return "amber";
  return "green";
}
function thresholdStroke(v: number): string {
  if (v >= 80) return "var(--destructive)";
  if (v >= 60) return "var(--warning)";
  return "var(--success)";
}

/* Generate mock historical CPU/RAM series — stable across renders */
function useHistory() {
  return useMemo(() => {
    const now = new Date();
    const points: { time: string; cpu: number; ram: number }[] = [];
    for (let i = 19; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 30 * 1000);
      points.push({
        time: t.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        cpu: Math.round(28 + Math.sin(i / 2) * 12 + Math.random() * 8),
        ram: Math.round(54 + Math.cos(i / 3) * 8 + Math.random() * 5),
      });
    }
    return points;
  }, []);
}

function useLatencyHistory() {
  return useMemo(() => {
    const now = new Date();
    const points: { time: string; latency: number }[] = [];
    for (let i = 19; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 30 * 1000);
      points.push({
        time: t.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        latency: Math.round(18 + Math.sin(i / 1.8) * 10 + Math.random() * 6),
      });
    }
    return points;
  }, []);
}

export function SystemHealth() {
  const health = useTrafficStore((s) => s.healthMetrics);
  const tickCount = useTrafficStore((s) => s._tickCount);
  const history = useHistory();
  const latencyHistory = useLatencyHistory();

  if (!health) {
    return (
      <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Đang tải dữ liệu hệ thống...
      </div>
    );
  }

  const gauges = [
    { id: "cpu", label: "CPU", value: health.cpu, unit: "%", icon: Cpu },
    { id: "ram", label: "RAM", value: health.ram, unit: "%", icon: MemoryStick },
    { id: "temp", label: "Nhiệt độ", value: health.temperature, unit: "°C", icon: Thermometer },
    { id: "disk", label: "Ổ đĩa", value: health.diskUsage, unit: "%", icon: HardDrive },
  ];

  return (
    <div className="space-y-5">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Cpu}
          label="CPU"
          value={health.cpu.toFixed(0)}
          unit="%"
          color={thresholdColor(health.cpu) === "red" ? "red" : thresholdColor(health.cpu) === "amber" ? "amber" : "green"}
          trend={health.cpu > 70 ? "up" : "neutral"}
          trendValue={health.cpu > 70 ? "cao" : "ổn định"}
          delay={0}
        />
        <StatCard
          icon={MemoryStick}
          label="RAM"
          value={health.ram.toFixed(0)}
          unit="%"
          color={thresholdColor(health.ram) === "red" ? "red" : thresholdColor(health.ram) === "amber" ? "amber" : "green"}
          trend={health.ram > 70 ? "up" : "neutral"}
          trendValue={health.ram > 70 ? "cao" : "ổn định"}
          delay={0.05}
        />
        <StatCard
          icon={Thermometer}
          label="Nhiệt độ"
          value={health.temperature.toFixed(0)}
          unit="°C"
          color={health.temperature > 70 ? "red" : health.temperature > 55 ? "amber" : "green"}
          trend={health.temperature > 60 ? "up" : "neutral"}
          trendValue={health.temperature > 60 ? "nóng" : "mát"}
          delay={0.1}
        />
        <StatCard
          icon={Wifi}
          label="Độ trễ mạng"
          value={health.networkLatency.toFixed(0)}
          unit="ms"
          color={health.networkLatency > 80 ? "red" : health.networkLatency > 40 ? "amber" : "green"}
          trend={health.networkLatency > 60 ? "up" : "down"}
          trendValue={health.networkLatency > 60 ? "chậm" : "nhanh"}
          delay={0.15}
        />
      </div>

      {/* Hardware gauges + Uptime */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Gauges */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Hệ thống phần cứng"
            subtitle="Ngưỡng: Xanh < 60% · Vàng 60–80% · Đỏ > 80%"
            icon={ServerCog}
            action={
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                <RefreshCw className="h-3 w-3 animate-spin" style={{ animationDuration: "3s" }} />
                Cập nhật mỗi 5s
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {gauges.map((g, i) => (
                <Gauge
                  key={g.id}
                  icon={g.icon}
                  label={g.label}
                  value={g.value}
                  unit={g.unit}
                  delay={i * 0.06}
                />
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Uptime + FPS */}
        <SectionCard title="Uptime & FPS" subtitle="Độ ổn định vận hành" icon={Activity}>
          <div className="space-y-4">
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center">
              <div className="text-[10px] uppercase tracking-wide text-success/90">Uptime</div>
              <div className="mt-1 text-3xl font-bold tabular-nums text-success">
                {health.uptime.toFixed(2)}%
              </div>
              <div className="mt-0.5 text-[11px] text-success/80">30 ngày gần nhất</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Video className="h-3.5 w-3.5" /> FPS
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                  {health.fps}
                </div>
                <div className="text-[10px] text-success">tốt</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Tick
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                  #{tickCount}
                </div>
                <div className="text-[10px] text-muted-foreground">vòng tick</div>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Service status + CPU/RAM chart */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Service status */}
        <SectionCard
          title="Trạng thái dịch vụ"
          subtitle="5 dịch vụ đang vận hành"
          icon={CircleDot}
          bodyClassName="p-0"
          noPadding
        >
          <div className="divide-y divide-border">
            {SERVICES.map((s, i) => (
              <ServiceRow key={s.id} service={s} delay={i * 0.05} />
            ))}
          </div>
        </SectionCard>

        {/* CPU/RAM history */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Sử dụng tài nguyên"
            subtitle="CPU & RAM trong 10 phút qua"
            icon={Activity}
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    interval={3}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                      color: "var(--foreground)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ram"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill="url(#ramGrad)"
                    name="RAM %"
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    fill="url(#cpuGrad)"
                    name="CPU %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center justify-end gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> CPU
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--chart-2)" }} /> RAM
              </span>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Network latency chart */}
      <SectionCard
        title="Độ trễ mạng theo thời gian"
        subtitle="Mili giây — 10 phút gần nhất"
        icon={Wifi}
      >
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyHistory} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                unit="ms"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                  color: "var(--foreground)",
                }}
                formatter={(v: number) => [`${v} ms`, "Độ trễ"]}
              />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="var(--chart-2)"
                strokeWidth={2.5}
                dot={{ r: 2, fill: "var(--chart-2)", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "var(--chart-2)", stroke: "var(--background)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
    </div>
  );
}

function Gauge({
  icon: Icon,
  label,
  value,
  unit,
  delay = 0,
}: {
  icon: typeof Cpu;
  label: string;
  value: number;
  unit: string;
  delay?: number;
}) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const stroke = thresholdStroke(value);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-3"
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="7"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut", delay: delay + 0.1 }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-lg font-bold tabular-nums text-foreground">
            {value.toFixed(0)}
            <span className="text-[10px] text-muted-foreground">{unit}</span>
          </span>
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.2} />
        </div>
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </motion.div>
  );
}

function ServiceRow({
  service,
  delay,
}: {
  service: (typeof SERVICES)[number];
  delay: number;
}) {
  const Icon = service.icon;
  const color = serviceColor(service.status);
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/40"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          color === "green" && "bg-success/10 text-success",
          color === "amber" && "bg-warning/10 text-warning",
          color === "red" && "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.1} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground">{service.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{service.desc}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusBadge color={color} pulse={color !== "green"}>
          {serviceLabel(service.status)}
        </StatusBadge>
        <span className="text-[10px] tabular-nums text-muted-foreground">{service.latency}ms</span>
      </div>
    </motion.div>
  );
}
