"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  Settings2,
  Bot,
  History,
  ArrowRight,
  Zap,
  Hand,
  Gauge,
  RotateCw,
  CircleDot,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { DIRECTIONS, SIGNAL_PHASES } from "@/lib/constants";
import { formatClockTime, timeAgo } from "@/lib/formatters";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

function getLightState(dirId: string, signalState: any) {
  const currentPhase = SIGNAL_PHASES.find((p) => p.id === signalState.currentPhase);
  const isActive = currentPhase?.directions?.includes(dirId);
  if (isActive) {
    if (signalState.countdown > 3) {
      return { color: "green" as const, countdown: signalState.countdown - 3 };
    }
    return { color: "yellow" as const, countdown: signalState.countdown };
  }
  return { color: "red" as const, countdown: signalState.countdown };
}

const LIGHT_RING: Record<string, string> = {
  green: "bg-success text-success-foreground shadow-[0_0_24px_-4px] shadow-success/60",
  yellow: "bg-warning text-warning-foreground shadow-[0_0_24px_-4px] shadow-warning/60",
  red: "bg-destructive text-destructive-foreground shadow-[0_0_24px_-4px] shadow-destructive/60",
};

const LIGHT_DOT_BG: Record<string, string> = {
  green: "bg-success",
  yellow: "bg-warning",
  red: "bg-destructive",
};

const LIGHT_TEXT: Record<string, string> = {
  green: "text-success",
  yellow: "text-warning",
  red: "text-destructive",
};

const LIGHT_LABEL_VN: Record<string, string> = {
  green: "Xanh",
  yellow: "Vàng",
  red: "Đỏ",
};

