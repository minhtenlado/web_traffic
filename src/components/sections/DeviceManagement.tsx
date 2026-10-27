"use client";

import { Camera, Cpu, Radio } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { selectedCameraView } from "@/lib/traffic-status";
import { SectionCard, StatusBadge } from "@/components/shared/ui";

function ageText(timestamp: number | null) {
  if (!timestamp || !Number.isFinite(timestamp)) return "Chưa có thời điểm";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  return seconds < 60 ? `${seconds} giây trước` : `${Math.floor(seconds / 60)} phút trước`;
}

export function DeviceManagement() {
  const cams = useTrafficStore((state) => state.realtimeCams);
  const edge = useTrafficStore((state) => state.edgeAI);
  const controller = useTrafficStore((state) => state.controllerStatus);
  const tick = useTrafficStore((state) => state._tickCount);
  void tick;
  const edgeAt = Number(edge?.generated_at);
  const genioLive = edge?.status?.online === true && Number.isFinite(edgeAt) && Date.now() / 1000 >= edgeAt && Date.now() / 1000 - edgeAt <= 30;
  const controllerAt = Number(controller?.lastSeen);
  const stm32Live = controller?.online === true && Number.isFinite(controllerAt) && Date.now() / 1000 - controllerAt < 3;
  const aiCameras = CAMERAS.filter((camera) => camera.aiInput);
  const freshAiCount = aiCameras.filter((camera) => selectedCameraView(camera.id, cams, edge).fresh).length;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Thiết bị hiện có</p><h2 className="mt-1 text-2xl font-semibold">Kết nối tại Hàng Xanh</h2></div><StatusBadge color={freshAiCount ? "green" : "cyan"}>{freshAiCount}/{aiCameras.length} camera AI có ảnh mới</StatusBadge></div>

    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Camera giao thông" icon={Camera}>
        <div className="divide-y divide-border">
          {CAMERAS.map((camera) => {
            const record = cams?.[camera.id];
            const view = selectedCameraView(camera.id, cams, edge);
            const at = view.observedAt;
            const age = ageText(at !== null && at > 0 ? at : null);
            const color = camera.aiInput ? view.fresh ? "green" : view.source === "legacy" && record?.status === "ERROR" ? "red" : "amber" : "cyan";
            const label = camera.aiInput ? view.fresh ? "Đang nhận ảnh" : view.source === "legacy" && record?.status === "ERROR" ? "Có lỗi camera" : "Chưa có ảnh mới" : "Chỉ xem tham chiếu";
            return <article key={camera.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><Camera className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{camera.name} <span className="font-normal text-muted-foreground">· {camera.aiInput ? "AI" : "tham chiếu"}</span></p><p className="truncate text-xs text-muted-foreground" title={camera.label}>{camera.label} · {age}</p></div>
              <StatusBadge color={color}>{label}</StatusBadge>
            </article>;
          })}
        </div>
      </SectionCard>

      <SectionCard title="Bộ xử lý và điều khiển" icon={Cpu}>
        <div className="space-y-3">
          <DeviceRow icon={Cpu} title="MediaTek Genio 350" subtitle={edgeAt ? `Heartbeat ${ageText(edgeAt)}` : "Chưa có heartbeat"} online={genioLive} known={Boolean(edge)} />
          <DeviceRow icon={Radio} title="STM32F105RCT6" subtitle={controllerAt ? `Telemetry ${ageText(controllerAt)}` : "Chưa có telemetry"} online={stm32Live} known={Boolean(controller)} />
        </div>
      </SectionCard>
    </div>
  </div>;
}

function DeviceRow({ icon: Icon, title, subtitle, online, known }: { icon: typeof Cpu; title: string; subtitle: string; online: boolean; known: boolean }) {
  return <article className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/35 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-medium">{title}</p><p className="text-xs text-muted-foreground">{subtitle}</p></div><StatusBadge color={!known ? "cyan" : online ? "green" : "amber"}>{!known ? "Chưa có dữ liệu" : online ? "Đang hoạt động" : "Mất heartbeat"}</StatusBadge></article>;
}
