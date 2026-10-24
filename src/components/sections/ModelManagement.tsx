"use client";

import { AICameraCharts } from "./AICameraCharts";
import { Brain, Package, ShieldCheck } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { SectionCard, StatusBadge } from "@/components/shared/ui";

export function ModelManagement() {
  const status = useTrafficStore(s => s.modelStatus);
  const offline = useTrafficStore(s => s.isBoardOffline);
  const models = status?.model_artifacts || {};
  const missing = status?.missing_model_inputs || [];
  const tcnIsLive = status?.tcn_status === "EXPERIMENTAL" && !offline;
  return <div className="space-y-5">
    <SectionCard title="Mô hình đang chạy trên Genio 350" subtitle="Thông tin do bo báo về; chưa có phép đo độ chính xác thực địa." icon={Brain}>
      <p className="mb-4 text-sm text-muted-foreground">Runtime: {status?.runtime_version || "Chưa nhận được"} · <StatusBadge color={offline ? "amber" : "green"}>{offline ? "Telemetry hết hạn" : "Đã kết nối"}</StatusBadge></p>
      <div className="grid gap-4 md:grid-cols-2">{["detection", "classification"].map(role => {
        const model = models[role];
        return <div key={role} className="min-w-0 rounded-xl border border-border p-4">
          <h3 className="mb-2 font-semibold">YOLO {role === "detection" ? "Detection" : "Classification"}</h3>
          <p className="text-sm">{model?.file || "Chưa có thông tin model"}</p>
          <p className="mt-2 text-xs text-muted-foreground">Input: {model?.input_shape?.join(" × ") || "—"} · Output: {model?.output_shape?.join(" × ") || "—"}</p>
          <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">SHA256: {model?.sha256 || "—"}</p>
          <p className="mt-3 text-sm text-muted-foreground">Accuracy / mAP / F1: chưa đo trên tập kiểm thử được duyệt.</p>
        </div>;
      })}</div>
    </SectionCard>
    <SectionCard title="TCN — dự báo 30 phút" icon={Package}>
      <StatusBadge color={tcnIsLive ? "green" : "amber"}>{tcnIsLive ? "Đang dự báo thử nghiệm" : status?.tcn_status === "DISABLED" ? "Đã khóa dự báo live" : "Chưa sẵn sàng"}</StatusBadge>
      <p className="mt-3 text-sm text-muted-foreground">Bộ đệm: {status?.buffer_fill ?? 0}/{status?.buffer_max ?? "—"} bước. {missing.length > 0 ? `Thiếu camera đầu vào: ${missing.join(", ")}. Không phát dự báo khi thiếu đầu vào.` : "Chỉ công bố khi dữ liệu mới, đủ lịch sử và đúng schema của model."}</p>
      {status?.tcn_reason && <p className="mt-2 text-sm text-warning">Lý do: {status.tcn_reason}</p>}
      <p className="mt-2 text-sm text-muted-foreground">TCN V3 dự báo số lượng quan sát trong ảnh cho 30 phút tới, dùng lịch sử 120 phút của 5 camera. Kết quả thử nghiệm chưa được kiểm định thực địa và không điều khiển đèn. Model này chưa dự báo nhãn ùn tắc.</p>
      <AICameraCharts />
    </SectionCard>
    <SectionCard title="Thay model sau này" icon={ShieldCheck}>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Chuẩn bị file model và manifest: SHA256, thứ tự nhãn/camera, tensor I/O, chuẩn hóa và chu kỳ lấy mẫu.</li>
        <li>Kiểm tra adapter và đối chiếu output với tập mẫu chuẩn trên Genio trước khi kích hoạt.</li>
        <li>Khởi động lại cửa sổ phiếu/bộ đệm sau khi thay model; giữ phiên bản cũ để khôi phục.</li>
      </ol>
      <p className="mt-4 text-sm">Bỏ phiếu giúp ổn định hiển thị. Tỷ lệ 8/10 phiếu không có nghĩa model chính xác 80%.</p>
    </SectionCard>
  </div>;
}
