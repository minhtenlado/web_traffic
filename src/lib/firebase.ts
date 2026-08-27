export const DB_URL = "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app";

export async function firebaseGet(path: string) {
  const res = await fetch(`${DB_URL}/${path}.json`);
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
  const url = `${DB_URL}/${path}.json`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('put', (event) => {
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
    firebaseGet(path).then(callback).catch(console.error);
  });

  eventSource.onerror = (err) => {
    console.warn('[Firebase SSE] Connection error, will auto-reconnect:', err);
  };

  return () => {
    eventSource.close();
  };
}
