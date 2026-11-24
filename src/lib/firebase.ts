export const DB_URL = "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app";

export async function firebaseGet(path: string) {
  const res = await fetch(`/api/data?path=${encodeURIComponent(path)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
  return res.json();
}

/**
 * Unified single-connection Firebase listener.
 * Connects to ROOT to prevent browser socket exhaustion (max 6 connections per domain).
 */
export function initUnifiedFirebase(onEvent: (path: string, data: any) => void) {
  if (typeof window === "undefined") return () => {};

  let eventSource: EventSource | null = null;
  let isClosed = false;
  let lastMessageTime = Date.now();
  let tree: any = {};
  const receive = (path: string, data: any, patch: boolean) => {
    const previousTrafficKeys = new Set(Object.keys(tree.traffic || {}));
    const assign = (target: string, value: any) => {
      const segments = target.split('/').filter(Boolean);
      if (!segments.length) { tree = value || {}; return; }
      let node = tree;
      for (const segment of segments.slice(0, -1)) {
        if (!node[segment] || typeof node[segment] !== 'object') node[segment] = {};
        node = node[segment];
      }
      const key = segments[segments.length - 1];
      if (value === null) delete node[key]; else node[key] = value;
    };
    if (patch && data && typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => assign(`${path}/${key}`, value));
    } else assign(path, data);
    if (path === '/') onEvent('/', structuredClone(tree));
    else if (path === '/traffic' || path.startsWith('/traffic/')) {
      for (const key of ['signalState', 'controllerStatus', 'commandResult', 'fuzzyStatus', 'fuzzyControl', 'edgeAI']) {
        const affected = path === '/traffic'
          ? patch ? Object.keys(data || {}).some(field => field.split('/')[0] === key)
            : previousTrafficKeys.has(key) || tree.traffic?.[key] != null
          : path === `/traffic/${key}` || path.startsWith(`/traffic/${key}/`);
        if (affected) {
          onEvent(`/traffic/${key}`, structuredClone(tree.traffic?.[key] ?? null));
        }
      }
    } else if (path === '/realtime' || path.startsWith('/realtime/')) {
      onEvent('/realtime', structuredClone(tree.realtime || {}));
    } else if (path === '/chart_data' || path.startsWith('/chart_data/')) {
      onEvent('/chart_data/latest', structuredClone(tree.chart_data?.latest || {}));
    } else if (path === '/system' || path.startsWith('/system/')) {
      onEvent('/system', structuredClone(tree.system || {}));
    } else onEvent(path, data);
  };

  let connectedAt = 0;
  let openedAt = 0;
  let failures = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const closeStream = () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
      eventSource = null;
    }
  };

  // The server ends each stream after ~100 s on purpose; reconnect after 1 s then.
  // A stream that failed or died early backs off 3 s, 6 s, 12 s … up to 60 s.
  const scheduleReconnect = () => {
    const endedNormally = openedAt > 0 && Date.now() - openedAt > 30_000;
    closeStream();
    if (isClosed || document.hidden) return;
    failures = endedNormally ? 0 : failures + 1;
    const delay = endedNormally ? 1000 : Math.min(60_000, 3000 * 2 ** (failures - 1));
    reconnectTimer = setTimeout(connect, delay);
  };

  const connect = () => {
    if (isClosed || document.hidden) return;
    closeStream();
    openedAt = 0;
    connectedAt = Date.now();

    try {
      const url = "/api/events";
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        openedAt = Date.now();
      };

      eventSource.addEventListener('put', (event) => {
        lastMessageTime = Date.now();
        try {
          const parsed = JSON.parse(event.data);
          receive(parsed.path, parsed.data, false);
        } catch (e) {
          console.error('[Firebase SSE] Parse error:', e);
        }
      });

      eventSource.addEventListener('patch', (event) => {
        lastMessageTime = Date.now();
        try {
          const parsed = JSON.parse(event.data);
          receive(parsed.path, parsed.data, true);
        } catch (e) {
          console.error('[Firebase SSE] Parse error:', e);
        }
      });

      eventSource.addEventListener('keep-alive', () => {
        lastMessageTime = Date.now();
      });

      // Reconnect ourselves instead of letting the browser retry every few seconds.
      eventSource.onerror = () => scheduleReconnect();
    } catch (e) {
      console.error('[Firebase SSE] Init error:', e);
      scheduleReconnect();
    }
  };

  // Hidden tabs hold no stream and send no requests; the stream reopens when the tab
  // is shown again and immediately replays the current value of every path.
  const onVisibilityChange = () => {
    if (document.hidden) closeStream();
    else if (!eventSource && !reconnectTimer) {
      failures = 0;
      connect();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  connect();

  // Watchdog: Reconnect if no message received in 45s
  const watchdog = setInterval(() => {
    if (eventSource && Date.now() - Math.max(lastMessageTime, connectedAt) > 45000) {
      console.warn('[Firebase SSE] Watchdog timeout, reconnecting...');
      scheduleReconnect();
    }
  }, 10000);

  // Fallback while the stream is down: every 8 s, one batched request for all paths
  // (it used to be seven requests every 8 s, even while the stream was working).
  const fallbackPaths = ["realtime", "system", "traffic/signalState", "traffic/controllerStatus", "traffic/fuzzyStatus",
    "traffic/fuzzyControl", "traffic/edgeAI", "chart_data/latest"];
  const polling = setInterval(async () => {
    if (isClosed || document.hidden) return;
    if (eventSource?.readyState === EventSource.OPEN || Date.now() - lastMessageTime < 5000) return;
    try {
      const response = await fetch(`/api/data?paths=${fallbackPaths.map(encodeURIComponent).join(',')}`, { cache: "no-store" });
      if (!response.ok) return;
      const snapshot = await response.json();
      for (const path of fallbackPaths) {
        if (!isClosed && Object.prototype.hasOwnProperty.call(snapshot, path)) receive(`/${path}`, snapshot[path], false);
      }
    } catch {}
  }, 8000);

  return () => {
    isClosed = true;
    clearInterval(watchdog);
    clearInterval(polling);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    closeStream();
  };
}
