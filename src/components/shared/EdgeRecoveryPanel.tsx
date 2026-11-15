"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CAMERAS } from "@/lib/constants";
import { edgeHistoryProgress } from "@/lib/edge-forecast";
import { edgeHistoryQuality, edgeSystemHealth, MINUTE_CAMERA_IDS, readEdgeCurrentCount, readEdgeForecastComparison, readEdgeMinuteForecast, type EdgeMinuteHistoryPoint } from "@/lib/edge-quality";
import { VEHICLE_COUNT_LEVELS, vehicleCountLevel } from "@/lib/traffic-status";
import { SectionCard } from "./ui";

const COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc", "#f472b6"];
const COMPARISON_HORIZONS = [1, 5, 15, 30] as const;
const OBSERVED_COLOR = "#34d399";
const PREDICTED_COLOR = "#60a5fa";
const IMPUTED_COLOR = "#fbbf24";
const CURRENT_COLOR = "#f472b6";

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

function ForecastComparison({ data, history, edgeAI, forecast, nowMs }: {
  data: any;
  history: EdgeMinuteHistoryPoint[];
  edgeAI: any;
  forecast: ReturnType<typeof readEdgeMinuteForecast>;
  nowMs: number;
}) {
  const [horizon, setHorizon] = useState<number>(1);
  const comparisons = MINUTE_CAMERA_IDS.map((camera, index) => ({
    camera,
    name: CAMERAS.find(item => item.id === camera)?.name || `Camera ${index + 1}`,
    color: COLORS[index],
    result: readEdgeForecastComparison(data, camera, horizon),
    current: readEdgeCurrentCount(edgeAI, camera, nowMs),
  }));
  const selectClass = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
  return <div className="mt-6 border-t border-border/70 pt-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold">Lịch sử, hiện tại và dự báo theo camera</h3>
        <p className="mt-1 text-xs text-muted-foreground">Mỗi biểu đồ ghép đến 120 phút lịch sử, số đếm ảnh mới nhất và dự báo TCN 30 phút.</p></div>
      <label className="grid gap-1 text-xs text-muted-foreground">Khoảng đánh giá dự báo lịch sử
        <select aria-label="Khoảng dự báo so sánh" className={selectClass} value={horizon} onChange={event => setHorizon(Number(event.target.value))}>
          {COMPARISON_HORIZONS.map(value => <option key={value} value={value}>{value} phút</option>)}
        </select>
      </label>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-4">
      {comparisons.map(({ camera, name, color, result, current }) => {
        type TimelinePoint = { timestamp: number; observed?: number; imputed?: number; current?: number; future?: number };
        const rows = new Map<number, TimelinePoint>();
        const at = (timestamp: number): TimelinePoint => {
          const existing = rows.get(timestamp);
          if (existing) return existing;
          const row: TimelinePoint = { timestamp };
          rows.set(timestamp, row);
          return row;
        };
        for (const point of history) {
          const value = point.counts[camera];
          if (value?.count === null || !value) continue;
          if (value.source === "observed") at(point.timestamp).observed = value.count;
          else if (value.source === "imputed") at(point.timestamp).imputed = value.count;
        }
        if (current) at(current.timestamp).current = current.count;
        if (forecast.ready) for (const point of forecast.points) at(point.timestamp).future = point[camera];
        const chartData = [...rows.values()].sort((a, b) => a.timestamp - b.timestamp);
        const hasTimeline = chartData.length > 0;
        const domain: [number, number] = hasTimeline
          ? [chartData[0].timestamp - 60, chartData[chartData.length - 1].timestamp + 60]
          : [0, 60];
        return <article key={camera} className="min-w-0 rounded-xl border border-border/80 bg-background/25 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold" style={{ color }}>{name}</h4>
            <span className="text-sm font-medium tabular-nums" style={{ color: CURRENT_COLOR }}>Hiện tại: {current ? `${current.count} xe` : "chờ ảnh mới"}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">Mốc so sánh +{horizon}p</p><p className="mt-1 text-sm font-semibold tabular-nums">{result.samples}</p></div>
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">MAE lịch sử</p><p className="mt-1 text-sm font-semibold tabular-nums">{result.mae === null ? "—" : `${result.mae.toFixed(2)} xe`}</p></div>
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">RMSE lịch sử</p><p className="mt-1 text-sm font-semibold tabular-nums">{result.rmse === null ? "—" : `${result.rmse.toFixed(2)} xe`}</p></div>
          </div>
          {hasTimeline ? <div role="img" aria-label={`Lịch sử số xe, số xe hiện tại và dự báo 30 phút của ${name}`} className="mt-3 h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="timestamp" type="number" domain={domain} minTickGap={32} tickFormatter={value => new Date(Number(value) * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} width={34} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={value => value ? new Date(Number(value) * 1000).toLocaleString("vi-VN") : ""}
                formatter={(value, seriesName) => [`${value} xe`, seriesName]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              {current && <ReferenceLine x={current.timestamp} stroke={CURRENT_COLOR} strokeDasharray="3 4" label={{ value: "Hiện tại", fill: CURRENT_COLOR, position: "insideTopRight", fontSize: 11 }} />}
              <Line type="monotone" dataKey="observed" name="Lịch sử · YOLO quan sát (trung bình phút)" stroke={OBSERVED_COLOR} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="imputed" name="Lịch sử · dữ liệu ước lượng bù" stroke={IMPUTED_COLOR} strokeWidth={2} strokeDasharray="3 4" dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="current" name="Hiện tại · số xe trong ảnh mới" stroke={CURRENT_COLOR} strokeWidth={0} dot={{ r: 6, fill: CURRENT_COLOR, stroke: "var(--card)", strokeWidth: 2 }} activeDot={{ r: 8 }} connectNulls={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="future" name="Tương lai · TCN dự báo (trung bình phút)" stroke={PREDICTED_COLOR} strokeWidth={2.5} strokeDasharray="7 5" dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            </LineChart></ResponsiveContainer>
          </div> : <p className="mt-3 flex h-[320px] items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-xs text-muted-foreground" aria-live="polite">Đang chờ lịch sử camera, ảnh mới hoặc dự báo đủ điều kiện.</p>}
        </article>;
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2" style={{ borderColor: OBSERVED_COLOR }} />Lịch sử quan sát · trung bình phút</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: IMPUTED_COLOR }} />Lịch sử ước lượng bù</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CURRENT_COLOR }} />Hiện tại · ảnh mới</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: PREDICTED_COLOR }} />Dự báo TCN · 30 phút</span>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Điểm hiện tại là số xe trong ảnh YOLO mới nhất; lịch sử và TCN là số xe trung bình theo phút. MAE/RMSE chỉ tính số đếm YOLO đã quan sát, không tính dữ liệu bù; đây là proxy số xe nhìn thấy trong ảnh, chưa phải kiểm định lưu lượng ngoài đường.</p>
  </div>;
}

export function EdgeMinuteForecastPanel({ data, history, nowMs }: { data: any; history: EdgeMinuteHistoryPoint[]; nowMs: number }) {
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
    <ForecastComparison data={data?.forecast_evaluation} history={history} edgeAI={data} forecast={forecast} nowMs={nowMs} />
  </SectionCard>;
}
