/** 2–24 h minute history published by the Genio (see edge `history_export.py`). */
export const HISTORY_RANGE_HOURS = [2, 4, 8, 12, 24] as const;
export type HistoryRangeHours = (typeof HISTORY_RANGE_HOURS)[number];

export type HistoryRow = {
  t: number;
  s?: string;
  c?: Record<string, number>;
  p?: Record<string, Record<string, number>>;
};

const VN_OFFSET_MS = 7 * 3600 * 1000;

/** First hour-bucket key (h + YYYYMMDDHH, Asia/Ho_Chi_Minh) that can hold minutes of the range. */
export function historyStartKey(nowMs: number, hours: number) {
  const local = new Date(nowMs + VN_OFFSET_MS - hours * 3600 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `h${local.getUTCFullYear()}${pad(local.getUTCMonth() + 1)}${pad(local.getUTCDate())}${pad(local.getUTCHours())}`;
}

function counts(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const result: Record<string, number> = {};
  for (const [camera, count] of Object.entries(value as Record<string, unknown>)) {
    if (/^cam_\d{2}$/.test(camera) && Number.isInteger(count) && (count as number) >= 0) result[camera] = count as number;
  }
  return Object.keys(result).length ? result : undefined;
}

function parseRow(raw: any): HistoryRow | null {
  const t = Number(raw?.t);
  if (!Number.isFinite(t) || t <= 0) return null;
  const row: HistoryRow = { t };
  if (typeof raw?.s === "string" && /^[oim]{1,8}$/.test(raw.s)) row.s = raw.s;
  const actual = counts(raw?.c);
  if (actual) row.c = actual;
  if (raw?.p && typeof raw.p === "object") {
    const predicted: Record<string, Record<string, number>> = {};
    for (const [horizon, value] of Object.entries(raw.p)) {
      const parsed = /^h\d{1,2}$/.test(horizon) ? counts(value) : undefined;
      if (parsed) predicted[horizon] = parsed;
    }
    if (Object.keys(predicted).length) row.p = predicted;
  }
  return row.c || row.p ? row : null;
}

/** Flatten `{hYYYYMMDDHH: {mMM: row}}` into rows within [fromSeconds, toSeconds], sorted by time. */
export function flattenHistoryBuckets(buckets: unknown, fromSeconds: number, toSeconds: number): HistoryRow[] {
  if (!buckets || typeof buckets !== "object") return [];
  const byTime = new Map<number, HistoryRow>();
  for (const [key, bucket] of Object.entries(buckets as Record<string, unknown>)) {
    if (!/^h\d{10}$/.test(key) || !bucket || typeof bucket !== "object") continue;
    for (const [minuteKey, raw] of Object.entries(bucket as Record<string, unknown>)) {
      if (!/^m\d{2}$/.test(minuteKey)) continue;
      const row = parseRow(raw);
      if (row && row.t >= fromSeconds && row.t <= toSeconds) byTime.set(row.t, row);
    }
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

export function parseHistoryResponse(data: any): HistoryRow[] {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map(parseRow).filter((row: HistoryRow | null): row is HistoryRow => row !== null)
    .sort((a: HistoryRow, b: HistoryRow) => a.t - b.t);
}

type SeriesPoint = { timestamp: number; value: number | null };

/** Insert a null after any gap longer than 90 s so charts break instead of bridging outages. */
function withGaps(points: { timestamp: number; value: number }[]): SeriesPoint[] {
  const result: SeriesPoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && point.timestamp - previous.timestamp > 90) result.push({ timestamp: previous.timestamp + 60, value: null });
    result.push(point);
  }
  return result;
}

/** Actual and horizon-matched forecast series for one camera, plus error metrics on observed minutes. */
export function historyRangeSeries(rows: HistoryRow[], camera: string, cameraIndex: number, horizon: number) {
  const key = `h${horizon}`;
  const actual = withGaps(rows.filter(row => row.c?.[camera] !== undefined)
    .map(row => ({ timestamp: row.t, value: row.c![camera] })));
  const predicted = withGaps(rows.filter(row => row.p?.[key]?.[camera] !== undefined)
    .map(row => ({ timestamp: row.t, value: row.p![key][camera] })));
  const errors = rows
    .filter(row => row.s?.[cameraIndex] === "o" && row.c?.[camera] !== undefined && row.p?.[key]?.[camera] !== undefined)
    .map(row => row.p![key][camera] - row.c![camera]);
  const samples = errors.length;
  return {
    actual, predicted, samples,
    mae: samples ? errors.reduce((sum, error) => sum + Math.abs(error), 0) / samples : null,
    rmse: samples ? Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / samples) : null,
  };
}
