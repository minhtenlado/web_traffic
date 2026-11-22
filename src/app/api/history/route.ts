import { session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
import { HISTORY_RANGE_HOURS, historyStartKey, flattenHistoryBuckets } from "@/lib/history-range";

/** Minute history (actual + issued forecasts) published by the Genio in hour buckets. */
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const hours = Number(new URL(request.url).searchParams.get("hours"));
  if (!(HISTORY_RANGE_HOURS as readonly number[]).includes(hours)) return new Response(null, { status: 400 });
  try {
    const nowMs = Date.now();
    const snapshot = await database().ref("traffic/history/minutes").orderByKey()
      .startAt(historyStartKey(nowMs, hours)).get();
    const rows = flattenHistoryBuckets(snapshot.val(), nowMs / 1000 - hours * 3600, nowMs / 1000);
    return Response.json({ hours, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return new Response(null, { status: 502 });
  }
}
