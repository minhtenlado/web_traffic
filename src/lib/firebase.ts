export const DB_URL = "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app";

export async function firebaseGet(path: string) {
  const res = await fetch(`${DB_URL}/${path}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
  return res.json();
}

export async function firebaseSet(path: string, data: any) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase SET failed: ${res.status}`);
  return res.json();
}

export async function firebaseUpdate(path: string, data: any) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase UPDATE failed: ${res.status}`);
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

  const connect = () => {
    if (isClosed) return;
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
    }

    try {
      const url = `${DB_URL}/.json`;
      eventSource = new EventSource(url);

      eventSource.addEventListener('put', (event) => {
        lastMessageTime = Date.now();
        try {
          const parsed = JSON.parse(event.data);
          onEvent(parsed.path, parsed.data);
        } catch (e) {
          console.error('[Firebase SSE] Parse error:', e);
        }
      });

      eventSource.addEventListener('patch', (event) => {
        lastMessageTime = Date.now();
        try {
          const parsed = JSON.parse(event.data);
          onEvent(parsed.path, parsed.data);
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
      const [realtimeRes, statusRes] = await Promise.allSettled([
        fetch(`${DB_URL}/realtime.json`, { cache: "no-store" }),
        fetch(`${DB_URL}/system.json`, { cache: "no-store" }),
      ]);
      if (realtimeRes.status === "fulfilled" && realtimeRes.value.ok) {
        const rData = await realtimeRes.value.json();
        if (rData) onEvent('/realtime', rData);
      }
      if (statusRes.status === "fulfilled" && statusRes.value.ok) {
        const sData = await statusRes.value.json();
        if (sData) onEvent('/system', sData);
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
