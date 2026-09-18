"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Camera, Video, ArrowUpLeft, X, ExternalLink, MapPin, Clock, Activity } from "lucide-react";
import { useTheme } from "next-themes";
import { CAMERAS, SIGNAL_PHASES, DIRECTIONS, AREA_CONFIGS } from "@/lib/constants";
import { useTrafficStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatNumber, formatClockTime } from "@/lib/formatters";

import "leaflet/dist/leaflet.css";

const INTERSECTION_CENTER: [number, number] = [10.8015, 106.7115];

const TRAFFIC_LIGHT_POSITIONS = [
  { id: "bach_dang", name: "Bạch Đằng", position: [10.80211, 106.71124] },
  { id: "dien_bien_phu", name: "Điện Biên Phủ", position: [10.80134, 106.71097] },
  { id: "xo_viet_nghe_tinh", name: "Xô Viết Nghệ Tĩnh", position: [10.80083, 106.71138] },
  { id: "hang_xanh", name: "Hàng Xanh", position: [10.80166, 106.7117] },
];

function getLightState(dirId: string, signalState: any) {
  const currentPhase = SIGNAL_PHASES.find((p) => p.id === signalState.currentPhase);
  const isStraightActive = currentPhase?.directions?.includes(dirId);
  const isLeftTurnActive = (currentPhase as any)?.leftTurnDirections?.includes(dirId);

  let straightColor: "green" | "yellow" | "red" = "red";
  let straightCountdown = signalState.countdown;
  if (isStraightActive) {
    if (signalState.countdown > 5) {
      straightColor = "green";
      straightCountdown = signalState.countdown - 5;
    } else {
      straightColor = "yellow";
      straightCountdown = signalState.countdown;
    }
  }

  let leftTurnColor: "green" | "yellow" | "red" = "red";
  let leftTurnCountdown = signalState.countdown;
  if (isLeftTurnActive) {
    if (signalState.countdown > 5) {
      leftTurnColor = "green";
      leftTurnCountdown = signalState.countdown - 5;
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
    },
  };
}

const LIGHT_COLORS: Record<string, string> = {
  green: "bg-success shadow-[0_0_12px_2px] shadow-success/60",
  yellow: "bg-warning shadow-[0_0_12px_2px] shadow-warning/60",
  red: "bg-destructive shadow-[0_0_12px_2px] shadow-destructive/60",
};

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  green: { bg: "bg-success/10", border: "border-success/40", text: "text-success", glow: "shadow-success/20" },
  amber: { bg: "bg-warning/10", border: "border-warning/40", text: "text-warning", glow: "shadow-warning/20" },
  red: { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", glow: "shadow-destructive/20" },
  cyan: { bg: "bg-chart-2/10", border: "border-chart-2/40", text: "text-chart-2", glow: "shadow-chart-2/20" },
};

function getStatusInfo(mappedLabel?: string, isError?: boolean) {
  if (isError) return { text: "Mất kết nối", cls: "red" as const };
  switch (mappedLabel) {
    case "Ket_xe": return { text: "Kẹt xe", cls: "red" as const };
    case "Sap_ket": return { text: "Sắp kẹt", cls: "amber" as const };
    case "Dong_xe": return { text: "Đông xe", cls: "amber" as const };
    case "Binh_thuong": return { text: "Bình thường", cls: "green" as const };
    case "Duong_vang": return { text: "Thông thoáng", cls: "green" as const };
    default: return { text: "Đang chờ", cls: "cyan" as const };
  }
}

