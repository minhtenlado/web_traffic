"use client";

import { create } from "zustand";
import { readTCNChart } from "./tcn-forecast";
import { buildRouteStats, buildCameraAlerts, selectedCameraView, appendCameraHistory, ACTIVE_CAMERA_IDS, edgePayloadIsFresh } from "./traffic-status";
import { isControllerSignal, sendControllerCommand,
  requestFuzzyControlMode, type ControllerSignal, type ControllerStatus, type CommandResult, type TimingKey,
  type FuzzyControlMode } from "./controller";

import { initUnifiedFirebase, firebaseGet } from "./firebase";
import { genioTelemetry, legacyHardwareTelemetry, newestTelemetry } from "./hardware-telemetry";


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
  uptime: number | null; observedAt: number; source: string;
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
  alertAcknowledgements: Record<string, { acknowledgedAt?: number; actor?: { id?: string; name?: string } }>;
  alertAcknowledgementsLoaded: boolean;
  auditLog: AuditItem[];
  users: UserItem[];
  devices: DeviceItem[];
  healthMetrics: HealthMetrics | null;
  signalRec: { policy: string; lastAdjusted: string; nextReview: string; recommendations: any[] };
  aiForecast: ForecastState;
  modelInfo: null;

  // Mamdani Fuzzy Adaptive Control state
  fuzzyStatus: {
    demandA?: number;
    demandB?: number;
    leftDemandA?: number;
    leftDemandB?: number;
    situation?: "NORMAL" | "BOTH_HEAVY" | "A_HEAVY" | "B_HEAVY";
    greenStraightA?: number;
    greenStraightB?: number;
    greenLeftA?: number;
    greenLeftB?: number;
    yellowTime?: number;
    isSimulation?: boolean;
    timestamp?: number;
    dataValid?: boolean;
    validUntil?: number;
    planStatus?: string;
    plannerStatus?: string;
    reason?: string;
    autoEnabled?: boolean;
    controlMode?: FuzzyControlMode | "UNKNOWN";
    advisoryOnly?: boolean;
    validationStatus?: string;
    inputSemantics?: string;
    weatherInfluence?: string;
    tcnInfluence?: string;
    classifierInfluence?: string;
    phaseMapping?: Record<string, string>;
    cameraCounts?: Record<string, number>;
    directionCounts?: Record<string, number>;
    plan?: { greenNS?: number; greenEW?: number; leftNS?: number; leftEW?: number; yellow?: number; allred?: number };
    appliedPlan?: { greenNS?: number; greenEW?: number; leftNS?: number; leftEW?: number; yellow?: number; allred?: number };
    currentPlan?: { greenNS?: number; greenEW?: number; leftNS?: number; leftEW?: number; yellow?: number; allred?: number };
    planId?: number;
    controllerState?: { mode?: string; currentPhase?: string; planId?: number };
  } | null;
  fuzzyControl: { mode: FuzzyControlMode; updatedAt?: number; actor?: string } | null;

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
  clearEmergencyStop: () => Promise<string>;
  setFuzzyControlMode: (mode: FuzzyControlMode) => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;
  acknowledgeAllAlerts: () => Promise<void>;
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

function applyAcknowledgements(alerts: AlertItem[], acknowledgements: TrafficState["alertAcknowledgements"]) {
  return alerts.map((alert) => {
    const acknowledgement = acknowledgements[alert.id];
    return { ...alert, acknowledged: Boolean(acknowledgement),
      ...(acknowledgement?.acknowledgedAt ? { acknowledgedAt: new Date(acknowledgement.acknowledgedAt).toISOString() } : {}) };
  });
}

