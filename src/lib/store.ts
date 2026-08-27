"use client";

import { create } from "zustand";

import { initUnifiedFirebase, firebaseUpdate, firebaseGet } from "./firebase";

import {
  CAMERAS,
  SIGNAL_PHASES,
  labelToDensity,
  pickWorstLabel,
  TRAFFIC_LABELS,
  type TrafficLabelKey,
} from "./constants";
import {
  generateRealtimeCams,
  generateSignalState,
  generateWeather,
  generateHealthMetrics,
  generateAlerts,
  generateAuditLog,
  generateSignalRecommendations,
  generateAIForecast,
  generateModelInfo,
  generateUsers,
  trafficMultiplier,
} from "./mockData";

/* Camera → Route mapping at Hàng Xanh intersection */
const CAM_TO_ROUTE: Record<string, string> = {
  cam_01: "hang_xanh",
  cam_02: "dien_bien_phu",
  cam_03: "bach_dang",
  cam_04: "dien_bien_phu",
  cam_05: "xo_viet_nghe_tinh",
  cam_06: "hang_xanh",
  cam_07: "bach_dang",
};

const ROUTE_META: Record<string, { name: string; cameras: string[]; isReference: boolean }> = {
  bach_dang: { name: "Bạch Đằng", cameras: ["Camera 3", "Camera 7"], isReference: false },
  dien_bien_phu: { name: "Điện Biên Phủ", cameras: ["Camera 2", "Camera 4"], isReference: false },
  xo_viet_nghe_tinh: { name: "Xô Viết Nghệ Tĩnh", cameras: ["Camera 5"], isReference: true },
  hang_xanh: { name: "Hàng Xanh", cameras: ["Camera 1", "Camera 6"], isReference: false },
};

function labelToStatus(mappedLabel?: string | null) {
  const entry = mappedLabel ? TRAFFIC_LABELS[mappedLabel as TrafficLabelKey] : null;
  if (!entry) return { status: "—", statusColor: "green" as const };
  return { status: entry.text, statusColor: entry.cls as "green" | "amber" | "red" };
}

function buildRouteStats(realtimeData: Record<string, any>) {
  const routeAcc: Record<string, { totalCount: number; labels: string[]; timestamps: string[] }> = {};
  for (const [camId, camData] of Object.entries(realtimeData)) {
    if (['cam_05', 'cam_06', 'cam_07'].includes(camId)) continue;
    if (!camData || typeof camData !== 'object') continue;
    
    const routeId = CAM_TO_ROUTE[camId];
    if (!routeId) continue;
    if (!routeAcc[routeId]) routeAcc[routeId] = { totalCount: 0, labels: [], timestamps: [] };
    routeAcc[routeId].totalCount += camData.count || 0;
    if (camData.mapped_label) routeAcc[routeId].labels.push(camData.mapped_label);
    if (camData.timestamp) routeAcc[routeId].timestamps.push(camData.timestamp);
  }
  return Object.entries(ROUTE_META).map(([routeId, meta]) => {
    const acc = routeAcc[routeId];
    const vehicleCount = acc ? acc.totalCount : 0;
    const worstLabel = acc && acc.labels.length ? pickWorstLabel(acc.labels) : "Duong_vang";
    const { status, statusColor } = labelToStatus(worstLabel);
    const density = labelToDensity(worstLabel);
    return {
      id: routeId,
      ...meta,
      vehicleCount,
      density,
      status,
      statusColor,
    };
  });
}

export type RouteStat = ReturnType<typeof buildRouteStats>[number];
export type AlertItem = ReturnType<typeof generateAlerts>[number];
export type AuditItem = ReturnType<typeof generateAuditLog>[number];
export type UserItem = ReturnType<typeof generateUsers>[number];

export type SectionId =
  | "dashboard"
  | "camera"
  | "analytics"
  | "signal"
  | "model"
  | "alerts"
  | "audit"
  | "admin"
  | "profile"
  | "health";

interface TrafficState {
  // Real-time data
  realtimeCams: Record<string, any> | null;
  weather: ReturnType<typeof generateWeather> | null;
  routeStats: RouteStat[];
  metrics: { totalVehicles: number; avgSpeed: number; avgWaitTime: number; activeAlerts: number };
  signalState: ReturnType<typeof generateSignalState> & { mode: "auto" | "manual" };
  alerts: AlertItem[];
  auditLog: AuditItem[];
  users: UserItem[];
  healthMetrics: ReturnType<typeof generateHealthMetrics> | null;
  signalRec: ReturnType<typeof generateSignalRecommendations>;
  aiForecast: ReturnType<typeof generateAIForecast>;
  modelInfo: ReturnType<typeof generateModelInfo>;

