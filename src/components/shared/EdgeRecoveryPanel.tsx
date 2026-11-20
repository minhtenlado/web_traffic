"use client";

import { useState } from "react";
import { Brain } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CAMERAS } from "@/lib/constants";
import { edgeHistoryProgress } from "@/lib/edge-forecast";
import { alignForecastComparisonToHistory, edgeHistoryQuality, edgeSystemHealth, MINUTE_CAMERA_IDS, readEdgeCurrentCount, readEdgeForecastComparison, readEdgeMinuteForecast, type EdgeMinuteHistoryPoint } from "@/lib/edge-quality";
import { applyVehicleCountCalibration, evaluateAdaptiveVehicleCountForecast, evaluateVehicleCountForecast, VEHICLE_COUNT_LEVELS, vehicleCountLevel } from "@/lib/traffic-status";
import { SectionCard } from "./ui";

const COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#c084fc", "#f472b6"];
const COMPARISON_HORIZONS = [1, 5, 15, 30] as const;
const OBSERVED_COLOR = "#34d399";
const PREDICTED_COLOR = "#60a5fa";
const CALIBRATED_COLOR = "#c084fc";
const CURRENT_COLOR = "#f472b6";

type ComparisonChartPoint = { timestamp: number; actual?: number | null; predicted?: number | null; adjusted?: number | null; adjustedPoint?: number | null; current?: number | null };

