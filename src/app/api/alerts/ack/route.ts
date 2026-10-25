import { NextResponse } from "next/server";
import { buildCameraAlerts } from "@/lib/traffic-status";
import { sameOrigin, session } from "@/lib/server/auth";
import { appendAuditEvent } from "@/lib/server/audit";
import { database } from "@/lib/server/firebase";

export const dynamic = "force-dynamic";
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^alert-cam_0[1-5]-(err|cong)$/.test(value);

export async function GET() {
  const user = await session();
  if (!user) return new Response(null, { status: 401 });
  try {
    const value = (await database().ref("system/alertAcknowledgements").get()).val() || {};
    const acknowledgements = Object.fromEntries(Object.entries(value).map(([id, entry]) => [id, {
      acknowledgedAt: Number((entry as Record<string, unknown>)?.acknowledgedAt) || null,
    }]));
    return NextResponse.json({ acknowledgements }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không đọc được trạng thái xác nhận cảnh báo" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await session();
  if (!user) return new Response(null, { status: 401 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const body = await request.json();
    const acknowledgeIds: unknown[] = Array.isArray(body.acknowledgeIds) ? body.acknowledgeIds : [];
    const resolveIds: unknown[] = Array.isArray(body.resolveIds) ? body.resolveIds : [];
    if (acknowledgeIds.length > 5 || resolveIds.length > 5 ||
        [...acknowledgeIds, ...resolveIds].some((id) => !validId(id))) {
      return NextResponse.json({ error: "Danh sách cảnh báo không hợp lệ" }, { status: 400 });
    }
    const records = (await database().ref("realtime").get()).val() || {};
    const active = new Set(buildCameraAlerts(records, []).map((alert) => alert.id));
    if (acknowledgeIds.some((id) => !active.has(id as string))) {
      return NextResponse.json({ error: "Cảnh báo đã được xử lý hoặc không còn hoạt động" }, { status: 409 });
    }
    const ackRef = database().ref("system/alertAcknowledgements");
    const now = Date.now();
    await Promise.all(acknowledgeIds.map((id) => ackRef.child(id as string).set({
      acknowledgedAt: now,
      actor: { id: user.id, username: user.username, name: user.fullName, role: user.role },
    })));
    const resolved = resolveIds.filter((id) => !active.has(id as string));
    await Promise.all(resolved.map((id) => ackRef.child(id as string).remove()));
    if (acknowledgeIds.length) {
      await appendAuditEvent(request, user, "alerts", `Ghi nhận ${acknowledgeIds.length} cảnh báo`, {
        count: acknowledgeIds.length,
      });
    }
    return NextResponse.json({ success: true, resolvedIds: resolved }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không lưu được trạng thái cảnh báo" }, { status: 503 });
  }
}
