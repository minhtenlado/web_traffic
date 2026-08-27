/**
 * Firebase Realtime Database Service
 * Uses REST API + Server-Sent Events for real-time sync.
 * Only requires the databaseURL (no apiKey needed for public rules).
 */

const DB_URL = "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app";

/**
 * Read data once from a path.
 */
export async function firebaseGet(path) {
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
  return res.json();
}

/**
 * Write (overwrite) data at a path.
 */
export async function firebaseSet(path, data) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase SET failed: ${res.status}`);
  return res.json();
}

/**
 * Partial update (merge) data at a path.
 */
export async function firebaseUpdate(path, data) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase UPDATE failed: ${res.status}`);
  return res.json();
}

/**
 * Listen for real-time changes using Server-Sent Events (SSE).
 * Returns a function to unsubscribe.
 */
export function firebaseListen(path, callback) {
  const url = `${DB_URL}/${path}.json`;
  const eventSource = new EventSource(url);

  eventSource.addEventListener('put', (event) => {
    try {
      const parsed = JSON.parse(event.data);
      // parsed.path is the sub-path that changed, parsed.data is the new value
      if (parsed.path === '/') {
        callback(parsed.data);
      } else {
        // Partial update — re-fetch full data for simplicity
        firebaseGet(path).then(callback).catch(console.error);
      }
    } catch (e) {
      console.error('[Firebase SSE] Parse error:', e);
    }
  });

  eventSource.addEventListener('patch', (event) => {
    // On patch, re-fetch full data
    firebaseGet(path).then(callback).catch(console.error);
  });

  eventSource.onerror = (err) => {
    console.warn('[Firebase SSE] Connection error, will auto-reconnect:', err);
  };

  // Return unsubscribe function
  return () => {
    eventSource.close();
  };
}
