import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

/**
 * Traffic light colors and glow effects matching SignalControl diagram.
 */
const LIGHT_COLORS = {
  red:    { active: '#ef4444', glow: 'rgba(239, 68, 68, 0.8)', dim: '#3b1111' },
  yellow: { active: '#eab308', glow: 'rgba(234, 179, 8, 0.8)',  dim: '#3b3311' },
  green:  { active: '#22c55e', glow: 'rgba(34, 197, 94, 0.8)',  dim: '#113b1e' },
};

function createTrafficLightIcon(color, countdown) {
  const c = LIGHT_COLORS;
  const r = color === 'red'    ? c.red.active    : c.red.dim;
  const y = color === 'yellow' ? c.yellow.active : c.yellow.dim;
  const g = color === 'green'  ? c.green.active  : c.green.dim;

  const rGlow = color === 'red'    ? `0 0 8px ${c.red.glow}, 0 0 16px ${c.red.glow}`    : 'none';
  const yGlow = color === 'yellow' ? `0 0 8px ${c.yellow.glow}, 0 0 16px ${c.yellow.glow}` : 'none';
  const gGlow = color === 'green'  ? `0 0 8px ${c.green.glow}, 0 0 16px ${c.green.glow}`  : 'none';

  const countdownColor = color === 'red' ? c.red.active : color === 'yellow' ? c.yellow.active : c.green.active;

  const html = `
    <div class="map-traffic-light-wrapper">
      <div class="map-traffic-light-body">
        <div class="map-tl-bulb" style="background:${r}; box-shadow:${rGlow};"></div>
        <div class="map-tl-bulb" style="background:${y}; box-shadow:${yGlow};"></div>
        <div class="map-tl-bulb" style="background:${g}; box-shadow:${gGlow};"></div>
      </div>
      <div class="map-tl-countdown" style="color:${countdownColor};">${countdown}</div>
    </div>
  `;

  return L.divIcon({
    className: 'map-traffic-light-icon',
    html,
    iconSize: [32, 60],
    iconAnchor: [16, 30],
    popupAnchor: [0, -30],
  });
}

export default function TrafficLightMarker({ position, color, countdown, directionName }) {
  const icon = useMemo(
    () => createTrafficLightIcon(color, countdown),
    [color, countdown],
  );

  return (
    <Marker position={position} icon={icon} zIndexOffset={1000}>
      <Tooltip
        direction="top"
        offset={[0, -35]}
        className="tl-tooltip"
        permanent={false}
      >
        <strong>{directionName}</strong>
        <br />
        {color === 'green' ? '🟢 Xanh' : color === 'yellow' ? '🟡 Vàng' : '🔴 Đỏ'} — {countdown}s
      </Tooltip>
    </Marker>
  );
}
