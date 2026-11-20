"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { buildTCNForecastComparison, TCN_OUTPUT_CAMERAS } from "@/lib/tcn-forecast";

const ACTUAL_COLOR = "#10b981";
const FORECAST_COLOR = "#3b82f6";
const CAMERA_COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc"];
const HORIZONS = [5, 15, 30] as const;
type Horizon = typeof HORIZONS[number];
type CameraId = typeof TCN_OUTPUT_CAMERAS[number];
type ChartPoint = { timestamp: number; actual?: number | null; predicted?: number | null };

function formatTime(stamp: number) {
  return new Date(stamp * 1000).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit",
  });
}

function ChartPanel({ title, data, lineKey, color, dashed = false, combined = false, currentTimestamp, futureEnd }: {
  title: string; data: ChartPoint[]; lineKey: "actual" | "predicted"; color: string;
  dashed?: boolean; combined?: boolean; currentTimestamp?: number; futureEnd?: number;
}) {
  return <section className="rounded-xl border border-border/80 bg-muted/15 p-3 sm:p-4">
    <h4 className="mb-2 text-sm font-semibold">{title}</h4>
    {data.length ? <div role="img" aria-label={title} className="h-[220px] w-full sm:h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 14, bottom: 4, left: 2 }}>
          <CartesianGrid strokeDasharray="3 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime} tick={{ fontSize: 11 }} minTickGap={38} />
          <YAxis domain={[0, "auto"]} width={40} tick={{ fontSize: 11 }} />
          <Tooltip labelFormatter={value => formatTime(Number(value))}
            formatter={(value, name) => [typeof value === "number" ? `${value.toFixed(1)} xe` : "—", String(name)]}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
          {currentTimestamp !== undefined && futureEnd !== undefined && <ReferenceArea
            x1={currentTimestamp} x2={futureEnd} fill="#fb923c" fillOpacity={0.06} strokeOpacity={0} />}
          {currentTimestamp !== undefined && <ReferenceLine x={currentTimestamp} stroke="var(--foreground)"
            strokeDasharray="4 4" label={{ value: "Hiện tại (t0)", position: "insideTopRight", fontSize: 11 }} />}
          {combined ? <>
            <Line type="linear" dataKey="actual" name="Số xe quan sát" stroke={ACTUAL_COLOR} strokeWidth={2.5}
              dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
            <Line type="linear" dataKey="predicted" name="Dự báo TCN" stroke={FORECAST_COLOR} strokeWidth={2.5}
              strokeDasharray="7 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />
          </> : <Line type="linear" dataKey={lineKey} name={dashed ? "Dự báo TCN" : "Số xe quan sát"}
            stroke={color} strokeWidth={2.5} strokeDasharray={dashed ? "7 5" : undefined}
            dot={false} activeDot={{ r: 4 }} isAnimationActive={false} connectNulls={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div> : <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border px-5 text-center text-sm text-muted-foreground sm:h-[250px]">
      Chưa có đủ dữ liệu để vẽ chuỗi này.
    </div>}
  </section>;
}

function Metric({ label, value, suffix = "" }: { label: string; value: string | number; suffix?: string }) {
  return <div className="rounded-xl bg-muted/35 px-4 py-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 text-lg font-semibold tabular-nums">{value}{suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}</p>
  </div>;
}

export function AICameraCharts() {
  const forecast = useTrafficStore(s => s.aiForecast);
  const history = forecast.rawHistory || [];
  const predictions = forecast.rawPredictions || [];
  const predictionRuns = forecast.predictionRuns || [];
  const [horizon, setHorizon] = useState<Horizon>(30);
  const [selectedCamera, setSelectedCamera] = useState<CameraId>(TCN_OUTPUT_CAMERAS[0]);
  const cameraCharts = useMemo(() => Object.fromEntries(TCN_OUTPUT_CAMERAS.map(camera => [camera,
    buildTCNForecastComparison(history, predictionRuns, camera, horizon),
  ])), [history, predictionRuns, horizon]);
  if (!history.length || predictions.length !== 30 || forecast.status !== "EXPERIMENTAL") return (
    <p className="mt-4 rounded-lg border border-border p-4 text-sm text-muted-foreground" aria-live="polite">
      {forecast.status === "NOT_READY" ? "Mô hình đang chờ đủ lịch sử camera mới." : "Chưa có dự báo còn hiệu lực để hiển thị."}
    </p>
  );

  return <div className="mt-5 space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">Số xe nhận dạng trong ảnh; các dự báo lịch sử được ghép đúng mốc thời gian đích.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          Chọn camera
          <select aria-label="Chọn camera" value={selectedCamera}
            onChange={event => setSelectedCamera(event.target.value as CameraId)}
            className="w-60 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary">
            {TCN_OUTPUT_CAMERAS.map(camera => <option key={camera} value={camera}>
              {CAMERAS.find(item => item.id === camera)?.name || camera}
            </option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted-foreground">
          Khoảng đối chiếu
          <select aria-label="Khoảng đối chiếu" value={horizon}
            onChange={event => setHorizon(Number(event.target.value) as Horizon)}
            className="w-60 rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary">
            {HORIZONS.map(minutes => <option key={minutes} value={minutes}>{minutes} phút</option>)}
          </select>
        </label>
      </div>
    </header>

    <div className="space-y-5">
      {TCN_OUTPUT_CAMERAS.filter(camera => camera === selectedCamera).map(camera => {
        const index = TCN_OUTPUT_CAMERAS.indexOf(camera);
        const cameraName = CAMERAS.find(item => item.id === camera)?.name || camera;
        const chart = cameraCharts[camera];
        const combined: ChartPoint[] = [
          ...chart.combined,
          ...predictions.slice(0, horizon).map(point => ({ timestamp: point.timestamp,
            actual: null, predicted: typeof point[camera] === "number" ? Number(point[camera]) : null })),
        ];
        const futureEnd = predictions[horizon - 1]?.timestamp;
        const mae = chart.mae === null ? "—" : chart.mae.toFixed(2);
        const rmse = chart.rmse === null ? "—" : chart.rmse.toFixed(2);
        return <article key={camera} className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold" style={{ color: CAMERA_COLORS[index] }}>{cameraName}</h3>
            <span className="text-xs text-muted-foreground">So sánh dự báo trước {horizon} phút</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Số mốc đã đối chiếu" value={chart.matchCount} />
            <Metric label={`MAE lịch sử · ${chart.matchCount} mẫu`} value={mae} suffix={chart.mae === null ? "" : "xe"} />
            <Metric label={`RMSE lịch sử · ${chart.matchCount} mẫu`} value={rmse} suffix={chart.rmse === null ? "" : "xe"} />
          </div>
          <ChartPanel title="1. Lịch sử thực tế" data={history.map(point => ({
            timestamp: point.timestamp,
            actual: typeof point[camera] === "number" ? Number(point[camera]) : null,
          }))} lineKey="actual" color={ACTUAL_COLOR} />
          <ChartPanel title={`2. Lịch sử dự báo TCN · mốc +${horizon} phút`}
            data={chart.historicalPredictions} lineKey="predicted" color={FORECAST_COLOR} dashed />
          <ChartPanel title="3. Hiện tại + dự báo TCN" data={combined} lineKey="actual" color={ACTUAL_COLOR}
            combined currentTimestamp={chart.currentTimestamp} futureEnd={futureEnd} />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2"><i className="h-0.5 w-7 bg-emerald-500" />Số xe thực tế/quan sát</span>
            <span className="inline-flex items-center gap-2"><i className="h-0 w-7 border-t-2 border-dashed border-blue-500" />Dự báo TCN</span>
            <span className="inline-flex items-center gap-2"><i className="h-4 border-l-2 border-dashed border-foreground" />Hiện tại (t0)</span>
          </div>
        </article>;
      })}
    </div>
    <p className="text-xs text-muted-foreground">
      MAE/RMSE chỉ tính các dự báo đã phát hành có số đếm tại đúng thời điểm đích; số mẫu được ghi cạnh chỉ số. Dữ liệu là số xe trong ảnh, chưa phải kiểm định lưu lượng giao thông thực địa.
    </p>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Thông tin mô hình</summary>
      <p className="mt-2 break-all font-mono">Mã phiên bản: {forecast.modelVersion || "chưa có"}</p>
      <p className="mt-1">Lịch sử dự báo tích lũy từ các bản tin TCN nhận được trong phiên mở trang này; sau khi tải lại trang, cần tích lũy lại.</p>
    </details>
  </div>;
}