function ComparisonChart({ title, data, lines, currentTimestamp, futureEnd }: {
  title: string;
  data: ComparisonChartPoint[];
  lines: Array<{ key: "actual" | "predicted" | "adjusted" | "adjustedPoint" | "current"; name: string; color: string; dashed?: boolean; marker?: boolean }>;
  currentTimestamp?: number;
  futureEnd?: number;
}) {
  const timestamps = data.map(point => point.timestamp).filter(Number.isFinite);
  const hasValues = lines.some(line => data.some(point => typeof point[line.key] === "number" && Number.isFinite(point[line.key])));
  const domain: [number, number] = timestamps.length
    ? [timestamps[0] - 60, timestamps[timestamps.length - 1] + 60]
    : [0, 60];

  return <section className="rounded-xl border border-border/80 bg-muted/15 p-3 sm:p-4">
    <h4 className="mb-2 text-sm font-semibold">{title}</h4>
    {hasValues ? <div role="img" aria-label={title} className="h-[220px] w-full sm:h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 14, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="timestamp" type="number" domain={domain} minTickGap={32}
            tickFormatter={value => new Date(Number(value) * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} domain={[0, "auto"]} width={38}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip labelFormatter={value => value ? new Date(Number(value) * 1000).toLocaleString("vi-VN") : ""}
            formatter={value => [typeof value === "number" ? `${Number.isInteger(value) ? value : value.toFixed(1)} xe` : "—", "Số xe"]}
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
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
      Chưa có đủ dữ liệu để vẽ chuỗi này.
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
  const comparisons = MINUTE_CAMERA_IDS.map((camera, index) => {
    const result = readEdgeForecastComparison(data, camera, horizon, nowMs);
    return {
      camera,
      name: CAMERAS.find(item => item.id === camera)?.name || `Camera ${index + 1}`,
      color: COLORS[index],
      result,
      current: readEdgeCurrentCount(edgeAI, camera, nowMs),
      evaluation: evaluateVehicleCountForecast(result.points),
      calibration: evaluateAdaptiveVehicleCountForecast(result.points),
    };
  }).filter(item => item.camera === selectedCamera);
  const selectClass = "w-60 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
  return <div className="mt-6 border-t border-border/70 pt-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-semibold">Lịch sử, hiện tại và dự báo theo camera</h3>
        <p className="mt-1 text-xs text-muted-foreground">Camera được chọn ghép đến 120 phút lịch sử, số đếm ảnh mới nhất và dự báo TCN 30 phút.</p></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">Chọn camera
          <select aria-label="Chọn camera" className={selectClass} value={selectedCamera} onChange={event => setSelectedCamera(event.target.value)}>
            {MINUTE_CAMERA_IDS.map((camera, index) => <option key={camera} value={camera}>{CAMERAS.find(item => item.id === camera)?.name || `Camera ${index + 1}`}</option>)}
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
      {comparisons.map(({ camera, name, color, result, current, evaluation, calibration }) => {
        const visibleComparison = alignForecastComparisonToHistory(history, result.points);
        const walkForwardByTimestamp = new Map(calibration.walkForwardRows.map(point => [point.timestamp, point]));
        const actualHistory: ComparisonChartPoint[] = history.map(point => {
          const value = point.counts[camera];
          const count = value && (value.source === "observed" || value.source === "imputed") ? value.count : null;
          return { timestamp: point.timestamp, actual: count };
        });
        const historicalPredictions: ComparisonChartPoint[] = visibleComparison.points.map(point => {
          const adjusted = walkForwardByTimestamp.get(point.timestamp)?.adjusted;
          return { ...point, adjusted: adjusted === null || adjusted === undefined ? null : Math.round(adjusted) };
        });
        const currentTimestamp = current?.timestamp ?? (forecast.ready ? forecast.issuedAt! : undefined);
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
          if (forecast.ready) now.predicted = current.count;
        }
        if (forecast.ready) for (const point of forecast.points) {
          if (currentTimestamp === undefined || point.timestamp > currentTimestamp) {
            const row = at(point.timestamp);
            row.predicted = point[camera];
            const adjusted = calibration.latestCalibration && point.horizon === horizon
              ? applyVehicleCountCalibration(point[camera], calibration.latestCalibration) : null;
            row.adjustedPoint = adjusted === null ? null : Math.round(adjusted);
          }
        }
        const combined = [...combinedRows.values()].sort((a, b) => a.timestamp - b.timestamp);
        const futureEnd = forecast.ready ? forecast.points[forecast.points.length - 1]?.timestamp : undefined;
        const targetForecast = forecast.ready ? forecast.points.find(point => point.horizon === horizon) : undefined;
        const targetAdjustedCount = targetForecast && calibration.latestCalibration
          ? applyVehicleCountCalibration(targetForecast[camera], calibration.latestCalibration) : null;
        const targetAdjustedRounded = targetAdjustedCount === null ? null : Math.round(targetAdjustedCount);
        const targetRawLevel = targetForecast ? vehicleCountLevel(targetForecast[camera]) : null;
        const targetAdjustedLevel = targetAdjustedRounded === null ? null : vehicleCountLevel(targetAdjustedRounded);
        return <article key={camera} className="min-w-0 rounded-xl border border-border/80 bg-background/25 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold" style={{ color }}>{name}</h4>
            <span className="text-sm font-medium tabular-nums" style={{ color: CURRENT_COLOR }}>Hiện tại: {current ? `${current.count} xe` : "chờ ảnh mới"}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">Mẫu khớp · +{horizon}p</p><p className="mt-1 text-sm font-semibold tabular-nums">{visibleComparison.samples}</p></div>
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">MAE · cửa sổ hiển thị</p><p className="mt-1 text-sm font-semibold tabular-nums">{visibleComparison.mae === null ? "—" : `${visibleComparison.mae.toFixed(2)} xe`}</p></div>
            <div className="rounded-lg bg-muted/35 p-2"><p className="text-[11px] text-muted-foreground">RMSE · cửa sổ hiển thị</p><p className="mt-1 text-sm font-semibold tabular-nums">{visibleComparison.rmse === null ? "—" : `${visibleComparison.rmse.toFixed(2)} xe`}</p></div>
          </div>
          <section aria-label="Đánh giá dự báo theo thời gian thực" className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
            <div>
              <h5 className="font-semibold">Real-time Forecast Evaluation · +{horizon} phút</h5>
              <p className="mt-1 text-xs text-muted-foreground">Đối chiếu dự báo đã đến hạn với số xe YOLO quan sát ở đúng phút; nhãn được quy đổi từ số xe theo các ngưỡng trên trang.</p>
            </div>
            {evaluation.samples ? <>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Cặp đã đối chiếu</p><p className="mt-1 font-semibold tabular-nums">{evaluation.samples}</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">MAE số xe</p><p className="mt-1 font-semibold tabular-nums">{evaluation.mae!.toFixed(2)} xe</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">RMSE số xe</p><p className="mt-1 font-semibold tabular-nums">{evaluation.rmse!.toFixed(2)} xe</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Khớp nhãn quy đổi</p><p className="mt-1 font-semibold tabular-nums">{(evaluation.labelAccuracy! * 100).toFixed(1)}%</p></div>
                <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Sai lệch mức TB</p><p className="mt-1 font-semibold tabular-nums">{evaluation.meanLevelError!.toFixed(2)} bậc ID</p></div>
              </div>
              <div className="mt-4 border-t border-border/70 pt-3">
                <h6 className="text-sm font-semibold">Hiệu chỉnh biên độ và bù sai lệch</h6>
                <p className="mt-1 text-xs text-muted-foreground">ŷ_adj = max(0, a × ŷ_TCN + b); a = σ_actual/(σ_pred + ε), b = μ_actual − a × μ_pred. Hệ số a,b được học từ các cặp đã trưởng thành trước thời điểm phát hành; dự báo lịch sử được chấm walk-forward trên các mốc chưa dùng để fit. Cửa sổ mục tiêu {calibration.windowSize} cặp, tối thiểu {calibration.minimumSamples}; payload hiện cấp tối đa 30 cặp.</p>
                {calibration.latestCalibration ? <>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Cặp học a,b</p><p className="mt-1 font-semibold tabular-nums">{calibration.latestCalibration.samples}/{calibration.windowSize}</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Biên độ a</p><p className="mt-1 font-semibold tabular-nums">{calibration.latestCalibration.a.toFixed(3)}</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Bù b</p><p className="mt-1 font-semibold tabular-nums">{calibration.latestCalibration.b.toFixed(2)} xe</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Mẫu kiểm tra</p><p className="mt-1 font-semibold tabular-nums">{calibration.walkForwardSamples}</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">MAE gốc → chỉnh</p><p className="mt-1 font-semibold tabular-nums">{calibration.rawMetrics.mae === null ? "—" : calibration.rawMetrics.mae.toFixed(2)} → {calibration.adjustedMetrics.mae === null ? "—" : calibration.adjustedMetrics.mae.toFixed(2)} xe</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">RMSE gốc → chỉnh</p><p className="mt-1 font-semibold tabular-nums">{calibration.rawMetrics.rmse === null ? "—" : calibration.rawMetrics.rmse.toFixed(2)} → {calibration.adjustedMetrics.rmse === null ? "—" : calibration.adjustedMetrics.rmse.toFixed(2)} xe</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Khớp nhãn gốc → chỉnh</p><p className="mt-1 font-semibold tabular-nums">{calibration.rawMetrics.labelAccuracy === null ? "—" : (calibration.rawMetrics.labelAccuracy * 100).toFixed(1)} → {calibration.adjustedMetrics.labelAccuracy === null ? "—" : (calibration.adjustedMetrics.labelAccuracy * 100).toFixed(1)}%</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Sai lệch ID TB gốc → chỉnh</p><p className="mt-1 font-semibold tabular-nums">{calibration.rawMetrics.meanLevelError === null ? "—" : calibration.rawMetrics.meanLevelError.toFixed(2)} → {calibration.adjustedMetrics.meanLevelError === null ? "—" : calibration.adjustedMetrics.meanLevelError.toFixed(2)} bậc</p></div>
                  </div>
                  {targetForecast && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Dự báo gốc tại +{horizon} phút</p><p className="mt-1 font-semibold tabular-nums">{targetForecast[camera]} xe · ID {targetRawLevel?.id} · {targetRawLevel?.label}</p></div>
                    <div className="rounded-lg bg-background/70 p-2"><p className="text-[11px] text-muted-foreground">Sau hiệu chỉnh tại +{horizon} phút</p><p className="mt-1 font-semibold tabular-nums">{targetAdjustedRounded === null || !targetAdjustedLevel ? "Đang tích lũy hệ số" : `${targetAdjustedRounded} xe · ID ${targetAdjustedLevel.id} · ${targetAdjustedLevel.label}`}</p></div>
                  </div>}
                  <p className="mt-2 text-[11px] text-muted-foreground">Biểu đồ hiện tại chỉ hiệu chỉnh điểm +{horizon} phút bằng {calibration.latestCalibration.samples} cặp cùng camera và cùng mốc dự báo; hệ số này không áp dụng cho mốc thời gian khác. Giá trị bị chặn dưới 0 và làm tròn khi hiển thị. Đường xanh nét đứt là TCN gốc; chấm tím là điểm đã hiệu chỉnh. Hiệu chỉnh này chỉ dùng cho đánh giá/hiển thị web, chưa thay đổi đầu ra TCN trên Genio hoặc điều khiển Fuzzy/STM32.</p>
                </> : <p className="mt-3 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">{calibration.latestCalibrationReason === "insufficient_forecast_variation"
                  ? `Dự báo lịch sử gần như không dao động; đang chờ độ biến thiên đủ để ước lượng hệ số ổn định (${calibration.availableSamples}/${calibration.minimumSamples} cặp tối thiểu).`
                  : `Đang tích lũy cặp dự báo đã trưởng thành để hiệu chỉnh (${calibration.availableSamples}/${calibration.minimumSamples} cặp tối thiểu).`}</p>}
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-border/70 bg-background/60">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <caption className="px-3 py-2 text-left text-muted-foreground">Tối đa 8 mốc kiểm tra mới nhất; hiệu chỉnh lịch sử chỉ dùng dữ liệu đến trước mỗi mốc</caption>
                  <thead className="border-y border-border/70 text-muted-foreground"><tr>
                    <th className="px-3 py-2 font-medium">Thời điểm</th><th className="px-3 py-2 font-medium">Thực tế</th>
                    <th className="px-3 py-2 font-medium">TCN gốc</th><th className="px-3 py-2 font-medium">Sau hiệu chỉnh</th>
                    <th className="px-3 py-2 font-medium">Nhãn gốc</th><th className="px-3 py-2 font-medium">Nhãn hiệu chỉnh</th>
                  </tr></thead>
                  <tbody>{evaluation.rows.slice(-8).reverse().map(point => <tr key={point.timestamp} className="border-b border-border/50 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{new Date(point.timestamp * 1000).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="whitespace-nowrap px-3 py-2">{point.actual} xe · ID {point.actualLevel.id} · {point.actualLevel.label}</td>
                    <td className="whitespace-nowrap px-3 py-2">{point.forecast} xe · ID {point.forecastLevel.id} · {point.forecastLevel.label}</td>
                    {(() => {
                      const adjusted = walkForwardByTimestamp.get(point.timestamp)?.adjusted;
                      const adjustedCount = adjusted === null || adjusted === undefined ? null : Math.round(adjusted);
                      const adjustedLevel = adjustedCount === null ? null : vehicleCountLevel(adjustedCount);
                      const rawMatches = point.labelMatch;
                      const adjustedMatches = adjustedLevel?.id === point.actualLevel.id;
                      return <>
                        <td className="whitespace-nowrap px-3 py-2">{adjustedCount === null || !adjustedLevel ? "Đang tích lũy" : `${adjustedCount} xe · ID ${adjustedLevel.id} · ${adjustedLevel.label}`}</td>
                        <td className={`whitespace-nowrap px-3 py-2 font-medium ${rawMatches ? "text-emerald-600" : "text-amber-600"}`}>{rawMatches ? "Khớp" : `Lệch ${Math.abs(point.forecastLevel.id - point.actualLevel.id)} bậc`}</td>
                        <td className={`whitespace-nowrap px-3 py-2 font-medium ${adjustedLevel ? adjustedMatches ? "text-emerald-600" : "text-amber-600" : "text-muted-foreground"}`}>{adjustedLevel ? adjustedMatches ? "Khớp" : `Lệch ${Math.abs(adjustedLevel.id - point.actualLevel.id)} bậc` : "Chưa fit"}</td>
                      </>;
                    })()}
                  </tr>)}</tbody>
                </table>
              </div>
            </> : <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Chưa có dự báo đến hạn khớp với số xe YOLO quan sát tại cùng phút. Đánh giá sẽ cập nhật khi mốc dự báo được ghi nhận thực tế.</p>}
            <p className="mt-2 text-[11px] text-muted-foreground">Nhãn quy đổi: 0 ≤ 10 xe, 1 = 11–20, 2 = 21–40, 3 ≥ 41. Đây là nhãn suy ra từ số xe, không phải nhãn phân loại độc lập của YOLO.</p>
          </section>
          <div className="mt-4 space-y-3">
            <ComparisonChart title="1. Lịch sử thực tế" data={actualHistory}
              lines={[{ key: "actual", name: "Lịch sử · quan sát và bù theo phút", color: OBSERVED_COLOR }]} />
            <ComparisonChart title={`2. Lịch sử dự báo TCN · mốc +${horizon} phút`} data={historicalPredictions}
              lines={[{ key: "predicted", name: "TCN gốc", color: PREDICTED_COLOR, dashed: true },
                { key: "adjusted", name: "TCN đã hiệu chỉnh (walk-forward)", color: CALIBRATED_COLOR, dashed: true }]} />
            <ComparisonChart title={`3. Hiện tại + dự báo TCN · hiệu chỉnh tại +${horizon} phút`} data={combined}
              lines={[
                { key: "actual", name: "Lịch sử · quan sát và bù theo phút", color: OBSERVED_COLOR },
                { key: "predicted", name: "TCN gốc", color: PREDICTED_COLOR, dashed: true },
                ...(calibration.latestCalibration ? [{ key: "adjustedPoint" as const, name: `TCN đã hiệu chỉnh · +${horizon} phút`, color: CALIBRATED_COLOR, marker: true }] : []),
                { key: "current", name: "Hiện tại · ảnh mới", color: CURRENT_COLOR, marker: true },
              ]}
              currentTimestamp={currentTimestamp} futureEnd={futureEnd} />
            {!forecast.ready && <p className="text-xs text-muted-foreground">Chưa có dự báo tương lai mới; biểu đồ lịch sử vẫn hiển thị theo dữ liệu hiện có.</p>}
          </div>
        </article>;
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2" style={{ borderColor: OBSERVED_COLOR }} />Số xe lịch sử · quan sát và bù theo phút</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CURRENT_COLOR }} />Hiện tại · ảnh mới</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: PREDICTED_COLOR }} />Dự báo TCN · 30 phút</span>
      <span className="inline-flex items-center gap-2"><span className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: CALIBRATED_COLOR }} /><span className="-ml-4 -mt-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: CALIBRATED_COLOR }} />TCN hiệu chỉnh · lịch sử / mốc tương lai</span>
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
      <p className="my-3 text-xs text-muted-foreground">Biểu đồ tổng hợp này giữ nguyên đầu ra TCN gốc cho 1–30 phút tới. Phần dưới hiệu chỉnh riêng camera và mốc đang chọn; không dùng chung hệ số giữa các mốc.</p>
      <div role="img" aria-label="Dự báo số xe TCN gốc 30 phút cho 5 camera" className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={forecast.points}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="horizon" type="number" domain={[1, 30]} ticks={[1, 5, 15, 30]} tickFormatter={value => `+${value} phút`} /><YAxis allowDecimals={false} label={{ value: "Số xe dự báo", angle: -90, position: "insideLeft", fill: "var(--muted-foreground)", fontSize: 11 }} />
        <Tooltip labelFormatter={value => `Sau ${value} phút`} formatter={value => [`${value} xe`, "Số xe dự báo"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
        {MINUTE_CAMERA_IDS.map((id, i) => <Line key={id} dataKey={id} name={CAMERAS.find(camera => camera.id === id)?.name || id} stroke={COLORS[i]} strokeWidth={2} strokeDasharray="7 5" dot={false} connectNulls={false} isAnimationActive={false} />)}
      </LineChart></ResponsiveContainer></div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">{MINUTE_CAMERA_IDS.map((id, i) => <span key={id} className="inline-flex items-center gap-2"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: COLORS[i] }} />{CAMERAS.find(camera => camera.id === id)?.name || id}</span>)}</div>
      <div className="mt-6 border-t border-border/70 pt-5">
        <h3 className="font-semibold">Mức ùn tắc quy đổi từ số xe TCN gốc</h3>
        <div role="img" aria-label="Mức ùn tắc quy đổi từ số xe TCN gốc 30 phút cho 5 camera" className="mt-3 h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={convertedPoints}>
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
