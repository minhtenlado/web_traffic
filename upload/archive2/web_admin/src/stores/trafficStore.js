import { create } from 'zustand';
import { firebaseSet, firebaseUpdate, firebaseListen, firebaseGet } from '../services/firebase';
import { uploadAllCameraSnapshots, getCameraSnapshotUrl, CAMERA_IDS } from '../services/cloudinaryService';
import { SIGNAL_PHASES } from '../utils/constants';
import { generateSignalState } from '../services/mockData';

const SNAPSHOT_CYCLE_MS = 3 * 60 * 60 * 1000; // 3 hours

/* ── Camera → Route mapping ──
 * Maps real Firebase camera IDs to the 4 intersection routes.
 * cam_01 → Hàng Xanh
 * cam_02 → Điện Biên Phủ
 * cam_03 → Bạch Đằng
 * cam_04 → Điện Biên Phủ
 * cam_05 → Xô Viết Nghệ Tĩnh
 * cam_06 → Bạch Đằng
 * cam_07 → Hàng Xanh
 */
const CAM_TO_ROUTE = {
  cam_01: 'hang_xanh',
  cam_02: 'dien_bien_phu',
  cam_03: 'bach_dang',
  cam_04: 'dien_bien_phu',
  cam_05: 'xo_viet_nghe_tinh',
  cam_06: 'bach_dang',
  cam_07: 'hang_xanh',
};

const ROUTE_META = {
  bach_dang: { name: 'Bạch Đằng', cameras: ['Camera 3', 'Camera 6'], isReference: false },
  dien_bien_phu: { name: 'Điện Biên Phủ', cameras: ['Camera 2', 'Camera 4'], isReference: false },
  xo_viet_nghe_tinh: { name: 'Xô Viết Nghệ Tĩnh', cameras: ['Camera 5'], isReference: true },
  hang_xanh: { name: 'Hàng Xanh', cameras: ['Camera 1', 'Camera 7'], isReference: false },
};

/* Convert Firebase mapped_label → Vietnamese status + color */
function labelToStatus(mappedLabel) {
  switch (mappedLabel) {
    case 'Duong_vang': return { status: 'Thông thoáng', statusColor: 'green' };
    case 'Binh_thuong': return { status: 'Bình thường', statusColor: 'green' };
    case 'Dong_xe': return { status: 'Đông xe', statusColor: 'amber' };
    case 'Sap_ket': return { status: 'Sắp kẹt', statusColor: 'amber' };
    case 'Ket_xe': return { status: 'Kẹt xe', statusColor: 'red' };
    default: return { status: mappedLabel || '—', statusColor: 'green' };
  }
}