export function SignalControl() {
  const signalState = useTrafficStore((s) => s.signalState);
  const setSignalMode = useTrafficStore((s) => s.setSignalMode);
  const setSignalDuration = useTrafficStore((s) => s.setSignalDuration);
  const signalRec = useTrafficStore((s) => s.signalRec);
  const chartHistory = useTrafficStore((s) => s.chartHistory);

  const currentPhase = SIGNAL_PHASES.find((p) => p.id === signalState.currentPhase);
  const isManual = signalState.mode === "manual";

  // Ring progress: countdown / phase duration
  const phaseDuration = signalState.phaseDurations[signalState.currentPhase as "phase_1" | "phase_2"] || 35;
  const ringPct = Math.max(0, Math.min(100, (signalState.countdown / phaseDuration) * 100));

  // Build phase history timeline (mock from chartHistory)
  const phaseHistory = useMemo(() => {
    const items: { time: string; phase: "phase_1" | "phase_2"; cycle: number }[] = [];
    const baseCycle = signalState.cycleNumber || 100;
    const altPhase = signalState.currentPhase === "phase_1" ? "phase_2" : "phase_1";
    for (let i = 6; i >= 1; i--) {
      const t = new Date(Date.now() - i * phaseDuration * 1000);
      const phase = i % 2 === 0 ? signalState.currentPhase : altPhase;
      items.push({ time: formatClockTime(t), phase: phase as "phase_1" | "phase_2", cycle: baseCycle - i + 1 });
    }
    items.push({
      time: formatClockTime(new Date()),
      phase: signalState.currentPhase as "phase_1" | "phase_2",
      cycle: baseCycle,
    });
    return items.reverse();
  }, [signalState.currentPhase, signalState.cycleNumber, phaseDuration]);

  return (
    <div className="space-y-5">
      {/* Top: Current phase + mode toggle + duration controls */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Current phase display */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Trạng thái đèn hiện tại"
            subtitle={`Chu kỳ #${signalState.cycleNumber}`}
            icon={Timer}
            action={
              <StatusBadge color={isManual ? "amber" : "green"} pulse={!isManual}>
                {isManual ? "Thủ công" : "Tự động"}
              </StatusBadge>
            }
            bodyClassName="p-0"
          >
            <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:gap-8">
              {/* Countdown ring */}
              <div className="relative h-44 w-44 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="var(--muted)" strokeWidth="6" />
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 44}
                    animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - ringPct / 100) }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Đếm ngược
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={signalState.countdown}
                      initial={{ scale: 0.5, opacity: 0, y: -4 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.5, opacity: 0, y: 4 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        "text-5xl font-bold tabular-nums leading-none",
                        signalState.countdown <= 3 ? "text-warning" : "text-foreground",
                      )}
                    >
                      {signalState.countdown}
                    </motion.div>
                  </AnimatePresence>
                  <span className="text-[10px] font-medium text-muted-foreground">giây</span>
                </div>
              </div>

              {/* Phase info */}
              <div className="flex-1 space-y-4 text-center sm:text-left">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Pha đang hoạt động
                  </div>
                  <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
                    {currentPhase?.name}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {currentPhase?.directions?.map((dirId) => {
                    const dir = DIRECTIONS.find((d) => d.id === dirId);
                    return (
                      <span
                        key={dirId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-success/20"
                      >
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                        {dir?.name}
                      </span>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-muted/30 p-2.5">
                    <div className="text-[10px] uppercase text-muted-foreground">Thời lượng pha</div>
                    <div className="font-bold tabular-nums text-foreground">{phaseDuration}s</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-2.5">
                    <div className="text-[10px] uppercase text-muted-foreground">Tiến trình</div>
                    <div className="font-bold tabular-nums text-foreground">{Math.round(ringPct)}%</div>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Mode + duration controls */}
        <SectionCard
          title="Điều khiển chế độ"
          subtitle="Chế độ vận hành đèn"
          icon={Settings2}
        >
          <div className="space-y-5">
            {/* Mode toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                    isManual ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
                  )}
                >
                  {isManual ? <Hand className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {isManual ? "Chế độ thủ công" : "Chế độ tự động"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {isManual ? "Vận hành viên điều khiển" : "AI tối ưu pha đèn"}
                  </div>
                </div>
              </div>
              <Switch
                checked={isManual}
                onCheckedChange={(checked) => setSignalMode(checked ? "manual" : "auto")}
                aria-label="Chuyển chế độ đèn"
              />
            </div>

            {/* Phase duration controls — visible always, but styled disabled in auto */}
            <div className={cn("space-y-4 transition-opacity", !isManual && "pointer-events-none opacity-50")}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Gauge className="h-3.5 w-3.5" /> Thời lượng pha (giây)
              </div>
              {SIGNAL_PHASES.map((phase) => {
                const value = signalState.phaseDurations[phase.id as "phase_1" | "phase_2"] || 35;
                return (
                  <div key={phase.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{phase.name}</span>
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono font-bold tabular-nums text-primary">
                        {value}s
                      </span>
                    </div>
                    <Slider
                      value={[value]}
                      min={15}
                      max={90}
                      step={5}
                      onValueChange={(v) => setSignalDuration(phase.id as "phase_1" | "phase_2", v[0])}
                      aria-label={`Thời lượng ${phase.name}`}
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>15s</span>
                      <span>90s</span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-2.5 text-[11px] text-warning">
                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Chế độ thủ công — AI vẫn đề xuất nhưng không tự áp dụng.</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 4-direction traffic light grid */}
      <SectionCard
        title="Trạng thái đèn 4 hướng"
        subtitle="Cập nhật thời gian thực theo pha hiện tại"
        icon={CircleDot}
        bodyClassName="p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DIRECTIONS.map((dir, i) => {
            const light = getLightState(dir.id, signalState);
            const phase = SIGNAL_PHASES.find((p) => p.directions?.includes(dir.id));
            return (
              <motion.div
                key={dir.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -2 }}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-3.5 transition-colors",
                  light.color === "green" && "border-success/30 bg-success/5",
                  light.color === "yellow" && "border-warning/30 bg-warning/5",
                  light.color === "red" && "border-destructive/20 bg-destructive/5",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">{dir.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">
                      {phase?.id === "phase_1" ? "Pha 1" : "Pha 2"} · {dir.short}
                    </div>
                  </div>
                  {/* Light indicator (3-dot vertical) */}
                  <div className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-card/95 p-1.5 shadow-sm">
                    {(["red", "yellow", "green"] as const).map((c) => (
                      <span
                        key={c}
                        className={cn(
                          "h-2.5 w-2.5 rounded-full transition-all duration-300",
                          light.color === c ? cn(LIGHT_DOT_BG[c], "scale-110 shadow-[0_0_8px_2px]") : "bg-muted opacity-30",
                          light.color === c && c === "green" && "shadow-success/60",
                          light.color === c && c === "yellow" && "shadow-warning/60",
                          light.color === c && c === "red" && "shadow-destructive/60",
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Trạng thái</div>
                    <div className={cn("text-base font-bold", LIGHT_TEXT[light.color])}>
                      {LIGHT_LABEL_VN[light.color]}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Còn lại</div>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={light.countdown}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn(
                          "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-base font-bold tabular-nums",
                          LIGHT_RING[light.color],
                        )}
                      >
                        {light.countdown}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </SectionCard>

      {/* AI Signal Recommendations + Phase history */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* AI Recommendations */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Đề xuất điều chỉnh từ AI"
            subtitle={signalRec.policy}
            icon={Bot}
            action={
              <div className="hidden flex-col items-end text-[10px] sm:flex">
                <span className="font-semibold text-foreground">Lần cuối: {timeAgo(signalRec.lastAdjusted)}</span>
                <span className="text-muted-foreground">Xem xét lại: {timeAgo(signalRec.nextReview).replace("trước", "nữa")}</span>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {signalRec.recommendations.map((rec, i) => {
                const delta = rec.suggestedGreen - rec.currentGreen;
                const isIncrease = delta > 0;
                return (
                  <motion.div
                    key={rec.phase}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-foreground">{rec.phase}</div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono tabular-nums text-muted-foreground">
                            {rec.currentGreen}s
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 font-mono font-bold tabular-nums",
                              isIncrease ? "bg-success/15 text-success" : delta < 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {rec.suggestedGreen}s
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          isIncrease ? "bg-success/15 text-success" : delta < 0 ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isIncrease ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)}s
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-muted-foreground">{rec.reason}</p>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-[10px]">
                        <span className="font-medium text-muted-foreground">Độ tin cậy</span>
                        <span className="font-mono font-bold tabular-nums text-primary">{rec.confidence}%</span>
                      </div>
                      <Progress value={rec.confidence} className="h-1.5" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-chart-5/20 bg-chart-5/5 p-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <RotateCw className="h-3.5 w-3.5 text-chart-5" />
                Lịch sử xem xét lại: {formatClockTime(signalRec.nextReview)}
              </span>
              <span className="font-medium text-chart-5">{signalRec.policy}</span>
            </div>
          </SectionCard>
        </div>

        {/* Phase history timeline */}
        <SectionCard
          title="Lịch sử chuyển pha"
          subtitle="7 lần gần nhất"
          icon={History}
          bodyClassName="p-4"
        >
          <div className="relative space-y-3 pl-4">
            <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border" />
            {phaseHistory.map((item, i) => {
              const isCurrent = i === phaseHistory.length - 1;
              const phase = SIGNAL_PHASES.find((p) => p.id === item.phase);
              const color =
                phase?.color === "var(--chart-2)" ? "bg-chart-2" : "bg-primary";
              return (
                <motion.div
                  key={`${item.cycle}-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative"
                >
                  <span
                    className={cn(
                      "absolute -left-[11px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                      color,
                      isCurrent && "animate-pulse ring-2 ring-primary/40",
                    )}
                  />
                  <div
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-xs transition-colors",
                      isCurrent ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {phase?.name.replace(/^Pha \d+ — /, "")}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">#{item.cycle}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {phase?.id === "phase_1" ? "Pha 1" : "Pha 2"}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{item.time}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px] text-muted-foreground">
            <span>Tổng điểm lịch sử: {chartHistory.length}</span>
            <span className="font-semibold text-primary">Hoạt động bình thường</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
