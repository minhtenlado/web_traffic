"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  Line as RLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Car,
  Gauge,
  Trophy,
  Sparkles,
  TrendingUp,
  CalendarDays,
  Brain,
  BarChart3,
  TrafficCone,
  PieChart as PieIcon,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import {
  generateHourlyData,
  generateWeeklyHeatmap,
  generateSignalCorrelation,
} from "@/lib/mockData";
import { VEHICLE_TYPES } from "@/lib/constants";
import { formatNumber } from "@/lib/formatters";
import { StatCard, SectionCard, StatusBadge } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

const DAYS_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover/95 p-2.5 text-xs shadow-lg backdrop-blur">
      {label !== undefined && (
        <div className="mb-1 font-semibold text-foreground">
          {typeof label === "number" ? `${label}:00` : label}
        </div>
      )}
      <div className="space-y-0.5">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color || p.fill }}
              />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatNumber(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Analytics() {
  const metrics = useTrafficStore((s) => s.metrics);
  const aiForecast = useTrafficStore((s) => s.aiForecast);
  const routeStats = useTrafficStore((s) => s.routeStats);
  const signalRec = useTrafficStore((s) => s.signalRec);

  // Aggregate hourly data into 24h vehicle-type breakdown
  const hourlyAggregated = useMemo(() => {
    const raw = generateHourlyData(1);
    const byHour: Record<number, { hour: number; car: number; motorbike: number; bus: number; truck: number; pedestrian: number; total: number }> = {};
    for (let h = 0; h < 24; h++) {
      byHour[h] = { hour: h, car: 0, motorbike: 0, bus: 0, truck: 0, pedestrian: 0, total: 0 };
    }
    raw.forEach((d) => {
      const r = byHour[d.hour];
      r.car += d.car;
      r.motorbike += d.motorbike;
      r.bus += d.bus;
      r.truck += d.truck;
      r.pedestrian += d.pedestrian;
      r.total += d.total;
    });
    return Object.values(byHour);
  }, []);

  const heatmap = useMemo(() => generateWeeklyHeatmap(), []);
  const correlation = useMemo(() => generateSignalCorrelation(), []);

  // Heatmap bounds for color scale
  const heatMax = useMemo(() => Math.max(...heatmap.map((c) => c[2])), [heatmap]);
  const heatMin = useMemo(() => Math.min(...heatmap.map((c) => c[2])), [heatmap]);

  // AI forecast chart data (actual + forecast, with confidence)
  const forecastChartData = useMemo(() => {
    const actual = aiForecast.actual.map((a) => ({ hour: a.hour, actual: a.total, type: "actual" }));
    const last = actual[actual.length - 1];
    const forecast = aiForecast.forecast.map((f) => ({
      hour: f.hour,
      forecast: f.total,
      confidence: f.confidence,
      type: "forecast",
    }));
    // Bridge: include last actual value at first forecast hour for line continuity
    const bridge = last ? [{ hour: last.hour, forecast: last.actual, confidence: 100 }] : [];
    return [...actual, ...bridge, ...forecast];
  }, [aiForecast]);

  // Vehicle distribution data (mock counts weighted realistically — HCMC: motorbike dominant)
  const vehicleData = useMemo(
    () => [
      { name: "Xe máy", value: 4280, color: "var(--primary)" },
      { name: "Ô tô", value: 1450, color: "var(--chart-2)" },
      { name: "Xe tải", value: 320, color: "var(--chart-5)" },
      { name: "Xe buýt", value: 180, color: "var(--warning)" },
      { name: "Người đi bộ", value: 540, color: "var(--chart-3)" },
    ],
    [],
  );
  const vehicleTotal = vehicleData.reduce((s, v) => s + v.value, 0);

  // Peak hour derived from hourly data
  const peakHour = useMemo(() => {
    let max = 0;
    let peak = 17;
    hourlyAggregated.forEach((d) => {
      if (d.total > max) {
        max = d.total;
        peak = d.hour;
      }
    });
    return { hour: peak, value: max };
  }, [hourlyAggregated]);

  const avgDensity = routeStats.length
    ? Math.round(routeStats.reduce((s, r) => s + r.density, 0) / routeStats.length)
    : 0;

  return (
    <div className="space-y-5">
      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Car}
          label="Tổng xe hôm nay"
          value={formatNumber(metrics.totalVehicles * 18)}
          unit="xe"
          trend="up"
          trendValue="+12% so với hôm qua"
          color="primary"
          delay={0}
        />
        <StatCard
          icon={Trophy}
          label="Giờ cao điểm"
          value={`${peakHour.hour}:00`}
          unit="giờ"
          trend="neutral"
          trendValue={`${formatNumber(peakHour.value)} xe/giờ`}
          color="amber"
          delay={0.05}
        />
        <StatCard
          icon={Gauge}
          label="Mật độ TB"
          value={avgDensity}
          unit="%"
          trend={avgDensity > 55 ? "up" : "neutral"}
          trendValue={avgDensity > 55 ? "đông đúc" : "ổn định"}
          color="cyan"
          delay={0.1}
        />
        <StatCard
          icon={Sparkles}
          label="Độ chính xác AI"
          value="94.2"
          unit="%"
          trend="up"
          trendValue="+2.4% tuần này"
          color="green"
          delay={0.15}
        />
      </div>

      {/* Traffic trend chart */}
      <SectionCard
        title="Xu hướng lưu lượng 24 giờ"
        subtitle="Phân loại xe theo từng giờ trong ngày"
        icon={TrendingUp}
        action={
          <div className="hidden items-center gap-3 text-[11px] sm:flex">
            {VEHICLE_TYPES.slice(0, 4).map((v, i) => (
              <span key={v.id} className="flex items-center gap-1.5 text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: ["var(--primary)", "var(--chart-2)", "var(--chart-5)", "var(--warning)"][i] }}
                />
                {v.name}
              </span>
            ))}
          </div>
        }
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyAggregated} margin={{ top: 5, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="g-motor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="g-car" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="g-truck" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="g-bus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--warning)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--warning)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => `${h}h`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="motorbike" name="Xe máy" stackId="1" stroke="var(--primary)" strokeWidth={1.5} fill="url(#g-motor)" />
              <Area type="monotone" dataKey="car" name="Ô tô" stackId="1" stroke="var(--chart-2)" strokeWidth={1.5} fill="url(#g-car)" />
              <Area type="monotone" dataKey="truck" name="Xe tải" stackId="1" stroke="var(--chart-5)" strokeWidth={1.5} fill="url(#g-truck)" />
              <Area type="monotone" dataKey="bus" name="Xe buýt" stackId="1" stroke="var(--warning)" strokeWidth={1.5} fill="url(#g-bus)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Weekly heatmap */}
      <SectionCard
        title="Bản đồ nhiệt lưu lượng tuần"
        subtitle="7 ngày × 24 giờ — độ đậm theo lưu lượng"
        icon={CalendarDays}
        action={
          <div className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:flex">
            <span>Thấp</span>
            <span className="flex overflow-hidden rounded-full">
              {[0.15, 0.3, 0.5, 0.7, 0.9].map((o) => (
                <span key={o} className="h-2 w-3" style={{ background: `color-mix(in oklch, var(--primary) ${o * 100}%, transparent)` }} />
              ))}
            </span>
            <span>Cao</span>
          </div>
        }
        noPadding
        bodyClassName="p-4 overflow-x-auto"
      >
        <div className="min-w-[640px]">
          {/* Hour labels */}
          <div className="mb-1 flex items-center gap-1 pl-10">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="flex-1 text-center text-[9px] font-medium text-muted-foreground">
                {h % 2 === 0 ? `${h}` : ""}
              </div>
            ))}
          </div>
          {/* Day rows */}
          {DAYS_VN.map((day, dIdx) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: dIdx * 0.04 }}
              className="mb-1 flex items-center gap-1"
            >
              <div className="w-9 shrink-0 text-[11px] font-semibold text-muted-foreground">{day}</div>
              {Array.from({ length: 24 }).map((_, h) => {
                const cell = heatmap.find((c) => c[0] === h && c[1] === dIdx);
                const v = cell ? cell[2] : 0;
                const ratio = (v - heatMin) / Math.max(1, heatMax - heatMin);
                const opacity = 0.12 + ratio * 0.88;
                const isPeak = ratio > 0.78;
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${v} xe`}
                    className={cn(
                      "group relative flex-1 rounded-sm transition-all hover:z-10 hover:scale-110 hover:ring-2 hover:ring-primary/40",
                      isPeak ? "ring-1 ring-primary/30" : "",
                    )}
                    style={{
                      background: `color-mix(in oklch, var(--primary) ${opacity * 100}%, transparent)`,
                      minHeight: 18,
                    }}
                  />
                );
              })}
            </motion.div>
          ))}
          {/* Footer hint */}
          <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="pl-10">Màu đậm = lưu lượng cao</span>
            <span className="tabular-nums">Cao điểm: T7-CN 17h-19h</span>
          </div>
        </div>
      </SectionCard>

      {/* AI Forecast + Vehicle distribution */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Dự báo AI — 3 giờ tới"
            subtitle={`Mô hình đã học ${aiForecast.daysLearned} ngày dữ liệu thực tế`}
            icon={Brain}
            action={
              <StatusBadge color="purple" pulse>
                {aiForecast.daysLearned} ngày học
              </StatusBadge>
            }
          >
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={forecastChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h) => `${h}h`}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={{ stroke: "var(--border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    domain={[0, "auto"]}
                    tickCount={3}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Thực tế"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--chart-2)" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Dự báo"
                    stroke="var(--chart-5)"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={{ r: 3, fill: "var(--chart-5)" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Per-route breakdown */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {aiForecast.directions.map((dir, i) => {
                const forecastVal = aiForecast.forecast[0]?.perRoute?.[i] || 0;
                                const actualLast = aiForecast.actual.length > 0 ? aiForecast.actual[aiForecast.actual.length - 1] : null;
                const actualVal = actualLast?.perRoute?.[i] || 0;
                const delta = actualVal ? Math.round(((forecastVal - actualVal) / actualVal) * 100) : 0;
                return (
                  <motion.div
                    key={dir}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-border bg-muted/30 p-2.5"
                  >
                    <div className="truncate text-[11px] font-medium text-muted-foreground">{dir}</div>
                    <div className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                      {formatNumber(forecastVal)}
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">xe/h</span>
                    </div>
                    <div className={cn("text-[10px] font-medium tabular-nums", delta > 0 ? "text-destructive" : delta < 0 ? "text-success" : "text-muted-foreground")}>
                      {delta > 0 ? "▲" : delta < 0 ? "▼" : "→"} {Math.abs(delta)}%
                    </div>
                  </motion.div>
                );
              })}
            </div>
            {/* Confidence indicators */}
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <span className="text-[11px] font-semibold text-muted-foreground">Độ tin cậy dự báo:</span>
              {aiForecast.forecast.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-semibold tabular-nums text-foreground">+{i + 1}h</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="font-mono font-semibold tabular-nums text-primary">{f.confidence}%</span>
                </span>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Vehicle distribution donut */}
        <SectionCard
          title="Cơ cấu phương tiện"
          subtitle="Tổng hợp 7 ngày"
          icon={PieIcon}
        >
          <div className="relative h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vehicleData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={3}
                  stroke="none"
                >
                  {vehicleData.map((v) => (
                    <Cell key={v.name} fill={v.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Tổng</span>
              <span className="text-xl font-bold tabular-nums text-foreground">{formatNumber(vehicleTotal)}</span>
              <span className="text-[10px] text-muted-foreground">phương tiện</span>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {vehicleData.map((v, i) => (
              <motion.div
                key={v.name}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: v.color }} />
                  {v.name}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {((v.value / vehicleTotal) * 100).toFixed(1)}%
                </span>
              </motion.div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Signal correlation chart */}
      <SectionCard
        title="Tương quan lưu lượng & pha đèn"
        subtitle="Lưu lượng (cột) và thời lượng xanh 2 pha (đường) — 24 giờ"
        icon={BarChart3}
        action={
          <div className="hidden items-center gap-3 text-[11px] sm:flex">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-sm bg-primary/40" /> Lưu lượng
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-3 rounded-sm" style={{ background: "var(--chart-2)" }} /> Pha 1 (BĐ & XVNT)
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-3 rounded-sm" style={{ background: "var(--chart-5)" }} /> Pha 2 (ĐBP & HX)
            </span>
          </div>
        }
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={correlation} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
              <XAxis
                dataKey="hour"
                tickFormatter={(h) => `${h}h`}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                interval={2}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar yAxisId="left" dataKey="traffic" name="Lưu lượng" fill="var(--primary)" fillOpacity={0.35} radius={[3, 3, 0, 0]} />
              <RLine yAxisId="right" type="monotone" dataKey="greenPhase1" name="Pha 1 xanh" stroke="var(--chart-2)" strokeWidth={2.2} dot={false} />
              <RLine yAxisId="right" type="monotone" dataKey="greenPhase2" name="Pha 2 xanh" stroke="var(--chart-5)" strokeWidth={2.2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Insight banner */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <TrafficCone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <div className="font-semibold text-foreground">Phân tích AI</div>
            <p className="mt-0.5 text-muted-foreground">{signalRec.policy}. Đề xuất điều chỉnh pha theo lưu lượng được cập nhật mỗi 30 phút.</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
