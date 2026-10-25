"use client";

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useTrafficStore } from "@/lib/store";
import { CAMERAS } from "@/lib/constants";
import { TCN_OUTPUT_CAMERAS } from "@/lib/tcn-forecast";

const COLORS = ["#38bdf8", "#fb923c", "#4ade80", "#f87171"];
export function AICameraCharts() {
  const forecast = useTrafficStore(s => s.aiForecast);
  const history = forecast.rawHistory, predictions = forecast.rawPredictions;
  const points = useMemo(() => {
    if (!history?.length || !predictions?.length) return [];
    const rows = history.map(h => ({ timestamp: h.timestamp,
      ...Object.fromEntries(TCN_OUTPUT_CAMERAS.map(c => [`${c}_history`, h[c] ?? null])) }));
    const last = rows.length - 1;
    rows[last] = { ...rows[last], ...Object.fromEntries(TCN_OUTPUT_CAMERAS.map(c => [`${c}_forecast`, history[last][c] ?? null])) };
    return [...rows, ...predictions.map(p => ({ timestamp: p.timestamp,
      ...Object.fromEntries(TCN_OUTPUT_CAMERAS.map(c => [`${c}_forecast`, p[c]])) }))];
  }, [history, predictions]);
  const timeLabel = (stamp: number) => new Date(stamp * 1000).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  if (!points.length || forecast.status !== "EXPERIMENTAL") return (
    <p className="mt-4 rounded-lg border border-border p-4 text-sm text-muted-foreground">
      {forecast.status === "NOT_READY" ? "Mô hình đang chờ đủ lịch sử camera mới." : "Chưa có dự báo còn hiệu lực để hiển thị."}
    </p>
  );
  return <div className="mt-5 space-y-4">
    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
      Thử nghiệm · Đường liền: số lượng từ detector đã làm mượt; đường đứt: dự báo TCN.
      Đây là số lượng trong ảnh, không phải lưu lượng xe qua vạch hay nhãn kẹt xe.
    </p>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {TCN_OUTPUT_CAMERAS.map((cam, i) => <div key={cam} className="min-w-0 rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold" style={{ color: COLORS[i] }}>{CAMERAS.find(c => c.id === cam)?.name || cam}</h3>
        <p className="my-2 text-sm">Sau 30 phút: <strong>{Number(predictions?.[29]?.[cam]).toFixed(1)}</strong> · số lượng dự báo</p>
        <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 10, right: 12, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} tickFormatter={timeLabel} tick={{ fontSize: 10 }} minTickGap={30} />
            <YAxis domain={[0, "auto"]} width={36} tick={{ fontSize: 10 }} />
            <ReferenceLine x={history?.[119]?.timestamp} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
            <Tooltip labelFormatter={value => timeLabel(Number(value))}
              formatter={(value: number, name: string) => [Number(value).toFixed(1), name.endsWith("_history") ? "Quan sát" : "Dự báo thử nghiệm"]}
              contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
            <Line type="linear" dataKey={`${cam}_history`} stroke={COLORS[i]} dot={false} isAnimationActive={false} connectNulls={false} />
            <Line type="linear" dataKey={`${cam}_forecast`} stroke={COLORS[i]} strokeDasharray="5 5" dot={false} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer></div>
      </div>)}
    </div>
    <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Thông tin mô hình</summary><p className="mt-2 break-all font-mono">Mã phiên bản: {forecast.modelVersion || "chưa có"}</p><p className="mt-1">Tự ẩn biểu đồ khi dự báo hết hiệu lực.</p></details>
  </div>;
}
