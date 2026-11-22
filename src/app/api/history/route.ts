import { session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
import { flattenHistoryBuckets, historyWindow } from "@/lib/history-range";

/** Minute history (actual + issued forecasts) published by the Genio in hour buckets (kept 3 days). */
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const params = new URL(request.url).searchParams;
  const hours = Number(params.get("hours"));
  const offset = Number(params.get("offset") ?? 0);
  const window = historyWindow(Date.now(), hours, offset);
  if (!window) return new Response(null, { status: 400 });
  try {
    const snapshot = await database().ref("traffic/history/minutes").orderByKey()
      .startAt(window.startKey).endAt(window.endKey).get();
    const rows = flattenHistoryBuckets(snapshot.val(), window.from, window.to);
    return Response.json({ hours, offset, from: window.from, to: window.to, rows },
      { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
