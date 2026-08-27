import { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Clock, Camera, AlertCircle, Loader } from 'lucide-react';
import useStore from '../../stores/trafficStore';
import { CAMERAS, INTERSECTION_CENTER, SIGNAL_PHASES } from '../../utils/constants';
import CameraFeed from '../../components/CameraFeed/CameraFeed';
import TrafficLightMarker from '../../components/TrafficLightMarker/TrafficLightMarker';
import '../../components/TrafficLightMarker/TrafficLightMarker.css';
import 'leaflet/dist/leaflet.css';
import './Dashboard.css';

/* Camera metadata for display */
const CAM_INFO = {
  cam_01: { name: 'Camera 1', location: 'Cầu Thị Nghè - Hàng Xanh' },
  cam_02: { name: 'Camera 2', location: 'Cầu Điện Biên Phủ - Hàng Xanh' },
  cam_03: { name: 'Camera 3', location: 'Đinh Bộ Lĩnh - Bạch Đằng' },
  cam_04: { name: 'Camera 4', location: 'Điện Biên Phủ - Nguyễn Gia Trí' },
  cam_05: { name: 'Camera 5', location: 'Viện Máy tính (XVNT)' },
  cam_06: { name: 'Camera 6', location: 'Hàng Xanh - Bạch Đằng' },
  cam_07: { name: 'Camera 7', location: 'Hàng Xanh - Cầu Văn Thánh' },
};

/* Convert Firebase label to Vietnamese + emoji + css class */
function labelDisplay(mappedLabel) {
  switch (mappedLabel) {
    case 'Duong_vang':  return { text: 'Đường vắng',   emoji: '🟢', cls: 'status-green' };
    case 'Binh_thuong': return { text: 'Bình thường',   emoji: '🟢', cls: 'status-green' };
    case 'Dong_xe':     return { text: 'Đông xe',       emoji: '🟠', cls: 'status-amber' };
    case 'Sap_ket':     return { text: 'Sắp kẹt',       emoji: '🟠', cls: 'status-amber' };
    case 'Ket_xe':      return { text: 'Kẹt xe',        emoji: '🔴', cls: 'status-red' };
    default:            return { text: mappedLabel || '—', emoji: '⚪', cls: 'status-green' };
  }
}

