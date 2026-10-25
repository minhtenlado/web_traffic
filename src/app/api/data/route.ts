import { session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
const allowed = new Set(["realtime", "system", "traffic/signalState", "traffic/controllerStatus", "traffic/fuzzyStatus", "traffic/edgeAI", "chart_data/latest", "predictions/latest"]);
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const path = new URL(request.url).searchParams.get("path") || "";
  if (!allowed.has(path)) return new Response(null, { status: 403 });
  try { return Response.json((await database().ref(path).get()).val(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return new Response(null, { status: 502 }); }
}
