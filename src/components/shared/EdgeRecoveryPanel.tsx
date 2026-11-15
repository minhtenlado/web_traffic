"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CAMERAS } from "@/lib/constants";
import { edgeHistoryProgress } from "@/lib/edge-forecast";
import { edgeHistoryQuality, edgeSystemHealth, MINUTE_CAMERA_IDS, readEdgeForecastComparison, readEdgeMinuteForecast } from "@/lib/edge-quality";
import { VEHICLE_COUNT_LEVELS, vehicleCountLevel } from "@/lib/traffic-status";
import { SectionCard } from "./ui";

const COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc", "#f472b6"];
const COMPARISON_HORIZONS = [1, 5, 15, 30] as const;
const OBSERVED_COLOR = "#34d399";
const PREDICTED_COLOR = "#60a5fa";

export function EdgeRecoverySummary({ data, nowMs }: { data: any; nowMs: number }) {
  const health = edgeSystemHealth(data, nowMs);
  const quality = edgeHistoryQuality(data?.status);
  const progress = edgeHistoryProgress(data?.status);
  const generatedAt = data?.generated_at;
  return <div className="rounded-lg border border-border/80 bg-background/35 p-4">
    <div className="text-sm font-medium">Lịch sử đầu vào TCN</div>
    <p className="mt-2 text-sm tabular-nums">{progress.required ? `${progress.steps}/${progress.required} bước liên tục · ${progress.percent}%` : "Chưa nhận tiến độ"}{quality.interval ? ` · mỗi bước ${quality.interval} giây` : ""}{!health.fresh ? " · bản tin cuối" : ""}</p>
    {progress.required > 0 && <div role="progressbar" aria-label="Tiến độ lịch sử TCN" aria-valuemin={0} aria-valuemax={progress.required} aria-valuenow={Math.min(progress.steps, progress.required)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} /></div>}
    <p className="mt-2 text-xs text-muted-foreground">Cập nhật: {typeof generatedAt === "number" && Number.isFinite(generatedAt) && generatedAt > 0 ? new Date(generatedAt * 1000).toLocaleString("vi-VN") : "chưa có heartbeat hợp lệ"}{health.ageSeconds !== null ? ` · ${Math.floor(health.ageSeconds)} giây trước` : ""}</p>
  </div>;
}

