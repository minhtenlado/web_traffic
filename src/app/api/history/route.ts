import { session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
import { flattenHistoryBuckets, historyWindow } from "@/lib/history-range";

/**
 * Minute history (actual + issued forecasts) published by the Genio in hour buckets, kept per calendar day.
 * `?day=YYYY-MM-DD` returns that whole day (00:00–23:59, today or the 2 previous days); `?hours=N` the last N hours.
 */
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const params = new URL(request.url).searchParams;
  const day = params.get("day");
  const hours = Number(params.get("hours"));
  const window = historyWindow(Date.now(), hours, day);
  if (!window) return new Response(null, { status: 400 });
  try {
    const snapshot = await database().ref("traffic/history/minutes").orderByKey()
      .startAt(window.startKey).endAt(window.endKey).get();
    const rows = flattenHistoryBuckets(snapshot.val(), window.from, window.to);
    return Response.json({ day: day ?? null, hours: day ? 24 : hours, from: window.from, to: window.to, rows },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
