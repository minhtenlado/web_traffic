"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CarFront,
  CameraOff,
  TrafficCone,
  CloudRain,
  Bell,
  BellRing,
  CheckCheck,
  ShieldAlert,
  ShieldCheck,
  AlertOctagon,
  Inbox,
} from "lucide-react";
import { useTrafficStore, type AlertItem } from "@/lib/store";
import { ALERT_TYPES } from "@/lib/constants";
import { timeAgo } from "@/lib/formatters";
import { StatCard, StatusBadge, SectionCard } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPE_ICON: Record<string, typeof AlertTriangle> = {
  congestion: AlertTriangle,
  accident: CarFront,
  camera_error: CameraOff,
  signal_error: TrafficCone,
  weather: CloudRain,
};

const SEVERITY_STRIPE: Record<string, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-chart-2",
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: "Nghiêm trọng",
  warning: "Cảnh báo",
  info: "Thông tin",
};

type TypeFilter = "all" | keyof typeof ALERT_TYPES;


export function Alerts() {
  const alerts = useTrafficStore((s) => s.alerts);
  const acknowledgeAlert = useTrafficStore((s) => s.acknowledgeAlert);
  const acknowledgeAllAlerts = useTrafficStore((s) => s.acknowledgeAllAlerts);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");


  const stats = useMemo(() => {
    const active = alerts.filter((a) => !a.acknowledged);
    const critical = active.filter((a) => a.severity === "critical");
    const warnings = active.filter((a) => a.severity === "warning");
    const ackedToday = alerts.filter((a) => a.acknowledged);
    return {
      active: active.length,
      critical: critical.length,
      warnings: warnings.length,
      acknowledged: ackedToday.length,
    };
  }, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (a.acknowledged) return false;
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      return true;
    });
  }, [alerts, typeFilter]);

  const hasActive = stats.active > 0;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={BellRing}
          label="Đang hoạt động"
          value={stats.active}
          unit="cảnh báo"
          trend={stats.active > 3 ? "up" : "neutral"}
          trendValue={stats.active > 3 ? "cần xử lý" : "ổn định"}
          color="red"
          delay={0}
        />
        <StatCard
          icon={AlertOctagon}
          label="Nghiêm trọng"
          value={stats.critical}
          unit="sự kiện"
          trend={stats.critical > 0 ? "up" : "neutral"}
          trendValue={stats.critical > 0 ? "ưu tiên" : "không có"}
          color="red"
          delay={0.05}
        />
        <StatCard
          icon={ShieldAlert}
          label="Cảnh báo"
          value={stats.warnings}
          unit="sự kiện"
          trend="neutral"
          trendValue="theo dõi"
          color="amber"
          delay={0.1}
        />

      </div>

      {/* Filter bar + bulk action */}
      <SectionCard
        title="Danh sách cảnh báo"
        subtitle={`${filtered.length} / ${alerts.length} cảnh báo`}
        icon={Bell}
        action={
          <Button
            size="sm"
            variant="default"
            onClick={acknowledgeAllAlerts}
            disabled={!hasActive}
            className="gap-1.5"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Xác nhận tất cả
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Loại:
              </span>
              {[
                { id: "all", label: "Tất cả" },
                { id: "congestion", label: "Ùn tắc" },
                { id: "accident", label: "Tai nạn" },
                { id: "camera_error", label: "Camera lỗi" },
                { id: "signal_error", label: "Đèn lỗi" },
                { id: "weather", label: "Thời tiết" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setTypeFilter(opt.id as TypeFilter)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    typeFilter === opt.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>


          </div>

          {/* Alert list */}
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="max-h-[640px] space-y-2.5 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {filtered.map((alert, i) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    index={i}
                    onAck={() => acknowledgeAlert(alert.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function AlertRow({
  alert,
  index,
  onAck,
}: {
  alert: AlertItem;
  index: number;
  onAck: () => void;
}) {
  const Icon = TYPE_ICON[alert.type] ?? AlertTriangle;
  const stripe = SEVERITY_STRIPE[alert.severity] ?? "bg-muted-foreground";
  const isActive = !alert.acknowledged;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
      whileHover={{ y: -1 }}
      className={cn(
        "relative flex items-start gap-3 overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-shadow hover:shadow-md hover:shadow-primary/5",
        isActive && (alert.severity === "critical" ? "border-destructive/30" : alert.severity === "warning" ? "border-warning/30" : "border-chart-2/30"),
      )}
    >
      {/* Severity stripe */}
      <div className={cn("absolute inset-y-0 left-0 w-1", stripe)} />

      {/* Icon */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          alert.severity === "critical" && "bg-destructive/10 text-destructive",
          alert.severity === "warning" && "bg-warning/10 text-warning",
          alert.severity === "info" && "bg-chart-2/10 text-chart-2",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={2.1} />
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{alert.label}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {SEVERITY_TEXT[alert.severity]}
          </span>
          {isActive ? (
            <StatusBadge color={alert.severity === "critical" ? "red" : alert.severity === "warning" ? "amber" : "cyan"} pulse>
              Đang hoạt động
            </StatusBadge>
          ) : (
            <StatusBadge color="green">Đã xử lý</StatusBadge>
          )}
        </div>
        <p className="mt-1 text-sm text-foreground/90">{alert.message}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CameraOff className="h-3 w-3" />
            {alert.camera}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Bell className="h-3 w-3" />
            {timeAgo(alert.timestamp)}
          </span>
        </div>
      </div>

      {/* Action */}
      <div className="shrink-0">
        {isActive ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onAck}
            className="gap-1.5 border-success/40 text-success hover:bg-success/10 hover:text-success"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Xác nhận
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            Đã xử lý
          </span>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center gap-3 py-12 text-center"
    >
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-success/20 opacity-40" />
        <Inbox className="h-8 w-8 text-success" strokeWidth={1.8} />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-foreground">Không có cảnh báo nào</h4>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Hệ thống đang vận hành ổn định. Mọi cảnh báo mới sẽ xuất hiện tại đây để bạn xử lý kịp thời.
        </p>
      </div>
    </motion.div>
  );
}
