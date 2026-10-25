"use client";

import { create } from "zustand";
import { readTCNChart } from "./tcn-forecast";
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

export interface AlertItem {
  id: string; type: string; label: string; color: string;
  severity: "critical" | "warning" | "info"; message: string;
  timestamp: string; acknowledged: boolean; camera?: string;
}
export interface AuditItem {
  id: string; user: string; role: string; action: string; timestamp: string; ip?: string;
}
export interface UserItem {
  id: number; name: string; email: string; role: "admin" | "operator";
  status: "active" | "inactive"; lastLogin?: string;
}
export interface DeviceItem {
  id: string; name: string; type: string; ip: string; location: string;
  status: "online" | "offline" | "error"; lastSeen?: string;
}
export interface HealthMetrics {
  cpu: number | null; ram: number | null; temperature: number | null;
  networkLatency: number | null; fps: number | null; diskUsage: number | null;
  uptime: number | null; observedAt: number | null;
}
type ForecastPoint = { hour: string | number; total: number; perRoute: number[]; confidence?: number };
type ForecastState = {
  actual: ForecastPoint[]; forecast: ForecastPoint[]; directions: string[]; daysLearned: number;
  rawHistory: any[]; rawPredictions: any[]; validUntil?: number; status?: string;
  kind?: string; experimental?: boolean; reason?: string; modelVersion?: string;
};

/* Camera → Route mapping at Hàng Xanh intersection */
let stopRealtime: (() => void) | null = null;

export type RouteStat = ReturnType<typeof buildRouteStats>[number];
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
  weather: Record<string, any> | null;
  routeStats: RouteStat[];
  metrics: { totalVehicles: number | null; avgSpeed: number | null; avgWaitTime: number | null; activeAlerts: number };
  signalState: ControllerSignal;
  controllerStatus: ControllerStatus | null;
  commandResult: CommandResult | null;
  edgeAI: Record<string, any> | null;
  modelStatus: { buffer_fill?: number; buffer_max?: number; missing_model_inputs?: string[]; last_heartbeat?: number; online?: boolean; tcn_status?: string; tcn_reason?: string; runtime_version?: string; active_camera_ids?: string[]; model_artifacts?: Record<string, any> } | null;
  isBoardOffline: boolean;
  lastRealtimeUpdate: number;
  alerts: AlertItem[];
  auditLog: AuditItem[];
  users: UserItem[];
  devices: DeviceItem[];
  healthMetrics: HealthMetrics | null;
  signalRec: { policy: string; lastAdjusted: string; nextReview: string; recommendations: any[] };
  aiForecast: ForecastState;
  modelInfo: null;

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
  chartHistory: ({ timestamp: number; time: string; total?: number } & Record<string, number | string | undefined>)[];

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

function observedNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return value !== null && value !== undefined && value !== "" && Number.isFinite(parsed) ? parsed : null;
}

function edgeIsFresh(data: any, now = Date.now() / 1000) {
  const generatedAt = Number(data?.generated_at);
  return data?.status?.online === true && Number.isFinite(generatedAt) &&
    now >= generatedAt && now - generatedAt <= 30;
}

function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("theme") as "dark" | "light") || "dark";
}

