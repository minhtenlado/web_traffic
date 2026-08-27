"use client";

import { create } from "zustand";
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
  cam_06: "bach_dang",
  cam_07: "hang_xanh",
};

const ROUTE_META: Record<string, { name: string; cameras: string[]; isReference: boolean }> = {
  bach_dang: { name: "Bạch Đằng", cameras: ["Camera 3", "Camera 6"], isReference: false },
  dien_bien_phu: { name: "Điện Biên Phủ", cameras: ["Camera 2", "Camera 4"], isReference: false },
  xo_viet_nghe_tinh: { name: "Xô Viết Nghệ Tĩnh", cameras: ["Camera 5"], isReference: true },
  hang_xanh: { name: "Hàng Xanh", cameras: ["Camera 1", "Camera 7"], isReference: false },
};

function labelToStatus(mappedLabel?: string | null) {
  const entry = mappedLabel ? TRAFFIC_LABELS[mappedLabel as TrafficLabelKey] : null;
  if (!entry) return { status: "—", statusColor: "green" as const };
  return { status: entry.text, statusColor: entry.cls as "green" | "amber" | "red" };
}

function buildRouteStats(realtimeData: Record<string, any>) {
  const routeAcc: Record<string, { totalCount: number; labels: string[]; timestamps: string[] }> = {};
  for (const [camId, camData] of Object.entries(realtimeData)) {
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
  setSignalDuration: (phase: "phase_1" | "phase_2", duration: number) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: () => void;
  refreshRealtime: () => void;
  isBoardOffline: boolean;
  lastRealtimeUpdate: number;
  _tickCount: number;
}

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const u = localStorage.getItem("auth_user");
    return u ? JSON.parse(u) : null;
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
        if (username === "admin" && password === "admin") {
          const userData = { id: "U01", username: "admin", fullName: "Nguyễn Thanh Nhàn", role: "admin" as const, email: "nhan.nt@gtvt.gov.vn" };
          localStorage.setItem("auth_user", JSON.stringify(userData));
          set({ user: userData, isAuthenticated: true });
          resolve();
        } else if (username === "staff" && password === "staff") {
          const userData = { id: "U02", username: "staff", fullName: "Trần Văn Vận Hành", role: "operator" as const, email: "staff.tv@gtvt.gov.vn" };
          localStorage.setItem("auth_user", JSON.stringify(userData));
          set({ user: userData, isAuthenticated: true });
          resolve();
        } else {
          reject(new Error("Tài khoản hoặc mật khẩu không chính xác"));
        }
      }, 600);
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
      if (signal.mode === "auto") {
        const nextPhase = signal.currentPhase === "phase_1" ? "phase_2" : "phase_1";
        const gen = generateSignalState(nextPhase);
        newSignal = { ...gen, mode: "auto" };
      } else {
        newSignal.countdown = signal.phaseDurations[signal.currentPhase as "phase_1" | "phase_2"];
      }
    } else {
      newSignal.countdown = newCountdown;
    }

    // Refresh realtime data every 5 ticks (5s)
    let newRealtime = state.realtimeCams;
    let newWeather = state.weather;
    let newHealth = state.healthMetrics;
    let newAlerts = state.alerts;
    let newRoutes = state.routeStats;
    let newMetrics = state.metrics;
    let newChartHistory = state.chartHistory;
    const tickCount = state._tickCount + 1;
    const isOffline = Date.now() - state.lastRealtimeUpdate > 30000;

    if (tickCount % 5 === 0) {
      newRealtime = generateRealtimeCams();
      newWeather = generateWeather();
      newHealth = generateHealthMetrics();
      newRoutes = buildRouteStats(newRealtime);
      const totalVehicles = newRoutes.reduce((s, r) => s + r.vehicleCount, 0);
      const avgDensity = newRoutes.length ? Math.round(newRoutes.reduce((s, r) => s + r.density, 0) / newRoutes.length) : 0;

      // Auto-generate alerts
      const sev: Record<string, number> = { Duong_vang: 0, Binh_thuong: 1, Dong_xe: 2, Sap_ket: 3, Ket_xe: 4 };
      const autoAlerts: AlertItem[] = [];
      for (const [camId, camData] of Object.entries(newRealtime)) {
        const cd = camData as any;
        if (cd.status === "ERROR") {
          autoAlerts.push({
            id: `alert-${camId}-err-${Date.now()}`,
            type: "camera_error",
            label: "Camera lỗi",
            color: "amber",
            severity: "warning",
            message: `Mất kết nối ${camId}`,
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
      // Keep existing acknowledged alerts + new auto alerts (cap 30)
      newAlerts = [...autoAlerts, ...state.alerts.filter((a) => a.acknowledged).slice(0, 20)].slice(0, 30);

      const ts = new Date().toLocaleTimeString("vi-VN", { hour12: false });
      const chartPoint: { time: string; [k: string]: number | string } = { time: ts };
      CAMERAS.slice(0, 4).forEach((c) => {
        chartPoint[c.id] = sev[(newRealtime as any)[c.id]?.mapped_label] || 0;
      });
      newChartHistory = [...state.chartHistory, chartPoint].slice(-30);

      newMetrics = {
        totalVehicles,
        avgSpeed: Math.round(rand(15, 35) / Math.max(1, trafficMultiplier(new Date().getHours()))),
        avgWaitTime: avgDensity > 70 ? 45 : avgDensity > 40 ? 30 : 15,
        activeAlerts: autoAlerts.length,
      };
    }

    set({
      signalState: newSignal,
      realtimeCams: newRealtime,
      weather: newWeather,
      healthMetrics: newHealth,
      alerts: newAlerts,
      routeStats: newRoutes,
      metrics: newMetrics,
      chartHistory: newChartHistory,
      isBoardOffline: isOffline,
      lastRealtimeUpdate: tickCount % 5 === 0 ? Date.now() : state.lastRealtimeUpdate,
      _tickCount: tickCount,
    });
  },

  setSignalMode: (mode) => set((s) => ({ signalState: { ...s.signalState, mode } })),
  setSignalDuration: (phase, duration) =>
    set((s) => ({
      signalState: {
        ...s.signalState,
        phaseDurations: { ...s.signalState.phaseDurations, [phase]: duration },
      },
    })),
  acknowledgeAlert: (id) =>
    set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) })),
  acknowledgeAllAlerts: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acknowledged: true })) })),
  refreshRealtime: () => {
    const data = generateRealtimeCams();
    set((s) => ({
      realtimeCams: data,
      weather: generateWeather(),
      healthMetrics: generateHealthMetrics(),
      routeStats: buildRouteStats(data),
      lastRealtimeUpdate: Date.now(),
      isBoardOffline: false,
    }));
  },
}));

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Initialize store on client mount
export function initStore() {
  const store = useTrafficStore;
  // Initialize realtime data if empty
  if (!store.getState().realtimeCams) {
    const data = generateRealtimeCams();
    store.setState({
      realtimeCams: data,
      weather: generateWeather(),
      healthMetrics: generateHealthMetrics(),
      routeStats: buildRouteStats(data),
      user: getStoredUser(),
      isAuthenticated: !!getStoredUser(),
      theme: getStoredTheme(),
    });
  }
}