async function postAlertAcknowledgements(body: Record<string, unknown>) {
  const response = await fetch("/api/alerts/ack", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Không lưu được trạng thái cảnh báo");
  }
  return response.json();
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
  fuzzyControl: null,
  alerts: [],
  alertAcknowledgements: {},
  alertAcknowledgementsLoaded: false,
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

    const updateCameraData = (records: Record<string, any>, edgeAI: any) => {
      const state = get();
      const routes = buildRouteStats(records, Date.now(), edgeAI);
      const alerts = applyAcknowledgements(
        buildCameraAlerts(records, state.alerts, Date.now(), edgeAI) as AlertItem[], state.alertAcknowledgements,
      );
      const observationTime = Math.max(0, ...ACTIVE_CAMERA_IDS.map(id => selectedCameraView(id, records, edgeAI).observedAt || 0));
      set({ realtimeCams: records, edgeAI, routeStats: routes, alerts,
        isBoardOffline: !edgePayloadIsFresh(edgeAI),
        chartHistory: appendCameraHistory(state.chartHistory, records, edgeAI),
        lastRealtimeUpdate: observationTime * 1000,
        metrics: { ...state.metrics, totalVehicles: routes.some(route => route.hasData) ? routes.reduce((sum, r) => sum + r.vehicleCount, 0) : null,
          activeAlerts: alerts.filter(a => !a.acknowledged).length },
      });
      return alerts;
    };
    const processEdgeAI = (data: any) => updateCameraData(get().realtimeCams || {}, data || {});
    const processRealtimeData = (data: any, complete = false) => {
      if (!data || typeof data !== "object") return;
      if (data.weather) set({ weather: { ...data.weather } });
      const records = complete ? data : { ...get().realtimeCams, ...data };
      const alerts = updateCameraData(records, get().edgeAI);
      if (complete && get().alertAcknowledgementsLoaded) {
        const active = new Set(alerts.map((alert) => alert.id));
        const resolvedIds = Object.keys(get().alertAcknowledgements).filter((id) => !active.has(id));
        if (resolvedIds.length) {
          set((state) => {
            const next = { ...state.alertAcknowledgements };
            resolvedIds.forEach((id) => delete next[id]);
            return { alertAcknowledgements: next };
          });
          void postAlertAcknowledgements({ resolveIds: resolvedIds }).catch(() => {});
        }
      }
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
      const sample = newestTelemetry(legacyHardwareTelemetry(data), get().healthMetrics);
      if (sample && sample.observedAt !== get().healthMetrics?.observedAt) set({ healthMetrics: sample });
    };

    const processControllerData = (data: any) => {
      if (!data || typeof data !== "object") return;
      set({ controllerStatus: data });
      const sample = newestTelemetry(genioTelemetry(data.genioDisplay), get().healthMetrics);
      if (sample && sample.observedAt !== get().healthMetrics?.observedAt) set({ healthMetrics: sample });
    };

    // Process helper for system status
    const processStatusData = (data: any) => {
      if (!data) return;
      set({modelStatus:data});
    };

    void fetch("/api/alerts/ack", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      const acknowledgements = data.acknowledgements && typeof data.acknowledgements === "object" ? data.acknowledgements : {};
      const current = get();
      const alerts = current.realtimeCams
        ? applyAcknowledgements(buildCameraAlerts(current.realtimeCams, current.alerts, Date.now(), current.edgeAI) as AlertItem[], acknowledgements)
        : current.alerts;
      set({ alertAcknowledgements: acknowledgements, alertAcknowledgementsLoaded: true, alerts,
        metrics: { ...get().metrics, activeAlerts: alerts.filter((alert) => !alert.acknowledged).length } });
      if (current.realtimeCams) {
        const active = new Set(alerts.map((alert) => alert.id));
        const resolvedIds = Object.keys(acknowledgements).filter((id) => !active.has(id));
        if (resolvedIds.length) {
          set((state) => {
            const next = { ...state.alertAcknowledgements };
            resolvedIds.forEach((id) => delete next[id]);
            return { alertAcknowledgements: next };
          });
          void postAlertAcknowledgements({ resolveIds: resolvedIds }).catch(() => {});
        }
      }
    }).catch(() => {});

    // Initialize single root SSE listener
    stopRealtime = initUnifiedFirebase((path: string, data: any) => {
      if (path === '/') {
        const acknowledgements = data.system?.alertAcknowledgements && typeof data.system.alertAcknowledgements === "object"
          ? data.system.alertAcknowledgements : {};
        set({ alertAcknowledgements: acknowledgements, alertAcknowledgementsLoaded: true, edgeAI: data?.traffic?.edgeAI || (get().edgeAI !== null ? {} : null) });
        processRealtimeData(data?.realtime || {}, true);
        if (data.chart_data?.latest) processChartData(data.chart_data.latest);
        if (data.system?.hardware) processHardwareData(data.system.hardware);
        if (data.system?.status) processStatusData(data.system.status);
        if (isControllerSignal(data.traffic?.signalState)) set({ signalState: data.traffic.signalState });
        if (data.traffic?.controllerStatus) processControllerData(data.traffic.controllerStatus);
        if (data.traffic?.commandResult) set({ commandResult: data.traffic.commandResult });
        if (data.traffic?.fuzzyStatus) set({ fuzzyStatus: data.traffic.fuzzyStatus });
        if (data.traffic?.fuzzyControl) set({ fuzzyControl: data.traffic.fuzzyControl });

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
          processRealtimeData(data || {}, true);
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
        const acknowledgements = data?.alertAcknowledgements && typeof data.alertAcknowledgements === "object"
          ? data.alertAcknowledgements : {};
        set({ alertAcknowledgements: acknowledgements, alertAcknowledgementsLoaded: true });
        if (data?.hardware) processHardwareData(data.hardware);
        if (data?.status) processStatusData(data.status);
        if (data?.alertAcknowledgements || get().alerts.length) {
          const alerts = applyAcknowledgements(buildCameraAlerts(get().realtimeCams || {}, get().alerts, Date.now(), get().edgeAI) as AlertItem[], acknowledgements);
          set({ alerts, metrics: { ...get().metrics, activeAlerts: alerts.filter((alert) => !alert.acknowledged).length } });
        }
      } else if (path.startsWith('/system')) {
        if (path.includes('hardware')) processHardwareData(data);
        if (path.includes('status')) processStatusData(data);
        if (path.includes('alertAcknowledgements')) {
          const acknowledgements = data && typeof data === "object" ? data : {};
          const alerts = applyAcknowledgements(buildCameraAlerts(get().realtimeCams || {}, get().alerts, Date.now(), get().edgeAI) as AlertItem[], acknowledgements);
          set({ alertAcknowledgements: acknowledgements, alertAcknowledgementsLoaded: true, alerts,
            metrics: { ...get().metrics, activeAlerts: alerts.filter((alert) => !alert.acknowledged).length } });
        }
      } else if (path === '/traffic/signalState') {
        if (isControllerSignal(data)) set({ signalState: data });
      } else if (path === '/traffic/controllerStatus') {
        processControllerData(data);
      } else if (path === '/traffic/commandResult') {
        set({ commandResult: data });
      } else if (path === '/traffic/edgeAI') {
        processEdgeAI(data);
      } else if (path.startsWith('/traffic/fuzzyStatus')) {
        set({ fuzzyStatus: data });
      } else if (path.startsWith('/traffic/fuzzyControl')) {
        set({ fuzzyControl: data });
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
    set({ user: null, isAuthenticated: false, _firebaseInitialized: false, controllerStatus: null,
      realtimeCams: null, edgeAI: null, healthMetrics: null, chartHistory: [], lastRealtimeUpdate: 0, routeStats: [], alertAcknowledgements: {},
      alertAcknowledgementsLoaded: false, alerts: [], auditLog: [], users: [], devices: [] });
  },

  tick: () => {
    // Keep STM32 telemetry intact. No browser-generated phase transitions.
    const state = get();
    const routes = buildRouteStats(state.realtimeCams || {}, Date.now(), state.edgeAI);
    const alerts = applyAcknowledgements(
      buildCameraAlerts(state.realtimeCams || {}, state.alerts, Date.now(), state.edgeAI) as AlertItem[], state.alertAcknowledgements,
    );
    set({ isBoardOffline: !edgePayloadIsFresh(state.edgeAI),
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
  clearEmergencyStop: () => sendControllerCommand({ action: "clear_emergency" }),
  setFuzzyControlMode: async (mode) => {
    await requestFuzzyControlMode(mode);
    const existing = get().fuzzyControl;
    set({ fuzzyControl: { ...existing, mode, updatedAt: Date.now() } });
  },
  acknowledgeAlert: async (id) => {
    const before = get();
    if (!before.alerts.some((alert) => alert.id === id && !alert.acknowledged)) return;
    const acknowledgement = { acknowledgedAt: Date.now(), actor: { id: before.user?.id, name: before.user?.fullName } };
    set((state) => ({ alertAcknowledgements: { ...state.alertAcknowledgements, [id]: acknowledgement },
      alerts: state.alerts.map((alert) => alert.id === id ? { ...alert, acknowledged: true } : alert),
      metrics: { ...state.metrics, activeAlerts: Math.max(0, state.metrics.activeAlerts - 1) } }));
    try { await postAlertAcknowledgements({ acknowledgeIds: [id] }); }
    catch (error) {
      set({ alertAcknowledgements: before.alertAcknowledgements, alerts: before.alerts, metrics: before.metrics });
      throw error;
    }
  },
  acknowledgeAllAlerts: async () => {
    const before = get();
    const ids = before.alerts.filter((alert) => !alert.acknowledged).map((alert) => alert.id);
    if (!ids.length) return;
    const now = Date.now();
    const actor = { id: before.user?.id, name: before.user?.fullName };
    set((state) => ({
      alertAcknowledgements: { ...state.alertAcknowledgements,
        ...Object.fromEntries(ids.map((id) => [id, { acknowledgedAt: now, actor }])) },
      alerts: state.alerts.map((alert) => ids.includes(alert.id) ? { ...alert, acknowledged: true } : alert),
      metrics: { ...state.metrics, activeAlerts: 0 },
    }));
    try { await postAlertAcknowledgements({ acknowledgeIds: ids }); }
    catch (error) {
      set({ alertAcknowledgements: before.alertAcknowledgements, alerts: before.alerts, metrics: before.metrics });
      throw error;
    }
  },
  addDevice: (device) => set((s) => ({ devices: [device, ...s.devices] })),
  updateDevice: (id, updates) => set((s) => ({ devices: s.devices.map((d) => (d.id === id ? { ...d, ...updates } : d)) })),
  deleteDevice: (id) => set((s) => ({ devices: s.devices.filter((d) => d.id !== id) })),
  addUser: (user) => set((s) => ({ users: [user, ...s.users] })),
  updateUser: (id, updates) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, ...updates } : u)) })),
  deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
  refreshRealtime: async () => {
    try {
      const results = await Promise.allSettled([firebaseGet("realtime"), firebaseGet("traffic/edgeAI")]);
      const records = results[0].status === "fulfilled" ? results[0].value || {} : get().realtimeCams || {};
      const edge = results[1].status === "fulfilled" ? results[1].value || {} : get().edgeAI;
      const routes = buildRouteStats(records, Date.now(), edge);
      const alerts = applyAcknowledgements(buildCameraAlerts(records, get().alerts, Date.now(), edge) as AlertItem[], get().alertAcknowledgements);
      set((state) => ({ realtimeCams: records, edgeAI: edge, routeStats: routes, alerts,
        chartHistory: appendCameraHistory(state.chartHistory, records, edge),
        isBoardOffline: !edgePayloadIsFresh(edge),
        lastRealtimeUpdate: Math.max(0, ...ACTIVE_CAMERA_IDS.map(id => selectedCameraView(id, records, edge).observedAt || 0)) * 1000,
        metrics: { ...state.metrics, totalVehicles: routes.some(r => r.hasData) ? routes.reduce((sum, r) => sum + r.vehicleCount, 0) : null,
          activeAlerts: alerts.filter(a => !a.acknowledged).length },
      }));
    } catch (e) { console.error(e); }
  },
}));
