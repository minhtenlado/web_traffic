"use client";

import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CAMERAS } from "@/lib/constants";
import { edgeHistoryProgress } from "@/lib/edge-forecast";
import { alignForecastComparisonToHistory, edgeHistoryQuality, edgeSystemHealth, MINUTE_CAMERA_IDS, readEdgeCurrentCount, readEdgeForecastComparison, readEdgeMinuteForecast, selectDisplayMinuteForecast, type EdgeMinuteHistoryPoint, type ReadyMinuteForecast } from "@/lib/edge-quality";
import { evaluateVehicleCountForecast, VEHICLE_COUNT_LEVELS, vehicleCountLevel } from "@/lib/traffic-status";
import { HISTORY_OFFSET_HOURS, HISTORY_OFFSET_LABELS, HISTORY_RANGE_HOURS, historyCoverage, historyRangeSeries, parseHistoryResponse, type HistoryRow, type HistorySpan } from "@/lib/history-range";
import { SectionCard } from "./ui";

const COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc", "#f472b6"];
const COMPARISON_HORIZONS = [1, 5, 15, 30] as const;
const OBSERVED_COLOR = "#34d399";
const PREDICTED_COLOR = "#60a5fa";
const CURRENT_COLOR = "#f472b6";
const NO_DATA_COLOR = "#ef4444";
const NO_FORECAST_COLOR = "#f59e0b";
const NO_DATA_LABEL = "Mất dữ liệu";
const NO_FORECAST_LABEL = "Chưa có dự báo";
const NO_ACTUAL_MESSAGE = "Không có số liệu trong khoảng này: thiết bị tắt, mất mạng hoặc camera không có ảnh.";
const NO_FORECAST_MESSAGE = "Không có dự báo TCN trong khoảng này. TCN chỉ dự báo khi có đủ 120 phút số liệu liên tục của cả 5 camera; sau mỗi lần mất dữ liệu quá 15 phút (mất mạng, khởi động lại, camera mất ảnh) hệ thống cần khoảng 2 giờ để tích lũy lại.";

type ShadedSpans = { spans: HistorySpan[]; color: string; label: string };

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

function spanMinutes(spans: HistorySpan[]) {
  return spans.reduce((sum, [first, last]) => sum + (last - first) / 60 + 1, 0);
}

const WINDOW_FORMAT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };

function formatWindow([from, to]: [number, number]) {
  const format = (seconds: number) => new Date(seconds * 1000).toLocaleString("vi-VN", WINDOW_FORMAT);
  return `${format(from)} → ${format(to)}`;
}

type ComparisonChartPoint = { timestamp: number; actual?: number | null; predicted?: number | null; predictedFilled?: boolean; current?: number | null };

