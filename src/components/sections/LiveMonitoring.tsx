"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Video,
  RefreshCw,
  Camera,
  CameraOff,
  AlertCircle,
  Maximize2,
  Radio,
  Crosshair,
  Activity,
  Signal,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS, DIRECTIONS, TRAFFIC_LABELS, type TrafficLabelKey } from "@/lib/constants";
import { formatNumber, formatClockTime } from "@/lib/formatters";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function labelDisplay(mappedLabel?: string | null, isError?: boolean) {
  if (isError) return { text: "MẤT KẾT NỐI", cls: "red" as const };
  const entry = mappedLabel ? TRAFFIC_LABELS[mappedLabel as TrafficLabelKey] : null;
  if (!entry) return { text: "Đang chờ", cls: "cyan" as const };
  return { text: entry.text, cls: entry.cls as "green" | "amber" | "red" };
}

const FEED_BG: Record<string, string> = {
  green: "from-success/20 via-success/5 to-background",
  amber: "from-warning/20 via-warning/5 to-background",
  red: "from-destructive/20 via-destructive/5 to-background",
  cyan: "from-chart-2/15 via-chart-2/5 to-background",
};

const SCANLINE_COLOR: Record<string, string> = {
  green: "via-success/40",
  amber: "via-warning/40",
  red: "via-destructive/40",
  cyan: "via-chart-2/40",
};

