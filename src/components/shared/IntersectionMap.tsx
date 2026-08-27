"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Camera, Video } from "lucide-react";
import { CAMERAS, SIGNAL_PHASES, DIRECTIONS } from "@/lib/constants";
import { useTrafficStore } from "@/lib/store";
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

const LIGHT_COLORS: Record<string, string> = {
  green: "bg-success shadow-[0_0_12px_2px] shadow-success/60",
  yellow: "bg-warning shadow-[0_0_12px_2px] shadow-warning/60",
  red: "bg-destructive shadow-[0_0_12px_2px] shadow-destructive/60",
};

const ROAD_COLOR_DARK = "#1e293b";
const ROAD_LINE = "var(--muted-foreground)";

export function IntersectionMap() {
  const signalState = useTrafficStore((s) => s.signalState);
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const isOffline = useTrafficStore((s) => s.isBoardOffline);

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted/40 to-background">
      {/* Ambient grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
        {/* Roads — cross shape */}
        {/* Horizontal road */}
        <rect x="0" y="150" width="400" height="100" fill={ROAD_COLOR_DARK} />
        {/* Vertical road */}
        <rect x="150" y="0" width="100" height="400" fill={ROAD_COLOR_DARK} />

        {/* Center roundabout */}
        <circle cx="200" cy="200" r="44" fill={ROAD_COLOR_DARK} stroke="var(--border)" strokeWidth="2" />
        <circle cx="200" cy="200" r="44" fill="none" stroke={ROAD_LINE} strokeWidth="1.5" strokeDasharray="4 6" opacity="0.4" />
        <circle cx="200" cy="200" r="20" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
        <text x="200" y="205" textAnchor="middle" className="fill-muted-foreground text-[9px] font-semibold uppercase">
          Vòng xoay
        </text>

        {/* Lane dividers (dashed) */}
        <line x1="0" y1="200" x2="150" y2="200" stroke={ROAD_LINE} strokeWidth="1.5" strokeDasharray="8 8" opacity="0.5" />
        <line x1="250" y1="200" x2="400" y2="200" stroke={ROAD_LINE} strokeWidth="1.5" strokeDasharray="8 8" opacity="0.5" />
        <line x1="200" y1="0" x2="200" y2="150" stroke={ROAD_LINE} strokeWidth="1.5" strokeDasharray="8 8" opacity="0.5" />
        <line x1="200" y1="250" x2="200" y2="400" stroke={ROAD_LINE} strokeWidth="1.5" strokeDasharray="8 8" opacity="0.5" />

        {/* Crosswalks */}
        <g opacity="0.35" stroke={ROAD_LINE} strokeWidth="2">
          {[160, 165, 170, 175, 180, 185, 190, 195].map((y) => (
            <line key={`cw-top-${y}`} x1="152" y1={y} x2="248" y2={y} />
          ))}
          {[160, 165, 170, 175, 180, 185, 190, 195].map((y) => (
            <line key={`cw-bot-${y}`} x1="152" y1={400 - y + 150} x2="248" y2={400 - y + 150} />
          ))}
          {[160, 165, 170, 175, 180, 185, 190, 195].map((x) => (
            <line key={`cw-left-${x}`} x1={x} y1="152" x2={x} y2="248" />
          ))}
          {[160, 165, 170, 175, 180, 185, 190, 195].map((x) => (
            <line key={`cw-right-${x}`} x1={400 - x + 150} y1="152" x2={400 - x + 150} y2="248" />
          ))}
        </g>

        {/* Direction labels */}
        {DIRECTIONS.map((dir) => {
          let x = 200, y = 200, dy = 0;
          if (dir.id === "bach_dang") { y = 24; }       // top
          if (dir.id === "xo_viet_nghe_tinh") { y = 384; } // bottom
          if (dir.id === "dien_bien_phu") { x = 376; y = 130; } // right (upper)
          if (dir.id === "hang_xanh") { x = 24; y = 130; }    // left (upper)
          return (
            <text
              key={dir.id}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-semibold"
            >
              {dir.name}
            </text>
          );
        })}
      </svg>

      {/* Traffic lights at each direction (positioned around center) */}
      {DIRECTIONS.map((dir) => {
        const light = getLightState(dir.id, signalState);
        // Position lights just outside the roundabout
        const pos: Record<string, { x: string; y: string }> = {
          bach_dang: { x: "44%", y: "26%" },          // top
          dien_bien_phu: { x: "62%", y: "44%" },       // right
          xo_viet_nghe_tinh: { x: "44%", y: "62%" },   // bottom
          hang_xanh: { x: "26%", y: "44%" },           // left
        };
        const p = pos[dir.id];
        return (
          <div
            key={dir.id}
            className="absolute z-10 flex flex-col items-center gap-1"
            style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
          >
            {/* Light housing */}
            <div className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
              <div className={cn("h-2 w-2 rounded-full transition-colors duration-300", light.color === "red" ? LIGHT_COLORS.red : "bg-muted opacity-40")} />
              <div className={cn("h-2 w-2 rounded-full transition-colors duration-300", light.color === "yellow" ? LIGHT_COLORS.yellow : "bg-muted opacity-40")} />
              <div className={cn("h-2 w-2 rounded-full transition-colors duration-300", light.color === "green" ? LIGHT_COLORS.green : "bg-muted opacity-40")} />
            </div>
            {/* Countdown */}
            <AnimatePresence mode="wait">
              <motion.div
                key={light.countdown}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-md",
                  light.color === "green" && "bg-success/20 text-success",
                  light.color === "yellow" && "bg-warning/20 text-warning",
                  light.color === "red" && "bg-destructive/20 text-destructive",
                )}
              >
                {light.countdown}
              </motion.div>
            </AnimatePresence>
          </div>
        );
      })}

      {/* Camera markers */}
      {CAMERAS.map((cam) => {
        const camData = realtimeCams?.[cam.id] as any;
        const isError = isOffline || camData?.status === "ERROR";
        const label = camData?.mapped_label;
        let dotColor = "bg-muted-foreground";
        if (isError) dotColor = "bg-destructive";
        else if (label === "Ket_xe" || label === "Sap_ket") dotColor = "bg-warning";
        else if (label === "Dong_xe") dotColor = "bg-warning";
        else dotColor = "bg-success";

        return (
          <div
            key={cam.id}
            className="group absolute z-20"
            style={{ left: `${cam.position.x}%`, top: `${cam.position.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <div className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-border bg-card shadow-md transition-all hover:scale-110 hover:shadow-lg">
              <Video className="h-3.5 w-3.5 text-foreground" />
              <span className={cn("absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card", dotColor)}>
                {!isError && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", dotColor)} />}
              </span>
            </div>
            {/* Tooltip on hover */}
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-lg group-hover:block">
              <div className="font-semibold text-foreground">{cam.name}</div>
              <div className="text-muted-foreground">{cam.label}</div>
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card/80 px-2.5 py-1.5 text-[10px] font-medium backdrop-blur">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Thông thoáng</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Đông xe</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Kẹt/Lỗi</span>
        <span className="flex items-center gap-1 text-muted-foreground"><Camera className="h-3 w-3" /> Camera</span>
      </div>
    </div>
  );
}
