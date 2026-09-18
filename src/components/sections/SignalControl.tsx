"use client";

import { useMemo, useState, useEffect } from "react";
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
  Cpu,
  Activity,
  Camera,
  ShieldCheck,
  EyeOff,
  Radio,
  CheckCircle2,
  PowerOff,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { DIRECTIONS, SIGNAL_PHASES } from "@/lib/constants";
import { formatClockTime, timeAgo } from "@/lib/formatters";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function getLightState(dirId: string, signalState: any) {
  // Chế độ Thủ công Tự do: Xả luồng riêng biệt, tắt toàn bộ LED 7 đoạn
  if (signalState.mode === "manual" && signalState.manualSubMode === "free") {
    const target = signalState.freeFlushTarget || "B1";
    let isGreen = false;
    if (target === "B1" && dirId === "dien_bien_phu") isGreen = true;
    else if (target === "B2" && dirId === "hang_xanh") isGreen = true;
    else if (target === "A1" && dirId === "bach_dang") isGreen = true;
    else if (target === "A2" && dirId === "xo_viet_nghe_tinh") isGreen = true;
    else if (target === "ALL_B" && (dirId === "dien_bien_phu" || dirId === "hang_xanh")) isGreen = true;
    else if (target === "ALL_A" && (dirId === "bach_dang" || dirId === "xo_viet_nghe_tinh")) isGreen = true;
    else if (target === "ALL_RED") isGreen = false;

    const c = isGreen ? ("green" as const) : ("red" as const);
    return {
      color: c,
      countdown: 0,
      isFreeMode: true,
      leftTurn: {
        color: c,
        countdown: 0,
      },
    };
  }

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
    isFreeMode: false,
    leftTurn: {
      color: leftTurnColor,
      countdown: leftTurnCountdown,
    },
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

const FREE_TARGET_INFO: Record<string, { name: string; zone: string; desc: string; dir: string }> = {
  B1: { name: "Hướng B1 (Điện Biên Phủ)", zone: "Zone 2", desc: "Chỉ B1 XANH, B2 - A1 - A2 ĐỎ", dir: "Điện Biên Phủ (Chiều 1)" },
  B2: { name: "Hướng B2 (Hàng Xanh)", zone: "Zone 4", desc: "Chỉ B2 XANH, B1 - A1 - A2 ĐỎ", dir: "Hàng Xanh (Chiều 2)" },
  A1: { name: "Hướng A1 (Bạch Đằng)", zone: "Zone 1", desc: "Chỉ A1 XANH, A2 - B1 - B2 ĐỎ", dir: "Bạch Đằng (Chiều 1)" },
  A2: { name: "Hướng A2 (Xô Viết Nghệ Tĩnh)", zone: "Zone 3", desc: "Chỉ A2 XANH, A1 - B1 - B2 ĐỎ", dir: "Xô Viết Nghệ Tĩnh (Chiều 2)" },
  ALL_B: { name: "Trục B (B1 + B2)", zone: "Zone 2 & 4", desc: "Điện Biên Phủ & Hàng Xanh cùng XANH, Trục A ĐỎ", dir: "Cả Trục B" },
  ALL_A: { name: "Trục A (A1 + A2)", zone: "Zone 1 & 3", desc: "Bạch Đằng & XVNT cùng XANH, Trục B ĐỎ", dir: "Cả Trục A" },
  ALL_RED: { name: "Dừng toàn bộ (All RED)", zone: "Tất cả Zone", desc: "Cả 4 hướng cùng ĐỎ (Dừng khẩn cấp)", dir: "Dừng toàn bộ" },
};

export function SignalControl() {
  const signalState = useTrafficStore((s) => s.signalState);
  const setSignalMode = useTrafficStore((s) => s.setSignalMode);
  const setManualSubMode = useTrafficStore((s) => s.setManualSubMode);
  const setFreeFlushTarget = useTrafficStore((s) => s.setFreeFlushTarget);
  const setSignalDuration = useTrafficStore((s) => s.setSignalDuration);
  const setSignalPhase = useTrafficStore((s) => s.setSignalPhase);
  const adjustSignalCountdown = useTrafficStore((s) => s.adjustSignalCountdown);
  const signalRec = useTrafficStore((s) => s.signalRec);
  const picoStatus = useTrafficStore((s) => s.picoStatus);
  const fuzzyStatus = useTrafficStore((s) => s.fuzzyStatus);

  const situation = fuzzyStatus?.situation || "NORMAL";
  const situationConfig: Record<string, { label: string; desc: string; badgeCls: string }> = {
    NORMAL: {
      label: "Cân bằng (NORMAL)",
      desc: "Lưu lượng 2 hướng cân bằng, duy trì chu kỳ cơ sở 30s.",
      badgeCls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    },
    A_HEAVY: {
      label: "Hướng A Đông xe (A_HEAVY)",
      desc: "Ưu tiên kéo dài thời gian xanh Hướng A (Bạch Đằng - Hàng Xanh).",
      badgeCls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    B_HEAVY: {
      label: "Hướng B Đông xe (B_HEAVY)",
      desc: "Ưu tiên kéo dài thời gian xanh Hướng B (Điện Biên Phủ - Hàng Xanh).",
      badgeCls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    },
    BOTH_HEAVY: {
      label: "Cả 2 Hướng Kẹt xe (BOTH_HEAVY)",
      desc: "Cả 2 tuyến cùng chịu áp lực lớn, kéo dài cả 2 pha để giải tỏa tối đa giao lộ.",
      badgeCls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    },
  };
  const sitInfo = situationConfig[situation] || situationConfig.NORMAL;

  const currentPhase = SIGNAL_PHASES.find((p) => p.id === signalState.currentPhase) || SIGNAL_PHASES[0];
  const isManual = signalState.mode === "manual";
  const isFree = isManual && signalState.manualSubMode === "free";
  const freeTarget = signalState.freeFlushTarget || "B1";
  const isPicoOnline = Boolean(picoStatus?.online);

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
            subtitle={isFree ? "Chế độ Tự do: Xả luồng riêng biệt & Tắt LED 7 đoạn" : `Chu kỳ #${signalState.cycleNumber || 100}`}
            icon={Timer}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge color={isPicoOnline ? "green" : "amber"} pulse={isPicoOnline}>
                  {isPicoOnline ? `Pico W: Online (${picoStatus?.ip || "Connected"})` : "Pico W: Offline (Fallback)"}
                </StatusBadge>
                {isFree ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-xs font-bold text-amber-500">
                    <EyeOff className="h-3 w-3" /> Thủ công: Tự do
                  </span>
                ) : (
                  <StatusBadge color={isManual ? "amber" : "green"} pulse={!isManual}>
                    {isManual ? "Thủ công (Chu kỳ)" : "Tự động (AI Fuzzy)"}
                  </StatusBadge>
                )}
              </div>
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
                    stroke={isFree ? "#f59e0b" : "var(--primary)"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 44}
                    animate={{ strokeDashoffset: isFree ? 0 : 2 * Math.PI * 44 * (1 - ringPct / 100) }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                  {isFree ? (
                    <>
                      <EyeOff className="h-5 w-5 text-amber-500 mb-1 animate-pulse" />
                      <span className="text-2xl font-black text-foreground tracking-tight">TẮT LED</span>
                      <span className="text-[10px] font-semibold text-amber-500 uppercase mt-0.5">7 đoạn đã tắt</span>
                      <span className="text-[9px] font-mono text-muted-foreground mt-0.5">Xả: {freeTarget}</span>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Phase info */}
              <div className="flex-1 space-y-4 text-center sm:text-left">
                {isFree ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500 border border-amber-500/30 uppercase">
                        <Radio className="h-3 w-3 animate-pulse" /> Thủ công Tự Do
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive border border-destructive/30 uppercase">
                        <EyeOff className="h-3 w-3" /> Toàn bộ LED 7 đoạn: TẮT
                      </span>
                    </div>
                    <div className="mt-1 text-xl font-bold tracking-tight text-foreground flex items-center justify-center sm:justify-start gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-success animate-ping" />
                      {FREE_TARGET_INFO[freeTarget]?.name || freeTarget}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {FREE_TARGET_INFO[freeTarget]?.desc}. Đèn xanh duy trì độc quyền cho hướng này, các hướng khác giữ đèn đỏ.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Pha đang hoạt động
                    </div>
                    <div className="mt-1 text-xl font-bold tracking-tight text-foreground">
                      {currentPhase?.name}
                    </div>
                  </div>
                )}

                {/* Active directions badges */}
                {!isFree && (
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
                )}

                {/* Control Buttons in Left Panel */}
                {isFree ? (
                  <div className="space-y-2 pt-1">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Bấm nút chọn hướng xả luồng (Chỉ hướng được chọn XANH, 3 hướng còn lại ĐỎ):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "B1", label: "Xả B1 (ĐBP)", sub: "Zone 2 - Chiều 1" },
                        { id: "B2", label: "Xả B2 (Hàng Xanh)", sub: "Zone 4 - Chiều 2" },
                        { id: "A1", label: "Xả A1 (Bạch Đằng)", sub: "Zone 1 - Chiều 1" },
                        { id: "A2", label: "Xả A2 (XVNT)", sub: "Zone 3 - Chiều 2" },
                      ].map((btn) => {
                        const isActive = freeTarget === btn.id;
                        return (
                          <button
                            key={btn.id}
                            onClick={() => setFreeFlushTarget(btn.id)}
                            className={cn(
                              "flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-95",
                              isActive
                                ? "border-success bg-success/20 text-success shadow-md shadow-success/20 ring-2 ring-success/50 font-bold"
                                : "border-border bg-card hover:border-primary/50 text-foreground hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-1 font-bold">
                              {isActive && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                              <span>{btn.label}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-normal mt-0.5">{btn.sub}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[
                        { id: "ALL_B", label: "Xả Cả Trục B (B1 + B2)" },
                        { id: "ALL_A", label: "Xả Cả Trục A (A1 + A2)" },
                        { id: "ALL_RED", label: "Dừng Toàn Bộ (All RED)" },
                      ].map((btn) => {
                        const isActive = freeTarget === btn.id;
                        return (
                          <button
                            key={btn.id}
                            onClick={() => setFreeFlushTarget(btn.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all active:scale-95",
                              isActive
                                ? (btn.id === "ALL_RED"
                                    ? "border-destructive bg-destructive/20 text-destructive ring-2 ring-destructive/40 shadow-sm"
                                    : "border-success bg-success/20 text-success ring-2 ring-success/40 shadow-sm")
                                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {btn.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
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
                )}
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
          <div className="space-y-4">
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

            {/* Sub-mode selector (Chỉ khi ở chế độ thủ công) */}
            {isManual && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Phân loại thủ công:
                </div>
                <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => setManualSubMode("cycle")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-semibold transition-all active:scale-95",
                      !isFree
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Timer className="h-3.5 w-3.5 text-primary" />
                    <span>Theo Chu Kỳ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualSubMode("free")}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all active:scale-95",
                      isFree
                        ? "bg-amber-500 text-white shadow-md shadow-amber-500/25 border border-amber-600"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>Tự Do (Xả luồng)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Nếu ở Chế độ Tự do: Bàn điều khiển xả luồng độc lập & Tắt LED 7 đoạn */}
            {isFree ? (
              <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
                <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                  <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold">Đặc tính Chế độ Tự Do:</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-muted-foreground">
                      <li><b>TẮT 100% LED 7 đoạn</b> trên bo mạch và web.</li>
                      <li>Chỉ <b>hướng được chọn có ĐÈN XANH</b>, các hướng khác ĐÈN ĐỎ.</li>
                      <li>Không giới hạn thời gian chu kỳ.</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t border-amber-500/20">
                  <div className="text-[10px] font-bold uppercase text-foreground">
                    Bàn phím xả luồng nhanh:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFreeFlushTarget("B1")}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-between",
                        freeTarget === "B1"
                          ? "border-success bg-success/15 ring-2 ring-success/40"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="text-[11px] font-bold text-foreground">Xả B1 (ĐBP)</div>
                      <div className="text-[9px] text-muted-foreground">Zone 2 - Chiều 1</div>
                      {freeTarget === "B1" && <span className="mt-1 text-[9px] font-bold text-success uppercase">● ĐANG XẢ LUỒNG</span>}
                    </button>

                    <button
                      onClick={() => setFreeFlushTarget("B2")}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-between",
                        freeTarget === "B2"
                          ? "border-success bg-success/15 ring-2 ring-success/40"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="text-[11px] font-bold text-foreground">Xả B2 (HX)</div>
                      <div className="text-[9px] text-muted-foreground">Zone 4 - Chiều 2</div>
                      {freeTarget === "B2" && <span className="mt-1 text-[9px] font-bold text-success uppercase">● ĐANG XẢ LUỒNG</span>}
                    </button>

                    <button
                      onClick={() => setFreeFlushTarget("A1")}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-between",
                        freeTarget === "A1"
                          ? "border-success bg-success/15 ring-2 ring-success/40"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="text-[11px] font-bold text-foreground">Xả A1 (Bạch Đằng)</div>
                      <div className="text-[9px] text-muted-foreground">Zone 1 - Chiều 1</div>
                      {freeTarget === "A1" && <span className="mt-1 text-[9px] font-bold text-success uppercase">● ĐANG XẢ LUỒNG</span>}
                    </button>

                    <button
                      onClick={() => setFreeFlushTarget("A2")}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-between",
                        freeTarget === "A2"
                          ? "border-success bg-success/15 ring-2 ring-success/40"
                          : "border-border bg-card hover:border-primary/40"
                      )}
                    >
                      <div className="text-[11px] font-bold text-foreground">Xả A2 (XVNT)</div>
                      <div className="text-[9px] text-muted-foreground">Zone 3 - Chiều 2</div>
                      {freeTarget === "A2" && <span className="mt-1 text-[9px] font-bold text-success uppercase">● ĐANG XẢ LUỒNG</span>}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Phase duration controls */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Gauge className="h-3.5 w-3.5 text-primary" /> Cài đặt thời lượng pha (giây)
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                    isManual ? "bg-amber-500/15 text-amber-500 border border-amber-500/30" : "bg-muted text-muted-foreground border border-border"
                  )}>
                    {isManual ? "Thủ công: Mở khóa" : "Tự động: Khóa thanh kéo"}
                  </span>
                </div>

                {!isManual && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-primary flex items-start gap-2">
                    <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Chế độ tự động đang bật: Thuật toán <b>Mamdani Fuzzy Logic</b> tự động thích ứng thời lượng xanh tối ưu từ 4 Camera AI. Các thanh kéo đã được khóa lại.</span>
                  </div>
                )}

                {SIGNAL_PHASES.map((phase) => {
                  const value = signalState.phaseDurations?.[phase.id as keyof typeof signalState.phaseDurations] || (phase.id === "phase_3" ? 20 : 35);
                  return (
                    <div key={phase.id} className={cn("space-y-1.5 transition-opacity", !isManual && "opacity-50 pointer-events-none")}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{(phase as any).shortName || phase.name}</span>
                        <span className={cn(
                          "rounded-md px-1.5 py-0.5 font-mono font-bold tabular-nums",
                          isManual ? "bg-amber-500/15 text-amber-500" : "bg-primary/10 text-primary"
                        )}>
                          {value}s
                        </span>
                      </div>
                      <Slider
                        value={[value]}
                        min={10}
                        max={999}
                        step={5}
                        disabled={!isManual}
                        onValueChange={(v) => {
                          if (isManual) {
                            setSignalDuration(phase.id, v[0]);
                          }
                        }}
                        aria-label={`Thời lượng ${phase.name}`}
                      />
                      <div className="flex justify-between text-[9px] text-muted-foreground">
                        <span>10s</span>
                        <span>999s</span>
                      </div>
                    </div>
                  );
                })}
                
                {isManual && (
                  <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/5 p-2.5 text-[11px] text-warning">
                    <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Chế độ chu kỳ thủ công đang bật. Bạn có thể kéo thanh thời lượng hoặc đổi sang chế độ Tự do xả luồng bên trên.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Mamdani Fuzzy Adaptive Control Panel */}
      <SectionCard
        title="Hệ Thống Thích Nghi Mờ (Mamdani Fuzzy Logic)"
        subtitle="Thích nghi thời gian đèn xanh theo thời gian thực dựa trên lưu lượng & hàng chờ (4 Camera AI)"
        icon={Cpu}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", sitInfo.badgeCls)}>
              <Activity className="h-3 w-3 animate-pulse" />
              {sitInfo.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              <Camera className="h-3 w-3" /> Camera AI Thực Tế (4 Tuyến)
            </span>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Situation Explanation Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="font-medium text-foreground">{sitInfo.desc}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono shrink-0">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              <span>Safety: Đi thẳng [20s, 90s] | Rẽ trái [15s, 60s] | Vàng 5s</span>
            </div>
          </div>

          {/* 2 Direction Demand & Fuzzy Output Columns */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Column A */}
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <span className="text-xs font-bold text-foreground">Hướng A (Bạch Đằng - Hàng Xanh)</span>
                  <div className="text-[10px] text-muted-foreground">Zone 1 & Zone 3 (Cam 01 + Cam 03)</div>
                </div>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums">
                  {fuzzyStatus?.demandA ?? 50}% Nhu cầu
                </span>
              </div>

              {/* Progress bars */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Nhu cầu Đi thẳng</span>
                    <span className="font-bold tabular-nums text-foreground">{fuzzyStatus?.demandA ?? 50}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        (fuzzyStatus?.demandA ?? 50) > 75
                          ? "bg-destructive"
                          : (fuzzyStatus?.demandA ?? 50) > 40
                          ? "bg-warning"
                          : "bg-success"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, fuzzyStatus?.demandA ?? 50))}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Nhu cầu Rẽ trái</span>
                    <span className="font-bold tabular-nums text-foreground">{fuzzyStatus?.leftDemandA ?? 35}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-chart-4 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, fuzzyStatus?.leftDemandA ?? 35))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Adaptive Outputs */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div className="rounded-lg bg-success/10 p-2.5 text-center border border-success/20">
                  <div className="text-[10px] uppercase font-bold text-success">Xanh Đi Thẳng</div>
                  <div className="text-xl font-extrabold text-success tabular-nums">
                    {fuzzyStatus?.greenStraightA ?? 30}s
                  </div>
                  <div className="text-[9px] text-muted-foreground">Giới hạn: [20s - 90s]</div>
                </div>
                <div className="rounded-lg bg-chart-4/10 p-2.5 text-center border border-chart-4/20">
                  <div className="text-[10px] uppercase font-bold text-chart-4">Xanh Rẽ Trái</div>
                  <div className="text-xl font-extrabold text-chart-4 tabular-nums">
                    {fuzzyStatus?.greenLeftA ?? 24}s
                  </div>
                  <div className="text-[9px] text-muted-foreground">Giới hạn: [15s - 60s]</div>
                </div>
              </div>
            </div>

            {/* Column B */}
            <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <span className="text-xs font-bold text-foreground">Hướng B (Điện Biên Phủ - Hàng Xanh)</span>
                  <div className="text-[10px] text-muted-foreground">Zone 2 & Zone 4 (Cam 02 + Cam 04)</div>
                </div>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums">
                  {fuzzyStatus?.demandB ?? 50}% Nhu cầu
                </span>
              </div>

              {/* Progress bars */}
              <div className="space-y-2">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Nhu cầu Đi thẳng</span>
                    <span className="font-bold tabular-nums text-foreground">{fuzzyStatus?.demandB ?? 50}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        (fuzzyStatus?.demandB ?? 50) > 75
                          ? "bg-destructive"
                          : (fuzzyStatus?.demandB ?? 50) > 40
                          ? "bg-warning"
                          : "bg-success"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, fuzzyStatus?.demandB ?? 50))}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">Nhu cầu Rẽ trái</span>
                    <span className="font-bold tabular-nums text-foreground">{fuzzyStatus?.leftDemandB ?? 35}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-chart-4 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, fuzzyStatus?.leftDemandB ?? 35))}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Adaptive Outputs */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <div className="rounded-lg bg-success/10 p-2.5 text-center border border-success/20">
                  <div className="text-[10px] uppercase font-bold text-success">Xanh Đi Thẳng</div>
                  <div className="text-xl font-extrabold text-success tabular-nums">
                    {fuzzyStatus?.greenStraightB ?? 30}s
                  </div>
                  <div className="text-[9px] text-muted-foreground">Giới hạn: [20s - 90s]</div>
                </div>
                <div className="rounded-lg bg-chart-4/10 p-2.5 text-center border border-chart-4/20">
                  <div className="text-[10px] uppercase font-bold text-chart-4">Xanh Rẽ Trái</div>
                  <div className="text-xl font-extrabold text-chart-4 tabular-nums">
                    {fuzzyStatus?.greenLeftB ?? 24}s
                  </div>
                  <div className="text-[9px] text-muted-foreground">Giới hạn: [15s - 60s]</div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Camera AI & TCN Prediction Banner */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-muted-foreground">
              <Camera className="h-4 w-4 text-primary shrink-0" />
              <span>Nhu cầu điều khiển kết hợp <b>60% Camera AI Thực tế</b> + <b>40% Mô hình AI Dự báo 30 phút (TCN-Seq2Seq)</b> để chủ động chống ùn tắc.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                <Sparkles className="h-3 w-3" />
                Dự báo AI 30 Phút
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Vận hành Thực tế 100%
              </span>
            </div>
          </div>
        </div>
      </SectionCard>

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
                    {light.isFreeMode ? (
                      isStraightGreen ? "Xả luồng (XANH)" : "Dừng chờ (ĐỎ)"
                    ) : (
                      isStraightGreen ? "Đang xả luồng" : isLeftGreen ? "Rẽ trái xanh" : "Dừng chờ"
                    )}
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
                      {light.isFreeMode
                        ? (light.color === "green" ? "Xanh (Xả)" : "Đỏ (Dừng)")
                        : `${LIGHT_LABEL_VN[light.color]} (${light.countdown}s)`}
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
                      {light.isFreeMode
                        ? (light.leftTurn.color === "green" ? "Xanh (Xả)" : "Đỏ (Dừng)")
                        : `${LIGHT_LABEL_VN[light.leftTurn.color]} (${light.leftTurn.countdown}s)`}
                    </div>
                  </div>
                </div>

                {light.isFreeMode && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-muted/50 py-1.5 px-2 text-[10px] font-semibold text-muted-foreground border border-border/70">
                    <EyeOff className="h-3.5 w-3.5 text-amber-500" />
                    <span>LED 7 đoạn: ĐÃ TẮT</span>
                  </div>
                )}
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
