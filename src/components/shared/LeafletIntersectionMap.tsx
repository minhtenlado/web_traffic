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

// Catmull-Rom spline interpolation for continuous, silky-smooth road curves
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

function smoothPath(points: [number, number][], samplesPerSegment = 8): [number, number][] {
  if (points.length < 3) return points;
  const result: [number, number][] = [];
  const pts = [points[0], ...points, points[points.length - 1]];

  for (let i = 0; i < pts.length - 3; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const p2 = pts[i + 2];
    const p3 = pts[i + 3];

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const lat = catmullRom(p0[0], p1[0], p2[0], p3[0], t);
      const lng = catmullRom(p0[1], p1[1], p2[1], p3[1], t);
      result.push([lat, lng]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

interface RouteConfig {
  id: string;
  name: string;
  rawPaths: [number, number][][];
}

// Precise anchor points following the exact visual curves of the roadways on the map
const RAW_ROUTE_CONFIGS: RouteConfig[] = [
  {
    id: "dien_bien_phu",
    name: "Điện Biên Phủ (Q.1 ➔ Hàng Xanh)",
    rawPaths: [
      [
        [10.79930, 106.70520],
        [10.79985, 106.70670],
        [10.80035, 106.70785],
        [10.80077, 106.70898],
        [10.80108, 106.71000],
        [10.80132, 106.71085],
        [10.80145, 106.71130],
      ],
    ],
  },
  {
    id: "hang_xanh",
    name: "Điện Biên Phủ (Cầu Sài Gòn ➔ Hàng Xanh)",
    rawPaths: [
      [
        [10.80080, 106.71620],
        [10.80102, 106.71495],
        [10.80120, 106.71370],
        [10.80137, 106.71230],
        [10.80155, 106.71175],
        [10.80150, 106.71145],
      ],
    ],
  },
  {
    id: "bach_dang",
    name: "Bạch Đằng (Bà Chiểu ➔ Hàng Xanh)",
    rawPaths: [
      [
        [10.80480, 106.70760],
        [10.80420, 106.70850],
        [10.80360, 106.70930],
        [10.80300, 106.70985],
        [10.80250, 106.71060],
        [10.80211, 106.71124],
        [10.80185, 106.71135],
      ],
    ],
  },
  {
    id: "xo_viet_nghe_tinh",
    name: "Xô Viết Nghệ Tĩnh (Cầu Thị Nghè ➔ Hàng Xanh)",
    rawPaths: [
      [
        [10.79720, 106.71125],
        [10.79850, 106.71128],
        [10.79979, 106.71131],
        [10.80050, 106.71135],
        [10.80083, 106.71138],
        [10.80135, 106.71140],
      ],
      [
        [10.80165, 106.71145],
        [10.80210, 106.71150],
        [10.80280, 106.71158],
        [10.80380, 106.71168],
        [10.80520, 106.71175],
      ],
    ],
  },
];

// Pre-compute smoothed paths once
const ROUTE_CONFIGS = RAW_ROUTE_CONFIGS.map((r) => ({
  ...r,
  paths: r.rawPaths.map((p) => smoothPath(p, 8)),
}));

const COLOR_MAP: Record<string, string> = {
  green: "#22c55e", // vibrant Google Maps green
  amber: "#f59e0b", // vibrant Google Maps amber/yellow
  red: "#ef4444",   // vibrant Google Maps red
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

        {/* Traffic Status Polylines (Smooth Google Maps style curves) */}
        {trafficRoutes.map((route) => {
          const color = isOffline ? "#64748b" : COLOR_MAP[route.statusColor] || "#22c55e";
          return route.paths.map((path, pIdx) => (
            <Fragment key={`route-${route.id}-${pIdx}`}>
              {/* Soft dark shadow casing */}
              <Polyline
                positions={path}
                pathOptions={{
                  color: "#0f172a",
                  weight: 8,
                  opacity: 0.55,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              {/* Main vibrant traffic line */}
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
              {/* Center subtle glass highlight for 3D appearance */}
              <Polyline
                positions={path}
                pathOptions={{
                  color: "#ffffff",
                  weight: 1.5,
                  opacity: 0.25,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
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
