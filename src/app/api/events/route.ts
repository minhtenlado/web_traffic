import { session } from "@/lib/server/auth";
import { database, publicAcknowledgements } from "@/lib/server/firebase";
export const dynamic = "force-dynamic";
// Each stream ends itself after STREAM_LIFETIME_MS and the browser reconnects, so no
// invocation runs into the platform limit (Hobby's default is 300 s, which used to end
// every stream as a FUNCTION_INVOCATION_TIMEOUT and pin an instance for the full 300 s).
export const maxDuration = 120;
const STREAM_LIFETIME_MS = 100_000;
const KEEPALIVE_MS = 15_000;
// The stream also carries the system paths the 8-second poll used to supply, so the
// browser no longer has to poll while the stream is up.
const paths = ["realtime", "system/alertAcknowledgements", "system/hardware", "system/status", "system/board_status",
  "traffic/signalState", "traffic/controllerStatus", "traffic/fuzzyStatus", "traffic/fuzzyControl", "traffic/edgeAI", "chart_data/latest"];
export async function GET(request: Request) {
  if (!await session()) return new Response(null, { status: 401 });
  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const subscriptions: (() => void)[] = [];
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const keepalive = setInterval(() => send("keep-alive", null), KEEPALIVE_MS);
      const lifetime = setTimeout(() => cleanup(), STREAM_LIFETIME_MS);
      cleanup = () => {
        if (closed) return; closed = true; clearInterval(keepalive); clearTimeout(lifetime);
        subscriptions.forEach((stop) => stop()); try { controller.close(); } catch {}
      };
      request.signal.addEventListener("abort", cleanup, { once: true });
      try {
        for (const path of paths) {
          const ref = database().ref(path);
          const callback = ref.on("value", (snapshot) => send("put", { path: "/"+path,
            data: path === "system/alertAcknowledgements" ? publicAcknowledgements(snapshot.val()) : snapshot.val() }), () => cleanup());
          subscriptions.push(() => ref.off("value", callback));
        }
      } catch { cleanup(); }
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
