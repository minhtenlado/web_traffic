// Mock data generators — realistic HCMC traffic patterns at Hàng Xanh intersection
import { DIRECTIONS, CAMERAS, ALERT_TYPES } from "./constants";

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

export function trafficMultiplier(hour: number): number {
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
  return DIRECTIONS.map((d) => ({
    ...d,
    vehicleCount: Math.round(rand(50, 150) * mult),
    avgSpeed: Math.round(rand(12, 35) / mult),
    congestionLevel: mult > 2 ? "cao" : mult > 1.5 ? "trung bình" : "thấp",
  }));
}

export function generateHourlyData(days = 1) {
  const data: any[] = [];
  const now = new Date();
  for (let d = days - 1; d >= 0; d--) {
    for (let h = 0; h < 24; h++) {
      const date = new Date(now);
      date.setDate(date.getDate() - d);
      date.setHours(h, 0, 0, 0);
      const mult = trafficMultiplier(h);
      DIRECTIONS.forEach((dir) => {
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
  data.forEach((d) => {
    d.total = d.car + d.motorbike + d.bus + d.truck + d.pedestrian;
  });
  return data;
}

export function generateWeeklyHeatmap() {
  const data: [number, number, number][] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const mult = trafficMultiplier(hour);
      const weekendFactor = day >= 5 ? 0.7 : 1.0;
      const value = Math.round(rand(40, 180) * mult * weekendFactor);
      data.push([hour, day, value]);
    }
  }
  return data;
}

export function generateSignalState(currentPhaseId?: string) {
  const phases = ["phase_1", "phase_2"];
  const currentIdx = currentPhaseId ? phases.indexOf(currentPhaseId) : -1;
  const nextIdx = (currentIdx + 1) % 2;
  return {
    currentPhase: phases[nextIdx],
    mode: "auto" as const,
    countdown: 35,
    phaseDurations: { phase_1: 35, phase_2: 35 },
    cycleNumber: rand(100, 999),
  };
}

function generateAlertMessage(type: string): string {
  const msgs: Record<string, string[]> = {
    congestion: [
      "Mật độ xe vượt ngưỡng trên hướng Điện Biên Phủ",
      "Ùn tắc kéo dài trên hướng Bạch Đằng",
      "Tốc độ trung bình giảm dưới 5 km/h",
    ],
    accident: [
      "Phát hiện va chạm tại làn 2 hướng Xô Viết Nghệ Tĩnh",
      "Nghi ngờ tai nạn — xe dừng bất thường",
    ],
    camera_error: [
      "Camera 3 mất kết nối",
      "Camera 1 — tín hiệu yếu",
      "Camera 5 — hình ảnh bị nhiễu",
    ],
    signal_error: ["Đèn pha 2 không phản hồi", "Lỗi bộ điều khiển đèn"],
    weather: ["Mưa lớn giảm tầm nhìn", "Đường trơn trượt do mưa"],
  };
  return pick(msgs[type] || msgs.congestion);
}

export function generateAlerts(count = 5) {
  const types = Object.keys(ALERT_TYPES);
  const severities = ["critical", "warning", "info"] as const;
  return Array.from({ length: count }, (_, i) => {
    const type = pick(types);
    return {
      id: `alert-${Date.now()}-${i}`,
      type,
      label: ALERT_TYPES[type as keyof typeof ALERT_TYPES].label,
      color: ALERT_TYPES[type as keyof typeof ALERT_TYPES].color,
      severity: pick([...severities]),
      message: generateAlertMessage(type),
      timestamp: new Date(Date.now() - rand(0, 86400000)).toISOString(),
      acknowledged: Math.random() > 0.5,
      camera: pick(CAMERAS).name,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateAuditLog(count = 10) {
  const actions = [
    { user: "Nguyễn Văn An", role: "Vận hành viên", action: "Chuyển đèn Bạch Đằng sang thủ công" },
    { user: "Trần Thị Bình", role: "Admin", action: "Cập nhật cấu hình camera" },
    { user: "Hệ thống AI", role: "Tự động", action: "Điều chỉnh pha đèn — mật độ cao" },
    { user: "Nguyễn Thanh Nhàn", role: "Admin", action: "Đăng nhập hệ thống" },
    { user: "Nguyễn Văn An", role: "Vận hành viên", action: "Xác nhận cảnh báo ùn tắc" },
    { user: "Phạm Đức Dũng", role: "Vận hành viên", action: "Khởi động lại Camera 5" },
    { user: "Hệ thống AI", role: "Tự động", action: "Phát hiện ùn tắc hướng Hàng Xanh" },
  ];
  return Array.from({ length: count }, (_, i) => {
    const a = pick(actions);
    return {
      id: `log-${i}`,
      ...a,
      timestamp: new Date(Date.now() - rand(0, 7 * 86400000)).toISOString(),
      ip: `192.168.1.${rand(10, 200)}`,
    };
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function generateModelInfo() {
  return {
    current: {
      version: "v2.3.1",
      accuracy: 94.2,
      f1Score: 0.91,
      precision: 0.93,
      recall: 0.89,
      lastUpdated: new Date(Date.now() - 3 * 86400000).toISOString(),
      status: "active",
      framework: "TensorFlow Lite",
      type: "LSTM + CNN",
      size: "18.4 MB",
      inferenceTime: 42,
    },
    previous: {
      version: "v2.2.0",
      accuracy: 91.8,
      f1Score: 0.88,
      lastUpdated: new Date(Date.now() - 30 * 86400000).toISOString(),
      status: "archived",
    },
    history: [
      { version: "v2.3.1", accuracy: 94.2, date: new Date(Date.now() - 3 * 86400000).toISOString() },
      { version: "v2.2.0", accuracy: 91.8, date: new Date(Date.now() - 30 * 86400000).toISOString() },
      { version: "v2.1.0", accuracy: 89.5, date: new Date(Date.now() - 60 * 86400000).toISOString() },
      { version: "v2.0.0", accuracy: 87.1, date: new Date(Date.now() - 90 * 86400000).toISOString() },
      { version: "v1.9.0", accuracy: 84.3, date: new Date(Date.now() - 120 * 86400000).toISOString() },
    ],
    predictions: Array.from({ length: 20 }, (_, i) => ({
      id: i,
      timestamp: new Date(Date.now() - rand(0, 86400000)).toISOString(),
      predicted: pick(["bình thường", "đông xe", "kẹt nhẹ", "kẹt nặng"]),
      actual: pick(["bình thường", "đông xe", "kẹt nhẹ", "kẹt nặng"]),
      confidence: Number((rand(70, 99) / 100).toFixed(2)),
    })),
  };
}

export function generateUsers() {
  return [
    { id: 1, name: "Nguyễn Văn An", email: "an.nv@gtvt.gov.vn", role: "operator", status: "active", lastLogin: new Date(Date.now() - rand(0, 86400000)).toISOString() },
    { id: 2, name: "Trần Thị Bình", email: "binh.tt@gtvt.gov.vn", role: "admin", status: "active", lastLogin: new Date(Date.now() - rand(0, 172800000)).toISOString() },
    { id: 3, name: "Nguyễn Thanh Nhàn", email: "nhan.nt@gtvt.gov.vn", role: "admin", status: "active", lastLogin: new Date(Date.now() - rand(0, 3600000)).toISOString() },
    { id: 4, name: "Phạm Đức Dũng", email: "dung.pd@gtvt.gov.vn", role: "operator", status: "active", lastLogin: new Date(Date.now() - rand(0, 604800000)).toISOString() },
    { id: 5, name: "Hoàng Thị Em", email: "em.ht@gtvt.gov.vn", role: "operator", status: "inactive", lastLogin: new Date(Date.now() - 30 * 86400000).toISOString() },
  ];
}

export function generatePerRouteStats() {
  const hour = new Date().getHours();
  const mult = trafficMultiplier(hour);
  const routes = [
    { id: "bach_dang", name: "Bạch Đằng", cameras: ["Camera 3", "Camera 6"], isReference: false },
    { id: "dien_bien_phu", name: "Điện Biên Phủ", cameras: ["Camera 2", "Camera 4"], isReference: false },
    { id: "xo_viet_nghe_tinh", name: "Xô Viết Nghệ Tĩnh", cameras: ["Camera 5"], isReference: true },
    { id: "hang_xanh", name: "Hàng Xanh", cameras: ["Camera 1", "Camera 7"], isReference: false },
  ];
  return routes.map((r) => {
    const vehicleCount = Math.round(rand(100, 350) * mult);
    const density = Math.min(100, Math.round((vehicleCount / 350) * 100 * (0.8 + Math.random() * 0.4)));
    let status = "Thông thoáng";
    let statusColor = "green";
    if (density > 80) {
      status = "Kẹt xe";
      statusColor = "red";
    } else if (density > 55) {
      status = "Đông xe";
      statusColor = "amber";
    }
    return { ...r, vehicleCount, density, status, statusColor };
  });
}

export function generateAIForecast() {
  const hour = new Date().getHours();
  const directions = ["Bạch Đằng", "Điện Biên Phủ", "Xô Viết Nghệ Tĩnh", "Hàng Xanh"];
  const actual: { hour: number; total: number; perRoute: number[] }[] = [];
  for (let h = Math.max(0, hour - 5); h <= hour; h++) {
    const mult = trafficMultiplier(h);
    actual.push({
      hour: h,
      total: Math.round(rand(600, 1200) * mult),
      perRoute: directions.map(() => Math.round(rand(120, 320) * mult)),
    });
  }
  const forecast: { hour: number; total: number; perRoute: number[]; confidence: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const fh = (hour + i) % 24;
    const mult = trafficMultiplier(fh);
    const confidence = Math.max(60, 95 - i * 8 - rand(0, 5));
    forecast.push({
      hour: fh,
      total: Math.round(rand(600, 1200) * mult),
      perRoute: directions.map(() => Math.round(rand(120, 320) * mult)),
      confidence,
    });
  }
  return { actual, forecast, directions, daysLearned: rand(14, 45) };
}

export function generateSignalCorrelation() {
  const data: { hour: number; traffic: number; greenPhase1: number; greenPhase2: number }[] = [];
  for (let h = 0; h < 24; h++) {
    const mult = trafficMultiplier(h);
    const traffic = Math.round(rand(300, 800) * mult);
    const greenPhase1 = Math.round(25 + mult * rand(5, 15));
    const greenPhase2 = Math.round(25 + (3 - mult) * rand(3, 10));
    data.push({ hour: h, traffic, greenPhase1, greenPhase2 });
  }
  return data;
}

export function generateSignalRecommendations() {
  const hour = new Date().getHours();
  const mult = trafficMultiplier(hour);
  const recommendations = [
    {
      phase: "Pha 1 — Bạch Đằng & XVNT",
      currentGreen: 35,
      suggestedGreen: mult > 2 ? 45 : mult > 1.5 ? 40 : 35,
      reason:
        mult > 2
          ? "Lưu lượng hướng Bạch Đằng tăng 35% so với trung bình tuần"
          : mult > 1.5
            ? "Mật độ xe trung bình — giữ thời lượng ổn định"
            : "Lưu lượng thấp — giữ chu kỳ mặc định",
      confidence: rand(82, 96),
    },
    {
      phase: "Pha 2 — Điện Biên Phủ & Hàng Xanh",
      currentGreen: 35,
      suggestedGreen: mult > 2 ? 40 : mult > 1.5 ? 38 : 35,
      reason:
        mult > 2
          ? "Lưu lượng ĐBP tăng 28%, cần gia hạn đèn xanh"
          : mult > 1.5
            ? "Tuyến ĐBP ổn định — điều chỉnh nhẹ"
            : "Lưu lượng đêm — giữ chu kỳ mặc định",
      confidence: rand(78, 94),
    },
  ];
  return {
    recommendations,
    lastAdjusted: new Date(Date.now() - rand(1800000, 7200000)).toISOString(),
    nextReview: new Date(Date.now() + rand(900000, 3600000)).toISOString(),
    policy: "Chu kỳ ổn định — điều chỉnh tối đa 2 lần/giờ",
  };
}

export function generateWeather() {
  const isRaining = Math.random() > 0.7;
  return {
    is_raining: isRaining,
    temperature: rand(26, 34),
    humidity: rand(60, 92),
    rain_intensity: isRaining ? rand(1, 12) : 0,
    wind_speed: rand(5, 25),
    timestamp: new Date().toISOString(),
  };
}

// Real-time camera status generator (simulates Firebase realtime data)
export function generateRealtimeCams() {
  const labels = ["Duong_vang", "Binh_thuong", "Dong_xe", "Sap_ket", "Ket_xe"];
  const hour = new Date().getHours();
  const mult = trafficMultiplier(hour);
  const cams: Record<string, any> = {};
  CAMERAS.forEach((cam) => {
    const isError = Math.random() < 0.05;
    // Higher traffic multiplier → more chance of congestion
    const labelIdx = Math.min(
      labels.length - 1,
      Math.floor(Math.random() * (1 + mult) + Math.max(0, mult - 1)),
    );
    cams[cam.id] = {
      status: isError ? "ERROR" : "ONLINE",
      mapped_label: isError ? null : labels[labelIdx],
      count: isError ? 0 : Math.round(rand(20, 80) * mult),
      error_message: isError ? "Mất kết nối thiết bị" : null,
      timestamp: new Date().toLocaleString("vi-VN", { hour12: false }),
    };
  });
  return cams;
}

export function generateHealthMetrics() {
  return {
    cpu: rand(18, 62),
    ram: rand(40, 78),
    temperature: rand(42, 68),
    networkLatency: rand(12, 45),
    diskUsage: rand(35, 65),
    uptime: rand(99, 100) + Math.random() * 0.9,
    fps: rand(28, 32),
  };
}
