"use client";

import { useEffect, useState } from "react";
import { Brain, Camera, ShieldCheck } from "lucide-react";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { CurrentWeatherCard } from "@/components/shared/CurrentWeatherCard";
import { edgeHistoryProgress, edgeTcnRecovery, groupEdgeForecasts } from "@/lib/edge-forecast";
import { selectedCameraView, EDGE_TRAFFIC_LABELS } from "@/lib/traffic-status";

export function ModelManagement() {
  const edgeAI = useTrafficStore((state) => state.edgeAI);
  const edgeStatus = edgeAI?.status || {};
  const edgeWeather = edgeAI?.weather;
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now() / 1000), 5000); return () => clearInterval(timer); }, []);
  const generatedAt = Number(edgeAI?.generated_at);
  const age = Number.isFinite(generatedAt) ? Math.max(0, now - generatedAt) : null;
  const edgeLive = edgeStatus.online === true && age !== null && age <= 30 && now >= generatedAt;
  const progress = edgeHistoryProgress(edgeStatus);
  const recovery = edgeTcnRecovery(edgeStatus, edgeLive);
  const forecasts = groupEdgeForecasts(edgeAI?.forecasts);
  const forecastReady = recovery.forecastReady;
  const cameras = Object.entries(edgeAI?.cameras || {}).sort(([a], [b]) => a.localeCompare(b));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Nhận dạng & dự báo</p><h2 className="mt-1 text-2xl font-semibold">AI tại Hàng Xanh</h2><p className="mt-1 text-sm text-muted-foreground">Kết quả mới nhất từ camera và mô hình trên Genio 350.</p></div>
      <StatusBadge color={edgeLive ? "green" : edgeAI ? "amber" : "cyan"}>{edgeLive ? "Genio có tín hiệu mới" : edgeAI ? "Đang chờ tín hiệu mới" : "Chưa nhận dữ liệu AI"}</StatusBadge>
    </div>

    <CurrentWeatherCard title="Thời tiết hiện tại" subtitle="Open-Meteo · ước tính cho khu vực Hàng Xanh, không phải trạm đo tại chỗ" />

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Cửa sổ TCN 120 phút · bước 10 giây</p><div className="flex flex-wrap items-center gap-2"><StatusBadge color={forecastReady ? "green" : recovery.state === "RESTORING" ? "amber" : "cyan"}>{recovery.label}</StatusBadge>{edgeStatus.history_reason === "estimated_gap_history" && <StatusBadge color="amber">Có mẫu bù ước tính</StatusBadge>}{forecastReady && <StatusBadge color="amber">Thử nghiệm · chưa kiểm định thực địa</StatusBadge>}</div></div>
      <div className="mb-4 rounded-lg border border-border/80 bg-background/35 p-4">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span>Mẫu đầu vào đã nạp{!edgeLive ? " ở bản tin cuối" : ""}</span><span className="tabular-nums">{progress.required > 0 ? `${progress.steps}/${progress.required} mẫu · ${progress.percent}%` : "Chưa nhận được tiến độ"}</span></div>
        {progress.required > 0 && <div role="progressbar" aria-label="Tiến độ mẫu đầu vào TCN" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={Math.min(progress.steps, progress.required)} className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.percent}%` }} /></div>}
      </div>
      {forecastReady ? <div className="grid gap-3 md:grid-cols-3">
        {([5, 15, 30] as const).map((horizon) => <article key={horizon} className="rounded-lg border border-border/80 bg-background/35 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">Sau {horizon} phút</p><div className="mt-3 space-y-3">{forecasts[horizon].length ? forecasts[horizon].map((row) => <div key={`${row.camera_id}-${horizon}`} className="flex items-center justify-between gap-2 border-b border-border/70 pb-2 last:border-0 last:pb-0"><div><p className="text-sm font-medium">{CAMERAS.find((camera) => camera.id === row.camera_id)?.name || row.camera_id}</p><p className="text-xs text-muted-foreground">{EDGE_TRAFFIC_LABELS[row.predicted_class]?.text || "Chưa rõ"}</p></div><span className="text-xs tabular-nums text-muted-foreground">{(row.confidence * 100).toFixed(0)}%</span></div>) : <p className="text-sm text-muted-foreground">Chưa có kết quả hợp lệ ở mốc này.</p>}</div></article>)}
      </div> : <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">Dự báo 5, 15 và 30 phút sẽ hiển thị khi cửa sổ có đủ 720 mẫu và nhận được ảnh camera mới.</div>}
      <p className="mt-4 text-xs text-muted-foreground">Phần trăm là độ tin cậy của đầu ra, không phải độ chính xác đã đo. Dự báo không tự điều khiển đèn.</p>
    </SectionCard>

    <details className="rounded-xl border border-border bg-card/70 p-4 text-sm"><summary className="cursor-pointer font-medium"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />Thông tin kỹ thuật</summary><div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><p>Kiểm định TCN: {String(edgeStatus.validation_status || "chưa có")}</p><p>Trạng thái thời tiết: {String(edgeStatus.weather_status || "chưa có")}</p><p>Trạng thái dự báo: {String(edgeStatus.forecast_status || "chưa có")}</p><p>Thời tiết code: {edgeWeather?.weather_code ?? "—"}</p><p>Khôi phục TCN: {String(edgeStatus.tcn_state || "chưa có")}</p><p>Lý do: {String(edgeStatus.history_reason || "chưa có")}</p><p>Bước lịch sử cuối: {String(edgeStatus.history_last_timestamp || "chưa có")}</p></div></details>
  </div>;
}
