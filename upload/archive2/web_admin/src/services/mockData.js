import { DIRECTIONS, VEHICLE_TYPES, CAMERAS, ALERT_TYPES } from '../utils/constants';

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

function trafficMultiplier(hour) {
  if (hour >= 7 && hour <= 9) return 2.5;
  if (hour >= 11 && hour <= 13) return 1.8;
  if (hour >= 17 && hour <= 19) return 2.8;
  if (hour >= 22 || hour <= 5) return 0.3;
  return 1;
}

export function generateCurrentMetrics() {
  const hour = new Date().getHours();
  const mult = trafficMultiplier(hour);
  return {
    totalVehicles: Math.round(rand(200, 400) * mult),
    avgSpeed: Math.round(rand(15, 40) / mult),
    avgWaitTime: Math.round(rand(20, 60) * mult),
    activeAlerts: rand(0, 5),
  };
}

export function generateDirectionMetrics() {
  const hour = new Date().getHours();
  const mult = trafficMultiplier(hour);
  return DIRECTIONS.map(d => ({
    ...d,
    vehicleCount: Math.round(rand(50, 150) * mult),
    avgSpeed: Math.round(rand(12, 35) / mult),
    congestionLevel: mult > 2 ? 'cao' : mult > 1.5 ? 'trung bình' : 'thấp',
  }));
}

export function generateHourlyData(days = 1) {
  const data = [];
  const now = new Date();
  for (let d = days - 1; d >= 0; d--) {
    for (let h = 0; h < 24; h++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(h, 0, 0, 0);
      const mult = trafficMultiplier(h);
      DIRECTIONS.forEach(dir => {
        data.push({
          timestamp: date.toISOString(),
          hour: h,
          direction: dir.id,
          directionName: dir.name,
          car: Math.round(rand(20, 80) * mult),
          motorbike: Math.round(rand(80, 200) * mult),
          bus: Math.round(rand(2, 15) * mult),
          truck: Math.round(rand(5, 20) * mult),
          pedestrian: Math.round(rand(10, 40) * mult),
          total: 0,
        });
      });
    }
  }
  data.forEach(d => { d.total = d.car + d.motorbike + d.bus + d.truck + d.pedestrian; });
  return data;
}

export function generateHeatmapData() {
  const data = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const mult = trafficMultiplier(hour);
      data.push([hour, day, Math.round(rand(50, 200) * mult)]);
    }
  }
  return data;
}

export function generateSignalState(currentPhaseId) {
  const phases = ['phase_1', 'phase_2'];
  const currentIdx = currentPhaseId ? phases.indexOf(currentPhaseId) : -1;
  const nextIdx = (currentIdx + 1) % 2;
  return {
    currentPhase: phases[nextIdx],
    mode: 'auto',
    countdown: 35,
    phaseDurations: { phase_1: 35, phase_2: 35 },
    cycleNumber: currentIdx === 1 ? rand(100, 999) : rand(100, 999),
  };
}

