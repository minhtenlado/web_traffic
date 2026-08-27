/**
 * Weather Service — Open-Meteo API (Free, no API key)
 * Fetches real forecast data for ngã tư Hàng Xanh (10.8015, 106.7114)
 * and pushes to Firebase for AI model consumption.
 */
import { firebaseUpdate } from './firebase';

const HANG_XANH_LAT = 10.8015;
const HANG_XANH_LON = 106.7114;

const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${HANG_XANH_LAT}&longitude=${HANG_XANH_LON}&current=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m&hourly=rain,weather_code,temperature_2m&forecast_hours=12&timezone=Asia/Ho_Chi_Minh`;

/* WMO Weather interpretation codes → Vietnamese descriptions */
const WMO_CODES = {
  0:  { text: 'Trời quang',      icon: '☀️', isRain: false },
  1:  { text: 'Quang đãng',      icon: '🌤️', isRain: false },
  2:  { text: 'Có mây',          icon: '⛅',  isRain: false },
  3:  { text: 'U ám',            icon: '☁️', isRain: false },
  45: { text: 'Sương mù',        icon: '🌫️', isRain: false },
  48: { text: 'Sương mù đọng',   icon: '🌫️', isRain: false },
  51: { text: 'Mưa phùn nhẹ',    icon: '🌦️', isRain: true },
  53: { text: 'Mưa phùn vừa',    icon: '🌦️', isRain: true },
  55: { text: 'Mưa phùn nặng',   icon: '🌧️', isRain: true },
  61: { text: 'Mưa nhẹ',         icon: '🌧️', isRain: true },
  63: { text: 'Mưa vừa',         icon: '🌧️', isRain: true },
  65: { text: 'Mưa to',          icon: '🌧️', isRain: true },
  66: { text: 'Mưa đá nhẹ',      icon: '🌨️', isRain: true },
  67: { text: 'Mưa đá nặng',     icon: '🌨️', isRain: true },
  80: { text: 'Mưa rào nhẹ',     icon: '🌦️', isRain: true },
  81: { text: 'Mưa rào vừa',     icon: '🌧️', isRain: true },
  82: { text: 'Mưa rào to',      icon: '⛈️', isRain: true },
  95: { text: 'Giông bão',       icon: '⛈️', isRain: true },
  96: { text: 'Giông + mưa đá',  icon: '⛈️', isRain: true },
  99: { text: 'Giông mạnh',      icon: '⛈️', isRain: true },
};

function decodeWeatherCode(code) {
  return WMO_CODES[code] || { text: `Mã ${code}`, icon: '🌡️', isRain: false };
}

/**
 * Fetch current weather + 12h forecast from Open-Meteo API.
 * Returns a structured object ready for display + Firebase push.
 */
export async function fetchWeatherForecast() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
  const data = await res.json();

  const current = data.current;
  const currentDecoded = decodeWeatherCode(current.weather_code);

  // Build hourly forecast array
  const hourly = [];
  for (let i = 0; i < data.hourly.time.length; i++) {
    const decoded = decodeWeatherCode(data.hourly.weather_code[i]);
    hourly.push({
      time: data.hourly.time[i],
      hour: new Date(data.hourly.time[i]).getHours(),
      rain: data.hourly.rain[i],
      weatherCode: data.hourly.weather_code[i],
      temp: data.hourly.temperature_2m[i],
      ...decoded,
    });
  }

  // Check if rain is expected in next few hours
  const rainNext3h = hourly.slice(0, 3).some(h => h.isRain || h.rain > 0);
  const rainNext6h = hourly.slice(0, 6).some(h => h.isRain || h.rain > 0);

  const result = {
    current: {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      rain: current.rain,
      windSpeed: current.wind_speed_10m,
      weatherCode: current.weather_code,
      ...currentDecoded,
    },
    hourly,
    forecast: {
      rainNext3h,
      rainNext6h,
    },
    fetchedAt: new Date().toISOString(),
  };

  return result;
}

/**
 * Fetch weather and push to Firebase for AI model input.
 */
export async function fetchAndPushWeather() {
  const weather = await fetchWeatherForecast();

  // Push to Firebase so AI model can read it
  const firebasePayload = {
    is_raining: weather.current.isRain ? 1.0 : 0.0,
    rain_intensity: weather.current.rain,
    temperature: weather.current.temperature,
    humidity: weather.current.humidity,
    weather_code: weather.current.weatherCode,
    description: weather.current.text,
    wind_speed: weather.current.windSpeed,
    forecast_rain_3h: weather.forecast.rainNext3h ? 1 : 0,
    forecast_rain_6h: weather.forecast.rainNext6h ? 1 : 0,
    source: 'open-meteo',
    updated_at: new Date().toISOString(),
  };

  await firebaseUpdate('realtime/weather', firebasePayload);

  return weather;
}
