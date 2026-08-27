"use client";

import { motion } from "framer-motion";
import {
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
  Brain,
  Target,
  Crosshair,
  Repeat,
  Sparkles,
  History,
  Trophy,
  Layers,
  Boxes,
  HardDrive,
  Timer,
  ArrowUpRight,
  TrendingUp,
  Activity,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { formatDate, formatTime, timeAgo } from "@/lib/formatters";
import { StatusBadge, SectionCard } from "@/components/shared/ui";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function ModelManagement() {
  const modelInfo = useTrafficStore((s) => s.modelInfo);
  const current = modelInfo.current;
  const previous = modelInfo.previous;

  const accDelta = (current.accuracy - previous.accuracy).toFixed(1);
  const f1Delta = ((current.f1Score - previous.f1Score) * 100).toFixed(1);

  return (
    <div className="space-y-5">
      {/* Current model — hero card */}
      <SectionCard
        title="Mô hình AI hiện tại"
        subtitle={`Phiên bản ${current.version} · Cập nhật ${timeAgo(current.lastUpdated)}`}
        icon={Brain}
        action={
          <StatusBadge color="green" pulse>
            {current.status === "active" ? "Đang hoạt động" : current.status}
          </StatusBadge>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Circular accuracy */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 p-5"
          >
            <CircularProgress value={current.accuracy} label="Độ chính xác" suffix="%" />
            <div className="text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                So với phiên bản trước
              </div>
              <div className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-success">
                <ArrowUpRight className="h-4 w-4" />
                +{accDelta}%
              </div>
            </div>
          </motion.div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            <MetricTile
              icon={Target}
              label="F1 Score"
              value={current.f1Score.toFixed(2)}
              trend={`+${f1Delta}%`}
              delay={0.05}
            />
            <MetricTile
              icon={Crosshair}
              label="Precision"
              value={current.precision.toFixed(2)}
              trend="tốt"
              delay={0.1}
            />
            <MetricTile
              icon={Repeat}
              label="Recall"
              value={current.recall.toFixed(2)}
              trend="ổn định"
              delay={0.15}
            />
            <MetricTile
              icon={Timer}
              label="Inference time"
              value={`${current.inferenceTime}ms`}
              trend="nhanh"
              delay={0.2}
            />
          </div>
        </div>

        {/* Info tiles */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5 lg:grid-cols-4">
          <InfoTile icon={Layers} label="Kiến trúc" value={current.type} />
          <InfoTile icon={Boxes} label="Framework" value={current.framework} />
          <InfoTile icon={HardDrive} label="Kích thước" value={current.size} />
          <InfoTile icon={Cpu} label="Cập nhật" value={formatDate(current.lastUpdated)} />
        </div>
      </SectionCard>

      {/* History chart + comparison */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Accuracy history */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Lịch sử độ chính xác"
            subtitle="Theo từng phiên bản mô hình"
            icon={History}
          >
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={modelInfo.history} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="version"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                  />
                  <YAxis
                    domain={[80, 100]}
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
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(v: number) => [`${v}%`, "Độ chính xác"]}
                    labelFormatter={(l) => `Phiên bản ${l}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="accuracy"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Comparison */}
        <SectionCard
          title="So sánh phiên bản"
          subtitle={`${current.version} vs ${previous.version}`}
          icon={Trophy}
        >
          <div className="space-y-4">
            <ComparisonRow
              label="Độ chính xác"
              current={`${current.accuracy}%`}
              previous={`${previous.accuracy}%`}
              delta={`+${accDelta}%`}
              positive
            />
            <ComparisonRow
              label="F1 Score"
              current={current.f1Score.toFixed(2)}
              previous={previous.f1Score.toFixed(2)}
              delta={`+${f1Delta}%`}
              positive
            />
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>Đánh giá tổng thể</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                Phiên bản mới cải thiện cả precision và recall
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Đề xuất giữ phiên bản {current.version} làm mặc định sản xuất.
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Predictions table */}
      <SectionCard
        title="Hiệu suất dự đoán gần đây"
        subtitle="20 dự đoán gần nhất — so sánh dự đoán vs thực tế"
        icon={Activity}
        noPadding
        bodyClassName="p-0"
      >
        <div className="max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="pl-5 text-xs uppercase tracking-wide text-muted-foreground">Thời gian</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Dự đoán</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Thực tế</TableHead>
                <TableHead className="text-xs uppercase tracking-wide text-muted-foreground">Kết quả</TableHead>
                <TableHead className="pr-5 text-xs uppercase tracking-wide text-muted-foreground">Độ tin cậy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelInfo.predictions.map((p, i) => {
                const match = p.predicted === p.actual;
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.4) }}
                    className="border-border transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="pl-5 py-2.5 text-xs tabular-nums text-muted-foreground">
                      {formatTime(p.timestamp)}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium text-foreground">{p.predicted}</TableCell>
                    <TableCell className="py-2.5 text-xs font-medium text-foreground">{p.actual}</TableCell>
                    <TableCell className="py-2.5">
                      {match ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                          <Target className="h-3 w-3" /> Đúng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          <Crosshair className="h-3 w-3" /> Sai
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              p.confidence >= 0.9 ? "bg-success" : p.confidence >= 0.75 ? "bg-warning" : "bg-destructive",
                            )}
                            style={{ width: `${p.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {(p.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}

function CircularProgress({
  value,
  label,
  suffix,
}: {
  value: number;
  label: string;
  suffix?: string;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="10"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {value.toFixed(1)}
          {suffix}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  trend,
  delay = 0,
}: {
  icon: typeof Target;
  label: string;
  value: string;
  trend?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2 }}
      className="rounded-xl border border-border bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" strokeWidth={2.1} />
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</div>
      {trend && (
        <div className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-success">
          <TrendingUp className="h-3 w-3" />
          {trend}
        </div>
      )}
    </motion.div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" strokeWidth={2.1} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

function ComparisonRow({
  label,
  current,
  previous,
  delta,
  positive,
}: {
  label: string;
  current: string;
  previous: string;
  delta: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold tabular-nums text-foreground">{current}</span>
          <span className="text-xs text-muted-foreground line-through tabular-nums">{previous}</span>
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-semibold",
          positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        )}
      >
        <ArrowUpRight className="h-3 w-3" />
        {delta}
      </span>
    </div>
  );
}
