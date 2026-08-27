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

export function firebaseListen(path: string, callback: (data: any) => void) {
  let eventSource: EventSource | null = null;
  let isClosed = false;
  let lastMessageTime = Date.now();

  const connect = () => {
    if (isClosed) return;
    if (eventSource) {
      eventSource.close();
    }
    
    const url = `${DB_URL}/${path}.json`;
    eventSource = new EventSource(url);

    eventSource.addEventListener('put', (event) => {
      lastMessageTime = Date.now();
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.path === '/') {
          callback(parsed.data);
        } else {
          firebaseGet(path).then(callback).catch(console.error);
        }
      } catch (e) {
        console.error('[Firebase SSE] Parse error:', e);
      }
    });

    eventSource.addEventListener('patch', (event) => {
      lastMessageTime = Date.now();
      firebaseGet(path).then(callback).catch(console.error);
    });

    eventSource.addEventListener('keep-alive', () => {
      lastMessageTime = Date.now();
    });

    eventSource.addEventListener('cancel', () => {
      console.warn(`[Firebase SSE] Cancel received for ${path}`);
      setTimeout(connect, 2000);
    });

    eventSource.onerror = (err) => {
      console.warn(`[Firebase SSE] Connection error for ${path}`, err);
      if (eventSource?.readyState === EventSource.CLOSED) {
        setTimeout(connect, 2000);
      }
    };
  };

  connect();

  // Watchdog: If no message (including keep-alive) for 65 seconds, reconnect manually
  const watchdog = setInterval(() => {
    if (Date.now() - lastMessageTime > 65000) {
      console.warn(`[Firebase SSE] Watchdog timeout for ${path}, reconnecting...`);
      connect();
    }
  }, 10000);

  return () => {
    isClosed = true;
    clearInterval(watchdog);
    if (eventSource) eventSource.close();
  };
}
