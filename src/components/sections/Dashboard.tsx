"use client";

import { motion } from "framer-motion";
import {
  Car,
  Timer,
  AlertTriangle,
  Camera,
  CloudRain,
  Sun,
  Wind,
  Droplets,
  Radar,
  Video,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS, TRAFFIC_LABELS, type TrafficLabelKey } from "@/lib/constants";
import { formatNumber } from "@/lib/formatters";
import { StatCard, StatusBadge, SectionCard } from "@/components/shared/ui";
import { IntersectionMap } from "@/components/shared/IntersectionMap";
import { cn } from "@/lib/utils";

const CAM_INFO: Record<string, { name: string; location: string }> = {
  cam_01: { name: "Camera 1", location: "Cầu Thị Nghè - Hàng Xanh" },
  cam_02: { name: "Camera 2", location: "Cầu Điện Biên Phủ - Hàng Xanh" },
  cam_03: { name: "Camera 3", location: "Đinh Bộ Lĩnh - Bạch Đằng" },
  cam_04: { name: "Camera 4", location: "Điện Biên Phủ - Nguyễn Gia Trí" },
  cam_05: { name: "Camera 5", location: "Viện Máy tính (XVNT)" },
  cam_06: { name: "Camera 6", location: "Hàng Xanh - Bạch Đằng" },
  cam_07: { name: "Camera 7", location: "Hàng Xanh - Cầu Văn Thánh" },
};

function labelDisplay(mappedLabel?: string | null, isError?: boolean) {
  if (isError) return { text: "MẤT KẾT NỐI", cls: "red", emoji: "⚠️" };
  const entry = mappedLabel ? TRAFFIC_LABELS[mappedLabel as TrafficLabelKey] : null;
  if (!entry) return { text: "Đang chờ", cls: "cyan", emoji: "⏳" };
  const emoji = entry.cls === "red" ? "🔴" : entry.cls === "amber" ? "🟠" : "🟢";
  return { text: entry.text, cls: entry.cls, emoji };
}

