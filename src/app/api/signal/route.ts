import { NextResponse } from "next/server";
import { session, sameOrigin } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
import { appendAuditEvent } from "@/lib/server/audit";
import { TIMING_LIMITS, type TimingKey } from "@/lib/controller";

// This endpoint accepts requests only; actual signalState is written by the UART bridge.
export async function POST(request: Request) {
  const user = await session();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  if (!["admin", "operator"].includes(user.role) || !sameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const controllerStatus = (await database().ref("traffic/controllerStatus").get()).val();
    if (controllerStatus?.readOnlyTelemetry === true || controllerStatus?.controlEnabled === false) {
      return NextResponse.json({ error: "Kết nối STM32 hiện ở chế độ chỉ đọc; lệnh điều khiển đang khóa" }, { status: 423 });
    }
    const body = await request.json();
    const { id, timestamp, action } = body;
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,128}$/.test(id) ||
        !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 10000) {
      return NextResponse.json({ error: "Yêu cầu không hợp lệ hoặc hết hạn" }, { status: 400 });
    }
    if (action === "clear_emergency") {
      if (controllerStatus?.online !== true || controllerStatus?.controlEnabled !== true) {
        return NextResponse.json({ error: "STM32 chưa sẵn sàng nhận lệnh hủy khẩn cấp" }, { status: 423 });
      }
      const signalState = (await database().ref("traffic/signalState").get()).val();
      if (signalState?.mode !== "emergency" || !Number.isFinite(signalState?.timestamp) ||
          Math.abs(Date.now() / 1000 - signalState.timestamp) > 3) {
        return NextResponse.json({ error: "STM32 chưa xác nhận trạng thái dừng khẩn cấp" }, { status: 409 });
      }
    }
    let command: Record<string, unknown> = { id, timestamp, action };
    if (action === "set_mode" && ["auto", "manual"].includes(body.mode)) {
      command.mode = body.mode;
    } else if (action === "set_duration" && Object.hasOwn(TIMING_LIMITS, body.phase)) {
      const [lo, hi] = TIMING_LIMITS[body.phase as TimingKey];
      if (!Number.isInteger(body.duration) || body.duration < lo || body.duration > hi) {
        return NextResponse.json({ error: "Thời lượng ngoài giới hạn STM32" }, { status: 400 });
      }
      command = { ...command, phase: body.phase, duration: body.duration };
    } else if (action === "set_plan") {
      if (user.role !== "admin") return new Response(null, { status: 403 });
      const keys = ["greenNS","greenEW","leftNS","leftEW","yellow","allred"];
      const ranges = [[5,90],[5,90],[5,30],[5,30],[2,9],[1,9]];
      const valid = body.plan && keys.every((key,i) => Number.isInteger(body.plan[key]) && body.plan[key]>=ranges[i][0] && body.plan[key]<=ranges[i][1]);
      const remaining = body.validUntil-Math.floor(Date.now()/1000);
      if (!valid || !Number.isInteger(body.planId) || body.planId<1 || body.planId>0xFFFFFF || !Number.isInteger(remaining) || remaining<1 || remaining>300) return new Response(null, { status: 400 });
      command = { ...command, plan: Object.fromEntries(keys.map((key) => [key,body.plan[key]])), planId: body.planId, validUntil: body.validUntil };
    } else if (action !== "next" && action !== "emergency" && action !== "clear_emergency") {
      return NextResponse.json({ error: "Lệnh không được STM32 hỗ trợ" }, { status: 400 });
    }
    command = { ...command, status: "PENDING", actor: user.id, queueKey: `${action === "emergency" ? 0 : 1}:${timestamp}:${id}`, expiresAt: timestamp+10000 };
    const transaction = await database().ref(`traffic/commands/${id}`).transaction((existing) => existing === null ? command : undefined);
    if (!transaction.committed) return NextResponse.json({ error: "ID đã tồn tại" }, { status: 409 });
    const actionLabel = action === "set_mode" ? `Xếp hàng yêu cầu đổi chế độ ${String(command.mode)}` :
      action === "set_duration" ? `Xếp hàng yêu cầu đặt ${String(command.phase)} = ${String(command.duration)} giây` :
      action === "set_plan" ? "Xếp hàng kế hoạch pha đèn" :
      action === "emergency" ? "Xếp hàng lệnh khẩn cấp" :
      action === "clear_emergency" ? "Xếp hàng yêu cầu hủy dừng khẩn cấp" : "Xếp hàng yêu cầu chuyển pha";
    await appendAuditEvent(request, user, "control", actionLabel, { commandId: id, status: "PENDING" });
    return NextResponse.json({ id, status: "PENDING" }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Không ghi được yêu cầu điều khiển" }, { status: 500 });
  }
}
export async function GET() {
  if (!await session()) return new Response(null, { status: 401 });
  try { return NextResponse.json((await database().ref('traffic/signalState').get()).val()); }
  catch { return new Response(null, { status: 502 }); }
}