export const useTrafficStore = create<TrafficState>((set, get) => ({
  realtimeCams: null,
  weather: null,
  routeStats: buildRouteStats({}),
  metrics: { totalVehicles: null, avgSpeed: null, avgWaitTime: null, activeAlerts: 0 },
  signalState: {
    source: "STM32", currentPhase: "unknown", mode: "auto", hold: false,
    countdown: 0, phaseDurations: { green: 30, yellow: 3, left: 10, allred: 2 }, timestamp: 0,
  },
  controllerStatus: null,
  commandResult: null,
  edgeAI: null,
  modelStatus: null,
  fuzzyStatus: null,
  alerts: [],
  auditLog: [],
  users: [],
  devices: [],
  healthMetrics: null,
  signalRec: { policy: "Chưa có dữ liệu đề xuất", lastAdjusted: "", nextReview: "", recommendations: [] },
  aiForecast: { actual: [], forecast: [], directions: [], daysLearned: 0, rawHistory: [], rawPredictions: [] },
  modelInfo: null,
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
      const chartPoint: { timestamp: number; time: string; [key: string]: number | string } = {
        timestamp: observationTime,
        time: new Date(observationTime * 1000).toLocaleTimeString("vi-VN", { hour12: false }),
      };
      ACTIVE_CAMERA_IDS.forEach(id => {
        const view = cameraView(data[id]);
        if (view.fresh && view.count !== null) chartPoint[id] = view.count;
      });
      routes.forEach(route => { if (route.hasData) chartPoint[route.id] = route.vehicleCount; });
      const sampledCount = ACTIVE_CAMERA_IDS.some(id => typeof chartPoint[id] === "number");
      const total = ACTIVE_CAMERA_IDS.reduce((sum, id) => sum + (typeof chartPoint[id] === "number" ? Number(chartPoint[id]) : 0), 0);
      if (sampledCount) chartPoint.total = total;
      const previousSampleAt = get().chartHistory.at(-1)?.timestamp ?? 0;
      const appendChartPoint = changed && sampledCount && observationTime > previousSampleAt;
      set(state => ({
        realtimeCams: data, routeStats: routes, alerts,
        chartHistory: appendChartPoint ? [...state.chartHistory, chartPoint].slice(-360) : state.chartHistory,
        lastRealtimeUpdate: observationTime * 1000,
        metrics: { ...state.metrics, totalVehicles: routes.some(route => route.hasData) ? routes.reduce((sum, r) => sum + r.vehicleCount, 0) : null,
          activeAlerts: alerts.filter(a => !a.acknowledged).length },
      }));
    };

    // Process helper for chart_data
    const processChartData = (data: any) => {
      const forecast = readTCNChart(data);
      set(state => ({ aiForecast: { ...state.aiForecast,
        actual: [], forecast: [], directions: [], daysLearned: 0, ...forecast,
      }}));
    };

    // Process helper for hardware metrics
    const processHardwareData = (data: any) => {
      if (!data) return;
      set((state) => ({
        healthMetrics: {
          ...(state.healthMetrics || {}),
          cpu: observedNumber(data.cpu_usage),
          ram: observedNumber(data.ram_percent),
          temperature: observedNumber(data.cpu_temp),
          networkLatency: observedNumber(data.latency),
          fps: observedNumber(data.camera_fps),
          diskUsage: observedNumber(data.disk_percent),
          uptime: state.healthMetrics?.uptime ?? null,
          observedAt: Date.now(),
        }
      }));
    };

    // Process helper for system status
    const processStatusData = (data: any) => {
      if (!data) return;
      set({modelStatus:data});
      set((state) => ({
        healthMetrics: {
          ...(state.healthMetrics || {}),
          diskUsage: state.healthMetrics?.diskUsage ?? null,
          uptime: observedNumber(data.uptime_seconds) ?? state.healthMetrics?.uptime ?? null,
          cpu: state.healthMetrics?.cpu ?? null,
          ram: state.healthMetrics?.ram ?? null,
          temperature: state.healthMetrics?.temperature ?? null,
          networkLatency: state.healthMetrics?.networkLatency ?? null,
          fps: state.healthMetrics?.fps ?? null,
          observedAt: state.healthMetrics?.observedAt ?? null,
        },
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
        if (data.traffic?.edgeAI) set({ edgeAI: data.traffic.edgeAI, isBoardOffline: !edgeIsFresh(data.traffic.edgeAI) });
        if (data.realtime?.weather) {
          set((s) => ({
            weather: {
              ...s.weather,
              ...data.realtime.weather,
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
              ...data,
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
      } else if (path === '/traffic/edgeAI') {
        set({ edgeAI: data, isBoardOffline: !edgeIsFresh(data) });
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
    set({ isBoardOffline: !edgeIsFresh(state.edgeAI),
          routeStats: routes, alerts,
          metrics: { ...state.metrics, totalVehicles: routes.some(route => route.hasData) ? routes.reduce((sum, r) => sum + r.vehicleCount, 0) : null,
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
