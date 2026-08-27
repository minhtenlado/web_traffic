"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Camera, Video, ArrowUpLeft } from "lucide-react";
import { useTheme } from "next-themes";
import { CAMERAS, SIGNAL_PHASES, DIRECTIONS } from "@/lib/constants";
import { useTrafficStore } from "@/lib/store";
import { cn } from "@/lib/utils";

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
    if (signalState.countdown > 3) {
      straightColor = "green";
      straightCountdown = signalState.countdown - 3;
    } else {
      straightColor = "yellow";
      straightCountdown = signalState.countdown;
    }
  }

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
    },
  };
}

const LIGHT_COLORS: Record<string, string> = {
  green: "bg-success shadow-[0_0_12px_2px] shadow-success/60",
  yellow: "bg-warning shadow-[0_0_12px_2px] shadow-warning/60",
  red: "bg-destructive shadow-[0_0_12px_2px] shadow-destructive/60",
};

// Create custom icons using react-dom/server
function createCameraIcon(cam: any, camData: any, isError: boolean) {
  const label = camData?.mapped_label;
  let dotColor = "bg-muted-foreground";
  if (isError) dotColor = "bg-destructive";
  else if (label === "Ket_xe" || label === "Sap_ket") dotColor = "bg-warning";
  else if (label === "Dong_xe") dotColor = "bg-warning";
  else dotColor = "bg-success";

  const html = renderToStaticMarkup(
    <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card shadow-md">
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
      {/* Straight Light pod */}
      <div className="flex flex-col items-center gap-0.5 rounded-md border border-border bg-card/95 p-1 shadow-lg">
        <div className={cn("h-2 w-2 rounded-full", light.color === "red" ? LIGHT_COLORS.red : "bg-muted opacity-30")} />
        <div className={cn("h-2 w-2 rounded-full", light.color === "yellow" ? LIGHT_COLORS.yellow : "bg-muted opacity-30")} />
        <div className={cn("h-2 w-2 rounded-full", light.color === "green" ? LIGHT_COLORS.green : "bg-muted opacity-30")} />
      </div>

      {/* Left turn Arrow Light pod */}
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

      {/* Countdown badge */}
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

export function LeafletIntersectionMap() {
  const { resolvedTheme } = useTheme();
  const signalState = useTrafficStore((s) => s.signalState);
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const isOffline = useTrafficStore((s) => s.isBoardOffline);

  // Use useMemo for camera icons so we don't recreate them unless needed, though realtimeCams change frequently
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
          url={
            resolvedTheme === "light"
              ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          }
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {CAMERAS.map((cam) => {
          const camIcon = camIcons.find((c) => c.id === cam.id)?.icon;
          const realPos = cam.realPosition || [10.8015, 106.7115]; // Need real lat/lon
          return (
            <Marker key={cam.id} position={realPos as [number, number]} icon={camIcon}>
              <Tooltip direction="top" offset={[0, -16]}>
                <div className="text-xs">
                  <span className="font-bold">{cam.name}</span>
                  <br />
                  <span className="text-muted-foreground">{cam.label}</span>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

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

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-[10px] font-medium backdrop-blur shadow-md">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Thông thoáng</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Đông xe</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Kẹt/Lỗi</span>
        <span className="flex items-center gap-1 text-muted-foreground"><ArrowUpLeft className="h-2.5 w-2.5" /> Đèn rẽ trái</span>
      </div>
    </div>
  );
}
