"use client";

import { useMemo } from "react";
import { Activity, BarChart3, Camera } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { selectedCameraView } from "@/lib/traffic-status";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
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
  const freshCount = cameras.filter((camera) => camera.view.fresh).length;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hàng Xanh · Dữ liệu trực tiếp</p>
        <h2 className="text-2xl font-semibold tracking-tight">Lưu lượng quan sát & dự báo</h2>
      </div>
      <StatusBadge color={freshCount === cameras.length && cameras.length ? "green" : freshCount ? "amber" : "cyan"}>
        {freshCount}/{cameras.length} camera AI đang có ảnh mới
      </StatusBadge>
    </div>

    <TrafficHistoryChart />

    <SectionCard title="Camera phân tích AI" subtitle="Số xe và tình trạng giao thông theo từng camera" icon={Camera}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cameras.map(({ id, name, label, view, record }) => <article key={id} className="min-w-0 rounded-xl border border-border/80 bg-background/35 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="font-semibold">{name}</h3><p className="mt-0.5 truncate text-sm text-muted-foreground" title={label}>{label}</p></div>
            <StatusBadge color={view.cls}>{view.fresh ? "Ảnh mới" : view.text}</StatusBadge>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/70 pt-3">
            <div><span className="text-3xl font-semibold tabular-nums">{view.count ?? "—"}</span><span className="ml-2 text-xs text-muted-foreground">xe trong ảnh</span></div>
            <p className="text-right text-xs text-muted-foreground">{view.observedAt ? new Date(view.observedAt * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Chưa có thời điểm"}</p>
          </div>
          {view.ready ? <p className="mt-2 text-sm">Tình trạng: <strong>{view.text}</strong></p> : <p className="mt-2 text-xs text-muted-foreground">Chưa đủ dữ liệu mới để kết luận tình trạng.</p>}
          {view.ready && view.source === "legacy" && <TrafficVotes record={record} />}
        </article>)}
      </div>
    </SectionCard>

    <SectionCard title="Tình trạng theo hướng" subtitle="Tổng hợp từ camera AI còn dữ liệu hiệu lực; mức ùn tắc là nhãn phân loại, không phải mật độ đo được." icon={Activity}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {routes.map((route) => <article key={route.id} className="rounded-xl border border-border/80 bg-background/35 p-4">
          <div className="flex items-center justify-between gap-2"><h3 className="font-medium">{route.name}</h3><StatusBadge color={route.statusColor}>{route.status}</StatusBadge></div>
          <p className="mt-5 text-2xl font-semibold tabular-nums">{route.hasData ? route.vehicleCount : "—"}<span className="ml-2 text-xs font-normal text-muted-foreground">xe trong ảnh mới</span></p>
          <p className="mt-2 text-xs text-muted-foreground">Camera có dữ liệu: {route.coverage}/{route.expectedCameras}</p>
        </article>)}
      </div>
    </SectionCard>

    <SectionCard title="Dự báo TCN" subtitle="Quan sát và dự báo chỉ xuất hiện khi payload còn hiệu lực; trạng thái kiểm định được giữ nguyên." icon={BarChart3}>
      <AICameraCharts />
    </SectionCard>
  </div>;
}
