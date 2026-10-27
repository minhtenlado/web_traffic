"use client";

import { ACTIVE_CAMERA_IDS, selectedCameraView } from "@/lib/traffic-status";
import { TrafficVotes } from "@/components/shared/TrafficVotes";
import { CameraSnapshot } from "@/components/shared/CameraSnapshot";
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
  Activity,
  Signal,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS, DIRECTIONS } from "@/lib/constants";
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
  const tickCount = useTrafficStore((s) => s._tickCount);
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const edgeAI = useTrafficStore((s) => s.edgeAI);
  const refreshRealtime = useTrafficStore((s) => s.refreshRealtime);
  const lastUpdate = useTrafficStore((s) => s.lastRealtimeUpdate);

  const [expandedCam, setExpandedCam] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const expandedCamInfo = useMemo(
    () => CAMERAS.find((c) => c.id === expandedCam) || null,
    [expandedCam],
  );
  const expandedView = selectedCameraView(expandedCam || "", realtimeCams, edgeAI);

  const handleRefresh = () => {
    setRefreshing(true);
    refreshRealtime();
    setTimeout(() => setRefreshing(false), 800);
  };

  const { freshCount, waitingCount, totalVehicles } = useMemo(() => {
    let freshCount = 0;
    let totalVehicles = 0;
    let countedCameras = 0;
    for (const id of ACTIVE_CAMERA_IDS) {
      const view = selectedCameraView(id, realtimeCams, edgeAI);
      if (view.fresh) {
        freshCount++;
        if (view.count !== null) { totalVehicles += view.count; countedCameras++; }
      }
    }
    return { freshCount, waitingCount: ACTIVE_CAMERA_IDS.length - freshCount, totalVehicles: countedCameras ? totalVehicles : null };
  }, [realtimeCams, edgeAI, tickCount]);

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <SectionCard
        title="Lưới ảnh camera"
        subtitle="5 camera có AI · 2 camera chỉ xem tham chiếu · ảnh làm mới mỗi 10 giây"
        icon={Video}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Online/offline count */}
            <div className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success sm:flex">
              <Camera className="h-3 w-3" />
              {freshCount}/5 ảnh mới
            </div>
            {waitingCount > 0 && (
              <div className="hidden items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive sm:flex">
                <CameraOff className="h-3 w-3" />
                {waitingCount} chờ cập nhật
              </div>
            )}
            <span className="flex items-center gap-1.5 rounded-full border border-chart-2/30 bg-chart-2/10 px-2.5 py-1 text-[11px] font-bold text-chart-2">
              <Camera className="h-3 w-3" />
              ẢNH CẬP NHẬT
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
            Cập nhật: <span className="font-mono font-semibold text-foreground">{lastUpdate ? formatClockTime(new Date(lastUpdate)) : "—"}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-chart-2" />
            Tổng xe trong ảnh mới: <span className="font-semibold tabular-nums text-foreground">{totalVehicles === null ? "—" : formatNumber(totalVehicles)}</span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-success" />
            Trạng thái: <span className={`font-semibold ${freshCount ? "text-success" : "text-warning"}`}>{freshCount ? "Đang nhận ảnh" : "Chưa có ảnh mới"}</span>
          </span>
        </div>
      </SectionCard>

      {/* Camera grid */}
      {!realtimeCams && !edgeAI ? (
        <div className="flex items-center gap-3 py-12 text-sm text-muted-foreground">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Đang kết nối dữ liệu camera...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAMERAS.map((cam, i) => {
            const camData = realtimeCams?.[cam.id] as any;
            const view = selectedCameraView(cam.id, realtimeCams, edgeAI);
            const isAiInput = cam.aiInput;
            const isCamError = isAiInput && view.cls === "red" && !view.ready;
            const dir = DIRECTIONS.find((d) => d.id === cam.direction);
            const cls = isAiInput ? view.cls : "cyan";
            const displayCount = isAiInput ? view.count : null;
            const displayLabel = isAiInput ? view.text : "Chỉ xem tham chiếu";
            const observedAt = view.observedAt;
            const ts = isAiInput && observedAt ? formatClockTime(new Date(observedAt * 1000)) : "—";
            const statusText = isAiInput ? view.text : "Chỉ xem ảnh tham chiếu";
            const statusColor = cls;

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
                <div className="flex items-center justify-between gap-2 px-4 pt-4">
                  <div className="min-w-0">
                    <div className="truncate text-base font-bold text-foreground">{cam.name}</div>
                    <div className="truncate text-sm text-muted-foreground">{cam.label}</div>
                  </div>
                  <StatusBadge color={statusColor} pulse={view.ready && cls !== "green"}>
                    {statusText}
                  </StatusBadge>
                </div>

                {/* HTGT provides refreshed still images rather than an embeddable video stream. */}
                <div
                  className={cn(
                    "relative mx-4 mt-3 aspect-video overflow-hidden border",
                    !cam.url ? ("bg-gradient-to-br " + (FEED_BG[cls] || FEED_BG.cyan)) : "bg-black",
                    isCamError ? "border-destructive/30" : cls === "red" ? "border-destructive/30" : cls === "amber" ? "border-warning/30" : "border-border",
                  )}
                >
                  {cam.url && <CameraSnapshot src={cam.url} alt={`${cam.name} — ${cam.label}`} />}


                  {/* Direction label */}
                  <div className="absolute left-2 top-2 z-10 rounded bg-background/70 px-2 py-1 text-xs font-semibold text-foreground backdrop-blur">
                    {dir?.name}
                  </div>

                  <div className="absolute right-2 top-2 z-10 rounded bg-background/80 px-2 py-1 text-[10px] font-semibold text-foreground backdrop-blur">
                    {isAiInput ? "AI nhận diện" : "Chỉ ảnh tham chiếu"}
                  </div>



                  {/* Timestamp overlay (bottom-left) */}
                  <div className="absolute bottom-2 left-2 rounded bg-background/70 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-foreground backdrop-blur">
                    {ts}
                  </div>

                  {/* Vehicle count overlay (bottom-right) */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded bg-background/70 px-2 py-1 text-xs font-bold tabular-nums text-foreground backdrop-blur">
                    <Video className="h-3 w-3" />
                    {displayCount === null ? "—" : formatNumber(displayCount)}
                  </div>

                  {/* Expand button on hover */}
                  {cam.url && (
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedCam(cam.id);
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

                <div className="px-4">
                  {isAiInput && view.source === "legacy" ? <TrafficVotes record={camData} /> : !isAiInput ? (
                    <p className="py-2 text-xs text-muted-foreground">Camera này chưa được đưa vào luồng AI.</p>
                  ) : null}
                </div>
                {/* Footer info */}
                <div className="grid grid-cols-2 gap-2 px-4 py-4 text-sm">
                  <div className="bg-muted/40 p-2">
                    <div className="text-xs uppercase text-muted-foreground">Số xe AI</div>
                    <div className="font-bold tabular-nums text-foreground text-base">
                      {displayCount === null ? "—" : formatNumber(displayCount)}
                    </div>
                  </div>
                  <div className="min-w-0 bg-muted/40 p-2">
                    <div className="text-xs uppercase text-muted-foreground">Nhãn AI</div>
                    <div className="truncate font-semibold text-foreground text-sm" title={displayLabel || undefined}>{displayLabel || "Chưa phân loại"}</div>
                    {view.label && view.labelSource?.includes("unverified") && <div className="mt-0.5 truncate text-[10px] text-muted-foreground">Tự động · chưa kiểm định</div>}
                  </div>
                  <div className="bg-muted/40 p-2">
                    <div className="text-xs uppercase text-muted-foreground">Cập nhật</div>
                    <div className="truncate font-semibold tabular-nums text-foreground text-sm">{ts}</div>
                    {isAiInput && view.ageSeconds !== null && <div className="mt-0.5 text-[10px] text-muted-foreground">AI {Math.max(0, Math.floor(view.ageSeconds))} giây trước</div>}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

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
              {expandedCamInfo?.aiInput && expandedView.observedAt ? `Kết quả AI: ${formatClockTime(new Date(expandedView.observedAt * 1000))} · ${expandedView.fresh ? "mới" : "dữ liệu cũ"}` : "Ảnh camera được làm mới khoảng 10 giây/lần."}
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
            {expandedCamInfo?.url ? (
              <CameraSnapshot src={expandedCamInfo.url} alt={`${expandedCamInfo.name} — ${expandedCamInfo.label}`} />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/40 to-background p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning/15 text-warning">
                  <AlertCircle className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Không có nguồn ảnh
                  </div>
                  <p className="mt-1 max-w-md text-xs text-muted-foreground">
                    Camera chưa có URL ảnh snapshot.
                  </p>
                </div>
              </div>
            )}
            {/* Overlay info pill */}
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-background/70 px-2 py-1 text-[10px] font-semibold backdrop-blur">
              <Clock className="h-3 w-3 text-primary" />
              <span className="font-mono tabular-nums text-foreground">
                {formatClockTime(new Date())}
              </span>
              <span className="text-chart-2">Ảnh tự làm mới</span>
            </div>
            {/* Camera status pill */}
            {expandedCamInfo?.aiInput && (
              <div className="pointer-events-none absolute right-3 top-3">
                <StatusBadge
                  color={expandedView.cls}
                  pulse={expandedView.ready}
                >
                  {expandedView.text}
                </StatusBadge>
              </div>
            )}
            {expandedCamInfo && !expandedCamInfo.aiInput && (
              <div className="pointer-events-none absolute right-3 top-3">
                <StatusBadge color="cyan">Chỉ ảnh tham chiếu</StatusBadge>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