export function LiveMonitoring() {
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const isOffline = useTrafficStore((s) => s.isBoardOffline);
  const refreshRealtime = useTrafficStore((s) => s.refreshRealtime);
  const lastUpdate = useTrafficStore((s) => s.lastRealtimeUpdate);

  const [expandedCam, setExpandedCam] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const expandedCamInfo = useMemo(
    () => CAMERAS.find((c) => c.id === expandedCam) || null,
    [expandedCam],
  );
  const expandedCamData = expandedCam ? realtimeCams?.[expandedCam] : null;

  const handleRefresh = () => {
    setRefreshing(true);
    refreshRealtime();
    setTimeout(() => setRefreshing(false), 800);
  };

  // Online / offline counts
  const { online, offline, totalVehicles } = useMemo(() => {
    let online = 0;
    let offline = 0;
    let totalVehicles = 0;
    if (realtimeCams) {
      for (const cam of CAMERAS) {
        const d = realtimeCams[cam.id] as any;
        if (!d) continue;
        if (d.status === "ERROR" || isOffline) offline++;
        else {
          online++;
          totalVehicles += d.count || 0;
        }
      }
    }
    return { online, offline, totalVehicles };
  }, [realtimeCams, isOffline]);

  const handleIframeError = () => setIframeError(true);

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <SectionCard
        title="Lưới camera trực tiếp"
        subtitle="7 camera — ngã tư Hàng Xanh"
        icon={Video}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Online/offline count */}
            <div className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success sm:flex">
              <Camera className="h-3 w-3" />
              {online} online
            </div>
            {offline > 0 && (
              <div className="hidden items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive sm:flex">
                <CameraOff className="h-3 w-3" />
                {offline} lỗi
              </div>
            )}
            {/* LIVE indicator */}
            <span className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive">
              <span className="live-dot relative h-1.5 w-1.5 rounded-full bg-current" />
              LIVE
            </span>
            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>
          </div>
        }
        bodyClassName="p-4"
      >
        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/30 p-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Signal className="h-3.5 w-3.5 text-primary" />
            Cập nhật: <span className="font-mono font-semibold text-foreground">{formatClockTime(new Date(lastUpdate))}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-chart-2" />
            Tổng xe phát hiện: <span className="font-semibold tabular-nums text-foreground">{formatNumber(totalVehicles)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-success" />
            Trạng thái: <span className="font-semibold text-success">{isOffline ? "Mất kết nối" : "Ổn định"}</span>
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">Bấm vào camera để xem toàn màn hình</span>
        </div>
      </SectionCard>

      {/* Camera grid */}
      {!realtimeCams ? (
        <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Đang kết nối dữ liệu camera...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CAMERAS.map((cam, i) => {
            const camData = realtimeCams[cam.id] as any;
            const isError = isOffline || camData?.status === "ERROR";
            const dir = DIRECTIONS.find((d) => d.id === cam.direction);
            const { text, cls } = labelDisplay(camData?.mapped_label, isError);
            const count = camData?.count || 0;
            const ts = camData?.timestamp?.split(" ")[1] || "—";

            return (
              <motion.div
                key={cam.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3 }}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-3 pt-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">{cam.name}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{cam.label}</div>
                  </div>
                  <StatusBadge color={isError ? "red" : cls} pulse={!isError && cls !== "green"}>
                    {isError ? "LỖI" : text}
                  </StatusBadge>
                </div>

                {/* Actual video feed */}
                <div
                  className={cn(
                    "relative mx-3 mt-2 aspect-video overflow-hidden rounded-lg border",
                    (!cam.url || isError) ? ("bg-gradient-to-br " + (FEED_BG[cls] || FEED_BG.cyan)) : "bg-black",
                    isError ? "border-destructive/30" : cls === "red" ? "border-destructive/30" : cls === "amber" ? "border-warning/30" : "border-border",
                  )}
                >
                  {!isError && cam.url && (
                    <iframe
                      src={cam.url}
                      title={cam.name}
                      className="absolute inset-0 z-0 h-full w-full border-0 pointer-events-none"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                  )}
                  {/* Grid overlay (camera POV lines) */}
                  <div
                    className="pointer-events-none absolute inset-0 z-10 opacity-[0.08]"
                    style={{
                      backgroundImage:
                        "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />

                  {/* Animated scan line */}
                  {!isError && (
                    <motion.div
                      className={cn("absolute left-0 right-0 z-10 h-px bg-gradient-to-r from-transparent to-transparent", SCANLINE_COLOR[cls])}
                      initial={{ top: "0%" }}
                      animate={{ top: ["0%", "100%", "0%"] }}
                      transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                    />
                  )}

                  {/* Noise / shimmer when error */}
                  {isError && (
                    <div className="absolute inset-0 shimmer opacity-50" />
                  )}

                  {/* Center crosshair */}
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <Crosshair className={cn("h-6 w-6 opacity-30", isError ? "text-destructive" : "text-foreground")} />
                  </div>

                  {/* Direction label */}
                  <div className="absolute left-2 top-2 z-10 rounded bg-background/70 px-1.5 py-0.5 text-[9px] font-semibold text-foreground backdrop-blur">
                    {dir?.name}
                  </div>

                  {/* REC indicator */}
                  {!isError && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-background/70 px-1.5 py-0.5 text-[9px] font-bold text-destructive backdrop-blur">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
                      </span>
                      REC
                    </div>
                  )}

                  {/* Timestamp overlay (bottom-left) */}
                  <div className="absolute bottom-2 left-2 rounded bg-background/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold tabular-nums text-foreground backdrop-blur">
                    {ts}
                  </div>

                  {/* Vehicle count overlay (bottom-right) */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-background/70 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-foreground backdrop-blur">
                    <Video className="h-2.5 w-2.5" />
                    {isError ? "—" : formatNumber(count)}
                  </div>

                  {/* Error overlay */}
                  {isError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/10 backdrop-blur-[2px]">
                      <CameraOff className="h-7 w-7 text-destructive" />
                      <span className="rounded bg-destructive/20 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                        Mất tín hiệu
                      </span>
                      {camData?.error_message && (
                        <span className="px-2 text-center text-[9px] text-destructive/80">
                          {camData.error_message}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expand button on hover */}
                  {!isError && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCam(cam.id);
                        setIframeError(false);
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100"
                      aria-label={`Mở rộng ${cam.name}`}
                    >
                      <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105">
                        <Maximize2 className="h-3.5 w-3.5" />
                        Xem toàn màn hình
                      </span>
                    </button>
                  )}
                </div>

                {/* Footer info */}
                <div className="grid grid-cols-2 gap-2 px-3 py-3 text-[11px]">
                  <div className="rounded-lg bg-muted/40 p-1.5">
                    <div className="text-[9px] uppercase text-muted-foreground">Số xe</div>
                    <div className="font-bold tabular-nums text-foreground">
                      {isError ? "—" : formatNumber(count)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-1.5">
                    <div className="text-[9px] uppercase text-muted-foreground">Hướng</div>
                    <div className="truncate font-semibold text-foreground">{dir?.short || "—"}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* External link hint */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5" />
        Nguồn dữ liệu: HTGT TP.HCM — làm mới 5s/lần
      </div>

      {/* Expanded camera dialog */}
      <Dialog open={!!expandedCam} onOpenChange={(o) => !o && setExpandedCam(null)}>
        <DialogContent className="max-w-4xl p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-border p-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Video className="h-4 w-4 text-primary" />
              {expandedCamInfo?.name}
              <span className="font-normal text-muted-foreground">— {expandedCamInfo?.label}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {expandedCamData?.timestamp ? `Cập nhật: ${expandedCamData.timestamp}` : "Đang tải..."}
              {expandedCamInfo?.url && (
                <a
                  href={expandedCamInfo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Mở trong tab mới <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="relative aspect-video w-full overflow-hidden rounded-b-lg bg-black">
            {expandedCamInfo?.url && !iframeError ? (
              <iframe
                key={expandedCamInfo.url}
                src={expandedCamInfo.url}
                title={expandedCamInfo.name}
                className="h-full w-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                onError={handleIframeError}
                onLoad={(e) => {
                  // Try detecting blank/blocked iframes via timeout fallback
                  try {
                    const f = e.currentTarget as HTMLIFrameElement;
                    if (!f.contentWindow) setIframeError(true);
                  } catch {
                    // Cross-origin access throws — assume OK
                  }
                }}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/40 to-background p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {iframeError ? "Không tải được luồng trực tiếp" : "Đang chuẩn bị luồng..."}
                  </div>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Trang camera của TP.HCM có thể chặn nhúng. Bạn có thể mở liên kết trực tiếp trong tab mới.
                  </p>
                </div>
                {expandedCamInfo?.url && (
                  <Button asChild size="sm">
                    <a href={expandedCamInfo.url} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Mở liên kết gốc
                    </a>
                  </Button>
                )}
              </div>
            )}
            {/* Overlay info pill */}
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-background/70 px-2 py-1 text-[10px] font-semibold backdrop-blur">
              <Clock className="h-3 w-3 text-primary" />
              <span className="font-mono tabular-nums text-foreground">
                {formatClockTime(new Date())}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
                </span>
                LIVE
              </span>
            </div>
            {/* Camera status pill */}
            {expandedCamData && (
              <div className="pointer-events-none absolute right-3 top-3">
                <StatusBadge
                  color={expandedCamData.status === "ERROR" ? "red" : labelDisplay(expandedCamData.mapped_label).cls}
                  pulse
                >
                  {expandedCamData.status === "ERROR"
                    ? "LỖI"
                    : labelDisplay(expandedCamData.mapped_label).text}
                </StatusBadge>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
