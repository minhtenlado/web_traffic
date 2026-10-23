"use client";

import { BarChart3, Camera, Car } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { cameraView } from "@/lib/traffic-status";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { TrafficVotes } from "@/components/shared/TrafficVotes";

export function Analytics() {
  const records = useTrafficStore(s => s.realtimeCams);
  const routes = useTrafficStore(s => s.routeStats);
  useTrafficStore(s => s._tickCount);
  return <div className="space-y-5">
    <SectionCard title="Thống kê từ dữ liệu đang thu thập" subtitle="Mỗi camera có cửa sổ 10 ảnh mới riêng. Số xe là ước lượng trong ảnh, không phải lưu lượng xe qua đường." icon={BarChart3}>
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMERAS.filter(c => !c.isReference).map(cam => {
          const record = records?.[cam.id];
          const view = cameraView(record);
          return <div key={cam.id} className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between"><h3 className="font-semibold">{cam.name}</h3><StatusBadge color={view.cls}>{view.text}</StatusBadge></div>
            <p className="mt-1 text-sm text-muted-foreground">{cam.label}</p>
            <p className="mt-3 text-xl font-semibold">{view.count ?? "—"} <span className="text-sm font-normal">xe trong ảnh (EMA)</span></p>
            {view.fresh && <p className="text-xs text-muted-foreground">Đếm ở ảnh mới nhất: {record.raw_count ?? "—"} · nhãn thô: {record.raw_mapped_label ?? "—"}</p>}
            <TrafficVotes record={record} />
          </div>;
        })}
      </div>
    </SectionCard>
    <SectionCard title="Độ phủ các hướng" subtitle="Một hướng có nhiều camera dùng nhãn ổn định nghiêm trọng nhất; không có mẫu thì chưa kết luận." icon={Camera}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{routes.map(route => <div key={route.id} className="rounded-xl border border-border p-3">
        <p className="font-semibold">{route.name}</p><p className="my-2"><StatusBadge color={route.statusColor}>{route.status}</StatusBadge></p>
        <p className="text-sm text-muted-foreground">{route.coverage}/{route.expectedCameras} camera AI đủ 10 mẫu</p>
      </div>)}</div>
    </SectionCard>
    <SectionCard title="Lịch sử và chất lượng mô hình" icon={Car}>
      <p className="text-sm text-muted-foreground">Chưa có API thống kê lịch sử và tập nhãn chuẩn đã được xác minh. Biểu đồ theo ngày, thời gian chờ, tốc độ, độ chính xác và dự báo số xe sẽ chỉ hiển thị khi có dữ liệu đo tương ứng. Nhật ký phiếu đang được lưu riêng trên Genio để đối chiếu.</p>
    </SectionCard>
  </div>;
}
