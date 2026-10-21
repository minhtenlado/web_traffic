"use client";

import { create } from "zustand";
import { isControllerSignal, sendControllerCommand,
  type ControllerSignal, type ControllerStatus, type CommandResult, type TimingKey } from "./controller";

import { initUnifiedFirebase, firebaseGet } from "./firebase";

import {
  CAMERAS,
  labelToDensity,
  pickWorstLabel,
  TRAFFIC_LABELS,
  type TrafficLabelKey,
} from "./constants";
import {
  generateWeather,
  generateHealthMetrics,
  generateAlerts,
  generateAuditLog,
  generateSignalRecommendations,
  generateAIForecast,
  generateModelInfo,
  generateUsers,
  generateDevices,
} from "./mockData";

/* Camera → Route mapping at Hàng Xanh intersection */
let stopRealtime: (() => void) | null = null;

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
export type DeviceItem = ReturnType<typeof generateDevices>[number];

export type SectionId =
  | "dashboard"
  | "camera"
  | "analytics"
  | "signal"
  | "model"
  | "alerts"
  | "audit"
  | "admin"
  | "devices"
  | "profile"
  | "health";

interface TrafficState {
  // Real-time data
  realtimeCams: Record<string, any> | null;
  weather: ReturnType<typeof generateWeather> | null;
  routeStats: RouteStat[];
  metrics: { totalVehicles: number; avgSpeed: number; avgWaitTime: number; activeAlerts: number };
  signalState: ControllerSignal;
  controllerStatus: ControllerStatus | null;
  commandResult: CommandResult | null;
  modelStatus: { buffer_fill?: number; buffer_max?: number; missing_model_inputs?: string[] } | null;
  isBoardOffline: boolean;
  lastRealtimeUpdate: number;
  alerts: AlertItem[];
  auditLog: AuditItem[];
  users: UserItem[];
  devices: DeviceItem[];
  healthMetrics: ReturnType<typeof generateHealthMetrics> | null;
  signalRec: ReturnType<typeof generateSignalRecommendations>;
  aiForecast: Omit<ReturnType<typeof generateAIForecast>, "actual" | "forecast"> & {
    actual: { hour: string | number; total: number; perRoute: number[] }[];
    forecast: { hour: string | number; total: number; perRoute: number[]; confidence: number }[];
    rawHistory?: any[]; rawPredictions?: any[];
  };
  modelInfo: ReturnType<typeof generateModelInfo>;

  // Mamdani Fuzzy Adaptive Control state
  fuzzyStatus: {
    demandA: number;
    demandB: number;
    leftDemandA?: number;
    leftDemandB?: number;
    situation: "NORMAL" | "BOTH_HEAVY" | "A_HEAVY" | "B_HEAVY";
    greenStraightA: number;
    greenStraightB: number;
    greenLeftA: number;
    greenLeftB: number;
    yellowTime?: number;
    isSimulation?: boolean;
    timestamp?: number;
    dataValid?: boolean;
    validUntil?: number;
  } | null;

  // Chart history
  chartHistory: { time: string; [camId: string]: number | string }[];

  // UI state
  activeSection: SectionId;
  sidebarOpen: boolean;
  theme: "dark" | "light";
  selectedArea: string;

  // Auth
  user: { id: string; username: string; fullName: string; role: "admin" | "operator"; email: string } | null;
  isAuthenticated: boolean;

  // Actions
  setActiveSection: (s: SectionId) => void;
  toggleSidebar: () => void;
  setTheme: (t: "dark" | "light") => void;
  toggleTheme: () => void;
  setSelectedArea: (area: string) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  tick: () => void;
  setSignalMode: (mode: "auto" | "manual") => Promise<string>;
  setSignalDuration: (phase: TimingKey, duration: number) => Promise<string>;
  nextSignalPhase: () => Promise<string>;
  emergencyStop: () => Promise<string>;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: () => void;
  addDevice: (device: DeviceItem) => void;
  updateDevice: (id: string, updates: Partial<DeviceItem>) => void;
  deleteDevice: (id: string) => void;
  addUser: (user: UserItem) => void;
  updateUser: (id: number, updates: Partial<UserItem>) => void;
  deleteUser: (id: number) => void;
  refreshRealtime: () => void;
  _tickCount: number;

