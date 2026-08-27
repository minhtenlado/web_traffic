"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  Settings2,
  Bot,
  Zap,
  Hand,
  Gauge,
  CircleDot,
  ArrowUp,
  ArrowUpLeft,
  Plus,
  Minus,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { DIRECTIONS, SIGNAL_PHASES } from "@/lib/constants";
import { formatClockTime, timeAgo } from "@/lib/formatters";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function getLightState(dirId: string, signalState: any) {
  const currentPhase = SIGNAL_PHASES.find((p) => p.id === signalState.currentPhase);
  const isStraightActive = currentPhase?.directions?.includes(dirId);
  const isLeftTurnActive = (currentPhase as any)?.leftTurnDirections?.includes(dirId);

  // Main straight light
  let straightColor: "green" | "yellow" | "red" = "red";
  let straightCountdown = signalState.countdown;
  if (isStraightActive) {
    if (signalState.countdown > 3) {
      straightColor = "green";
      straightCountdown = signalState.countdown - 3;
    } else {
      straightColor = "yellow";
      straightCountdown = signalState.countdown;
    }
  }

  // Left turn light (arrow)
  let leftTurnColor: "green" | "yellow" | "red" = "red";
  let leftTurnCountdown = signalState.countdown;
  if (isLeftTurnActive) {
    if (signalState.countdown > 3) {
      leftTurnColor = "green";
      leftTurnCountdown = signalState.countdown - 3;
    } else {
      leftTurnColor = "yellow";
      leftTurnCountdown = signalState.countdown;
    }
  }

  return {
    color: straightColor,
    countdown: straightCountdown,
    leftTurn: {
      color: leftTurnColor,
      countdown: leftTurnCountdown,
    }
  };
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
  const setSignalPhase = useTrafficStore((s) => s.setSignalPhase);
  const adjustSignalCountdown = useTrafficStore((s) => s.adjustSignalCountdown);
  const signalRec = useTrafficStore((s) => s.signalRec);

  const currentPhase = SIGNAL_PHASES.find((p) => p.id === signalState.currentPhase) || SIGNAL_PHASES[0];
  const isManual = signalState.mode === "manual";

  // Ring progress: countdown / phase duration
  const phaseDuration = signalState.phaseDurations?.[signalState.currentPhase as keyof typeof signalState.phaseDurations] || 35;
  const ringPct = Math.max(0, Math.min(100, (signalState.countdown / phaseDuration) * 100));

  return (
    <div className="space-y-5">
      {/* Top: Current phase + mode toggle + duration controls */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Current phase display */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Trạng thái đèn hiện tại"
            subtitle={`Chu kỳ #${signalState.cycleNumber || 100}`}
            icon={Timer}
            action={
              <StatusBadge color={isManual ? "amber" : "green"} pulse={!isManual}>
                {isManual ? "Thủ công" : "Tự động (AI)"}
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

                {/* Active directions badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {currentPhase?.directions?.length > 0 && currentPhase.directions.map((dirId) => {
                    const dir = DIRECTIONS.find((d) => d.id === dirId);
                    return (
                      <span
                        key={dirId}
                        className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success ring-1 ring-inset ring-success/20"
                      >
                        <ArrowUp className="h-3 w-3" />
                        Đi thẳng: {dir?.name}
                      </span>
                    );
                  })}
                  {(currentPhase as any)?.leftTurnDirections?.length > 0 && (currentPhase as any).leftTurnDirections.map((dirId: string) => {
                    const dir = DIRECTIONS.find((d) => d.id === dirId);
                    return (
                      <span
                        key={`left-${dirId}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-chart-4/15 px-2.5 py-1 text-xs font-semibold text-chart-4 ring-1 ring-inset ring-chart-4/30"
                      >
                        <ArrowUpLeft className="h-3 w-3" />
                        Rẽ trái: {dir?.name}
                      </span>
                    );
                  })}
                </div>

                {/* Direct Phase Switch Buttons (Thủ công / Can thiệp nhanh) */}
                <div className="space-y-2 pt-1">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Can thiệp / Chuyển pha trực tiếp:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SIGNAL_PHASES.map((p) => {
                      const isActive = p.id === signalState.currentPhase;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            if (!isManual) setSignalMode("manual");
                            setSignalPhase(p.id);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                            isActive
                              ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30"
                              : "border-border bg-card hover:border-primary/50 hover:bg-muted/50 text-foreground"
                          )}
                        >
                          {p.id === "phase_3" ? <ArrowUpLeft className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                          {(p as any).shortName || p.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add / Subtract seconds */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground">Thời gian:</span>
                    <button
                      onClick={() => adjustSignalCountdown(10)}
                      className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted active:scale-95"
                    >
                      <Plus className="h-3 w-3 text-success" /> +10s
                    </button>
                    <button
                      onClick={() => adjustSignalCountdown(-10)}
                      className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted active:scale-95"
                    >
                      <Minus className="h-3 w-3 text-destructive" /> -10s
                    </button>
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
                    {isManual ? "Vận hành viên điều khiển" : "AI tự động luân phiên"}
                  </div>
                </div>
              </div>
              <Switch
                checked={isManual}
                onCheckedChange={(checked) => setSignalMode(checked ? "manual" : "auto")}
                aria-label="Chuyển chế độ đèn"
              />
            </div>

            {/* Phase duration controls */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Gauge className="h-3.5 w-3.5 text-primary" /> Cài đặt thời lượng pha (giây)
              </div>
              {SIGNAL_PHASES.map((phase) => {
                const value = signalState.phaseDurations?.[phase.id as keyof typeof signalState.phaseDurations] || (phase.id === "phase_3" ? 20 : 35);
                return (
                  <div key={phase.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{(phase as any).shortName || phase.name}</span>
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-mono font-bold tabular-nums text-primary">
                        {value}s
                      </span>
                    </div>
                    <Slider
                      value={[value]}
                      min={10}
                      max={90}
                      step={5}
                      onValueChange={(v) => setSignalDuration(phase.id, v[0])}
                      aria-label={`Thời lượng ${phase.name}`}
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground">
                      <span>10s</span>
                      <span>90s</span>
                    </div>
                  </div>
                );
              })}
              
              {isManual && (
                <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-2.5 text-[11px] text-warning">
                  <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Chế độ thủ công đang bật. Bạn có thể bấm chuyển pha đèn tức thì bên trái.</span>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 4-direction traffic light grid with Left Turn Indicators */}
      <SectionCard
        title="Trạng thái đèn 4 hướng (Đi thẳng & Rẽ trái)"
        subtitle="Cập nhật theo thời gian thực — hiển thị cụm đèn đi thẳng và đèn rẽ trái"
        icon={CircleDot}
        bodyClassName="p-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DIRECTIONS.map((dir, i) => {
            const light = getLightState(dir.id, signalState);
            const isStraightGreen = light.color === "green";
            const isLeftGreen = light.leftTurn.color === "green";

            return (
              <motion.div
                key={dir.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -2 }}
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all",
                  (isStraightGreen || isLeftGreen) ? "border-success/40 bg-success/5 shadow-success/5" : "border-border"
                )}
              >
                {/* Direction Header */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <div className="text-sm font-bold text-foreground">{dir.name}</div>
                    <div className="text-[10px] text-muted-foreground">Mã hướng: {dir.short}</div>
                  </div>
                  <span className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                    isStraightGreen ? "bg-success/15 text-success" : isLeftGreen ? "bg-chart-4/15 text-chart-4" : "bg-destructive/15 text-destructive"
                  )}>
                    {isStraightGreen ? "Đang xả luồng" : isLeftGreen ? "Rẽ trái xanh" : "Dừng chờ"}
                  </span>
                </div>

                {/* 2 Traffic Light Pods: Straight + Left Turn */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {/* Pod 1: Đi thẳng (Straight) */}
                  <div className="flex flex-col items-center rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                      <ArrowUp className="h-3.5 w-3.5 text-primary" />
                      <span>Đi thẳng</span>
                    </div>

                    {/* Vertical 3 dots */}
                    <div className="my-2 flex flex-col items-center gap-1 rounded-full border border-border bg-background/90 p-1.5 shadow-inner">
                      {(["red", "yellow", "green"] as const).map((c) => (
                        <span
                          key={`str-${c}`}
                          className={cn(
                            "h-3 w-3 rounded-full transition-all duration-300",
                            light.color === c ? cn(LIGHT_DOT_BG[c], "scale-110 shadow-[0_0_10px_2px]") : "bg-muted opacity-25",
                            light.color === c && c === "green" && "shadow-success/70",
                            light.color === c && c === "yellow" && "shadow-warning/70",
                            light.color === c && c === "red" && "shadow-destructive/70",
                          )}
                        />
                      ))}
                    </div>

                    <div className={cn("text-xs font-bold", LIGHT_TEXT[light.color])}>
                      {LIGHT_LABEL_VN[light.color]} ({light.countdown}s)
                    </div>
                  </div>

                  {/* Pod 2: Rẽ trái (Left Turn Arrow) */}
                  <div className="flex flex-col items-center rounded-xl border border-border/80 bg-muted/30 p-2.5 text-center">
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                      <ArrowUpLeft className="h-3.5 w-3.5 text-chart-4" />
                      <span>Rẽ trái</span>
                    </div>

                    {/* Left turn arrow indicator with glowing colors */}
                    <div className="my-2 flex flex-col items-center gap-1 rounded-full border border-border bg-background/90 p-1.5 shadow-inner">
                      {(["red", "yellow", "green"] as const).map((c) => (
                        <div
                          key={`left-${c}`}
                          className={cn(
                            "flex h-3 w-3 items-center justify-center rounded-full transition-all duration-300",
                            light.leftTurn.color === c ? cn(LIGHT_DOT_BG[c], "scale-110 shadow-[0_0_10px_2px]") : "bg-muted opacity-25",
                            light.leftTurn.color === c && c === "green" && "shadow-success/70",
                            light.leftTurn.color === c && c === "yellow" && "shadow-warning/70",
                            light.leftTurn.color === c && c === "red" && "shadow-destructive/70",
                          )}
                        >
                          <ArrowUpLeft className="h-2 w-2 text-background stroke-[3]" />
                        </div>
                      ))}
                    </div>

                    <div className={cn("text-xs font-bold", LIGHT_TEXT[light.leftTurn.color])}>
                      {LIGHT_LABEL_VN[light.leftTurn.color]} ({light.leftTurn.countdown}s)
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </SectionCard>

      {/* AI Recommendations */}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {signalRec.recommendations?.map((rec, i) => (
            <div key={i} className="flex flex-col justify-between rounded-xl border border-border bg-muted/20 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{rec.phase}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    Độ tin cậy: {rec.confidence}%
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{rec.reason}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                <span className="text-muted-foreground">Hiện tại: <b className="text-foreground">{rec.currentGreen}s</b></span>
                <span className="text-primary font-bold">Đề xuất: {rec.suggestedGreen}s</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
