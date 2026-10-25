"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTrafficStore } from "@/lib/store";
import { DIRECTIONS } from "@/lib/constants";
import { SectionCard } from "@/components/shared/ui";
import { BarChart3 } from "lucide-react";

const WINDOWS = [
  { id: "15m", label: "15 phút", seconds: 15 * 60 },
  { id: "1h", label: "1 giờ", seconds: 60 * 60 },
] as const;
const COLORS = ["#54d6b0", "#64b5f6", "#f4bb62", "#c6a5ff"];
type WindowId = (typeof WINDOWS)[number]["id"];

export function TrafficHistoryChart() {
  const history = useTrafficStore((s) => s.chartHistory);
  const [windowId, setWindowId] = useState<WindowId>("15m");
  const windowSeconds = WINDOWS.find((window) => window.id === windowId)?.seconds ?? 900;
  const points = useMemo(() => {
    const latest = history.at(-1)?.timestamp ?? 0;
    return history.filter((row) => row.timestamp >= latest - windowSeconds);
  }, [history, windowSeconds]);
  const spanSeconds = points.length > 1 ? points.at(-1)!.timestamp - points[0].timestamp : 0;
  const coverage = spanSeconds >= 60 ? `${Math.floor(spanSeconds / 60)} phút dữ liệu` : points.length ? "vừa có mẫu mới" : "chưa có mẫu";

  return (
    <SectionCard
      title="Diễn biến số xe trong ảnh"
      subtitle="Ước lượng từ các ảnh camera AI mới nhận; không phải lưu lượng xe qua đường"
      icon={BarChart3}
      action={<div className="flex rounded-lg border border-border bg-background/60 p-1" aria-label="Khoảng thời gian biểu đồ">
        {WINDOWS.map((window) => <button key={window.id} onClick={() => setWindowId(window.id)}
          aria-pressed={windowId === window.id}
          className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${windowId === window.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {window.label}
        </button>)}
      </div>}
    >
      {points.length < 2 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/30 px-6 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground/60" />
          <p className="font-medium">Đang chờ thêm ảnh mới để vẽ xu hướng</p>
          <p className="max-w-lg text-sm text-muted-foreground">Biểu đồ chỉ ghi nhận mẫu mới có thời điểm quan sát. Dữ liệu được tích lũy trong phiên hiện tại; chưa có lịch sử dài hạn tại Firebase.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{coverage} · {points.length} lần cập nhật</span>
            <span>Hiển thị tối đa {windowId === "15m" ? "15 phút" : "1 giờ"} dữ liệu có sẵn</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, left: -14, bottom: 4 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="timestamp" type="number" domain={["dataMin", "dataMax"]} scale="time"
                  tickFormatter={(value) => new Date(Number(value) * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} minTickGap={28} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} width={42} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(value) => new Date(Number(value) * 1000).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  formatter={(value: number, name: string) => [Number(value).toFixed(0), DIRECTIONS.find((route) => route.id === name)?.name ?? name]}
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--foreground)" }}
                />
                {DIRECTIONS.map((direction, index) => <Line key={direction.id} type="monotone" dataKey={direction.id}
                  name={direction.name} stroke={COLORS[index]} strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-3">
            {DIRECTIONS.map((direction, index) => <span key={direction.id} className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index] }} />{direction.name}
            </span>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Mỗi điểm là tổng số xe AI ước lượng trong các ảnh mới còn hiệu lực của hướng tương ứng. Mẫu cũ/trùng không được tính lại.</p>
        </>
      )}
    </SectionCard>
  );
}