  _firebaseInitialized: boolean;
  initFirebase: () => void;
}

function getStoredUser() { return null; }

function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as "dark" | "light") || "dark";
}

export const useTrafficStore = create<TrafficState>((set, get) => ({
  realtimeCams: null,
  weather: null,
  routeStats: buildRouteStats({}),
  metrics: { totalVehicles: 0, avgSpeed: 0, avgWaitTime: 0, activeAlerts: 0 },
  signalState: {
    source: "STM32", currentPhase: "unknown", mode: "auto", hold: false,
    countdown: 0, phaseDurations: { green: 30, yellow: 3, left: 10, allred: 2 }, timestamp: 0,
  },
  controllerStatus: null,
  commandResult: null,
  modelStatus: null,
  fuzzyStatus: null,
  alerts: [],
  auditLog: generateAuditLog(12),
  users: generateUsers(),
  devices: generateDevices(),
  healthMetrics: null,
  signalRec: generateSignalRecommendations(),
  aiForecast: { actual: [], forecast: [], directions: [], daysLearned: 0, rawHistory: [], rawPredictions: [] },
  modelInfo: generateModelInfo(),
  chartHistory: [],
  activeSection: "dashboard",
  sidebarOpen: true,
  theme: "dark",
  selectedArea: "hang-xanh",
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
            id: `alert-${camId}-err`,
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
            id: `alert-${camId}-cong`,
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
      let recs: ReturnType<typeof generateSignalRecommendations>["recommendations"] = [];
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
        const newAlerts = [...autoAlerts, ...state.alerts.filter(a => !autoAlerts.some(newA => newA.id === a.id))].slice(0, 50);
        const newChartHistory = [...(state.chartHistory || []), chartPoint].slice(-60);
        
        // Inject reference cameras status so they show as online
        const enrichedData = { ...mergedData };
        ['cam_05', 'cam_06', 'cam_07'].forEach(c => {
           if (!enrichedData[c]) {
             enrichedData[c] = { status: "ONLINE", name: CAM_TO_ROUTE[c] || c };
           }
        });

        // Determine if data has actually changed (e.g. board pushing new count/timestamp)
        // By checking if the new payload stringifies to the exact same as the old state
        const oldStateStr = JSON.stringify(state.realtimeCams || {});
        const newStateStr = JSON.stringify(enrichedData);
        const isDataChanged = oldStateStr !== newStateStr;
        
        const newUpdateTimestamp = isDataChanged ? Date.now() : (state.lastRealtimeUpdate || Date.now());

        return {
          realtimeCams: enrichedData,
          routeStats: routes,
          alerts: newAlerts,
          chartHistory: newChartHistory,
          signalRec: newSignalRec as any,
          lastRealtimeUpdate: newUpdateTimestamp,
          // Only force it online if data changed. If it didn't change, let the tick loop mark it offline when it expires.
          isBoardOffline: isDataChanged ? false : state.isBoardOffline,
          metrics: {
            ...state.metrics,
            totalVehicles,
            activeAlerts: newAlerts.filter(a => !a.acknowledged).length,
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
          networkLatency: Number(data.latency) || 0,
          fps: Number(data.camera_fps) || 0,
          diskUsage: Number(data.disk_percent) || 0,
          uptime: state.healthMetrics?.uptime || 0,
        } as any
      }));
    };

    // Process helper for system status
    const processStatusData = (data: any) => {
      if (!data) return;
      set({modelStatus:data});
      set((state) => ({
        healthMetrics: {
          ...(state.healthMetrics || {}),
          diskUsage: state.healthMetrics?.diskUsage || 0,
          uptime: data.uptime_seconds ? (data.uptime_seconds / 3600) : 99.9,
          cpu: state.healthMetrics?.cpu || 0,
          ram: state.healthMetrics?.ram || 0,
          temperature: state.healthMetrics?.temperature || 0,
          networkLatency: state.healthMetrics?.networkLatency || 0,
          fps: state.healthMetrics?.fps || 0
        } as any,
        isBoardOffline: data.online === false
      }));
    };

    // Initialize single root SSE listener
    stopRealtime = initUnifiedFirebase((path: string, data: any) => {
      if (!data) return;

      if (path === '/') {
        if (data.realtime) processRealtimeData(data.realtime);
        if (data.chart_data?.latest) processChartData(data.chart_data.latest);
        if (data.system?.hardware) processHardwareData(data.system.hardware);
        if (data.system?.status) processStatusData(data.system.status);
        if (isControllerSignal(data.traffic?.signalState)) set({ signalState: data.traffic.signalState });
        if (data.traffic?.controllerStatus) set({ controllerStatus: data.traffic.controllerStatus });
        if (data.traffic?.commandResult) set({ commandResult: data.traffic.commandResult });
        if (data.traffic?.fuzzyStatus) set({ fuzzyStatus: data.traffic.fuzzyStatus });
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
      } else if (path === '/traffic/signalState') {
        if (isControllerSignal(data)) set({ signalState: data });
      } else if (path === '/traffic/controllerStatus') {
        set({ controllerStatus: data });
      } else if (path === '/traffic/commandResult') {
        set({ commandResult: data });
      } else if (path.startsWith('/traffic/fuzzyStatus')) {
        set({ fuzzyStatus: data });
      }
    });
  },

  setActiveSection: (s) => set({ activeSection: s }),
  toggleSidebar: () => set((st) => ({ sidebarOpen: !st.sidebarOpen })),
  setSelectedArea: (area) => set({ selectedArea: area }),
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

  login: async (username, password) => {
    const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Đăng nhập thất bại');
    set({ user: data.user, isAuthenticated: true });
    get().initFirebase();
  },
  logout: () => {
    fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
    stopRealtime?.(); stopRealtime = null;
    set({ user: null, isAuthenticated: false, _firebaseInitialized: false, controllerStatus: null });
  },

  tick: () => {
    // Keep STM32 telemetry intact. No browser-generated phase transitions.
    const state = get();
    set({ isBoardOffline: Date.now() - state.lastRealtimeUpdate > 300000,
          _tickCount: state._tickCount + 1 });
  },
  setSignalMode: (mode) => sendControllerCommand({ action: "set_mode", mode }),
  setSignalDuration: (phase, duration) => sendControllerCommand({ action: "set_duration", phase, duration }),
  nextSignalPhase: () => sendControllerCommand({ action: "next" }),
  emergencyStop: () => sendControllerCommand({ action: "emergency" }),
  acknowledgeAlert: (id) =>
    set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) })),
  acknowledgeAllAlerts: () => set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acknowledged: true })) })),
  addDevice: (device) => set((s) => ({ devices: [device, ...s.devices] })),
  updateDevice: (id, updates) => set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, ...updates } : d)) })),
  deleteDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
  addUser: (user) => set((s) => ({ users: [user, ...s.users] })),
  updateUser: (id, updates) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)) })),
  deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
  refreshRealtime: async () => {
    try {
      const data = await firebaseGet("realtime");
      if (data) {
        set((s) => {
          const isChanged = JSON.stringify(s.realtimeCams) !== JSON.stringify(data);
          return {
            realtimeCams: data,
            routeStats: buildRouteStats(data),
            lastRealtimeUpdate: isChanged ? Date.now() : s.lastRealtimeUpdate,
            isBoardOffline: isChanged ? false : s.isBoardOffline,
          };
        });
      }
    } catch (e) {
      console.error(e);
    }
  },
}));
