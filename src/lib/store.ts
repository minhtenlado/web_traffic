"use client";

import { create } from "zustand";

import { firebaseListen, firebaseUpdate, firebaseGet } from "./firebase";

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

  _firebaseInitialized: boolean;
  initFirebase: () => void;
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

  _firebaseInitialized: false,
  initFirebase: () => {
    if (get()._firebaseInitialized) return;
    set({ _firebaseInitialized: true });

    firebaseGet("chart_data/latest/history").then(historyData => {
      if (historyData) {
        let sortedHistory = [];
        if (Array.isArray(historyData)) {
           sortedHistory = historyData.filter(d => d && d.time).sort((a, b) => a.time.localeCompare(b.time));
        } else {
           sortedHistory = Object.values(historyData).filter(d => d && d.time).sort((a, b) => (a as any).time.localeCompare((b as any).time));
        }
        set({ chartHistory: sortedHistory.slice(-60) });
      }
    }).catch(console.error);

        firebaseGet("chart_data/latest/predictions").then(predData => {
      if (predData && predData.actual && predData.forecast) {
        set({ aiForecast: predData });
      }
    }).catch(console.error);



    
    firebaseListen("realtime", (data) => {
      if (!data) return;
      const routes = buildRouteStats(data);
      const totalVehicles = routes.reduce((sum, r) => sum + r.vehicleCount, 0);
      const avgDensity = routes.length ? Math.round(routes.reduce((s, r) => s + r.density, 0) / routes.length) : 0;
      
      const sev: Record<string, number> = { Duong_vang: 0, Binh_thuong: 1, Dong_xe: 2, Sap_ket: 3, Ket_xe: 4 };
      const autoAlerts: AlertItem[] = [];
      for (const [camId, camData] of Object.entries(data)) {
        if (camId === 'weather' || camId === 'timestamp') continue;
        const cd = camData as any;
        if (cd.status === "ERROR" || cd.error_message) {
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
      CAMERAS.slice(0, 4).forEach((c) => {
        chartPoint[c.id] = sev[(data as any)[c.id]?.mapped_label] || 0;
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
        const newChartHistory = [...state.chartHistory, chartPoint].slice(-60);
        
        return {
          realtimeCams: data,
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
    });

    firebaseListen("traffic/signalState", (data) => {
      if (data) set({ signalState: data });
    });
    
    firebaseListen("system/hardware", (data) => {
      if (data) {
        set({
          healthMetrics: {
            cpu: data.cpu_usage || 0,
            ram: data.ram_percent || 0,
            temperature: data.cpu_temp || 0,
            networkLatency: Math.floor(Math.random() * 20) + 15,
            diskUsage: data.disk_usage || 45,
            uptime: data.uptime_percent || 99.9,
            fps: data.camera_fps || 24
          }
        });
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
        newSignal = { ...gen, mode: "auto", phaseDurations: signal.phaseDurations };
        fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(console.error);
      } else {
        newSignal.countdown = signal.phaseDurations[signal.currentPhase as "phase_1" | "phase_2"];
      }
    } else {
      newSignal.countdown = newCountdown;
    }

    const tickCount = state._tickCount + 1;
    const isOffline = Date.now() - state.lastRealtimeUpdate > 30000;

    set({
      signalState: newSignal,
      isBoardOffline: isOffline,
      _tickCount: tickCount,
    });
  },


  setSignalMode: (mode) => {
    const newSignal = { ...get().signalState, mode };
    fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(console.error);
    set({ signalState: newSignal });
  },
  setSignalDuration: (phase, duration) => {
    const newSignal = {
      ...get().signalState,
      phaseDurations: { ...get().signalState.phaseDurations, [phase]: duration },
    };
    fetch('/api/signal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSignal) }).catch(console.error);
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
