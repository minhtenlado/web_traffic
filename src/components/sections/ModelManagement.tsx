"use client";

import { useEffect, useState } from "react";
import { AICameraCharts } from "./AICameraCharts";
import { Brain, Package, ShieldCheck } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { edgeHistoryProgress, groupEdgeForecasts } from "@/lib/edge-forecast";

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
  const historyProgress = edgeHistoryProgress(edgeStatus);
  const edgeRainRate = typeof edgeWeather?.precipitation === "number" && Number.isFinite(edgeWeather.precipitation) ? edgeWeather.precipitation : null;
  const edgeRainAmount = typeof edgeWeather?.raw_precipitation_mm === "number" && Number.isFinite(edgeWeather.raw_precipitation_mm) ? edgeWeather.raw_precipitation_mm : null;
  const edgeRainInterval = typeof edgeWeather?.interval_seconds === "number" && Number.isFinite(edgeWeather.interval_seconds) ? edgeWeather.interval_seconds : null;
  const edgeRainIntensity = typeof edgeWeather?.rain_intensity === "number" && Number.isFinite(edgeWeather.rain_intensity) ? edgeWeather.rain_intensity : null;
  const edgeForecasts = groupEdgeForecasts(edgeAI?.forecasts);
  const edgeForecastReady = edgeStatus.forecast_status === "EXPERIMENTAL" && edgeLive;
  const forecastWaitingReason = !edgeAI
    ? "Chưa nhận telemetry của Genio; chưa thể xác nhận model hoặc dự báo."
    : !edgeLive
      ? "Telemetry Genio đã cũ; website ẩn dự báo để không hiển thị kết quả hết hạn."
      : edgeStatus.weather_status !== "AVAILABLE"
        ? "Thời tiết hiện không khả dụng; không tạo hoặc điền giả đặc trưng thời tiết."
        : historyProgress.remaining > 0
          ? `TCN đang tích lũy lịch sử liên tục: ${historyProgress.steps}/${historyProgress.required} bước, còn ${historyProgress.remaining} bước trước dự báo đầu tiên.`
          : "Đã đủ lịch sử đầu vào; đang chờ chu kỳ TCN phát bản dự báo mới.";
  return <div className="space-y-5">
    <SectionCard title="Mô hình đang chạy trên Genio 350" subtitle="Trạng thái runtime và mã phiên bản được đọc trực tiếp từ telemetry Genio." icon={Brain}>
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
        <span className="break-all font-mono text-xs text-muted-foreground">Model: {edgeStatus.model_version || "chưa có mã phiên bản"}</span>
      </div>
      <p className="mt-3 text-sm">
        Thời tiết (ước lượng mô hình, không phải trạm đo): {edgeStatus.weather_status === "AVAILABLE" && edgeWeather
          ? `${edgeWeather.is_raining ? "Có mưa" : "Không ghi nhận mưa"} · ${edgeRainAmount !== null && edgeRainInterval !== null ? `API ${edgeRainAmount.toFixed(2)} mm/${edgeRainInterval}s → ` : ""}${edgeRainRate !== null ? `${edgeRainRate.toFixed(2)} mm/giờ` : "tốc độ mưa không có dữ liệu"} · rain_intensity ${edgeRainIntensity !== null ? edgeRainIntensity.toFixed(2) : "không có dữ liệu"} · ${edgeWeather.rain_group || "chưa phân nhóm"}`
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
          <StatusBadge color={edgeForecastReady ? "green" : "amber"}>{edgeForecastReady ? "Có dự báo · kết quả thử nghiệm" : edgeStatus.forecast_status || "Chờ dữ liệu"}</StatusBadge>
        </div>
        {edgeForecastReady ? (
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {([5, 15, 30] as const).map(horizon => <div key={horizon}>
              <h4 className="mb-2 text-sm font-medium">{horizon} phút</h4>
              <div className="space-y-1 text-sm">
                {edgeForecasts[horizon].length ? edgeForecasts[horizon].map(row => (
                  <p key={`${row.camera_id}-${horizon}`} className="flex justify-between gap-2"><span>{row.camera_id}</span><span>{row.predicted_class} · độ tin cậy {row.confidence.toFixed(2)}</span></p>
                )) : <p className="text-muted-foreground">Chưa có bản ghi dự báo hợp lệ cho mốc này.</p>}
              </div>
            </div>)}
          </div>
        ) : <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">{forecastWaitingReason}</p>
          {historyProgress.required > 0 && edgeLive && <div aria-label="Tiến độ lịch sử TCN">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Lịch sử đầu vào liên tục</span><span>{historyProgress.steps}/{historyProgress.required} bước · còn {historyProgress.remaining}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${historyProgress.percent}%` }} /></div>
          </div>}
        </div>}
        <p className="mt-3 text-xs text-muted-foreground">Độ tin cậy là xác suất đầu ra của model, không phải độ chính xác đã đo. Dự báo không điều khiển đèn.</p>
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
