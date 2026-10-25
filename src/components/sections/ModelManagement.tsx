"use client";

import { useEffect, useState } from "react";
import { AICameraCharts } from "./AICameraCharts";
import { Brain, Package, ShieldCheck } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { SectionCard, StatusBadge } from "@/components/shared/ui";

export function ModelManagement() {
  const status = useTrafficStore(s => s.modelStatus);
  const edgeAI = useTrafficStore(s => s.edgeAI);
  const offline = useTrafficStore(s => s.isBoardOffline);
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 5000); return () => clearInterval(timer); }, []);
  const models = status?.model_artifacts || {};
  const missing = status?.missing_model_inputs || [];
  const tcnIsLive = status?.tcn_status === "EXPERIMENTAL" && !offline;
  const edgeStatus = edgeAI?.status || {};
  const edgeGeneratedAt = Number(edgeAI?.generated_at);
  const edgeAge = Number.isFinite(edgeGeneratedAt) ? Math.max(0, now - edgeGeneratedAt) : Infinity;
  const edgeLive = edgeStatus.online === true && edgeAge <= 30;
  const edgeWeather = edgeAI?.weather;
  const edgeForecasts = Array.isArray(edgeAI?.forecasts) ? edgeAI.forecasts : [];
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
    <SectionCard title="Genio Edge — nhận dạng và dự báo trạng thái" subtitle="Dữ liệu do Genio ghi trực tiếp vào Firebase; không lấy từ Windows." icon={Brain}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge color={edgeLive ? "green" : "amber"}>{edgeLive ? "Heartbeat mới" : edgeAI ? "Telemetry hết hạn" : "Chưa nhận telemetry"}</StatusBadge>
        <span className="text-muted-foreground">{Number.isFinite(edgeAge) ? `Cập nhật ${Math.round(edgeAge)} giây trước` : "Chưa có thời điểm cập nhật"}</span>
        <span className="text-muted-foreground">TCN: {edgeStatus.validation_status || "—"}</span>
      </div>
      <p className="mt-3 text-sm">
        Thời tiết: {edgeStatus.weather_status === "AVAILABLE" && edgeWeather
          ? `${edgeWeather.is_raining ? "Có mưa" : "Không ghi nhận mưa"} · ${Number(edgeWeather.precipitation || 0).toFixed(2)} mm/giờ · rain_intensity ${Number(edgeWeather.rain_intensity || 0).toFixed(2)} · ${edgeWeather.rain_group || "chưa phân nhóm"}`
          : "Không có dữ liệu thời tiết mới; hệ thống không tự điền lượng mưa."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Nguồn: {edgeWeather?.source || "chưa nhận"} · Mã thời tiết {edgeWeather?.weather_code ?? "—"} · {edgeWeather?.validation_status || ""}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Object.entries(edgeAI?.cameras || {}).map(([camera, value]: [string, any]) => (
          <div key={camera} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex justify-between gap-2"><strong>{camera}</strong><span className="text-muted-foreground">{value.status}</span></div>
            <p className="mt-2">Lớp classifier: <strong>{value.label || "—"}</strong></p>
            <p className="text-muted-foreground">Xe trong ảnh: {value.vehicle_count ?? "—"} · confidence {Number.isFinite(value.classification_confidence) ? Number(value.classification_confidence).toFixed(2) : "—"}</p>
            <p className="text-xs text-muted-foreground">Tuổi ảnh: {Number.isFinite(value.image_age_seconds) ? `${Number(value.image_age_seconds).toFixed(1)} giây` : "—"} · nguồn nhãn {value.label_source || "—"}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Dự báo 5 / 15 / 30 phút</h3>
          <StatusBadge color="amber">{edgeStatus.forecast_status === "EXPERIMENTAL" ? "Thử nghiệm, chưa kiểm định thực địa" : edgeStatus.forecast_status || "Chờ dữ liệu"}</StatusBadge>
        </div>
        {edgeStatus.forecast_status === "EXPERIMENTAL" && edgeLive ? (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {[5, 15, 30].map(horizon => <div key={horizon}>
              <h4 className="mb-2 text-sm font-medium">{horizon} phút</h4>
              <div className="space-y-1 text-sm">{edgeForecasts.filter((row: any) => row.horizon_minutes === horizon).map((row: any) => (
                <p key={`${row.camera_id}-${horizon}`} className="flex justify-between gap-2"><span>{row.camera_id}</span><span>{row.predicted_class} ({Number(row.confidence).toFixed(2)})</span></p>
              ))}</div>
            </div>)}
          </div>
        ) : <p className="mt-2 text-sm text-muted-foreground">Chờ đủ lịch sử 5 camera, thời tiết mới và heartbeat hợp lệ.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Nhận dạng và dự báo dùng nhãn model riêng; không ánh xạ ngầm sang nhãn Firebase cũ, không phát lệnh đèn.</p>
      </div>
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
