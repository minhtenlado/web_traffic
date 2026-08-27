"use client";

import { motion } from "framer-motion";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  green: {
    bg: "bg-success/10",
    text: "text-success",
    ring: "ring-success/20",
    dot: "bg-success",
  },
  amber: {
    bg: "bg-warning/10",
    text: "text-warning",
    ring: "ring-warning/20",
    dot: "bg-warning",
  },
  red: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    ring: "ring-destructive/20",
    dot: "bg-destructive",
  },
  cyan: {
    bg: "bg-chart-2/10",
    text: "text-chart-2",
    ring: "ring-chart-2/20",
    dot: "bg-chart-2",
  },
  purple: {
    bg: "bg-chart-5/10",
    text: "text-chart-5",
    ring: "ring-chart-5/20",
    dot: "bg-chart-5",
  },
};

export function StatusBadge({
  color = "green",
  children,
  dot = true,
  pulse = false,
  className,
}: {
  color?: "green" | "amber" | "red" | "cyan" | "purple" | string;
  children: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const c = COLOR_MAP[color] || COLOR_MAP.green;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        c.bg,
        c.text,
        c.ring,
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", c.dot)} />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", c.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  trend,
  trendValue,
  trendColor,
  color = "primary",
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  trendColor?: "success" | "destructive" | "muted" | "warning";
  color?: "primary" | "green" | "amber" | "red" | "cyan" | "purple";
  delay?: number;
}) {
  const colorMap: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary",
    green: "from-success/20 to-success/5 text-success",
    amber: "from-warning/20 to-warning/5 text-warning",
    red: "from-destructive/20 to-destructive/5 text-destructive",
    cyan: "from-chart-2/20 to-chart-2/5 text-chart-2",
    purple: "from-chart-5/20 to-chart-5/5 text-chart-5",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {value}
            </span>
            {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
          </div>
          {trendValue && (
            <span
              className={cn(
                "mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium",
                trendColor === "success" || (!trendColor && trend === "up") ? "text-success" : "",
                trendColor === "destructive" || (!trendColor && trend === "down") ? "text-destructive" : "",
                trendColor === "warning" ? "text-warning" : "",
                trendColor === "muted" || (!trendColor && trend === "neutral") ? "text-muted-foreground" : "",
              )}
            >
              {trend === "up" && "▲"}
              {trend === "down" && "▼"}
              {trendValue}
            </span>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm",
            colorMap[color],
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.1} />
        </div>
      </div>
    </motion.div>
  );
}

export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
  noPadding,
}: {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-sm",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" strokeWidth={2.1} />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-5", bodyClassName)}>{children}</div>
    </motion.section>
  );
}
