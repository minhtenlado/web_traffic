"use client";

import { useMemo } from "react";
import { Activity, BarChart3, Camera, CarFront, MapPinned } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { selectedCameraView, vehicleCountLevel } from "@/lib/traffic-status";
import { formatNumber } from "@/lib/formatters";
import { SectionCard, StatCard, StatusBadge } from "@/components/shared/ui";
import { TrafficVotes } from "@/components/shared/TrafficVotes";
import { TrafficHistoryChart } from "./TrafficHistoryChart";
import { AICameraCharts } from "./AICameraCharts";

export function Analytics() {
  const records = useTrafficStore((state) => state.realtimeCams);
  const edgeAI = useTrafficStore((state) => state.edgeAI);
  const routes = useTrafficStore((state) => state.routeStats);
  const tick = useTrafficStore((state) => state._tickCount);
  const cameras = useMemo(() => CAMERAS.filter((camera) => camera.aiInput).map((camera) => ({
    ...camera, view: selectedCameraView(camera.id, records, edgeAI), record: records?.[camera.id],
  })), [records, edgeAI, tick]);
  const countedCameras = cameras.filter((camera) => camera.view.count !== null);
  const totalVehicles = countedCameras.length
    ? countedCameras.reduce((sum, camera) => sum + (camera.view.count ?? 0), 0) : null;
  const highestCountCamera = countedCameras.reduce<(typeof countedCameras)[number] | null>(
    (highest, camera) => highest === null || camera.view.count! > highest.view.count! ? camera : highest, null,
  );
  const highestCountLevel = vehicleCountLevel(highestCountCamera?.view.count);
  const routesWithData = routes.filter((route) => route.hasData).length;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Số xe trong ảnh & dự báo</h2>
      </div>
      <div className="text-right">
        <StatusBadge color={countedCameras.length === cameras.length && cameras.length ? "green" : countedCameras.length ? "amber" : "cyan"}>
          {countedCameras.length}/{cameras.length} camera có số đếm mới
        </StatusBadge>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard icon={CarFront} label="Xe trong ảnh mới" value={totalVehicles === null ? "—" : formatNumber(totalVehicles)} unit="xe" color="primary" />
      <StatCard icon={Camera} label="Camera có số đếm mới" value={`${countedCameras.length}/${cameras.length}`} unit="camera" color="cyan" />
      <StatCard icon={MapPinned} label="Hướng có dữ liệu mới" value={`${routesWithData}/${routes.length}`} unit="hướng" color="green" />
      <StatCard icon={Activity} label="Mức cao nhất theo ảnh" value={highestCountLevel?.label || "—"} unit={highestCountCamera ? `${highestCountCamera.name} · ${highestCountCamera.view.count} xe` : undefined} color={highestCountLevel?.color || "cyan"} />
    </div>

    <TrafficHistoryChart />

    <SectionCard title="Camera phân tích AI" icon={Camera}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cameras.map(({ id, name, label, view, record }) => {
          const countLevel = vehicleCountLevel(view.count);
          return (
            <article key={id} className="min-w-0 rounded-xl border border-border/80 bg-background/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{name}</h3>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground" title={label}>{label}</p>
                </div>
                <StatusBadge color={view.fresh ? "green" : view.cls}>{view.fresh ? "Ảnh mới" : view.text}</StatusBadge>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/70 pt-3">
                <div><span className="text-3xl font-semibold tabular-nums">{view.count ?? "—"}</span><span className="ml-2 text-sm text-muted-foreground">xe</span></div>
                <p className="text-right text-xs text-muted-foreground">{view.observedAt ? new Date(view.observedAt * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Chưa có thời điểm"}</p>
              </div>
              <div className="mt-3 border-t border-border/70 pt-3">
                {countLevel ? <>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Mức theo số xe</span><StatusBadge color={countLevel.color}>ID {countLevel.id} · {countLevel.label}</StatusBadge></div>
                </> : view.labelInfo ? <p className="text-sm">Nhãn YOLO: <strong>{view.labelInfo.text}</strong></p>
                  : <span className="text-sm text-muted-foreground">—</span>}
              </div>
              {view.ready && view.source === "legacy" && <TrafficVotes record={record} />}
            </article>
          );
        })}
      </div>
    </SectionCard>

    <SectionCard title="Tình trạng theo hướng" icon={Activity}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {routes.map((route) => <article key={route.id} className="rounded-xl border border-border/80 bg-background/35 p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-medium">{route.name}</h3><StatusBadge color={route.statusColor}>{route.status}</StatusBadge></div>
          <p className="mt-5 text-2xl font-semibold tabular-nums">{route.hasData ? formatNumber(route.vehicleCount) : "—"}<span className="ml-2 text-sm font-normal text-muted-foreground">xe</span></p>
        </article>)}
      </div>
    </SectionCard>

    <SectionCard title="Lịch sử, hiện tại và dự báo theo camera" icon={BarChart3}>
      <AICameraCharts />
    </SectionCard>
  </div>;
}
