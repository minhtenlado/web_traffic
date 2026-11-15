"use client";

import { Brain, CalendarClock } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CAMERAS } from "@/lib/constants";
import { edgeHistoryProgress } from "@/lib/edge-forecast";
import { edgeHistoryQuality, edgeMinuteView, edgeSystemHealth, MINUTE_CAMERA_IDS, readEdgeMinuteForecast } from "@/lib/edge-quality";
import { VEHICLE_COUNT_LEVELS, vehicleCountLevel } from "@/lib/traffic-status";
import { SectionCard, StatusBadge } from "./ui";

const COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc", "#f472b6"];

export function EdgeRecoverySummary({ data, nowMs }: { data: any; nowMs: number }) {
  const health = edgeSystemHealth(data, nowMs);
  const quality = edgeHistoryQuality(data?.status);
  const progress = edgeHistoryProgress(data?.status);
  const generatedAt = data?.generated_at;
  return <div className="rounded-lg border border-border/80 bg-background/35 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm font-medium">Lịch sử đầu vào TCN</span><StatusBadge color={health.color}>{health.label}</StatusBadge></div>
    <p className="mt-2 text-sm tabular-nums">{progress.required ? `${progress.steps}/${progress.required} bước liên tục · ${progress.percent}%` : "Chưa nhận tiến độ"}{quality.interval ? ` · mỗi bước ${quality.interval} giây` : ""}{!health.fresh ? " · bản tin cuối" : ""}</p>
    {progress.required > 0 && <div role="progressbar" aria-label="Tiến độ lịch sử TCN" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={Math.min(progress.steps, progress.required)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} /></div>}
    <p className="mt-2 text-xs text-muted-foreground">Cập nhật: {typeof generatedAt === "number" && Number.isFinite(generatedAt) && generatedAt > 0 ? new Date(generatedAt * 1000).toLocaleString("vi-VN") : "chưa có heartbeat hợp lệ"}{health.ageSeconds !== null ? ` · ${Math.floor(health.ageSeconds)} giây trước` : ""}</p>
    {data?.status?.history_reason && <p className="mt-1 text-xs text-muted-foreground">Trạng thái khôi phục: {String(data.status.history_reason)}</p>}
  </div>;
}

