"use client";

import { create } from "zustand";
import { buildRouteStats, buildCameraAlerts, cameraView, ACTIVE_CAMERA_IDS } from "./traffic-status";
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
  modelStatus: { buffer_fill?: number; buffer_max?: number; missing_model_inputs?: string[]; last_heartbeat?: number; online?: boolean; tcn_status?: string; runtime_version?: string; active_camera_ids?: string[]; model_artifacts?: Record<string, any> } | null;
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
    rawHistory?: any[]; rawPredictions?: any[]; validUntil?: number; status?: string;
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
  signalRec: { policy: "Chờ dữ liệu được xác minh", lastAdjusted: "", nextReview: "", recommendations: [] },
  aiForecast: { actual: [], forecast: [], directions: [], daysLearned: 0, rawHistory: [], rawPredictions: [] },
  modelInfo: generateModelInfo(),
  chartHistory: [],
  activeSection: "dashboard",
  sidebarOpen: true,
  theme: "dark",
  selectedArea: "hang-xanh",
  user: null,
  isAuthenticated: false,
  isBoardOffline: true,
  lastRealtimeUpdate: 0,
  _tickCount: 0,

  _firebaseInitialized: false,
  initFirebase: () => {
    if (get()._firebaseInitialized) return;
    set({ _firebaseInitialized: true });

    // Process helper for realtime camera data
    const processRealtimeData = (data: any) => {
      if (!data || typeof data !== 'object') return;
      
      if (data.weather) {
        set({ weather: { ...data.weather } as any });
      }
      // The SSE adapter passes complete snapshots; deletion must not resurrect old records.
      const routes = buildRouteStats(data);
      const alerts = buildCameraAlerts(data, get().alerts) as AlertItem[];
      const observationTime = Math.max(0, ...ACTIVE_CAMERA_IDS.map(id => Number(data[id]?.last_update) || 0));
      const changed = observationTime * 1000 > get().lastRealtimeUpdate;
      const chartPoint: { time: string; [key: string]: number | string } = {
        time: new Date(observationTime * 1000).toLocaleTimeString("vi-VN", { hour12: false }),
      };
      ACTIVE_CAMERA_IDS.forEach(id => {
        const view = cameraView(data[id]);
        // Missing labels are omitted, not rendered as free-flow zeroes.
        if (view.ready) chartPoint[id] = Number(data[id].mapped_idx);
      });
      set(state => ({
        realtimeCams: data, routeStats: routes, alerts,
        chartHistory: changed ? [...state.chartHistory, chartPoint].slice(-60) : state.chartHistory,
        lastRealtimeUpdate: observationTime * 1000,
        metrics: { ...state.metrics, totalVehicles: routes.reduce((sum, r) => sum + r.vehicleCount, 0),
          activeAlerts: alerts.filter(a => !a.acknowledged).length },
      }));
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

      const valid = Number(data.valid_until) > Date.now() / 1000 && data.experimental === false;
      // Legacy chart points are label indices, NOT vehicle counts.
      set(state => ({ aiForecast: { ...state.aiForecast,
        actual: [], forecast: [], directions: [], daysLearned: 0,
        rawHistory: valid ? history : [], rawPredictions: valid ? predictions : [],
        validUntil: Number(data.valid_until) || 0,
        status: valid ? "READY" : (data.status || "UNAVAILABLE"),
      }}));
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
          uptime: Number(data.uptime_seconds || 0) / 3600,
          cpu: state.healthMetrics?.cpu || 0,
          ram: state.healthMetrics?.ram || 0,
          temperature: state.healthMetrics?.temperature || 0,
          networkLatency: state.healthMetrics?.networkLatency || 0,
          fps: state.healthMetrics?.fps || 0
        } as any,
        isBoardOffline: data.online !== true || Date.now() / 1000 - Number(data.last_heartbeat || 0) > 90
      }));
    };

    // Initialize single root SSE listener
    stopRealtime = initUnifiedFirebase((path: string, data: any) => {
      if (path === '/') {
        processRealtimeData(data?.realtime || {});
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
          processRealtimeData(data || {});
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
      } else if (path === '/system') {
        if (data?.hardware) processHardwareData(data.hardware);
        if (data?.status) processStatusData(data.status);
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
    const routes = buildRouteStats(state.realtimeCams || {});
    const alerts = buildCameraAlerts(state.realtimeCams || {}, state.alerts) as AlertItem[];
    set({ isBoardOffline: state.modelStatus?.online !== true ||
            Date.now() / 1000 - Number(state.modelStatus?.last_heartbeat || 0) > 90,
          routeStats: routes, alerts,
          metrics: { ...state.metrics, totalVehicles: routes.reduce((sum, r) => sum + r.vehicleCount, 0),
            activeAlerts: alerts.filter(a => !a.acknowledged).length },
          aiForecast: Number(state.aiForecast.validUntil) > Date.now() / 1000 ? state.aiForecast :
            { ...state.aiForecast, actual: [], forecast: [], rawHistory: [], rawPredictions: [], status: "UNAVAILABLE" },
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
          return {
            realtimeCams: data,
            routeStats: buildRouteStats(data),
            lastRealtimeUpdate: Math.max(0, ...ACTIVE_CAMERA_IDS.map(id => Number(data[id]?.last_update) || 0)) * 1000,
          };
        });
      }
    } catch (e) {
      console.error(e);
    }
  },
}));