function createCameraIcon(cam: any, camData: any, isError: boolean) {
  const label = camData?.mapped_label;
  let dotColor = "bg-muted-foreground";
  if (isError) dotColor = "bg-destructive";
  else if (label === "Ket_xe" || label === "Sap_ket") dotColor = "bg-warning";
  else if (label === "Dong_xe") dotColor = "bg-warning";
  else dotColor = "bg-success";

  const html = renderToStaticMarkup(
    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-md cursor-pointer hover:scale-110 transition-transform">
      <Video className="h-4 w-4 text-foreground" />
      <span className={cn("absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-card", dotColor)}></span>
    </div>
  );

  return L.divIcon({
    className: "custom-cam-icon bg-transparent border-none",
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function createTrafficLightIcon(light: ReturnType<typeof getLightState>) {
  const html = renderToStaticMarkup(
    <div className="flex items-center gap-1.5 transform scale-[1.15]">
      <div className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-card/95 p-1 shadow-lg">
        <div className={cn("h-2 w-2 rounded-full", light.color === "red" ? LIGHT_COLORS.red : "bg-muted opacity-30")} />
        <div className={cn("h-2 w-2 rounded-full", light.color === "yellow" ? LIGHT_COLORS.yellow : "bg-muted opacity-30")} />
        <div className={cn("h-2 w-2 rounded-full", light.color === "green" ? LIGHT_COLORS.green : "bg-muted opacity-30")} />
      </div>

      <div className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-card/95 p-1 shadow-lg">
        <div className={cn("flex h-2 w-2 items-center justify-center rounded-full", light.leftTurn.color === "red" ? LIGHT_COLORS.red : "bg-muted opacity-30")}>
          <ArrowUpLeft className="h-1.5 w-1.5 text-background stroke-[3]" />
        </div>
        <div className={cn("flex h-2 w-2 items-center justify-center rounded-full", light.leftTurn.color === "yellow" ? LIGHT_COLORS.yellow : "bg-muted opacity-30")}>
          <ArrowUpLeft className="h-1.5 w-1.5 text-background stroke-[3]" />
        </div>
        <div className={cn("flex h-2 w-2 items-center justify-center rounded-full", light.leftTurn.color === "green" ? LIGHT_COLORS.green : "bg-muted opacity-30")}>
          <ArrowUpLeft className="h-1.5 w-1.5 text-background stroke-[3]" />
        </div>
      </div>

      <div
        className={cn(
          "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold tabular-nums shadow-md",
          (light.color === "green" || light.leftTurn.color === "green") && "bg-success/20 text-success",
          (light.color === "yellow" || light.leftTurn.color === "yellow") && "bg-warning/20 text-warning",
          light.color === "red" && light.leftTurn.color === "red" && "bg-destructive/20 text-destructive"
        )}
      >
        {Math.max(light.countdown, light.leftTurn.countdown)}
      </div>
    </div>
  );

  return L.divIcon({
    className: "custom-tl-icon bg-transparent border-none",
    html,
    iconSize: [64, 40],
    iconAnchor: [32, 20],
    popupAnchor: [0, -20],
  });
}

/* FlyTo component — listens for area changes and flies the map */
function FlyToArea({ selectedArea }: { selectedArea: string }) {
  const map = useMap();
  const prevAreaRef = useRef(selectedArea);

  useEffect(() => {
    if (selectedArea !== prevAreaRef.current) {
      prevAreaRef.current = selectedArea;
      const area = AREA_CONFIGS[selectedArea];
      if (area) {
        map.flyTo(area.center, area.zoom, {
          duration: 1.8,
          easeLinearity: 0.25,
        });
      }
    }
  }, [selectedArea, map]);

  return null;
}

/* Camera Popup Overlay — shown when a camera marker is clicked */
function CameraPopup({
  cam,
  camData,
  isError,
  onClose,
}: {
  cam: (typeof CAMERAS)[number];
  camData: any;
  isError: boolean;
  onClose: () => void;
}) {
  const dir = DIRECTIONS.find((d) => d.id === cam.direction);
  const { text, cls } = getStatusInfo(camData?.mapped_label, isError);
  const count = camData?.count || 0;
  const ts = camData?.timestamp?.split(" ")[1] || "—";
  const colors = STATUS_COLORS[cls] || STATUS_COLORS.cyan;

  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className={cn(
          "relative w-full max-w-2xl overflow-hidden rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl",
          colors.border,
          `shadow-lg ${colors.glow}`
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", colors.bg)}>
              <Camera className={cn("h-4.5 w-4.5", colors.text)} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-foreground">{cam.name}</h3>
              <p className="truncate text-xs text-muted-foreground">{cam.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Status badge */}
            <span className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold",
              colors.bg, colors.border, colors.text
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full bg-current", cls !== "green" && "animate-pulse")} />
              {text}
            </span>
            {/* Close button */}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              aria-label="Đóng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Video feed */}
        <div className="relative aspect-video w-full bg-black">
          {!isError && cam.url ? (
            <>
              <iframe
                src={cam.url}
                title={cam.name}
                className="absolute inset-0 h-full w-full border-0"
                allow="autoplay; encrypted-media; picture-in-picture"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                referrerPolicy="no-referrer"
                loading="eager"
              />
              {/* REC indicator */}
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 text-[10px] font-bold text-red-400 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
                </span>
              </div>
              {/* Time indicator */}
              <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
                <Clock className="h-3 w-3 text-blue-400" />
                <span className="font-mono text-[10px] font-bold tabular-nums text-white/90">{formatClockTime(new Date())}</span>
                <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
                  </span>
                  LIVE
                </span>
              </div>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/30 to-background p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15">
                <Camera className="h-7 w-7 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isError ? "Mất tín hiệu camera" : "Đang tải luồng video..."}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isError ? "Camera hiện không khả dụng" : "Vui lòng đợi hoặc mở trong tab mới"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="grid grid-cols-4 gap-px border-t border-border/50 bg-border/30">
          <div className="flex flex-col items-center justify-center bg-card/95 p-3">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Hướng</span>
            <span className="mt-0.5 text-sm font-bold text-foreground">{dir?.short || "—"}</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-card/95 p-3">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Số xe</span>
            <span className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{isError ? "—" : formatNumber(count)}</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-card/95 p-3">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Cập nhật</span>
            <span className="mt-0.5 font-mono text-sm font-bold tabular-nums text-foreground">{ts}</span>
          </div>
          <div className="flex flex-col items-center justify-center bg-card/95 p-3">
            {cam.url && (
              <a
                href={cam.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-semibold text-primary transition-colors hover:text-primary/80"
              >
                <ExternalLink className="h-3 w-3" />
                Tab mới
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeafletIntersectionMap({ selectedArea = "hang-xanh" }: { selectedArea?: string }) {
  const { resolvedTheme } = useTheme();
  const signalState = useTrafficStore((s) => s.signalState);
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const isOffline = useTrafficStore((s) => s.isBoardOffline);

  const [activeCam, setActiveCam] = useState<string | null>(null);

  const activeCamInfo = useMemo(
    () => (activeCam ? CAMERAS.find((c) => c.id === activeCam) || null : null),
    [activeCam],
  );
  const activeCamData = activeCam ? realtimeCams?.[activeCam] : null;
  const activeCamError = isOffline || activeCamData?.status === "ERROR";

  const camIcons = useMemo(() => {
    return CAMERAS.map((cam) => {
      const camData = realtimeCams?.[cam.id] as any;
      const isError = isOffline || camData?.status === "ERROR";
      return {
        id: cam.id,
        icon: createCameraIcon(cam, camData, isError),
      };
    });
  }, [realtimeCams, isOffline]);

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer
        center={INTERSECTION_CENTER}
        zoom={18}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          key={resolvedTheme}
          url="https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          subdomains={["0", "1", "2", "3"]}
          maxZoom={20}
          className={resolvedTheme === "dark" ? "map-tiles-dark" : ""}
          attribution='&copy; Google Maps'
        />

        {/* FlyTo controller */}
        <FlyToArea selectedArea={selectedArea} />

        {/* Cameras */}
        {CAMERAS.map((cam) => {
          const camIcon = camIcons.find((c) => c.id === cam.id)?.icon;
          const realPos = cam.realPosition || [10.8015, 106.7115];
          return (
            <Marker
              key={cam.id}
              position={realPos as [number, number]}
              icon={camIcon}
              eventHandlers={{
                click: () => setActiveCam(cam.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                <div className="text-xs">
                  <span className="font-bold">{cam.name}</span>
                  <br />
                  <span className="text-muted-foreground">{cam.label}</span>
                  <br />
                  <span className="text-[10px] text-primary font-medium">Click để xem hình ảnh</span>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Traffic Lights */}
        {TRAFFIC_LIGHT_POSITIONS.map((tl) => {
          const light = getLightState(tl.id, signalState);
          const icon = createTrafficLightIcon(light);
          return (
            <Marker key={tl.id} position={tl.position as [number, number]} icon={icon}>
              <Tooltip direction="bottom" offset={[0, 16]}>
                <div className="text-xs font-bold">{tl.name}</div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Camera Popup Overlay */}
      {activeCamInfo && (
        <CameraPopup
          cam={activeCamInfo}
          camData={activeCamData}
          isError={activeCamError}
          onClose={() => setActiveCam(null)}
        />
      )}

      {/* Minimal legend */}
      <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-2 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-[10px] font-medium backdrop-blur shadow-md">
        <span className="flex items-center gap-1.5">
          <Camera className="h-3 w-3 text-primary" />
          Click camera để xem hình ảnh
        </span>
        <span className="flex items-center gap-1 text-muted-foreground border-l border-border pl-2">
          <ArrowUpLeft className="h-2.5 w-2.5" />
          Đèn rẽ trái
        </span>
      </div>
    </div>
  );
}
