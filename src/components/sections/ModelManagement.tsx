"use client";

import { useEffect, useState } from "react";
import { Brain, Camera, CloudRain, Cpu, ShieldCheck } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { edgeHistoryProgress, edgeTcnRecovery, groupEdgeForecasts } from "@/lib/edge-forecast";
import { selectedCameraView, EDGE_TRAFFIC_LABELS } from "@/lib/traffic-status";

function validationText(value: unknown) {
  if (value === "validated") return "Đã kiểm định";
  if (value === "experimental_unvalidated" || value === "EXPERIMENTAL") return "Đang kiểm định";
  return "Chưa xác nhận";
}

export function ModelManagement() {
  const status = useTrafficStore((state) => state.modelStatus);
  const edgeAI = useTrafficStore((state) => state.edgeAI);
  const edgeStatus = edgeAI?.status || {};
  const edgeWeather = edgeAI?.weather;
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 5000); return () => clearInterval(timer); }, []);
  const generatedAt = Number(edgeAI?.generated_at);
  const age = Number.isFinite(generatedAt) ? Math.max(0, now - generatedAt) : null;
  const edgeLive = edgeStatus.online === true && age !== null && age <= 30 && now >= generatedAt;
  const validation = validationText(edgeStatus.validation_status);
  const models = status?.model_artifacts || edgeStatus.model_artifacts || {};
  const progress = edgeHistoryProgress(edgeStatus);
  const recovery = edgeTcnRecovery(edgeStatus, edgeLive);
  const forecasts = groupEdgeForecasts(edgeAI?.forecasts);
  const forecastReady = recovery.forecastReady;
  const cameras = Object.entries(edgeAI?.cameras || {}).sort(([a], [b]) => a.localeCompare(b));
  const rainFlag = edgeWeather?.is_raining;
  const isRaining = typeof rainFlag === "boolean" ? rainFlag : rainFlag === 0 || rainFlag === 1 ? Boolean(rainFlag) : null;
  const rainRate = typeof edgeWeather?.precipitation === "number" ? edgeWeather.precipitation : null;
  const rainAmount = typeof edgeWeather?.raw_precipitation_mm === "number" ? edgeWeather.raw_precipitation_mm : null;
  const rainInterval = typeof edgeWeather?.interval_seconds === "number" ? edgeWeather.interval_seconds : null;
  const temperature = edgeWeather?.temperature_c ?? edgeWeather?.temperature ?? edgeWeather?.temperature_2m;
  const humidity = edgeWeather?.humidity_percent ?? edgeWeather?.humidity ?? edgeWeather?.relative_humidity_2m;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nhận dạng & dự báo</p><h2 className="mt-1 text-2xl font-semibold">AI tại Hàng Xanh</h2><p className="mt-1 text-sm text-muted-foreground">Kết quả mới nhất từ camera và mô hình trên Genio 350.</p></div>
      <StatusBadge color={edgeLive ? "green" : edgeAI ? "amber" : "cyan"}>{edgeLive ? "Genio có tín hiệu mới" : edgeAI ? "Đang chờ tín hiệu mới" : "Chưa nhận dữ liệu AI"}</StatusBadge>
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <SectionCard title="Phiên bản đang hoạt động" subtitle="Thông tin model được hiển thị khi thiết bị gửi dữ liệu" icon={Cpu}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {(["detection", "classification"] as const).map((role) => {
            const model = models[role];
            return <article key={role} className="rounded-lg border border-border/80 bg-background/35 p-4">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">YOLO {role === "detection" ? "Detection" : "Classification"}</h3><StatusBadge color={model ? "green" : "cyan"}>{model ? "Đang hoạt động" : "Chưa có metadata"}</StatusBadge></div>
              <p className="mt-3 text-sm">{model?.file || "Thiết bị chưa gửi tên tệp model."}</p>
              <p className="mt-1 text-xs text-muted-foreground">Chỉ số đánh giá độc lập: chưa có trong bản tin hiện tại.</p>
              {model?.sha256 && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Thông tin kỹ thuật</summary><p className="mt-2 break-all font-mono">SHA-256: {model.sha256}</p><p className="mt-1">Input: {model.input_shape?.join(" × ") || "—"} · Output: {model.output_shape?.join(" × ") || "—"}</p></details>}
            </article>;
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm"><span>TCN: <strong>{validation}</strong></span><span className="text-muted-foreground">{age === null ? "Chưa có thời điểm cập nhật" : `Cập nhật ${Math.round(age)} giây trước`}</span></div>
        {edgeStatus.model_version && <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer">Mã phiên bản và trạng thái kiểm định</summary><p className="mt-2 break-all font-mono">Model: {edgeStatus.model_version}</p><p>Mã trạng thái: {String(edgeStatus.validation_status || "chưa có")}</p><p>Runtime: {status?.runtime_version || edgeStatus.runtime_version || "chưa có telemetry"}</p></details>}
      </SectionCard>

      <SectionCard title="Thời tiết hiện tại" subtitle="Ước tính API tại khu vực; không phải số đo từ trạm tại chỗ" icon={CloudRain}>
        {edgeStatus.weather_status === "AVAILABLE" && edgeWeather ? <>
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Điều kiện</p><p className="mt-1 text-2xl font-semibold">{isRaining === true ? "Có mưa" : isRaining === false ? "Không ghi nhận mưa" : "Chưa xác định"}</p></div>{typeof temperature === "number" && Number.isFinite(temperature) && <p className="text-3xl font-semibold tabular-nums">{temperature.toFixed(1)} °C</p>}</div>
          <div className="mt-4 grid gap-3 border-y border-border py-3 sm:grid-cols-5"><WeatherValue label="Nhiệt độ · 2 m" value={typeof temperature === "number" && Number.isFinite(temperature) ? `${temperature.toFixed(1)} °C` : "Thiếu từ API"} /><WeatherValue label="Mưa" value={rainRate === null ? "—" : `${rainRate.toFixed(2)} mm/giờ`} /><WeatherValue label={rainInterval === 900 ? "Lượng mưa / 15 phút" : "Lượng mưa theo kỳ"} value={rainAmount === null ? "—" : `${rainAmount.toFixed(2)} mm${rainInterval === null ? "" : ` / ${rainInterval}s`}`} /><WeatherValue label="Độ ẩm · 2 m" value={typeof humidity === "number" && Number.isFinite(humidity) ? `${humidity.toFixed(0)}%` : "Thiếu từ API"} /><WeatherValue label="Nguồn" value={String(edgeWeather.source || "Không rõ")} /></div>
          <p className="mt-3 text-xs text-muted-foreground">Bản tin API lúc {edgeWeather.source_time ? new Date(String(edgeWeather.source_time)).toLocaleString("vi-VN") : "không rõ thời điểm"}. Nếu API thiếu trường nhiệt độ hoặc độ ẩm, giao diện để trống thay vì tự ước lượng.</p>
          <p className="mt-3 text-xs text-muted-foreground">Nếu API không có dữ liệu mưa, hệ thống để trống đặc trưng thời tiết thay vì tự tạo giá trị.</p>
        </> : <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Thời tiết hiện không khả dụng; dự báo không được điền giả dữ liệu mưa.</div>}
      </SectionCard>
    </div>

    <SectionCard title="Nhận dạng từ camera" subtitle={`${cameras.length} nguồn camera có bản tin trong payload gần nhất`} icon={Camera}>
      {cameras.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cameras.map(([id, value]: [string, any]) => {
          const camera = selectedCameraView(id, null, edgeAI, now * 1000);
          const stability = value?.classification_stability;
          const labelText = camera.text;
          const cameraFresh = camera.fresh;
          return <article key={id} className="rounded-lg border border-border/80 bg-background/35 p-4">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{CAMERAS.find((item) => item.id === id)?.name || id.replace("_", " ")}</h3><p className="text-xs text-muted-foreground">{CAMERAS.find((item) => item.id === id)?.label || ""}</p></div><StatusBadge color={cameraFresh ? "green" : "amber"}>{cameraFresh ? "Ảnh mới" : "Đang chờ"}</StatusBadge></div>
            <div className="mt-4 flex items-end justify-between border-t border-border/70 pt-3"><div><p className="text-xs text-muted-foreground">Tình trạng{camera.stabilizationMode === "display" ? " ổn định" : " nhận diện"}</p><p className="mt-1 text-lg font-semibold">{labelText}</p></div><p className="text-right text-sm tabular-nums">{camera.count ?? "—"}<span className="ml-1 text-xs text-muted-foreground">xe trong ảnh</span></p></div>
            <p className="mt-2 text-xs text-muted-foreground">YOLO: {EDGE_TRAFFIC_LABELS[value.label]?.text || "Chưa phân loại"} · tin cậy {Number.isFinite(value.classification_confidence) && value.classification_confidence >= 0 && value.classification_confidence <= 1 ? `${(value.classification_confidence * 100).toFixed(0)}%` : "—"} · ảnh {Number.isFinite(value.image_age_seconds) ? `${Number(value.image_age_seconds).toFixed(0)} giây trước` : "chưa rõ thời điểm"}</p>
            {stability && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer">Chi tiết trạng thái theo thời gian</summary><p className="mt-1">Chế độ: {stability.mode || "legacy"} · dữ liệu: {stability.data_status || "UNKNOWN"}</p><p>YOLO hiện tại: {EDGE_TRAFFIC_LABELS[stability.raw_state]?.text || EDGE_TRAFFIC_LABELS[value.label]?.text || "Chưa phân loại"} · {Number.isFinite(stability.raw_confidence) ? `${(Number(stability.raw_confidence) * 100).toFixed(0)}%` : "—"}</p><p>Ổn định: {stability.data_status === "VALID" ? EDGE_TRAFFIC_LABELS[stability.stable_state]?.text || "—" : "Chưa hợp lệ"} · {Number.isFinite(stability.stable_confidence) ? `${(Number(stability.stable_confidence) * 100).toFixed(0)}%` : "—"}</p><p>Ảnh hợp lệ gần nhất: {Number.isFinite(stability.last_valid_timestamp) ? new Date(Number(stability.last_valid_timestamp) * 1000).toLocaleString("vi-VN") : "—"}</p>{stability.pending_transition && <p>Đang xác nhận: {EDGE_TRAFFIC_LABELS[stability.pending_transition.state]?.text || stability.pending_transition.state} ({stability.pending_transition.count}/{stability.pending_transition.required} ảnh)</p>}</details>}
            {value.label_source && <p className="mt-1 text-[11px] text-muted-foreground">Nhãn tự động từ YOLO</p>}
          </article>;
        })}
      </div> : <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Chưa nhận được kết quả nhận dạng mới.</p>}
    </SectionCard>

    <SectionCard title="Dự báo ùn tắc" subtitle="Dự báo 5, 15 và 30 phút; kết quả vẫn được gắn trạng thái kiểm định" icon={Brain}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Lịch sử 120 phút · cập nhật mỗi 10 giây</p><div className="flex flex-wrap items-center gap-2"><StatusBadge color={forecastReady ? "green" : recovery.state === "RESTORING" ? "amber" : "cyan"}>{recovery.label}</StatusBadge>{forecastReady && <StatusBadge color="amber">Thử nghiệm · chưa kiểm định thực địa</StatusBadge>}</div></div>
      <div className="mb-4 rounded-lg border border-border/80 bg-background/35 p-4">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>Lịch sử hợp lệ{!edgeLive ? " ở bản tin cuối" : ""}</span><span className="tabular-nums">{progress.required > 0 ? `${progress.steps}/${progress.required} bước · ${progress.percent}%` : "Chưa nhận được tiến độ"}</span></div>
        {progress.required > 0 && <div role="progressbar" aria-label="Lịch sử TCN hợp lệ" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={Math.min(progress.steps, progress.required)} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.percent}%` }} /></div>}
        <p className="mt-2 text-xs text-muted-foreground">{recovery.reason}</p>
      </div>
      {forecastReady ? <div className="grid gap-3 md:grid-cols-3">
        {([5, 15, 30] as const).map((horizon) => <article key={horizon} className="rounded-lg border border-border/80 bg-background/35 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Sau {horizon} phút</p><div className="mt-3 space-y-3">{forecasts[horizon].length ? forecasts[horizon].map((row) => <div key={`${row.camera_id}-${horizon}`} className="flex items-center justify-between gap-2 border-b border-border/70 pb-2 last:border-0 last:pb-0"><div><p className="text-sm font-medium">{CAMERAS.find((camera) => camera.id === row.camera_id)?.name || row.camera_id}</p><p className="text-xs text-muted-foreground">{EDGE_TRAFFIC_LABELS[row.predicted_class]?.text || "Chưa rõ"}</p></div><span className="text-xs tabular-nums text-muted-foreground">{(row.confidence * 100).toFixed(0)}%</span></div>) : <p className="text-sm text-muted-foreground">Chưa có kết quả hợp lệ ở mốc này.</p>}</div></article>)}
      </div> : <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Dự báo 5, 15 và 30 phút sẽ hiển thị khi có đủ đầu vào hợp lệ.</div>}
      <p className="mt-4 text-xs text-muted-foreground">Phần trăm là độ tin cậy của đầu ra, không phải độ chính xác đã đo. Dự báo không tự điều khiển đèn.</p>
    </SectionCard>

    <details className="rounded-xl border border-border bg-card/70 p-4 text-sm"><summary className="cursor-pointer font-medium"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />Thông tin kỹ thuật</summary><div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p>Kiểm định TCN: {String(edgeStatus.validation_status || "chưa có")}</p><p>Trạng thái thời tiết: {String(edgeStatus.weather_status || "chưa có")}</p><p>Trạng thái dự báo: {String(edgeStatus.forecast_status || "chưa có")}</p><p>Thời tiết code: {edgeWeather?.weather_code ?? "—"}</p><p>Khôi phục TCN: {String(edgeStatus.tcn_state || "chưa có")}</p><p>Lý do: {String(edgeStatus.history_reason || "chưa có")}</p><p>Bước lịch sử cuối: {String(edgeStatus.history_last_timestamp || "chưa có")}</p></div></details>
  </div>;
}

function WeatherValue({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium tabular-nums">{value}</p></div>; }