  // Chart history
  chartHistory: { time: string; [camId: string]: number | string }[];

  // UI state
  activeSection: SectionId;
  sidebarOpen: boolean;
  theme: "dark" | "light";

  // Auth
  user: { id: string; username: string; fullName: string; role: "admin" | "operator"; email: string } | null;
  isAuthenticated: boolean;

  // Actions
  setActiveSection: (s: SectionId) => void;
  toggleSidebar: () => void;
  setTheme: (t: "dark" | "light") => void;
  toggleTheme: () => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  tick: () => void;
  setSignalMode: (mode: "auto" | "manual") => void;
  setSignalDuration: (phase: string, duration: number) => void;
  setSignalPhase: (phase: string) => void;
  adjustSignalCountdown: (delta: number) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: () => void;
  refreshRealtime: () => void;
  isBoardOffline: boolean;
  lastRealtimeUpdate: number;
  _tickCount: number;

  _firebaseInitialized: boolean;
  initFirebase: () => void;
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const u = localStorage.getItem("auth_user");
    if (!u) return null;
    const parsed = JSON.parse(u);
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem("auth_user");
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as "dark" | "light") || "dark";
}

export const useTrafficStore = create<TrafficState>((set, get) => ({
  realtimeCams: null,
  weather: null,
  routeStats: [],
  metrics: { totalVehicles: 0, avgSpeed: 0, avgWaitTime: 0, activeAlerts: 0 },
  signalState: { currentPhase: "phase_1", mode: "auto", countdown: 35, phaseDurations: { phase_1: 35, phase_2: 35 }, cycleNumber: 1 },
  alerts: generateAlerts(6),
  auditLog: generateAuditLog(12),
  users: generateUsers(),
  healthMetrics: null,
  signalRec: generateSignalRecommendations(),
  aiForecast: generateAIForecast(),
  modelInfo: generateModelInfo(),
  chartHistory: [],
  activeSection: "dashboard",
  sidebarOpen: true,
  theme: "dark",
  user: null,
  isAuthenticated: false,
  isBoardOffline: false,
  lastRealtimeUpdate: Date.now(),
  _tickCount: 0,

  _firebaseInitialized: false,
  initFirebase: () => {
    if (get()._firebaseInitialized) return;
    set({ _firebaseInitialized: true });

    // Process helper for realtime camera data
    const processRealtimeData = (data: any) => {
      if (!data || typeof data !== 'object') return;
      
      const currentCams = get().realtimeCams || {};
      const mergedData = { ...currentCams, ...data };
      
      const routes = buildRouteStats(mergedData);
      const totalVehicles = routes.reduce((sum, r) => sum + r.vehicleCount, 0);
      const avgDensity = routes.length ? Math.round(routes.reduce((s, r) => s + r.density, 0) / routes.length) : 0;
      
      const sev: Record<string, number> = { Duong_vang: 0, Binh_thuong: 1, Dong_xe: 2, Sap_ket: 3, Ket_xe: 4 };
      const autoAlerts: AlertItem[] = [];
      for (const [camId, camData] of Object.entries(mergedData)) {
        if (['cam_05', 'cam_06', 'cam_07', 'weather', 'timestamp', 'test_board'].includes(camId)) continue;
        const cd = camData as any;
        if (!cd || typeof cd !== 'object') continue;
        if (cd.status === "ERROR" || (cd.error_message && cd.error_message !== "OK" && cd.error_message !== "None")) {
          autoAlerts.push({
            id: `alert-${camId}-err-${Date.now()}`,
            type: "camera_error",
            label: "Camera lỗi",
            color: "amber",
            severity: "warning",
            message: `Mất kết nối / Lỗi ${camId}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            camera: camId,
          });
        }
        if (cd.mapped_label === "Ket_xe" || cd.mapped_label === "Sap_ket") {
          autoAlerts.push({
            id: `alert-${camId}-cong-${Date.now()}`,
            type: "congestion",
            label: "Ùn tắc",
            color: "red",
            severity: "critical",
            message: `Mật độ xe cao tại ${CAM_TO_ROUTE[camId] || camId}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            camera: camId,
          });
        }
      }
      
      const ts = new Date().toLocaleTimeString("vi-VN", { hour12: false });
      const chartPoint: { time: string; [k: string]: number | string } = { time: ts };
      CAMERAS.filter(c => !['cam_05', 'cam_06', 'cam_07'].includes(c.id)).forEach((c) => {
        chartPoint[c.id] = sev[(mergedData as any)[c.id]?.mapped_label] || 0;
      });
      
      const p1Density = (routes.find(r => r.id === 'bach_dang')?.density || 0) + (routes.find(r => r.id === 'hang_xanh')?.density || 0);
      const p2Density = (routes.find(r => r.id === 'xo_viet_nghe_tinh')?.density || 0) + (routes.find(r => r.id === 'dien_bien_phu')?.density || 0);

      let policy = 'Cân bằng luồng';
      let recs = [];
      if (p1Density > p2Density + 30) {
        policy = 'Ưu tiên Pha 1';
        recs = [
          { phase: 'Pha 1 (Bạch Đằng - Hàng Xanh)', currentGreen: 35, suggestedGreen: 45, confidence: 92, reason: 'Mật độ Pha 1 cao bất thường' },
          { phase: 'Pha 2 (ĐBP - XVNT)', currentGreen: 35, suggestedGreen: 25, confidence: 88, reason: 'Giảm thời gian để bù cho Pha 1' }
        ];
      } else if (p2Density > p1Density + 30) {
        policy = 'Ưu tiên Pha 2';
        recs = [
          { phase: 'Pha 1 (Bạch Đằng - Hàng Xanh)', currentGreen: 35, suggestedGreen: 25, confidence: 89, reason: 'Giảm thời gian do đường vắng' },
          { phase: 'Pha 2 (ĐBP - XVNT)', currentGreen: 35, suggestedGreen: 45, confidence: 94, reason: 'Mật độ Pha 2 tăng cao' }
        ];
      } else {
        recs = [
          { phase: 'Pha 1 (Bạch Đằng - Hàng Xanh)', currentGreen: 35, suggestedGreen: 35, confidence: 95, reason: 'Mật độ 2 pha tương đối đồng đều' },
          { phase: 'Pha 2 (ĐBP - XVNT)', currentGreen: 35, suggestedGreen: 35, confidence: 95, reason: 'Duy trì chu kỳ hiện tại' }
        ];
      }

      const newSignalRec = {
        policy,
        lastAdjusted: new Date().toISOString(),
        nextReview: new Date(Date.now() + 5 * 60000).toISOString(),
        recommendations: recs,
      };

      set(state => {
        const newAlerts = [...autoAlerts, ...state.alerts.filter((a) => a.acknowledged).slice(0, 20)].slice(0, 30);
        const newChartHistory = [...(state.chartHistory || []), chartPoint].slice(-60);
        
        // Inject reference cameras status so they show as online
        const enrichedData = { ...mergedData };
        ['cam_05', 'cam_06', 'cam_07'].forEach(c => {
           if (!enrichedData[c]) {
             enrichedData[c] = { status: "ONLINE", name: CAM_TO_ROUTE[c] || c };
           }
        });

        return {
          realtimeCams: enrichedData,
          routeStats: routes,
          alerts: newAlerts,
          chartHistory: newChartHistory,
          signalRec: newSignalRec as any,
          lastRealtimeUpdate: Date.now(),
          isBoardOffline: false,
          metrics: {
            ...state.metrics,
            totalVehicles,
            activeAlerts: newAlerts.length,
            avgWaitTime: avgDensity > 70 ? 45 : avgDensity > 40 ? 30 : 15,
          }
        };
      });
    };

    // Process helper for chart_data
    const processChartData = (data: any) => {
      if (!data) return;
      let history = Array.isArray(data.history) ? data.history : Object.values(data.history || {});
      let predictionsRaw = data.predictions || {};
      let predictions: any[] = [];
      if (Array.isArray(predictionsRaw)) {
        predictions = predictionsRaw;
      } else {
        predictions = Object.keys(predictionsRaw)
          .filter(k => k !== 'latest')
          .sort((a, b) => Number(a) - Number(b))
          .map(k => predictionsRaw[k]);
      }
      
      history = history.filter(Boolean);
      predictions = predictions.filter(Boolean);

      const mapToTotal = (point: any) => {
        let sum = 0;
        const perRoute: number[] = [];
        ['cam_01', 'cam_02', 'cam_03', 'cam_04'].forEach(c => {
          const val = Number(point[c]) || 0;
          sum += val * 100;
          perRoute.push(val * 100);
        });
        return { hour: point.time ? String(point.time).substring(0, 5) : '00:00', total: sum, perRoute };
      };

      const actualArr = history.slice(-30).map(mapToTotal);
      const forecastArr = predictions.map((p: any, idx: number) => {
        const mapped = mapToTotal(p);
        return { ...mapped, confidence: Math.max(50, 95 - (idx * 0.2)) };
      });

      const directionsArr = ["Hàng Xanh 3", "Hàng Xanh 6", "Đinh Bộ Lĩnh", "Điện Biên Phủ"];

      set((state) => ({
        aiForecast: {
          ...state.aiForecast,
          actual: actualArr,
          forecast: forecastArr,
          directions: directionsArr,
          daysLearned: 14,
          rawHistory: history,
          rawPredictions: predictions
        }
      }));
    };

    // Process helper for hardware metrics
    const processHardwareData = (data: any) => {
      if (!data) return;
      set((state) => ({
        healthMetrics: {
          ...(state.healthMetrics || {}),
          cpu: Number(data.cpu_usage) || 0,
          ram: Number(data.ram_percent) || 0,
          temperature: Number(data.cpu_temp) || 0,
          networkLatency: Number(data.latency) || 15,
          fps: Number(data.camera_fps) || 24,
          diskUsage: state.healthMetrics?.diskUsage || 45,
          uptime: state.healthMetrics?.uptime || 99.9,
        } as any
      }));
    };

    // Process helper for system status
    const processStatusData = (data: any) => {
      if (!data) return;
      set((state) => ({
        healthMetrics: {
          ...(state.healthMetrics || {}),
          diskUsage: data.buffer_max ? (data.buffer_fill / data.buffer_max) * 100 : 45,
          uptime: data.uptime_seconds ? (data.uptime_seconds / 3600) : 99.9,
          cpu: state.healthMetrics?.cpu || 0,
          ram: state.healthMetrics?.ram || 0,
          temperature: state.healthMetrics?.temperature || 0,
          networkLatency: state.healthMetrics?.networkLatency || 15,
          fps: state.healthMetrics?.fps || 24
        } as any,
        isBoardOffline: data.online === false
      }));
    };

    // Initialize single root SSE listener
    initUnifiedFirebase((path: string, data: any) => {
      if (!data) return;

      if (path === '/') {
        if (data.realtime) processRealtimeData(data.realtime);
        if (data.chart_data?.latest) processChartData(data.chart_data.latest);
        if (data.system?.hardware) processHardwareData(data.system.hardware);
        if (data.system?.status) processStatusData(data.system.status);
        if (data.traffic?.signalState) {
          const cur = get().signalState;
          if (cur.mode !== "manual" || data.traffic.signalState.mode === "manual") {
            set({ signalState: { ...cur, ...data.traffic.signalState } });
          }
        }
        if (data.realtime?.weather) {
          set((s) => ({
            weather: {
              ...s.weather,
              is_raining: Boolean(data.realtime.weather.is_raining),
              rain_intensity: Number(data.realtime.weather.rain_intensity) || 0,
              temperature: Number(data.realtime.weather.temperature) || 0,
              humidity: Number(data.realtime.weather.humidity) || 0,
              wind_speed: Number(data.realtime.weather.wind_speed) || 12
            } as any
          }));
        }
      } else if (path.startsWith('/realtime')) {
        if (path === '/realtime') {
          processRealtimeData(data);
        } else if (path.startsWith('/realtime/cam_')) {
          const camId = path.split('/')[2];
          processRealtimeData({ [camId]: data });
        } else if (path === '/realtime/weather') {
          set((s) => ({
            weather: {
              ...s.weather,
              is_raining: Boolean(data.is_raining),
              rain_intensity: Number(data.rain_intensity) || 0,
              temperature: Number(data.temperature) || 0,
              humidity: Number(data.humidity) || 0,
              wind_speed: Number(data.wind_speed) || 12
            } as any
          }));
        }
      } else if (path.startsWith('/chart_data')) {
        if (path === '/chart_data/latest' || path.startsWith('/chart_data/latest/')) {
          processChartData(data);
        }
      } else if (path.startsWith('/system')) {
        if (path.includes('hardware')) processHardwareData(data);
        if (path.includes('status')) processStatusData(data);
      } else if (path.startsWith('/traffic/signalState')) {
        const cur = get().signalState;
        if (cur.mode !== "manual" || data.mode === "manual") {
          set({ signalState: { ...cur, ...data } });
        }
      }
    });
  },

  setActiveSection: (s) => set({ activeSection: s }),
  toggleSidebar: () => set((st) => ({ sidebarOpen: !st.sidebarOpen })),
  setTheme: (t) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    }
    set({ theme: t });
  },
  toggleTheme: () => {
    const cur = get().theme;
    get().setTheme(cur === "dark" ? "light" : "dark");
  },

  login: (username, password) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        const u = username.trim();
        const p = password.trim();
        if (u === "admin" && p === "admin") {
          const userData = {
            id: "U01",
            username: "admin",
            fullName: "Nguyễn Thanh Nhàn",
            role: "admin" as const,
            email: "nhan.nt@gtvt.gov.vn",
            loginAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          };
          localStorage.setItem("auth_user", JSON.stringify(userData));
          set({ user: userData, isAuthenticated: true });
          resolve();
        } else if (u === "staff" && p === "staff") {
          const userData = {
            id: "U02",
            username: "staff",
            fullName: "Trần Văn Vận Hành",
            role: "operator" as const,
            email: "staff.tv@gtvt.gov.vn",
            loginAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          };
          localStorage.setItem("auth_user", JSON.stringify(userData));
          set({ user: userData, isAuthenticated: true });
          resolve();
        } else {
          reject(new Error("Tài khoản hoặc mật khẩu không chính xác"));
        }
      }, 500);
    }),

  logout: () => {
    localStorage.removeItem("auth_user");
    set({ user: null, isAuthenticated: false });
  },

  tick: () => {
    const state = get();
    const signal = state.signalState;
    let newSignal = { ...signal };
    const newCountdown = signal.countdown - 1;
    if (newCountdown <= 0) {
      const phases = ["phase_1", "phase_2", "phase_3"];
      const currIdx = phases.indexOf(signal.currentPhase);
      const nextPhase = phases[(currIdx + 1) % phases.length];
      const defaultDurations = { phase_1: 35, phase_2: 35, phase_3: 20, ...(signal.phaseDurations || {}) };
      const nextDuration = defaultDurations[nextPhase as keyof typeof defaultDurations] || 35;
      
      newSignal = {
        ...signal,
        currentPhase: nextPhase,
        countdown: nextDuration,
        phaseDurations: defaultDurations,
        cycleNumber: nextPhase === "phase_1" ? (signal.cycleNumber || 100) + 1 : (signal.cycleNumber || 100),
      };
      
      firebaseUpdate("traffic/signalState", newSignal).catch(() => {});
      fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(() => {});
    } else {
      newSignal.countdown = newCountdown;
    }

    const tickCount = state._tickCount + 1;
    const isOffline = Date.now() - state.lastRealtimeUpdate > 60000;

    set({
      signalState: newSignal,
      isBoardOffline: isOffline,
      _tickCount: tickCount,
    });
  },

  setSignalMode: (mode) => {
    const newSignal = { ...get().signalState, mode };
    firebaseUpdate("traffic/signalState", newSignal).catch(() => {});
    fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(() => {});
    set({ signalState: newSignal });
  },

  setSignalDuration: (phase, duration) => {
    const current = get().signalState;
    const isCurrentPhase = current.currentPhase === phase;
    const newDurations = { ...current.phaseDurations, [phase]: duration };
    const newSignal = {
      ...current,
      phaseDurations: newDurations,
      countdown: isCurrentPhase ? duration : current.countdown,
    };
    firebaseUpdate("traffic/signalState", newSignal).catch(() => {});
    fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(() => {});
    set({ signalState: newSignal });
  },

  setSignalPhase: (phaseId) => {
    const current = get().signalState;
    const defaultDurations = { phase_1: 35, phase_2: 35, phase_3: 20, ...(current.phaseDurations || {}) };
    const dur = defaultDurations[phaseId as keyof typeof defaultDurations] || 35;
    const newSignal = {
      ...current,
      currentPhase: phaseId,
      countdown: dur,
      phaseDurations: defaultDurations,
    };
    firebaseUpdate("traffic/signalState", newSignal).catch(() => {});
    fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(() => {});
    set({ signalState: newSignal });
  },

  adjustSignalCountdown: (delta) => {
    const current = get().signalState;
    const newCountdown = Math.max(5, current.countdown + delta);
    const newSignal = { ...current, countdown: newCountdown };
    firebaseUpdate("traffic/signalState", newSignal).catch(() => {});
    fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(() => {});
    set({ signalState: newSignal });
  },
  acknowledgeAlert: (id) =>
    set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) })),
  acknowledgeAllAlerts: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acknowledged: true })) })),
  refreshRealtime: async () => {
    try {
      const data = await firebaseGet("realtime");
      if (data) {
        set((s) => ({
          realtimeCams: data,
          routeStats: buildRouteStats(data),
          lastRealtimeUpdate: Date.now(),
          isBoardOffline: false,
        }));
      }
    } catch (e) {
      console.error(e);
    }
  },
}));