/* Custom camera icon for map markers */
function createCameraIcon(camLabel) {
  return L.divIcon({
    className: 'camera-map-icon',
    html: `
      <div class="cam-marker">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
          <circle cx="12" cy="13" r="3"/>
        </svg>
        <span class="cam-marker-label">${camLabel}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const TRAFFIC_LIGHT_POSITIONS = [
  { id: 'bach_dang',          name: 'Bạch Đằng',         position: [10.80211, 106.71124] },
  { id: 'dien_bien_phu',     name: 'Điện Biên Phủ',     position: [10.80134, 106.71097] },
  { id: 'xo_viet_nghe_tinh', name: 'Xô Viết Nghệ Tĩnh', position: [10.80083, 106.71138] },
  { id: 'hang_xanh',         name: 'Hàng Xanh',         position: [10.80166, 106.71170] },
];

function getLightState(dirId, signalState) {
  const currentPhase = SIGNAL_PHASES.find(p => p.id === signalState.currentPhase);
  const isActive = currentPhase?.directions?.includes(dirId);
  if (isActive) {
    if (signalState.countdown > 3) {
      return { color: 'green', countdown: signalState.countdown - 3 };
    }
    return { color: 'yellow', countdown: signalState.countdown };
  }
  return { color: 'red', countdown: signalState.countdown };
}

export default function Dashboard() {
  const theme = useStore(s => s.theme);
  const signalState = useStore(s => s.signalState);
  const realtimeCams = useStore(s => s.realtimeCams);
  const predictionSummary = useStore(s => s.predictionSummary);
  const routeStats = useStore(s => s.routeStats);
  const isBoardOffline = useStore(s => s.isBoardOffline);

  const firebaseWeather = realtimeCams?.weather;

  /* Pre-create icons to avoid re-renders */
  const cameraIcons = useMemo(() =>
    CAMERAS.map((cam, i) => createCameraIcon(i + 1)),
  []);

  return (
    <div className="dashboard">

      {/* ── REAL-TIME CAMERA STATUS FROM FIREBASE ── */}
      <div className="card realtime-panel">
        <div className="card-header">
          <span>📡 Trạng thái Camera — Realtime từ Firebase</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
            {firebaseWeather && (
              <span className={`weather-badge ${firebaseWeather.is_raining ? 'raining' : 'clear'}`}>
                {firebaseWeather.is_raining ? '🌧️ Đang mưa' : '☀️ Không mưa'} — {firebaseWeather.temperature}°C
              </span>
            )}
            {realtimeCams && <span className="live-badge">● LIVE</span>}
          </div>
        </div>

        {!realtimeCams ? (
          <div className="realtime-loading">
            <div className="spinner" />
            <span>Đang kết nối Firebase…</span>
          </div>
        ) : (
          <div className="cam-status-grid">
            {Object.entries(realtimeCams)
              .filter(([camId]) => ['cam_01', 'cam_02', 'cam_03', 'cam_04', 'cam_05', 'cam_06', 'cam_07'].includes(camId))
              .map(([camId, camData]) => {
              const info = CAM_INFO[camId] || { name: camId, location: '' };
              const isError = isBoardOffline || camData.status === 'ERROR' || camData.status === 'OFFLINE';
              const { text, emoji, cls } = isError
                  ? { text: 'MẤT KẾT NỐI', emoji: '⚠️', cls: 'status-red' }
                  : labelDisplay(camData.mapped_label);
                  
              let prediction = predictionSummary?.status_summary?.[camId];
              if (isError) {
                  prediction = isBoardOffline ? 'Lỗi: Bo mạch đang offline' : `Lỗi: ${camData.error_message?.slice(0, 25) || 'Mất kết nối'}`;
              }

              return (
                <div className={`cam-status-card ${cls}`} key={camId}>
                  <div className="cam-status-top">
                    <span className="cam-status-name">{info.name}</span>
                    <span className={`cam-status-badge ${cls}`}>{emoji} {text}</span>
                  </div>
                  <div className="cam-status-location">{info.location}</div>
                  <div className="cam-status-details">
                    <div className="cam-detail">
                      <span className="cam-detail-label">Số xe đếm được</span>
                      <span className="cam-detail-value">{isError ? '⚠️' : camData.count}</span>
                    </div>
                    <div className="cam-detail">
                      <span className="cam-detail-label">Cập nhật</span>
                      <span className="cam-detail-value cam-time">{camData.timestamp?.split(' ')[1] || '—'}</span>
                    </div>
                  </div>
                  {prediction && (
                    <div className="cam-prediction">
                      <span className="cam-detail-label">AI dự đoán</span>
                      <span className="cam-prediction-text">{prediction}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ROUTE SUMMARY (computed from realtime cams) ── */}
      <div className="route-summary-bar">
        {routeStats.map(route => (
          <div className={`route-summary-item status-${route.statusColor}`} key={route.id}>
            <span className="route-name">{route.name}</span>
            <span className={`route-badge badge-${route.statusColor}`}>{route.status}</span>
            <span className="route-count">{route.vehicleCount} xe</span>
          </div>
        ))}
      </div>


      {/* ── WEATHER FORECAST (Firebase — real data) ── */}
      {firebaseWeather && (
        <div className="card weather-panel">
          <div className="card-header">
            <span>🌤️ Thời tiết hiện tại — Ngã tư Hàng Xanh</span>
            <span className="weather-source">Dữ liệu từ Firebase Realtime</span>
          </div>
          <div className="weather-content">
            {/* Current weather */}
            <div className="weather-current">
              <div className="weather-current-icon">{firebaseWeather.is_raining ? '🌧️' : '☀️'}</div>
              <div className="weather-current-info">
                <div className="weather-temp">{firebaseWeather.temperature}°C</div>
                <div className="weather-desc">
                  {firebaseWeather.is_raining ? 'Đang mưa' : 'Không mưa'}
                </div>
              </div>
              <div className="weather-details-grid">
                <div className="weather-detail-item">
                  <span className="weather-detail-label">💧 Độ ẩm</span>
                  <span className="weather-detail-val">{firebaseWeather.humidity}%</span>
                </div>
                <div className="weather-detail-item">
                  <span className="weather-detail-label">🌧️ Lượng mưa</span>
                  <span className="weather-detail-val">{firebaseWeather.rain_intensity} mm</span>
                </div>
                <div className="weather-detail-item">
                  <span className="weather-detail-label">💨 Gió</span>
                  <span className="weather-detail-val">{firebaseWeather.wind_speed} km/h</span>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Map — full width, Hàng Xanh centered ── */}
      <div className="card map-card">
        <div className="card-header">Bản đồ ngã tư Hàng Xanh</div>
        <div className="map-container">
          <MapContainer center={INTERSECTION_CENTER} zoom={20} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <TileLayer
              key={theme}
              url={theme === 'light' 
                ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"}
              attribution='&copy; OpenStreetMap'
            />
            {CAMERAS.map((cam, i) => (
              <Marker key={cam.id} position={cam.position} icon={cameraIcons[i]}>
                <Popup className="live-cam-popup" minWidth={480}>
                  <div className="popup-video-container">
                    <CameraFeed url={cam.url} name={cam.name} mini={false} />
                  </div>
                </Popup>
              </Marker>
            ))}
            {TRAFFIC_LIGHT_POSITIONS.map(tl => {
              const light = getLightState(tl.id, signalState);
              return (
                <TrafficLightMarker
                  key={tl.id}
                  position={tl.position}
                  color={light.color}
                  countdown={light.countdown}
                  directionName={tl.name}
                />
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
