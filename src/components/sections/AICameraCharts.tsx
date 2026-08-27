"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from "recharts";
import { useTrafficStore } from "@/lib/store";

const LABELS = ["Đường vắng", "Bình thường", "Đông xe", "Sắp kẹt", "Kẹt xe"];
const CAM_COLORS: Record<string, string> = {
  cam_01: "#38bdf8", // cyan
  cam_02: "#fb923c", // orange
  cam_03: "#4ade80", // green
  cam_04: "#f87171", // red
};
const STATUS_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];

export function AICameraCharts() {
  const aiForecast = useTrafficStore((s) => s.aiForecast);
  const { rawHistory, rawPredictions } = aiForecast;

  // Process data for the charts
  const combinedData = useMemo(() => {
    if (!rawHistory || !rawPredictions) return [];
    
    // We sample the data to avoid overcrowding the DOM with 720 + 180 points
    // Let's take every 12th point (every 2 minutes) or so for rendering
    const step = 6; // 1 minute intervals (10s * 6)
    const sampledHistory = rawHistory.filter((_, i) => i % step === 0);
    const sampledPreds = rawPredictions.filter((_, i) => i % step === 0);

    const data: any[] = [];
    
    sampledHistory.forEach((h) => {
      data.push({
        time: h.time?.substring(0, 5), // HH:mm
        rawTime: h.time,
        type: 'history',
        cam_01_hist: h.cam_01,
        cam_02_hist: h.cam_02,
        cam_03_hist: h.cam_03,
        cam_04_hist: h.cam_04,
      });
    });

    // Bridge point to connect history and predictions
    if (sampledHistory.length > 0 && sampledPreds.length > 0) {
      const lastHist = sampledHistory[sampledHistory.length - 1];
      data[data.length - 1] = {
        ...data[data.length - 1],
        cam_01_pred: lastHist.cam_01,
        cam_02_pred: lastHist.cam_02,
        cam_03_pred: lastHist.cam_03,
        cam_04_pred: lastHist.cam_04,
      };
    }

    sampledPreds.forEach((p) => {
      data.push({
        time: p.time?.substring(0, 5),
        rawTime: p.time,
        type: 'pred',
        cam_01_pred: p.cam_01,
        cam_02_pred: p.cam_02,
        cam_03_pred: p.cam_03,
        cam_04_pred: p.cam_04,
      });
    });

    return data;
  }, [rawHistory, rawPredictions]);

  if (combinedData.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">Chưa có dữ liệu từ AI.</div>;
  }

  const renderChart = (camId: string, title: string) => {
    const color = CAM_COLORS[camId] || "#38bdf8";
    return (
      <div className="flex flex-col rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-bold uppercase" style={{ color }}>{title}</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={combinedData} margin={{ top: 5, right: 5, bottom: 5, left: -25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              
              {/* Background color bands like in Tkinter */}
              <ReferenceArea y1={-0.5} y2={0.5} fill={STATUS_COLORS[0]} fillOpacity={0.06} />
              <ReferenceArea y1={0.5} y2={1.5} fill={STATUS_COLORS[1]} fillOpacity={0.06} />
              <ReferenceArea y1={1.5} y2={2.5} fill={STATUS_COLORS[2]} fillOpacity={0.06} />
              <ReferenceArea y1={2.5} y2={3.5} fill={STATUS_COLORS[3]} fillOpacity={0.06} />
              <ReferenceArea y1={3.5} y2={4.5} fill={STATUS_COLORS[4]} fillOpacity={0.06} />
              
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                minTickGap={30}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <YAxis 
                domain={[-0.5, 4.5]}
                ticks={[0, 1, 2, 3, 4]}
                tickFormatter={(v) => LABELS[v] || ""}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  fontSize: "12px",
                  color: "var(--foreground)",
                }}
                labelStyle={{ color: "var(--muted-foreground)", marginBottom: '4px' }}
                formatter={(val: number, name: string) => [
                  <span key="val" style={{ fontWeight: 'bold', color: STATUS_COLORS[val] }}>{LABELS[val]}</span>,
                  name === `${camId}_hist` ? "Quá khứ" : "Dự báo"
                ]}
                labelFormatter={(l, payloads) => {
                  if (payloads && payloads.length > 0) {
                     return `Thời gian: ${payloads[0].payload.rawTime}`;
                  }
                  return l;
                }}
              />
              
              {/* Historical Line */}
              <Line 
                type="stepAfter" 
                dataKey={`${camId}_hist`} 
                stroke={color} 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
                name={`${camId}_hist`}
              />
              
              {/* Prediction Line */}
              <Line 
                type="stepAfter" 
                dataKey={`${camId}_pred`} 
                stroke={color} 
                strokeWidth={2} 
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
                name={`${camId}_pred`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-5 space-y-4">
       <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pb-2">
          <div className="flex items-center gap-2"><span className="w-8 border-b-2 border-primary"></span> Quá khứ</div>
          <div className="flex items-center gap-2"><span className="w-8 border-b-2 border-primary border-dashed"></span> Dự báo</div>
       </div>
       <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
         {renderChart("cam_01", "CAM_01 - Hàng Xanh 3")}
         {renderChart("cam_02", "CAM_02 - Hàng Xanh 6")}
         {renderChart("cam_03", "CAM_03 - Đinh Bộ Lĩnh")}
         {renderChart("cam_04", "CAM_04 - Điện Biên Phủ")}
       </div>
    </div>
  );
}
