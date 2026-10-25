export type OpenMeteoCurrent = {
  source: "Open-Meteo · mô hình";
  sourceTime: string;
  intervalSeconds: number;
  temperatureC: number;
  humidityPercent: number;
  precipitationMm: number;
  rainMm: number;
  weatherCode: number;
  windSpeedKmh: number;
};

const API_URL = "https://api.open-meteo.com/v1/forecast";
const CURRENT_FIELDS = "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m";

export function openMeteoCurrentUrl() {
  const params = new URLSearchParams({
    latitude: "10.801",
    longitude: "106.714",
    current: CURRENT_FIELDS,
    timezone: "Asia/Ho_Chi_Minh",
    temperature_unit: "celsius",
  });
  return `${API_URL}?${params.toString()}`;
}

function numberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function isoOffset(seconds: number) {
  const minutes = Math.round(seconds / 60);
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

export function parseOpenMeteoCurrent(payload: any): OpenMeteoCurrent {
  const current = payload?.current;
  const offset = payload?.utc_offset_seconds;
  if (!current || typeof current.time !== "string" || !Number.isFinite(offset)) {
    throw new Error("Open-Meteo response is missing current time data");
  }
  const time = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(current.time)
    ? current.time
    : `${current.time.length === 16 ? `${current.time}:00` : current.time}${isoOffset(offset)}`;
  if (!Number.isFinite(Date.parse(time))) throw new Error("Open-Meteo returned an invalid timestamp");
  if (!numberInRange(current.interval, 60, 86400)
    || !numberInRange(current.temperature_2m, -80, 60)
    || !numberInRange(current.relative_humidity_2m, 0, 100)
    || !numberInRange(current.precipitation, 0, 1000)
    || !numberInRange(current.rain, 0, 1000)
    || !Number.isInteger(current.weather_code)
    || !numberInRange(current.wind_speed_10m, 0, 500)) {
    throw new Error("Open-Meteo response has missing or invalid current values");
  }
  return {
    source: "Open-Meteo · mô hình",
    sourceTime: time,
    intervalSeconds: current.interval,
    temperatureC: current.temperature_2m,
    humidityPercent: current.relative_humidity_2m,
    precipitationMm: current.precipitation,
    rainMm: current.rain,
    weatherCode: current.weather_code,
    windSpeedKmh: current.wind_speed_10m,
  };
}

export async function fetchOpenMeteoCurrent(fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const response = await fetcher(openMeteoCurrentUrl(), { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Open-Meteo request failed (${response.status})`);
  return parseOpenMeteoCurrent(await response.json());
}

export function describeWeatherCode(code: number) {
  if (code === 0) return "Trời quang";
  if (code === 1) return "Ít mây";
  if (code === 2) return "Mây rải rác";
  if (code === 3) return "Nhiều mây";
  if (code === 45 || code === 48) return "Có sương mù";
  if ([51, 53, 55, 56, 57].includes(code)) return "Mưa phùn";
  if ([61, 63, 65, 66, 67].includes(code)) return "Có mưa";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Có tuyết";
  if ([80, 81, 82].includes(code)) return "Mưa rào";
  if ([95, 96, 99].includes(code)) return "Dông";
  return "Chưa xác định";
}