function ForecastComparison({ data }: { data: any }) {
  const [horizon, setHorizon] = useState<number>(1);
  const comparisons = MINUTE_CAMERA_IDS.map((camera, index) => ({
    camera,
    name: CAMERAS.find(item => item.id === camera)?.name || `Camera ${index + 1}`,
    color: COLORS[index],
    result: readEdgeForecastComparison(data, camera, horizon),
  }));
  const selectClass = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
  return <div className="mt-6 border-t border-border/70 pt-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold">Đối chiếu dự báo với số xe quan sát</h3>
        <p className="mt-1 text-xs text-muted-foreground">Cả 5 camera · so sánh dự báo và số xe quan sát tại cùng mốc thời gian</p></div>
      <label className="grid gap-1 text-xs text-muted-foreground">Dự báo trước
        <select aria-label="Khoảng dự báo so sánh" className={selectClass} value={horizon} onChange={event => setHorizon(Number(event.target.value))}>
          {COMPARISON_HORIZONS.map(value => <option key={value} value={value}>{value} phút</option>)}
        </select>
      </label>
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {comparisons.map(({ camera, name, color, result }) => {
        const chartData = result.points.map(point => ({
          time: new Date(point.timestamp * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
          timestamp: point.timestamp,
          actual: point.actual,
          forecast: point.forecast,
        }));
        return <article key={camera} className="min-w-0 rounded-xl border border-border/80 bg-background/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold" style={{ color }}>{name}</h4>
            <span className="text-xs tabular-nums text-muted-foreground">{result.samples} mốc</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">MAE</p><p className="mt-1 text-sm font-semibold tabular-nums">{result.mae === null ? "—" : `${result.mae.toFixed(2)} xe`}</p></div>
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">RMSE</p><p className="mt-1 text-sm font-semibold tabular-nums">{result.rmse === null ? "—" : `${result.rmse.toFixed(2)} xe`}</p></div>
          </div>
          {result.samples > 0 ? <div role="img" aria-label={`Đối chiếu số xe dự báo và quan sát của ${name}, trước ${horizon} phút`} className="mt-3 h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="time" minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} width={34} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(_, items) => items?.[0]?.payload?.timestamp ? new Date(items[0].payload.timestamp * 1000).toLocaleString("vi-VN") : ""}
                formatter={(value, seriesName) => [`${value} xe`, seriesName]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="actual" name="Số xe quan sát" stroke={OBSERVED_COLOR} strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="forecast" name={`TCN dự báo · ${horizon} phút`} stroke={PREDICTED_COLOR} strokeWidth={2.5} strokeDasharray="7 5" dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            </LineChart></ResponsiveContainer>
          </div> : <p className="mt-3 flex h-[230px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-xs text-muted-foreground" aria-live="polite">Chưa có mốc đối chiếu {horizon} phút cho camera này.</p>}
        </article>;
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2" style={{ borderColor: OBSERVED_COLOR }} />Quan sát YOLO</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: PREDICTED_COLOR }} />Dự báo TCN</span>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">MAE/RMSE chỉ tính các mốc có quan sát YOLO thật; phút dữ liệu bù không được tính là thực tế. Đây là so sánh số xe nhìn thấy trong ảnh, chưa phải kiểm định lưu lượng ngoài đường.</p>
  </div>;
}

export function EdgeMinuteForecastPanel({ data, nowMs }: { data: any; nowMs: number }) {
  const forecast = readEdgeMinuteForecast(data, nowMs);
  const convertedPoints = forecast.points.map(point => ({
    horizon: point.horizon,
    ...Object.fromEntries(MINUTE_CAMERA_IDS.map(id => [id, vehicleCountLevel(point[id])?.id ?? null])),
  }));
  return <SectionCard title="Dự báo số xe theo phút" icon={Brain}>
    <EdgeRecoverySummary data={data} nowMs={nowMs} />
    {forecast.ready ? <>
      <p className="my-3 text-xs text-muted-foreground">Đường nét đứt là dự báo 1–30 phút tới. Phần đối chiếu bên dưới ghép dự báo đã phát hành với số xe quan sát tại đúng mốc thời gian.</p>
      <div role="img" aria-label="Dự báo số xe 30 phút cho 5 camera" className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={forecast.points}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="horizon" type="number" domain={[1, 30]} ticks={[1, 5, 15, 30]} tickFormatter={value => `+${value} phút`} /><YAxis allowDecimals={false} label={{ value: "Số xe dự báo", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Tooltip labelFormatter={value => `Sau ${value} phút`} formatter={value => [`${value} xe`, "Số xe dự báo"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        {MINUTE_CAMERA_IDS.map((id, i) => <Line key={id} dataKey={id} name={CAMERAS.find(camera => camera.id === id)?.name || id} stroke={COLORS[i]} strokeWidth={2} strokeDasharray="7 5" dot={false} connectNulls={false} isAnimationActive={false} />)}
      </LineChart></ResponsiveContainer></div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">{MINUTE_CAMERA_IDS.map((id, i) => <span key={id} className="inline-flex items-center gap-2"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: COLORS[i] }} />{CAMERAS.find(camera => camera.id === id)?.name || id}</span>)}</div>
      <div className="mt-6 border-t border-border/70 pt-5">
        <h3 className="font-semibold">Mức ùn tắc quy đổi từ số xe dự báo</h3>
        <div role="img" aria-label="Mức ùn tắc quy đổi từ số xe dự báo 30 phút cho 5 camera" className="mt-3 h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={convertedPoints}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="horizon" type="number" domain={[1, 30]} ticks={[1, 5, 15, 30]} tickFormatter={value => `+${value} phút`} /><YAxis type="number" domain={[0, 3]} ticks={VEHICLE_COUNT_LEVELS.map(level => level.id)} allowDecimals={false} width={108} tickFormatter={value => VEHICLE_COUNT_LEVELS.find(level => level.id === Number(value))?.label || ""} />
          <Tooltip labelFormatter={value => `Sau ${value} phút`} formatter={value => {
            const level = VEHICLE_COUNT_LEVELS.find(item => item.id === Number(value));
            return [level ? `ID ${level.id} · ${level.label}` : "Chưa xác định", "Mức quy đổi"];
          }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
          {MINUTE_CAMERA_IDS.map((id, i) => <Line key={id} type="stepAfter" dataKey={id} name={CAMERAS.find(camera => camera.id === id)?.name || id} stroke={COLORS[i]} strokeWidth={2} strokeDasharray="7 5" dot={false} connectNulls={false} isAnimationActive={false} />)}
        </LineChart></ResponsiveContainer></div>
      </div>
    </> : <p className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground" aria-live="polite">Đang tích lũy đủ dữ liệu liên tục để tạo dự báo.</p>}
    <ForecastComparison data={data?.forecast_evaluation} />
  </SectionCard>;
}