export function generateAlerts(count = 4) {
  const types = Object.keys(ALERT_TYPES);
  const severities = ['critical', 'warning', 'info'];
  return Array.from({ length: count }, (_, i) => {
    const type = pick(types);
    return {
      id: `alert-${Date.now()}-${i}`,
      type,
      label: ALERT_TYPES[type].label,
      color: ALERT_TYPES[type].color,
      severity: pick(severities),
      message: generateAlertMessage(type),
      timestamp: new Date(Date.now() - rand(0, 86400000)).toISOString(),
      acknowledged: Math.random() > 0.5,
      camera: pick(CAMERAS).name,
    };
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function generateAlertMessage(type) {
  const msgs = {
    congestion: ['Mật độ xe vượt ngưỡng trên hướng Điện Biên Phủ', 'Ùn tắc kéo dài trên hướng Bạch Đằng', 'Tốc độ trung bình giảm dưới 5 km/h'],
    accident: ['Phát hiện va chạm tại làn 2 hướng Xô Viết Nghệ Tĩnh', 'Nghi ngờ tai nạn – xe dừng bất thường'],
    camera_error: ['Camera 3 mất kết nối', 'Camera 1 – tín hiệu yếu', 'Camera 5 – hình ảnh bị nhiễu'],
    signal_error: ['Đèn pha 2 không phản hồi', 'Lỗi bộ điều khiển đèn'],
  };
  return pick(msgs[type] || msgs.congestion);
}

export function generateAuditLog(count = 8) {
  const actions = [
    { user: 'Nguyễn Văn An', role: 'Vận hành viên', action: 'Chuyển đèn Bạch Đằng sang thủ công' },
    { user: 'Trần Thị Bình', role: 'Admin', action: 'Cập nhật cấu hình camera' },
    { user: 'Hệ thống AI', role: 'Tự động', action: 'Điều chỉnh pha đèn – mật độ cao' },
    { user: 'Nguyễn Thanh Nhàn', role: 'Admin', action: 'Đăng nhập hệ thống' },
    { user: 'Nguyễn Văn An', role: 'Vận hành viên', action: 'Xác nhận cảnh báo ùn tắc' },
  ];
  return Array.from({ length: count }, (_, i) => {
    const a = pick(actions);
    return {
      id: `log-${i}`,
      ...a,
      timestamp: new Date(Date.now() - rand(0, 7 * 86400000)).toISOString(),
      ip: `192.168.1.${rand(10, 200)}`,
    };
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function generateModelInfo() {
  return {
    current: {
      version: 'v2.3.1',
      accuracy: 94.2,
      f1Score: 0.91,
      lastUpdated: new Date(Date.now() - 3 * 86400000).toISOString(),
      status: 'active',
      framework: 'TensorFlow Lite',
      type: 'LSTM + CNN',
    },
    previous: {
      version: 'v2.2.0',
      accuracy: 91.8,
      f1Score: 0.88,
      lastUpdated: new Date(Date.now() - 30 * 86400000).toISOString(),
      status: 'archived',
    },
    predictions: Array.from({ length: 20 }, (_, i) => ({
      id: i,
      timestamp: new Date(Date.now() - rand(0, 86400000)).toISOString(),
      predicted: pick(['bình thường', 'đông xe', 'kẹt nhẹ', 'kẹt nặng']),
      actual: pick(['bình thường', 'đông xe', 'kẹt nhẹ', 'kẹt nặng']),
      confidence: (rand(70, 99) / 100).toFixed(2),
    })),
  };
}

export function generateUsers() {
  return [
    { id: 1, name: 'Nguyễn Văn An', email: 'an.nv@gtvt.gov.vn', role: 'operator', status: 'active', lastLogin: new Date(Date.now() - rand(0, 86400000)).toISOString() },
    { id: 2, name: 'Trần Thị Bình', email: 'binh.tt@gtvt.gov.vn', role: 'admin', status: 'active', lastLogin: new Date(Date.now() - rand(0, 172800000)).toISOString() },
    { id: 3, name: 'Nguyễn Thanh Nhàn', email: 'nhan.nt@gtvt.gov.vn', role: 'admin', status: 'active', lastLogin: new Date(Date.now() - rand(0, 3600000)).toISOString() },
    { id: 4, name: 'Phạm Đức Dũng', email: 'dung.pd@gtvt.gov.vn', role: 'operator', status: 'active', lastLogin: new Date(Date.now() - rand(0, 604800000)).toISOString() },
    { id: 5, name: 'Hoàng Thị Em', email: 'em.ht@gtvt.gov.vn', role: 'operator', status: 'inactive', lastLogin: new Date(Date.now() - 30 * 86400000).toISOString() },
  ];
}

/* ===== ANALYTICS V2 — Data generators for the upgraded Analytics page ===== */

/**
 * Per-route real-time stats for each direction at Hàng Xanh intersection.
 * Camera 3 (Viện Máy tính) is marked as reference camera for the roundabout.
 */
export function generatePerRouteStats() {
  const hour = new Date().getHours();
  const mult = trafficMultiplier(hour);
  const routes = [
    { id: 'bach_dang', name: 'Bạch Đằng', cameras: ['Camera 1', 'Camera 2'], isReference: false },
    { id: 'dien_bien_phu', name: 'Điện Biên Phủ', cameras: ['Camera 5', 'Camera 6'], isReference: false },
    { id: 'xo_viet_nghe_tinh', name: 'Xô Viết Nghệ Tĩnh', cameras: ['Camera 3'], isReference: true },
    { id: 'hang_xanh', name: 'Hàng Xanh', cameras: ['Camera 4', 'Camera 7'], isReference: false },
  ];
  return routes.map(r => {
    const vehicleCount = Math.round(rand(100, 350) * mult);
    const density = Math.min(100, Math.round((vehicleCount / 350) * 100 * (0.8 + Math.random() * 0.4)));
    let status = 'Thông thoáng';
    let statusColor = 'green';
    if (density > 80) { status = 'Kẹt xe'; statusColor = 'red'; }
    else if (density > 55) { status = 'Đông xe'; statusColor = 'amber'; }
    return { ...r, vehicleCount, density, status, statusColor };
  });
}

/**
 * Weekly heatmap data: 7 days × 24 hours, returns array of [hour, dayIndex, value]
 * Realistic patterns: high during rush hours (7-9, 17-19), low at night.
 */
export function generateWeeklyHeatmap() {
  const data = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const mult = trafficMultiplier(hour);
      // Weekends are slightly lower
      const weekendFactor = day >= 5 ? 0.7 : 1.0;
      const value = Math.round(rand(40, 180) * mult * weekendFactor);
      data.push([hour, day, value]);
    }
  }
  return data;
}

/**
 * AI Forecast: actual data for past hours + forecast for next 3 hours per route.
 * Returns { actual: [{hour, values}], forecast: [{hour, values, confidence}], daysLearned }
 */
export function generateAIForecast() {
  const hour = new Date().getHours();
  const directions = ['Bạch Đằng', 'Điện Biên Phủ', 'Xô Viết Nghệ Tĩnh', 'Hàng Xanh'];
  
  // Past 6 hours of actual data
  const actual = [];
  for (let h = Math.max(0, hour - 5); h <= hour; h++) {
    const mult = trafficMultiplier(h);
    actual.push({
      hour: h,
      total: Math.round(rand(600, 1200) * mult),
      perRoute: directions.map(d => Math.round(rand(120, 320) * mult)),
    });
  }
  
  // Forecast next 3 hours
  const forecast = [];
  for (let i = 1; i <= 3; i++) {
    const fh = (hour + i) % 24;
    const mult = trafficMultiplier(fh);
    const confidence = Math.max(60, 95 - i * 8 - rand(0, 5));
    forecast.push({
      hour: fh,
      total: Math.round(rand(600, 1200) * mult),
      perRoute: directions.map(d => Math.round(rand(120, 320) * mult)),
      confidence,
    });
  }
  
  return { actual, forecast, directions, daysLearned: rand(14, 45) };
}

/**
 * Signal-to-traffic correlation: hourly data showing traffic volume vs green duration.
 */
export function generateSignalCorrelation() {
  const data = [];
  for (let h = 0; h < 24; h++) {
    const mult = trafficMultiplier(h);
    const traffic = Math.round(rand(300, 800) * mult);
    // Green duration adapts to traffic — higher traffic = longer green on busier phase
    const greenPhase1 = Math.round(25 + mult * rand(5, 15));
    const greenPhase2 = Math.round(25 + (3 - mult) * rand(3, 10));
    data.push({ hour: h, traffic, greenPhase1, greenPhase2 });
  }
  return data;
}

/**
 * AI recommendations for signal timing — stable adjustments, not per-tick reactions.
 */
export function generateSignalRecommendations() {
  const hour = new Date().getHours();
  const mult = trafficMultiplier(hour);
  const recommendations = [
    {
      phase: 'Pha 1 – Bạch Đằng & XVNT',
      currentGreen: 35,
      suggestedGreen: mult > 2 ? 45 : mult > 1.5 ? 40 : 35,
      reason: mult > 2
        ? 'Lưu lượng hướng Bạch Đằng tăng 35% so với trung bình tuần'
        : mult > 1.5
          ? 'Mật độ xe trung bình — giữ thời lượng ổn định'
          : 'Lưu lượng thấp — giữ chu kỳ mặc định',
      confidence: rand(82, 96),
    },
    {
      phase: 'Pha 2 – Điện Biên Phủ & Hàng Xanh',
      currentGreen: 35,
      suggestedGreen: mult > 2 ? 40 : mult > 1.5 ? 38 : 35,
      reason: mult > 2
        ? 'Lưu lượng ĐBP tăng 28%, cần gia hạn đèn xanh'
        : mult > 1.5
          ? 'Tuyến ĐBP ổn định — điều chỉnh nhẹ'
          : 'Lưu lượng đêm — giữ chu kỳ mặc định',
      confidence: rand(78, 94),
    },
  ];
  return {
    recommendations,
    lastAdjusted: new Date(Date.now() - rand(1800000, 7200000)).toISOString(), // 30min to 2h ago
    nextReview: new Date(Date.now() + rand(900000, 3600000)).toISOString(), // 15min to 1h from now
    policy: 'Chu kỳ ổn định — điều chỉnh tối đa 2 lần/giờ',
  };
}