export function EdgeMinutePanel({ data, nowMs }: { data: any; nowMs: number }) {
  const health = edgeSystemHealth(data, nowMs);
  return <SectionCard title="Số xe theo phút" icon={CalendarClock}>
    <p className="mb-3 text-sm text-muted-foreground">Trung bình số xe trong các ảnh mới của phút đã hoàn tất; không phải lưu lượng qua vạch.</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{MINUTE_CAMERA_IDS.map(id => {
      const minute = edgeMinuteView(data?.minute_counts?.[id], nowMs);
      const stale = !health.fresh || minute.ageSeconds === null || minute.ageSeconds > 120;
      return <article key={id} className="rounded-lg border border-border/80 p-3">
        <h3 className="text-sm font-medium">{CAMERAS.find(camera => camera.id === id)?.name || id}</h3>
        <p className="my-2 text-2xl font-semibold tabular-nums">{minute.count ?? "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">xe</span></p>
        <StatusBadge color={minute.source === "observed" && !stale ? "green" : "amber"}>{minute.label}</StatusBadge>
        <p className="mt-2 text-xs text-muted-foreground">{minute.timestamp ? new Date(minute.timestamp * 1000).toLocaleString("vi-VN") : "Chưa có phút hợp lệ"}</p>
        {stale && <p className="mt-1 text-xs text-amber-600">Bản ghi lịch sử · chưa có phút mới</p>}
        {minute.source === "imputed" && <p className="mt-1 text-xs text-muted-foreground">{minute.method || "Chưa có phương pháp"} · tin cậy {minute.confidence === null ? "chưa rõ" : `${(minute.confidence * 100).toFixed(0)}%`}</p>}
      </article>;
    })}</div>
  </SectionCard>;
}

export function EdgeMinuteForecastPanel({ data, nowMs }: { data: any; nowMs: number }) {
  const forecast = readEdgeMinuteForecast(data, nowMs);
  const convertedPoints = forecast.points.map(point => ({
    horizon: point.horizon,
    ...Object.fromEntries(MINUTE_CAMERA_IDS.map(id => [id, vehicleCountLevel(point[id])?.id ?? null])),
  }));
  return <SectionCard title="Dự báo số xe theo phút" icon={Brain}>
    <EdgeRecoverySummary data={data} nowMs={nowMs} />
    <p className="mt-3 text-sm text-muted-foreground">30 phút tiếp theo · 5 camera · số xe nhìn thấy trong ảnh · kết quả thử nghiệm.</p>
    {forecast.ready ? <>
      <p className="my-3 text-xs text-muted-foreground">Phát hành lúc {new Date(forecast.issuedAt! * 1000).toLocaleString("vi-VN")}. Số xe đếm được trong ảnh, không phải lưu lượng qua vạch; chưa được kiểm định thực địa.</p>
      <div role="img" aria-label="Dự báo số xe 30 phút cho 5 camera" className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={forecast.points}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="horizon" type="number" domain={[1, 30]} ticks={[1, 5, 15, 30]} tickFormatter={value => `+${value} phút`} /><YAxis allowDecimals={false} label={{ value: "Số xe dự báo", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Tooltip labelFormatter={value => `Sau ${value} phút`} formatter={value => [`${value} xe`, "Số xe dự báo"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        {MINUTE_CAMERA_IDS.map((id, i) => <Line key={id} dataKey={id} name={CAMERAS.find(camera => camera.id === id)?.name || id} stroke={COLORS[i]} dot={false} connectNulls={false} isAnimationActive={false} />)}
      </LineChart></ResponsiveContainer></div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">{MINUTE_CAMERA_IDS.map((id, i) => <span key={id}><span style={{ color: COLORS[i] }}>● </span>{CAMERAS.find(camera => camera.id === id)?.name || id}</span>)}</div>
      <div className="mt-6 border-t border-border/70 pt-5">
        <h3 className="font-semibold">Mức ùn tắc quy đổi từ số xe dự báo</h3>
        <p className="mt-1 text-sm text-muted-foreground">Quy đổi theo ngưỡng hiển thị đã thống nhất; đây là mức suy ra từ số xe, không phải nhãn do mô hình phân loại.</p>
        <div role="img" aria-label="Mức ùn tắc quy đổi từ số xe dự báo 30 phút cho 5 camera" className="mt-3 h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={convertedPoints}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="horizon" type="number" domain={[1, 30]} ticks={[1, 5, 15, 30]} tickFormatter={value => `+${value} phút`} /><YAxis type="number" domain={[0, 3]} ticks={VEHICLE_COUNT_LEVELS.map(level => level.id)} allowDecimals={false} width={108} tickFormatter={value => VEHICLE_COUNT_LEVELS.find(level => level.id === Number(value))?.label || ""} />
          <Tooltip labelFormatter={value => `Sau ${value} phút`} formatter={value => {
            const level = VEHICLE_COUNT_LEVELS.find(item => item.id === Number(value));
            return [level ? `ID ${level.id} · ${level.label}` : "Chưa xác định", "Mức quy đổi"];
          }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
          {MINUTE_CAMERA_IDS.map((id, i) => <Line key={id} type="stepAfter" dataKey={id} name={CAMERAS.find(camera => camera.id === id)?.name || id} stroke={COLORS[i]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />)}
        </LineChart></ResponsiveContainer></div>
      </div>
    </> : <p className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground" aria-live="polite">Chưa có dự báo mới đáp ứng đủ 120 bước, chất lượng đầu vào, đồng hồ và thời hạn bản tin. {data?.forecast?.reason ? `Lý do: ${String(data.forecast.reason)}` : ""}</p>}
  </SectionCard>;
}
