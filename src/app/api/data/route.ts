import { session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
const allowed = new Set(["realtime", "system", "traffic/signalState", "traffic/controllerStatus", "traffic/fuzzyStatus", "traffic/fuzzyControl", "traffic/edgeAI", "chart_data/latest", "predictions/latest"]);
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!allowed.has(path)) return new Response(null, { status: 403 });
  try {
    if (path === "system") {
      const db = database();
      const [hardware, status, boardStatus, acknowledgements] = await Promise.all([
        db.ref("system/hardware").get(), db.ref("system/status").get(),
        db.ref("system/board_status").get(), db.ref("system/alertAcknowledgements").get(),
      ]);
      const rawAcks = acknowledgements.val() || {};
      const safeAcks = Object.fromEntries(Object.entries(rawAcks).map(([id, value]) => [id, {
        acknowledgedAt: Number((value as Record<string, unknown>)?.acknowledgedAt) || null,
      }]));
      return Response.json({ hardware: hardware.val(), status: status.val(), board_status: boardStatus.val(),
        alertAcknowledgements: safeAcks }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json((await database().ref(path).get()).val(), { headers: { "Cache-Control": "no-store" } });
  }
  catch { return new Response(null, { status: 502 }); }
}