function ComparisonChart({ title, subtitle, data, lines, currentTimestamp, futureEnd, window: fixedWindow, shaded = [], emptyMessage }: {
  title: string;
  subtitle?: string;
  window?: [number, number];
  data: ComparisonChartPoint[];
  lines: Array<{ key: "actual" | "predicted" | "current"; name: string; color: string; dashed?: boolean; marker?: boolean }>;
  currentTimestamp?: number;
  futureEnd?: number;
  /** Minute runs to shade (each run covers its minutes ±30 s), e.g. outages. */
  shaded?: ShadedSpans[];
  emptyMessage?: string;
}) {
  const timestamps = data.map(point => point.timestamp).filter(Number.isFinite);
  const hasValues = lines.some(line => data.some(point => typeof point[line.key] === "number" && Number.isFinite(point[line.key])));
  const domain: [number, number] = fixedWindow ?? (timestamps.length
    ? [timestamps[0] - 60, timestamps[timestamps.length - 1] + 60]
    : [0, 60]);

  const clamp = (value: number) => Math.min(domain[1], Math.max(domain[0], value));
  const areas = shaded.flatMap(group => group.spans.map(([first, last]) => ({
    key: `${group.label}-${first}`, color: group.color, x1: clamp(first - 30), x2: clamp(last + 30),
  }))).filter(area => area.x2 > area.x1);
  const legend = shaded.filter(group => group.spans.length > 0);

  return <section className="rounded-xl border border-border/80 bg-muted/15 p-3 sm:p-4">
    <h4 className="text-sm font-semibold">{title}</h4>
    {subtitle && <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{subtitle}</p>}
    <div className="mb-2" />
    {hasValues ? <div role="img" aria-label={title} className="h-[220px] w-full sm:h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 14, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="timestamp" type="number" domain={domain} minTickGap={32}
            tickFormatter={value => new Date(Number(value) * 1000).toLocaleString("vi-VN", domain[1] - domain[0] > 12 * 3600
              ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" })}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} domain={[0, "auto"]} width={38}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={value => value ? new Date(Number(value) * 1000).toLocaleString("vi-VN") : ""}
            formatter={(value) => {
              const formatted = typeof value === "number" ? `${Number.isInteger(value) ? value : value.toFixed(1)} xe` : "—";
              return [formatted, "Số xe"];
            }}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
          {areas.map(area => <ReferenceArea key={area.key} x1={area.x1} x2={area.x2} fill={area.color} fillOpacity={0.12} strokeOpacity={0} ifOverflow="hidden" />)}
          {currentTimestamp !== undefined && futureEnd !== undefined && futureEnd > currentTimestamp &&
            <ReferenceArea x1={currentTimestamp} x2={futureEnd} fill="#fb923c" fillOpacity={0.06} strokeOpacity={0} />}
          {currentTimestamp !== undefined && <ReferenceLine x={currentTimestamp} stroke="var(--foreground)"
            strokeDasharray="4 4" label={{ value: "Hiện tại (t0)", position: "insideTopRight", fontSize: 10 }} />}
          {lines.map(line => <Line key={line.key} type="linear" dataKey={line.key} name={line.name}
            stroke={line.color} strokeWidth={line.marker ? 0 : 2.5} strokeDasharray={line.dashed ? "7 5" : undefined}
            dot={line.marker ? { r: 5, fill: line.color, stroke: "var(--card)", strokeWidth: 2 } : false}
            activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div> : <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border px-5 text-center text-sm text-muted-foreground sm:h-[250px]">
      {emptyMessage ?? "Chưa có đủ dữ liệu để vẽ chuỗi này."}
    </div>}
    {hasValues && legend.length > 0 && <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
      {legend.map(group => <span key={group.label} className="inline-flex items-center gap-2">
        <span className="inline-block h-2.5 w-4 rounded-sm" style={{ backgroundColor: group.color, opacity: 0.35 }} />
        {group.label} · {formatDuration(spanMinutes(group.spans))}
      </span>)}
    </div>}
  </section>;
}

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
  const [selectedCamera, setSelectedCamera] = useState<string>(MINUTE_CAMERA_IDS[0]);
  const [rangeHours, setRangeHours] = useState<number>(2);
  const [offsetHours, setOffsetHours] = useState<number>(0);
  const [rangeRows, setRangeRows] = useState<HistoryRow[] | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    setRangeRows(null);
    setRangeEnd(null);
    const load = async () => {
      try {
        const response = await fetch(`/api/history?hours=${rangeHours}&offset=${offsetHours}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.json();
        if (alive) {
          setRangeRows(parseHistoryResponse(body));
          setRangeEnd(Number.isFinite(Number(body?.to)) ? Number(body.to) : null);
        }
      } catch {
        if (alive) setRangeRows(null);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => { alive = false; clearInterval(timer); };
  }, [rangeHours, offsetHours]);
  const [lastReadyForecast, setLastReadyForecast] = useState<ReadyMinuteForecast | null>(null);
  if (forecast.ready && (!lastReadyForecast || forecast.issuedAt > lastReadyForecast.issuedAt)) {
    setLastReadyForecast(forecast);
  }
  const comparisons = MINUTE_CAMERA_IDS.map((camera, index) => {
    const result = readEdgeForecastComparison(data, camera, horizon);
    return {
      camera,
      name: CAMERAS.find(item => item.id === camera)?.name || `Camera ${index + 1}`,
      color: COLORS[index],
      result,
      current: readEdgeCurrentCount(edgeAI, camera, nowMs),
      evaluation: evaluateVehicleCountForecast(result.points),
    };
  }).filter(item => item.camera === selectedCamera);
  const selectClass = "w-60 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
  return <div className="mt-6 border-t border-border/70 pt-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h3 className="font-semibold">Lịch sử, hiện tại và dự báo theo camera</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">Chọn camera
          <select aria-label="Chọn camera" className={selectClass} value={selectedCamera} onChange={event => setSelectedCamera(event.target.value)}>
            {MINUTE_CAMERA_IDS.map((camera, index) => <option key={camera} value={camera}>{CAMERAS.find(item => item.id === camera)?.name || `Camera ${index + 1}`}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Khoảng lịch sử
          <select aria-label="Khoảng lịch sử" className={selectClass} value={rangeHours} onChange={event => setRangeHours(Number(event.target.value))}>
            {HISTORY_RANGE_HOURS.map(value => <option key={value} value={value}>{value} giờ</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Xem đến (lưu 3 ngày)
          <select aria-label="Xem lịch sử đến thời điểm" className={selectClass} value={offsetHours} onChange={event => setOffsetHours(Number(event.target.value))}>
            {HISTORY_OFFSET_HOURS.map(value => <option key={value} value={value}>{HISTORY_OFFSET_LABELS[value]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">Mốc dự báo đối chiếu
          <select aria-label="Khoảng dự báo so sánh" className={selectClass} value={horizon} onChange={event => setHorizon(Number(event.target.value))}>
            {COMPARISON_HORIZONS.map(value => <option key={value} value={value}>{value} phút</option>)}
          </select>
        </label>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-1 gap-4">
      {comparisons.map(({ camera, name, color, result, current, evaluation }) => {
        const visibleComparison = alignForecastComparisonToHistory(history, result.points);
        const actualHistory: ComparisonChartPoint[] = history.map(point => {
          const value = point.counts[camera];
          const count = value && (value.source === "observed" || value.source === "imputed") ? value.count : null;
          return { timestamp: point.timestamp, actual: count };
        });
        const historicalPredictions: ComparisonChartPoint[] = visibleComparison.points
          .filter(point => point.predicted !== null)
          .map(point => ({
            timestamp: point.timestamp,
            predicted: point.predicted,
            predictedFilled: point.filled,
          }));
        // Saved history (Firebase, 3 days) once loaded — even if empty; live 2 h buffer only as a fallback for "now".
        const useSaved = rangeRows !== null && (rangeRows.length > 0 || offsetHours > 0);
        const cameraIndex = MINUTE_CAMERA_IDS.indexOf(camera as (typeof MINUTE_CAMERA_IDS)[number]);
        const range = rangeRows && useSaved ? historyRangeSeries(rangeRows, camera, cameraIndex, horizon) : null;
        const fallbackLive = !range && offsetHours === 0;
        const rangeActual: ComparisonChartPoint[] = range ? range.actual.map(point => ({ timestamp: point.timestamp, actual: point.value })) : fallbackLive ? actualHistory : [];
        const rangePredicted: ComparisonChartPoint[] = range ? range.predicted.map(point => ({ timestamp: point.timestamp, predicted: point.value })) : fallbackLive ? historicalPredictions : [];
        const stats = range ? { samples: range.samples, mae: range.mae, rmse: range.rmse }
          : fallbackLive ? visibleComparison : { samples: 0, mae: null, rmse: null };
        const windowEnd = rangeEnd ?? nowMs / 1000 - offsetHours * 3600;
        const rangeWindow: [number, number] | undefined = fallbackLive ? undefined : [windowEnd - rangeHours * 3600, windowEnd];
        const shownHours = fallbackLive ? 2 : rangeHours;
        const periodLabel = rangeWindow ? ` · ${formatWindow(rangeWindow)}` : "";
        const coverage = range && rangeRows && rangeWindow
          ? historyCoverage(rangeRows, camera, cameraIndex, horizon, rangeWindow[0], rangeWindow[1]) : null;
        const noDataMinutes = coverage ? spanMinutes(coverage.noData) : 0;
        const actualSubtitle = coverage ? `Có số liệu ${coverage.actual}/${coverage.minutes} phút`
          + (coverage.imputed ? ` (${coverage.imputed} phút ước lượng khi camera mất ảnh ngắn)` : "")
          + (noDataMinutes ? ` · mất dữ liệu ${formatDuration(noDataMinutes)}` : "") : undefined;
        const forecastSubtitle = coverage ? `Có dự báo ${coverage.forecast}/${coverage.minutes} phút`
          + (coverage.forecast < coverage.minutes ? " · TCN cần 120 phút số liệu liên tục trước khi dự báo" : "") : undefined;
        const currentTimestamp = current?.timestamp ?? nowMs / 1000;
        const displayForecast = selectDisplayMinuteForecast(forecast, lastReadyForecast, currentTimestamp);
        const combinedRows = new Map<number, ComparisonChartPoint>();
        const at = (timestamp: number) => {
          const existing = combinedRows.get(timestamp);
          if (existing) return existing;
          const row: ComparisonChartPoint = { timestamp };
          combinedRows.set(timestamp, row);
          return row;
        };
        for (const point of actualHistory) {
          if (currentTimestamp === undefined || point.timestamp <= currentTimestamp) at(point.timestamp).actual = point.actual;
        }
        if (current && currentTimestamp !== undefined) {
          const now = at(currentTimestamp);
          now.actual = current.count;
          now.current = current.count;
          // Anchor the dashed forecast at t0 so it transitions from the actual value.
          if (displayForecast.points.length) now.predicted = current.count;
        }
        for (const point of displayForecast.points) at(point.timestamp).predicted = point[camera];
        const combined = [...combinedRows.values()].sort((a, b) => a.timestamp - b.timestamp);
        const futureEnd = displayForecast.points[displayForecast.points.length - 1]?.timestamp;
        return <article key={camera} className="min-w-0 rounded-xl border border-border/80 bg-background/25 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold" style={{ color }}>{name}</h4>
            <span className="text-sm font-medium tabular-nums" style={{ color: CURRENT_COLOR }}>Hiện tại: {current ? `${current.count} xe` : "chờ ảnh mới"}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">Mẫu khớp · +{horizon}p</p><p className="mt-1 text-sm font-semibold tabular-nums">{stats.samples}</p></div>
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">MAE</p><p className="mt-1 text-sm font-semibold tabular-nums">{stats.mae === null ? "—" : `${stats.mae.toFixed(2)} xe`}</p></div>
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">RMSE</p><p className="mt-1 text-sm font-semibold tabular-nums">{stats.rmse === null ? "—" : `${stats.rmse.toFixed(2)} xe`}</p></div>
          </div>
          {evaluation.samples > 0 && <section aria-label="Đánh giá dự báo theo thời gian thực" className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
            <h5 className="font-semibold">Real-time Forecast Evaluation · +{horizon} phút</h5>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Cặp đã đối chiếu</p><p className="mt-1 font-semibold tabular-nums">{evaluation.samples}</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">MAE số xe</p><p className="mt-1 font-semibold tabular-nums">{evaluation.mae!.toFixed(2)} xe</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">RMSE số xe</p><p className="mt-1 font-semibold tabular-nums">{evaluation.rmse!.toFixed(2)} xe</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Khớp nhãn</p><p className="mt-1 font-semibold tabular-nums">{(evaluation.labelAccuracy! * 100).toFixed(1)}%</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Sai lệch mức TB</p><p className="mt-1 font-semibold tabular-nums">{evaluation.meanLevelError!.toFixed(2)} bậc ID</p></div>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border/70 bg-background/60">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="border-y border-border/70 text-muted-foreground"><tr>
                    <th className="px-3 py-2 font-medium">Thời điểm</th><th className="px-3 py-2 font-medium">Thực tế</th>
                    <th className="px-3 py-2 font-medium">Dự báo</th><th className="px-3 py-2 font-medium">Đối chiếu nhãn</th>
                  </tr></thead>
                  <tbody>{evaluation.rows.slice(-8).reverse().map(point => <tr key={point.timestamp} className="border-b border-border/50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{new Date(point.timestamp * 1000).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="whitespace-nowrap px-3 py-2">{point.actual} xe · ID {point.actualLevel.id} · {point.actualLevel.label}</td>
                    <td className="whitespace-nowrap px-3 py-2">{point.forecast} xe · ID {point.forecastLevel.id} · {point.forecastLevel.label}</td>
                    <td className={`whitespace-nowrap px-3 py-2 font-medium ${point.labelMatch ? "text-emerald-600" : "text-amber-600"}`}>{point.labelMatch ? "Khớp" : `Lệch (${Math.abs(point.forecastLevel.id - point.actualLevel.id)} bậc)`}</td>
                  </tr>)}</tbody>
                </table>
              </div>
          </section>}
          <div className="mt-4 space-y-3">
            <ComparisonChart title={`1. Lịch sử thực tế · ${shownHours} giờ${periodLabel}`} subtitle={actualSubtitle}
              data={rangeActual} window={rangeWindow} emptyMessage={range ? NO_ACTUAL_MESSAGE : undefined}
              shaded={coverage ? [{ spans: coverage.noData, color: NO_DATA_COLOR, label: NO_DATA_LABEL }] : []}
              lines={[{ key: "actual", name: "Số xe lịch sử", color: OBSERVED_COLOR }]} />
            <ComparisonChart title={`2. Lịch sử dự báo TCN · mốc +${horizon} phút · ${shownHours} giờ${periodLabel}`} subtitle={forecastSubtitle}
              data={rangePredicted} window={rangeWindow} emptyMessage={range ? NO_FORECAST_MESSAGE : undefined}
              shaded={coverage ? [{ spans: coverage.noForecast, color: NO_FORECAST_COLOR, label: NO_FORECAST_LABEL }] : []}
              lines={[{ key: "predicted", name: "Dự báo TCN lịch sử", color: PREDICTED_COLOR, dashed: true }]} />
            <ComparisonChart title="3. Hiện tại + dự báo TCN" data={combined}
              lines={[
                { key: "actual", name: "Số xe lịch sử", color: OBSERVED_COLOR },
                { key: "predicted", name: "Dự báo TCN", color: PREDICTED_COLOR, dashed: true },
                { key: "current", name: "Hiện tại · ảnh mới", color: CURRENT_COLOR, marker: true },
              ]}
              currentTimestamp={currentTimestamp} futureEnd={futureEnd} />
          </div>
        </article>;
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2" style={{ borderColor: OBSERVED_COLOR }} />Số xe lịch sử</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CURRENT_COLOR }} />Hiện tại · ảnh mới</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: PREDICTED_COLOR }} />Dự báo TCN · 30 phút</span>
    </div>
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
      <div role="img" aria-label="Dự báo số xe 30 phút cho 5 camera" className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={forecast.points}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="horizon" type="number" domain={[1, 30]} ticks={[1, 5, 15, 30]} tickFormatter={value => `+${value} phút`} /><YAxis allowDecimals={false} label={{ value: "Số xe dự báo", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Tooltip labelFormatter={value => `Sau ${value} phút`} formatter={value => [`${value} xe`, "Số xe dự báo"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        {MINUTE_CAMERA_IDS.map((id, i) => <Line key={id} dataKey={id} name={CAMERAS.find(camera => camera.id === id)?.name || id} stroke={COLORS[i]} strokeWidth={2} strokeDasharray="7 5" dot={false} connectNulls={false} isAnimationActive={false} />)}
      </LineChart></ResponsiveContainer></div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">{MINUTE_CAMERA_IDS.map((id, i) => <span key={id} className="inline-flex items-center gap-2"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: COLORS[i] }} />{CAMERAS.find(camera => camera.id === id)?.name || id}</span>)}</div>
      <div className="mt-6 border-t border-border/70 pt-5">
        <h3 className="font-semibold">Mức ùn tắc dự báo</h3>
        <div role="img" aria-label="Mức ùn tắc dự báo 30 phút cho 5 camera" className="mt-3 h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={convertedPoints}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="horizon" type="number" domain={[1, 30]} ticks={[1, 5, 15, 30]} tickFormatter={value => `+${value} phút`} /><YAxis type="number" domain={[0, 3]} ticks={VEHICLE_COUNT_LEVELS.map(level => level.id)} allowDecimals={false} width={108} tickFormatter={value => VEHICLE_COUNT_LEVELS.find(level => level.id === Number(value))?.label || ""} />
          <Tooltip labelFormatter={value => `Sau ${value} phút`} formatter={value => {
            const level = VEHICLE_COUNT_LEVELS.find(item => item.id === Number(value));
            return [level ? `ID ${level.id} · ${level.label}` : "Chưa xác định", "Mức ùn tắc"];
          }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
          {MINUTE_CAMERA_IDS.map((id, i) => <Line key={id} type="stepAfter" dataKey={id} name={CAMERAS.find(camera => camera.id === id)?.name || id} stroke={COLORS[i]} strokeWidth={2} strokeDasharray="7 5" dot={false} connectNulls={false} isAnimationActive={false} />)}
        </LineChart></ResponsiveContainer></div>
      </div>
    </> : <p className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground" aria-live="polite">Đang tích lũy đủ dữ liệu liên tục để tạo dự báo.</p>}
    <ForecastComparison data={data?.forecast_evaluation} history={history} edgeAI={data} forecast={forecast} nowMs={nowMs} />
  </SectionCard>;
}