export function Dashboard() {
  const metrics = useTrafficStore((s) => s.metrics);
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const weather = useTrafficStore((s) => s.weather);
  const routeStats = useTrafficStore((s) => s.routeStats);
  const isOffline = useTrafficStore((s) => s.isBoardOffline);
  const signalState = useTrafficStore((s) => s.signalState);
  const setActive = useTrafficStore((s) => s.setActiveSection);

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Car}
          label="Tổng số xe"
          value={formatNumber(metrics.totalVehicles)}
          unit="xe"
          trend="up"
          trendValue="realtime"
          color="primary"
          delay={0}
        />
        <StatCard
          icon={Timer}
          label="Thời gian chờ TB"
          value={metrics.avgWaitTime}
          unit="giây"
          trend="down"
          trendValue="ổn định"
          color="amber"
          delay={0.05}
        />
        <StatCard
          icon={AlertTriangle}
          label="Cảnh báo hoạt động"
          value={metrics.activeAlerts}
          unit="sự kiện"
          trend={metrics.activeAlerts > 2 ? "up" : "neutral"}
          trendValue={metrics.activeAlerts > 2 ? "cần xử lý" : "bình thường"}
          color="red"
          delay={0.1}
        />
      </div>

      {/* Route summary */}
      <SectionCard
        title="Tình trạng các hướng"
        subtitle="Tổng hợp từ 7 camera thời gian thực"
        icon={Radar}
        action={
          <button
            onClick={() => setActive("analytics")}
            className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            Chi tiết <ArrowRight className="h-3 w-3" />
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {routeStats.length === 0 && (
            <div className="col-span-full flex items-center gap-3 py-4 text-sm text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Đang tải dữ liệu thời gian thực...
            </div>
          )}
          {routeStats.map((route, i) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-muted/30 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{route.name}</span>
                <StatusBadge color={route.statusColor} pulse={route.statusColor !== "green"}>
                  {route.status}
                </StatusBadge>
              </div>
              <div className="mb-2 flex items-baseline gap-1">
                <span className="text-xl font-bold tabular-nums text-foreground">{formatNumber(route.vehicleCount)}</span>
                <span className="text-xs text-muted-foreground">xe</span>
              </div>
              {/* Density bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${route.density}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    route.statusColor === "red" && "bg-destructive",
                    route.statusColor === "amber" && "bg-warning",
                    route.statusColor === "green" && "bg-success",
                  )}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{route.cameras.join(", ")}</span>
                <span className="tabular-nums">{route.density}%</span>
              </div>
              {route.isReference && (
                <span className="mt-1.5 inline-block rounded bg-chart-5/10 px-1.5 py-0.5 text-[9px] font-medium text-chart-5">
                  Camera tham chiếu
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </SectionCard>

      {/* Camera status grid */}
      <SectionCard
        title="Trạng thái Camera — Realtime"
        subtitle="Cập nhật mỗi 5 giây"
        icon={Video}
        action={
          <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
            <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-current" />
            LIVE
          </span>
        }
      >
        {!realtimeCams ? (
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Đang kết nối dữ liệu...
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CAMERAS.map((cam, i) => {
              const camData = realtimeCams[cam.id] as any;
              const isError = isOffline || camData?.status === "ERROR" || camData?.status === "OFFLINE";
              const info = CAM_INFO[cam.id] || { name: cam.id, location: "" };
              const { text, cls } = labelDisplay(camData?.mapped_label, isError);
              const ts = camData?.timestamp?.split(" ")[1] || "—";

              return (
                <motion.div
                  key={cam.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -2 }}
                  className={cn(
                    "relative overflow-hidden rounded-xl border bg-card p-3 transition-colors",
                    cls === "red" && "border-destructive/30",
                    cls === "amber" && "border-warning/30",
                    cls === "green" && "border-success/20",
                    cls === "cyan" && "border-border",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{info.name}</span>
                    <StatusBadge color={cls} pulse={!isError && cls !== "green"}>
                      {isError ? "⚠️" : cls === "red" ? "🔴" : cls === "amber" ? "🟠" : "🟢"} {text}
                    </StatusBadge>
                  </div>
                  <div className="mb-2 truncate text-xs text-muted-foreground" title={info.location}>
                    {info.location}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Số xe</div>
                      <div className="font-semibold tabular-nums text-foreground">
                        {isError ? "—" : formatNumber(camData?.count || 0)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <div className="text-[10px] uppercase text-muted-foreground">Cập nhật</div>
                      <div className="font-mono font-semibold tabular-nums text-foreground">{ts}</div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Map + Weather */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Intersection map */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Bản đồ ngã tư Hàng Xanh"
            subtitle={`Pha hiện tại: ${signalState.currentPhase === "phase_1" ? "Bạch Đằng & XVNT" : "ĐBP & Hàng Xanh"} · Đếm ngược ${signalState.countdown}s`}
            icon={Radar}
            noPadding
            bodyClassName="p-4"
          >
            <IntersectionMap />
          </SectionCard>
        </div>

        {/* Weather */}
        <div>
          <SectionCard title="Thời tiết" subtitle="Ngã tư Hàng Xanh" icon={weather?.is_raining ? CloudRain : Sun}>
            {weather ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-chart-2/10">
                    <motion.div
                      key={weather.is_raining ? "rain" : "sun"}
                      initial={{ rotate: -10, scale: 0.8 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      {weather.is_raining ? (
                        <CloudRain className="h-8 w-8 text-chart-2" />
                      ) : (
                        <Sun className="h-8 w-8 text-warning" />
                      )}
                    </motion.div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold tabular-nums text-foreground">{weather.temperature}</span>
                      <span className="text-sm text-muted-foreground">°C</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {weather.is_raining ? "Đang mưa" : "Trời quang"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-center">
                    <Droplets className="mx-auto mb-1 h-4 w-4 text-chart-2" />
                    <div className="text-[10px] uppercase text-muted-foreground">Độ ẩm</div>
                    <div className="text-sm font-semibold tabular-nums text-foreground">{weather.humidity}%</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-center">
                    <CloudRain className="mx-auto mb-1 h-4 w-4 text-chart-2" />
                    <div className="text-[10px] uppercase text-muted-foreground">Mưa</div>
                    <div className="text-sm font-semibold tabular-nums text-foreground">{weather.rain_intensity}mm</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-center">
                    <Wind className="mx-auto mb-1 h-4 w-4 text-chart-2" />
                    <div className="text-[10px] uppercase text-muted-foreground">Gió</div>
                    <div className="text-sm font-semibold tabular-nums text-foreground">{weather.wind_speed}km/h</div>
                  </div>
                </div>
                {weather.is_raining && (
                  <div className="flex items-start gap-2 rounded-lg border border-chart-2/30 bg-chart-2/10 p-2.5 text-xs text-chart-2">
                    <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Mưa có thể gây ùn tắc — hệ thống theo dõi sát lưu lượng.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Đang tải dữ liệu thời tiết...
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
