"use client";

import { useEffect, useState } from "react";
import { CloudRain, Sun } from "lucide-react";
import { SectionCard, StatusBadge } from "@/components/shared/ui";
import { describeWeatherCode, fetchOpenMeteoCurrent, type OpenMeteoCurrent } from "@/lib/open-meteo";

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];

export function CurrentWeatherCard({
  title = "Thời tiết tại Hàng Xanh",
  subtitle = "Open-Meteo · ước tính mô hình khu vực, không phải trạm đo tại chỗ",
}: { title?: string; subtitle?: string }) {
  const [weather, setWeather] = useState<OpenMeteoCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const refresh = async () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const result = await fetchOpenMeteoCurrent(fetch, request.signal);
        if (active) { setWeather(result); setError(false); setLoading(false); }
      } catch {
        if (active && !request.signal.aborted) { setError(true); setLoading(false); }
      }
    };
    void refresh();
    const intervalId = window.setInterval(() => { void refresh(); }, 5 * 60 * 1000);
    return () => { active = false; controller?.abort(); window.clearInterval(intervalId); };
  }, []);

  const sourceEpoch = weather ? Date.parse(weather.sourceTime) / 1000 : NaN;
  const ageSeconds = Number.isFinite(sourceEpoch) ? Date.now() / 1000 - sourceEpoch : null;
  const available = Boolean(weather) && ageSeconds !== null && ageSeconds >= 0 && ageSeconds <= 3600;
  const raining = weather ? weather.rainMm > 0 || RAIN_CODES.includes(weather.weatherCode) : false;
  const rainRate = weather ? weather.rainMm * 3600 / weather.intervalSeconds : null;
  const ageText = ageSeconds === null ? "chưa rõ thời điểm" : ageSeconds < 60 ? `${Math.floor(ageSeconds)} giây trước` : `${Math.floor(ageSeconds / 60)} phút trước`;

  return <SectionCard title={title} subtitle={subtitle} icon={raining ? CloudRain : Sun}>
    {!available ? <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
      {loading ? "Đang lấy dữ liệu thời tiết từ Open-Meteo…" : weather ? "Bản tin Open-Meteo đã quá cũ." : error ? "Không lấy được dữ liệu thời tiết từ Open-Meteo." : "Chưa có dữ liệu thời tiết."}
    </div> : <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Điều kiện hiện tại</p><p className="mt-1 text-2xl font-semibold">{describeWeatherCode(weather!.weatherCode)}</p></div>
        {error && <StatusBadge color="amber">Đang hiển thị bản tin gần nhất</StatusBadge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3 sm:grid-cols-3">
        <WeatherMetric label="Nhiệt độ · 2 m" value={`${weather!.temperatureC.toFixed(1)} °C`} />
        <WeatherMetric label="Độ ẩm · 2 m" value={`${weather!.humidityPercent.toFixed(0)}%`} />
        <WeatherMetric label="Mưa quy đổi" value={`${rainRate!.toFixed(2)} mm/giờ`} />
        <WeatherMetric label={`Lượng mưa / ${Math.round(weather!.intervalSeconds / 60)} phút`} value={`${weather!.precipitationMm.toFixed(2)} mm`} />
        <WeatherMetric label="Gió · 10 m" value={`${weather!.windSpeedKmh.toFixed(1)} km/h`} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Bản tin lúc {new Date(weather!.sourceTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · {ageText} · cập nhật mỗi 5 phút · <a className="underline underline-offset-2" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></p>
    </>}
  </SectionCard>;
}

function WeatherMetric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-medium tabular-nums" title={value}>{value}</p></div>;
}
