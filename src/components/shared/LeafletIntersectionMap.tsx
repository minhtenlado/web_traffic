"use client";

import { useEffect, useMemo, Fragment } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline } from "react-leaflet";
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

interface RouteConfig {
  id: string;
  name: string;
  paths: [number, number][][];
}

const ROUTE_CONFIGS: RouteConfig[] = [
  {
    id: "dien_bien_phu",
    name: "Điện Biên Phủ (Q.1 ➔ Hàng Xanh)",
    paths: [
      [
        [10.79855, 106.70553],
        [10.79894, 106.70593],
        [10.79927, 106.70628],
        [10.79962, 106.70672],
        [10.79990, 106.70714],
        [10.80019, 106.70762],
        [10.80036, 106.70791],
        [10.80050, 106.70815],
        [10.80066, 106.70851],
        [10.80073, 106.70862],
        [10.80092, 106.70910],
        [10.80101, 106.70939],
        [10.80103, 106.70980],
        [10.80119, 106.71050],
        [10.80130, 106.71120],
        [10.80134, 106.71156]
      ]
    ]
  },
  {
    id: "hang_xanh",
    name: "Điện Biên Phủ (Cầu Sài Gòn ➔ Hàng Xanh)",
    paths: [
      [
        [10.79980, 106.71773],
        [10.80030, 106.71672],
        [10.80060, 106.71603],
        [10.80084, 106.71497],
        [10.80111, 106.71405],
        [10.80116, 106.71390],
        [10.80127, 106.71342],
        [10.80128, 106.71292],
        [10.80127, 106.71254],
        [10.80129, 106.71191],
        [10.80130, 106.71156]
      ]
    ]
  },
  {
    id: "bach_dang",
    name: "Bạch Đằng (Bà Chiểu ➔ Hàng Xanh)",
    paths: [
      [
        [10.80328, 106.70606],
        [10.80314, 106.70668],
        [10.80310, 106.70725],
        [10.80304, 106.70811],
        [10.80302, 106.70842],
        [10.80299, 106.70869],
        [10.80294, 106.70925],
        [10.80293, 106.70937],
        [10.80279, 106.71118],
        [10.80218, 106.71129],
        [10.80168, 106.71121]
      ]
    ]
  },
  {
    id: "xo_viet_nghe_tinh",
    name: "Xô Viết Nghệ Tĩnh (Cầu Thị Nghè ➔ Hàng Xanh)",
    paths: [
      [
        [10.79779, 106.71090],
        [10.79815, 106.71099],
        [10.79862, 106.71109],
        [10.79949, 106.71117],
        [10.79981, 106.71120],
        [10.80045, 106.71127],
        [10.80064, 106.71130],
        [10.80103, 106.71135],
        [10.80119, 106.71138],
        [10.80145, 106.71145]
      ],
      [
        [10.80169, 106.71145],
        [10.80206, 106.71142],
        [10.80266, 106.71139],
        [10.80283, 106.71140],
        [10.80379, 106.71146],
        [10.80460, 106.71149],
        [10.80576, 106.71154]
      ]
    ]
  }
];

const COLOR_MAP: Record<string, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

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

export function LeafletIntersectionMap() {
  const { resolvedTheme } = useTheme();
  const signalState = useTrafficStore((s) => s.signalState);
  const realtimeCams = useTrafficStore((s) => s.realtimeCams);
  const isOffline = useTrafficStore((s) => s.isBoardOffline);
  const routeStats = useTrafficStore((s) => s.routeStats);

  const trafficRoutes = useMemo(() => {
    const routeMap = new Map((routeStats || []).map((r) => [r.id, r]));
    return ROUTE_CONFIGS.map((cfg) => {
      const stat = routeMap.get(cfg.id);
      const statusColor = stat?.statusColor || "green";
      const status = stat?.status || "Thông thoáng";
      const vehicleCount = stat?.vehicleCount ?? 0;
      return {
        ...cfg,
        statusColor,
        status,
        vehicleCount,
      };
    });
  }, [routeStats]);

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

        {/* Traffic Status Polylines (Google Maps style) */}
        {trafficRoutes.map((route) => {
          const color = isOffline ? "#6b7280" : COLOR_MAP[route.statusColor] || "#22c55e";
          return route.paths.map((path, pIdx) => (
            <Fragment key={`route-${route.id}-${pIdx}`}>
              <Polyline
                positions={path}
                pathOptions={{
                  color: "#000000",
                  weight: 8,
                  opacity: 0.7,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Polyline
                positions={path}
                pathOptions={{
                  color: color,
                  weight: 5,
                  opacity: 0.95,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              >
                <Tooltip sticky direction="top">
                  <div className="text-xs p-1">
                    <div className="font-bold text-foreground">{route.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium">{isOffline ? "Mất kết nối" : route.status}</span>
                      {route.vehicleCount > 0 && (
                        <span className="text-muted-foreground">({route.vehicleCount} xe)</span>
                      )}
                    </div>
                  </div>
                </Tooltip>
              </Polyline>
            </Fragment>
          ));
        })}

        {/* Cameras */}
        {CAMERAS.map((cam) => {
          const camIcon = camIcons.find((c) => c.id === cam.id)?.icon;
          const realPos = cam.realPosition || [10.8015, 106.7115];
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

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-[10px] font-medium backdrop-blur shadow-md">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-[#22c55e]" />
          Thông thoáng
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-[#f59e0b]" />
          Đông xe
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-4 rounded-full bg-[#ef4444]" />
          Kẹt xe
        </span>
        <span className="flex items-center gap-1 text-muted-foreground border-l border-border pl-2">
          <ArrowUpLeft className="h-2.5 w-2.5" />
          Đèn rẽ trái
        </span>
      </div>
    </div>
  );
}
