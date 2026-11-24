import { session } from "@/lib/server/auth";
import { database, publicAcknowledgements } from "@/lib/server/firebase";
const allowed = new Set(["realtime", "system", "traffic/signalState", "traffic/controllerStatus", "traffic/fuzzyStatus", "traffic/fuzzyControl", "traffic/edgeAI", "chart_data/latest", "predictions/latest"]);
const noStore = { headers: { "Cache-Control": "no-store" } };

async function read(path: string) {
  const db = database();
  if (path === "system") {
    const [hardware, status, boardStatus, acknowledgements] = await Promise.all([
      db.ref("system/hardware").get(), db.ref("system/status").get(),
      db.ref("system/board_status").get(), db.ref("system/alertAcknowledgements").get(),
    ]);
    return { hardware: hardware.val(), status: status.val(), board_status: boardStatus.val(),
      alertAcknowledgements: publicAcknowledgements(acknowledgements.val()) };
  }
  return (await db.ref(path).get()).val();
}

/**
 * `?path=a` returns one allowed path. `?paths=a,b,c` returns `{ a, b, c }` from one
 * invocation; a path whose read fails is left out, as a failed single request was.
 */
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const params = new URL(request.url).searchParams;
  const batch = params.get("paths");
  if (batch !== null) {
    const paths = [...new Set(batch.split(","))];
    if (!paths.every((path) => allowed.has(path))) return new Response(null, { status: 403 });
    const results = await Promise.allSettled(paths.map(read));
    if (results.every((result) => result.status === "rejected")) return new Response(null, { status: 502 });
    return Response.json(Object.fromEntries(paths.flatMap((path, index) => {
      const result = results[index];
      return result.status === "fulfilled" ? [[path, result.value]] : [];
    })), noStore);
  }
  const path = params.get("path") || "";
  if (!allowed.has(path)) return new Response(null, { status: 403 });
  try { return Response.json(await read(path), noStore); }
  catch { return new Response(null, { status: 502 }); }
}
