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
      for (const key of ['signalState', 'controllerStatus', 'commandResult', 'fuzzyStatus']) {
        if (tree.traffic?.[key]) onEvent(`/traffic/${key}`, structuredClone(tree.traffic[key]));
      }
    } else if (path === '/realtime' || path.startsWith('/realtime/')) {
      onEvent('/realtime', structuredClone(tree.realtime || {}));
    } else if (path === '/chart_data' || path.startsWith('/chart_data/')) {
      onEvent('/chart_data/latest', structuredClone(tree.chart_data?.latest || {}));
    } else if (path === '/system' || path.startsWith('/system/')) {
      onEvent('/system', structuredClone(tree.system || {}));
    } else onEvent(path, data);
  };

  const connect = () => {
    if (isClosed) return;
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
    }

    try {
      const url = "/api/events";
      eventSource = new EventSource(url);

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

      eventSource.addEventListener('cancel', () => {
        console.warn('[Firebase SSE] Cancel received, reconnecting...');
        setTimeout(connect, 3000);
      });

      eventSource.onerror = (err) => {
        console.warn('[Firebase SSE] Connection error:', err);
        if (eventSource?.readyState === EventSource.CLOSED) {
          setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      console.error('[Firebase SSE] Init error:', e);
    }
  };

  connect();

  // Watchdog: Reconnect if no message received in 45s
  const watchdog = setInterval(() => {
    if (Date.now() - lastMessageTime > 45000) {
      console.warn('[Firebase SSE] Watchdog timeout, reconnecting...');
      connect();
    }
  }, 10000);

  // Fallback Polling every 8 seconds to ensure data NEVER goes stale even if SSE drops
  const polling = setInterval(async () => {
    try {
      const [realtimeRes, statusRes, signalRes, controllerRes, fuzzyRes] = await Promise.allSettled([
        fetch(`/api/data?path=realtime`, { cache: "no-store" }),
        fetch(`/api/data?path=system`, { cache: "no-store" }),
        fetch(`/api/data?path=traffic/signalState`, { cache: "no-store" }),
        fetch(`/api/data?path=traffic/controllerStatus`, { cache: "no-store" }),
        fetch(`/api/data?path=traffic/fuzzyStatus`, { cache: "no-store" }),
      ]);
      if (realtimeRes.status === "fulfilled" && realtimeRes.value.ok) {
        const rData = await realtimeRes.value.json();
        if (!isClosed) receive('/realtime', rData, false);
      }
      if (statusRes.status === "fulfilled" && statusRes.value.ok) {
        const sData = await statusRes.value.json();
        if (!isClosed) receive('/system', sData, false);
      }
      if (signalRes.status === "fulfilled" && signalRes.value.ok) {
        const sigData = await signalRes.value.json();
        if (!isClosed) receive('/traffic/signalState', sigData, false);
      }
      if (controllerRes.status === "fulfilled" && controllerRes.value.ok) {
        const pData = await controllerRes.value.json();
        if (!isClosed) receive('/traffic/controllerStatus', pData, false);
      }
      if (fuzzyRes.status === "fulfilled" && fuzzyRes.value.ok) {
        const fData = await fuzzyRes.value.json();
        if (!isClosed) receive('/traffic/fuzzyStatus', fData, false);
      }
    } catch {}
  }, 8000);

  return () => {
    isClosed = true;
    clearInterval(watchdog);
    clearInterval(polling);
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
    }
  };
}