/* Build routeStats array from raw Firebase `realtime` data */
function buildRouteStats(realtimeData) {
  // Accumulate per route
  const routeAcc = {};
  for (const [camId, camData] of Object.entries(realtimeData)) {
    const routeId = CAM_TO_ROUTE[camId];
    if (!routeId) continue;
    if (!routeAcc[routeId]) {
      routeAcc[routeId] = { totalCount: 0, labels: [], timestamps: [] };
    }
    routeAcc[routeId].totalCount += (camData.count || 0);
    routeAcc[routeId].labels.push(camData.mapped_label);
    routeAcc[routeId].timestamps.push(camData.timestamp);
  }

  // Convert to array matching existing routeStats shape
  return Object.entries(ROUTE_META).map(([routeId, meta]) => {
    const acc = routeAcc[routeId];
    const vehicleCount = acc ? acc.totalCount : 0;
    // Pick the worst (highest severity) label for the route
    const worstLabel = acc ? pickWorstLabel(acc.labels) : 'Duong_vang';
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

/* Pick the most severe label among an array of labels */
function pickWorstLabel(labels) {
  const severity = { Duong_vang: 0, Binh_thuong: 1, Dong_xe: 2, Sap_ket: 3, Ket_xe: 4 };
  let worst = labels[0] || 'Duong_vang';
  for (const l of labels) {
    if ((severity[l] ?? 0) > (severity[worst] ?? 0)) worst = l;
  }
  return worst;
}

/* Convert label to a 0-100 density value for charts */
function labelToDensity(label) {
  switch (label) {
    case 'Duong_vang': return 15;
    case 'Binh_thuong': return 30;
    case 'Dong_xe': return 60;
    case 'Sap_ket': return 75;
    case 'Ket_xe': return 95;
    default: return 20;
  }
}

const useStore = create((set, get) => ({
  // Real-time metrics
  metrics: { totalVehicles: 0, avgSpeed: 0, avgWaitTime: 0, activeAlerts: 0 },
  directionMetrics: [],
  signalState: { currentPhase: 'phase_1', mode: 'auto', countdown: 35, phaseDurations: { phase_1: 35, phase_2: 35 }, cycleNumber: 1 },
  alerts: [],
  auditLog: [],

  // V2 Analytics State (Single Source of Truth)
  routeStats: [],
  heatmapData: [],
  aiPredictions: [],
  signalRec: {
    policy: 'Đang khởi tạo',
    lastAdjusted: new Date().toISOString(),
    nextReview: new Date().toISOString(),
    recommendations: [],
  },

  // Firebase real-time camera data (raw)
  realtimeCams: null,
  // AI prediction summaries
  predictionSummary: null,
  // Offline detection
  lastRealtimeUpdate: Date.now(),
  isBoardOffline: false,
  _lastRealtimeDataStr: null,
  // Weather forecast from Open-Meteo API
  weatherForecast: null,
  _weatherInterval: null,

  // Real-time chart history arrays
  chartHistory: [],
  localHistory: [],
  _tickCount: 0,

  // Camera snapshot state (Cloudinary)
  cameraSnapshots: {},
  snapshotRefreshTimer: null,
  isUploadingSnapshots: false,
  lastSnapshotCycle: null,
  nextSnapshotRefresh: null,

  // Firebase state
  _firebaseInitialized: false,
  _unsubscribers: [],

  initFirebase: () => {
    if (get()._firebaseInitialized) return;
    set({ _firebaseInitialized: true });

    const unsubs = [];

    // ── 1. Listen to REAL camera data from `realtime` node ──
    const unsubRealtime = firebaseListen('realtime', (data) => {
      if (data && typeof data === 'object') {
        const state = get();
        const dataForCompare = { ...data };
        delete dataForCompare.weather;
        const currentDataStr = JSON.stringify(dataForCompare);
        
        let newLastRealtimeUpdate = state.lastRealtimeUpdate;
        let isOffline = state.isBoardOffline;
        
        if (currentDataStr !== state._lastRealtimeDataStr) {
           newLastRealtimeUpdate = Date.now();
           isOffline = false;
        }

        const routes = buildRouteStats(data);
        const totalVehicles = routes.reduce((sum, r) => sum + r.vehicleCount, 0);
        const avgDensity = Math.round(routes.reduce((s, r) => s + r.density, 0) / routes.length);

        // Calculate mapped level for chartHistory
        const severity = { Duong_vang: 0, Binh_thuong: 1, Dong_xe: 2, Sap_ket: 3, Ket_xe: 4 };
        const getSev = (camId) => data[camId]?.mapped_label ? severity[data[camId].mapped_label] || 0 : 0;

        const timestamp = data.cam_01?.timestamp?.split(' ')[1] || new Date().toLocaleTimeString('vi-VN', { hour12: false });

        // Auto-generate alerts
        let newAlerts = [];
        for (const [camId, camData] of Object.entries(data)) {
           if (camId === 'weather' || camId === 'timestamp') continue;
           if (camData.status === 'ERROR' || camData.error_message) {
              newAlerts.push({
                 id: `alert-${camId}-err-${Date.now()}`,
                 type: 'camera_error',
                 label: 'Camera lỗi',
                 color: 'amber',
                 severity: 'warning',
                 message: `Mất kết nối / Lỗi ${camId}`,
                 timestamp: new Date().toISOString(),
                 acknowledged: false,
                 camera: camId
              });
           }
           if (camData.mapped_label === 'Ket_xe' || camData.mapped_label === 'Sap_ket') {
              newAlerts.push({
                 id: `alert-${camId}-cong-${Date.now()}`,
                 type: 'congestion',
                 label: 'Ùn tắc',
                 color: 'red',
                 severity: 'critical',
                 message: `Mật độ xe cao tại ${CAM_TO_ROUTE[camId] || camId}`,
                 timestamp: new Date().toISOString(),
                 acknowledged: false,
                 camera: camId
              });
           }
        }

        // Dynamic Signal Recommendation logic
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
          const newChartPoint = {
            cam_01: getSev('cam_01'),
            cam_02: getSev('cam_02'),
            cam_03: getSev('cam_03'),
            cam_04: getSev('cam_04'),
            time: timestamp
          };
          const newChartHistory = [...state.chartHistory, newChartPoint].slice(-60); // Keep last 60 points (~10 mins)

          return {
            realtimeCams: data,
            routeStats: routes,
            chartHistory: newChartHistory,
            signalRec: newSignalRec,
            alerts: newAlerts,
            lastRealtimeUpdate: newLastRealtimeUpdate,
            isBoardOffline: isOffline,
            _lastRealtimeDataStr: currentDataStr,
            metrics: {
              ...state.metrics,
              totalVehicles,
              activeAlerts: newAlerts.length,
              avgWaitTime: avgDensity > 70 ? 45 : avgDensity > 40 ? 30 : 15,
            },
          };
        });
      }
    });
    unsubs.push(unsubRealtime);

    // ── Fetch Initial Chart History & Predictions ──
    firebaseGet('chart_data/latest/history').then(historyData => {
      if (historyData) {
        let sortedHistory = [];
        if (Array.isArray(historyData)) {
           sortedHistory = historyData.filter(d => d && d.time).sort((a, b) => a.time.localeCompare(b.time));
        } else {
           sortedHistory = Object.values(historyData).filter(d => d && d.time).sort((a, b) => a.time.localeCompare(b.time));
        }
        
        // Generate empty heatmap
        const heatmap = [];
        for (let day = 0; day < 7; day++) {
          for (let hour = 0; hour < 24; hour++) {
            heatmap.push([hour, day, 0]);
          }
        }
        
        set({ chartHistory: sortedHistory.slice(-60), heatmapData: heatmap });
      }
    }).catch(console.error);

    firebaseGet('chart_data/latest/predictions').then(predData => {
      if (predData) {
        let sortedPreds = [];
        if (Array.isArray(predData)) {
           sortedPreds = predData.filter(d => d && d.time).sort((a, b) => a.time.localeCompare(b.time));
        } else {
           sortedPreds = Object.values(predData).filter(d => d && d.time).sort((a, b) => a.time.localeCompare(b.time));
        }
        set({ aiPredictions: sortedPreds });
      }
    }).catch(console.error);

    // ── 2. Listen to AI predictions from `predictions/latest` ──
    const unsubPredictions = firebaseListen('predictions/latest', (data) => {
      if (data) {
        set({ predictionSummary: data });
      }
    });
    unsubs.push(unsubPredictions);

    // ── 3. Listen to signalState from Firebase ──
    const unsubSignal = firebaseListen('traffic/signalState', (data) => {
      if (data) {
        set({ signalState: data });
      } else {
        firebaseSet('traffic/signalState', get().signalState).catch(console.error);
      }
    });
    unsubs.push(unsubSignal);

    // ── 4. Listen to camera snapshots from Firebase ──
    const unsubSnapshots = firebaseListen('camera_snapshots', (data) => {
      if (data && typeof data === 'object') {
        const meta = data._meta || {};
        const snapshots = { ...data };
        delete snapshots._meta;
        set({
          cameraSnapshots: snapshots,
          lastSnapshotCycle: meta.last_cycle || null,
          nextSnapshotRefresh: meta.next_refresh || null,
        });
      }
    });
    unsubs.push(unsubSnapshots);

    // ── Start snapshot auto-refresh timer ──
    get().startSnapshotAutoRefresh();

    // ── Listen to Hardware Health ──
    const unsubHealth = firebaseListen('system/hardware', (data) => {
      if (data) {
        set({
          healthMetrics: {
            cpu: data.cpu_usage || 0,
            ram: data.ram_percent || 0,
            temperature: data.cpu_temp || 0,
            networkLatency: Math.floor(Math.random() * 20) + 15 // Mock ping 15-35ms
          }
        });
      }
    });
    unsubs.push(unsubHealth);

    set({ _unsubscribers: unsubs });
  },

  /** Start auto-refresh cycle (every 3 hours) */
  startSnapshotAutoRefresh: () => {
    const existing = get().snapshotRefreshTimer;
    if (existing) clearInterval(existing);

    const timerId = setInterval(() => {
      console.log('[Snapshot] Auto-refresh cycle triggered');
      // Auto-refresh only fires the timer; actual upload needs image data
      // from backend or manual trigger. Here we just refresh URLs from Firebase.
      firebaseGet('camera_snapshots').then(data => {
        if (data && typeof data === 'object') {
          const meta = data._meta || {};
          const snapshots = { ...data };
          delete snapshots._meta;
          set({
            cameraSnapshots: snapshots,
            lastSnapshotCycle: meta.last_cycle || null,
            nextSnapshotRefresh: meta.next_refresh || null,
          });
        }
      }).catch(console.error);
    }, SNAPSHOT_CYCLE_MS);

    set({ snapshotRefreshTimer: timerId });
  },

  /** Stop auto-refresh */
  stopSnapshotAutoRefresh: () => {
    const timerId = get().snapshotRefreshTimer;
    if (timerId) clearInterval(timerId);
    set({ snapshotRefreshTimer: null });
  },

  /**
   * Manual trigger: upload snapshot images to Cloudinary.
   * @param {Object} snapshotsMap — { cam_01: File/Blob/base64, ... }
   */
  triggerSnapshotUpload: async (snapshotsMap) => {
    set({ isUploadingSnapshots: true });
    try {
      const results = await uploadAllCameraSnapshots(snapshotsMap);
      const errors = Object.entries(results).filter(([_, res]) => res.status === 'error');
      if (errors.length > 0) {
        alert(`Upload lỗi: ${errors[0][1].error}`);
      } else {
        console.log('[Snapshot] Upload complete:', results);
      }
    } catch (err) {
      console.error('[Snapshot] Upload failed:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      set({ isUploadingSnapshots: false });
    }
  },

  // UI state
  sidebarOpen: true,
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),

  // Theme state
  theme: localStorage.getItem('theme') || 'dark',
  toggleTheme: () => set(s => {
    const newTheme = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.documentElement.dataset.theme = newTheme;
    return { theme: newTheme };
  }),

  // Tick: local countdown for smooth UI, push phase changes to Firebase
  tick: () => {
    const state = get();
    const signal = state.signalState;

    let newSignalState = { ...signal };
    let newCountdown = signal.countdown - 1;

    if (newCountdown <= 0) {
      if (signal.mode === 'auto') {
        const nextPhase = signal.currentPhase === 'phase_1' ? 'phase_2' : 'phase_1';
        newSignalState = generateSignalState(nextPhase);
        newSignalState.mode = 'auto';

        // WRITE: push phase change to Firebase
        firebaseUpdate('traffic/signalState', newSignalState).catch(console.error);
      } else {
        newSignalState.countdown = 35;
      }
    } else {
      newSignalState.countdown = newCountdown;
    }

    const newTickCount = state._tickCount + 1;
    let newLocalHistory = state.localHistory;

    // Check offline status
    const isBoardOffline = Date.now() - state.lastRealtimeUpdate > 30000; // Increased to 30s to be safe

    // Save to localHistory every 3 ticks
    if (newTickCount % 3 === 0) {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      newLocalHistory = [...state.localHistory, {
        time: timeStr,
        traffic: state.metrics.totalVehicles,
        greenPhase1: newSignalState.currentPhase === 'phase_1' ? newSignalState.countdown : 0,
        greenPhase2: newSignalState.currentPhase === 'phase_2' ? newSignalState.countdown : 0,
      }].slice(-30); // Keep last 30 points
    }

    set({ signalState: newSignalState, _tickCount: newTickCount, localHistory: newLocalHistory, isBoardOffline });
  },

  refreshAlerts: () => {},
  refreshAuditLog: () => {},
  refreshMetrics: () => {},

  // WRITE: push mode change to Firebase
  setSignalMode: (mode) => {
    const s = get();
    const newSignalState = { ...s.signalState, mode };
    firebaseUpdate('traffic/signalState', newSignalState).catch(console.error);
    set({ signalState: newSignalState });
  },

  // Health Metrics from socket
  healthMetrics: null,
  updateHealthMetrics: (data) => set({ healthMetrics: data }),
}));

export default useStore;
