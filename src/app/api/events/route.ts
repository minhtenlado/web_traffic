import { session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const paths = ["realtime", "system/hardware", "system/status", "traffic/signalState", "traffic/controllerStatus", "traffic/fuzzyStatus", "traffic/fuzzyControl", "traffic/edgeAI", "chart_data/latest"];
      const subscriptions: (() => void)[] = [];
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const keepalive = setInterval(() => send("keep-alive", null), 15000);
      cleanup = () => { if (closed) return; closed = true; clearInterval(keepalive); subscriptions.forEach((stop) => stop()); try { controller.close(); } catch {} };
      request.signal.addEventListener("abort", cleanup, { once: true });
      try {
        for (const path of paths) {
          const ref = database().ref(path);
          const callback = ref.on("value", (snapshot) => send("put", { path: "/"+path, data: snapshot.val() }), () => cleanup());
          subscriptions.push(() => ref.off("value", callback));
        }
      } catch { cleanup(); }
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
