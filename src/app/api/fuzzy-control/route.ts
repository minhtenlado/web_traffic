import { NextResponse } from "next/server";
import { sameOrigin, session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
import { appendAuditEvent } from "@/lib/server/audit";
import type { FuzzyControlMode } from "@/lib/controller";

export async function POST(request: Request) {
  const user = await session();
  if (!user) return NextResponse.json({ error: "Cần đăng nhập" }, { status: 401 });
  if (user.role !== "admin" || !sameOrigin(request)) {
    return NextResponse.json({ error: "Chỉ Admin mới được đổi quyền điều khiển Fuzzy" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const mode = body?.mode as FuzzyControlMode;
    if (mode !== "AUTO" && mode !== "MANUAL_OVERRIDE") {
      return NextResponse.json({ error: "Chế độ điều khiển không hợp lệ" }, { status: 400 });
    }

    const db = database();
    if (mode === "MANUAL_OVERRIDE") {
      const [controllerSnapshot, signalSnapshot] = await Promise.all([
        db.ref("traffic/controllerStatus").get(),
        db.ref("traffic/signalState").get(),
      ]);
      const controller = controllerSnapshot.val();
      const signal = signalSnapshot.val();
      const now = Date.now();
      const controllerFresh = controller?.online === true && controller?.controlEnabled === true &&
        controller?.readOnlyTelemetry !== true && Number.isFinite(controller?.lastSeen) &&
        now - controller.lastSeen * 1000 < 3000;
      const signalFresh = signal?.mode === "auto" && signal?.localControl === false &&
        Number.isFinite(signal?.timestamp) && Math.abs(now / 1000 - signal.timestamp) < 3;
      if (!controllerFresh || !signalFresh) {
        return NextResponse.json({ error: "Chỉ bật ghi đè khi STM32 đang kết nối mới, ở AUTO và Web có quyền điều khiển" }, { status: 423 });
      }
    }

    const record = { mode, updatedAt: Date.now(), actor: user.id };
    await db.ref("traffic/fuzzyControl").set(record);
    await appendAuditEvent(request, user, "control",
      mode === "MANUAL_OVERRIDE" ? "Bật ghi đè thủ công, tạm dừng kế hoạch Fuzzy" : "Trả quyền điều khiển AUTO cho Fuzzy",
      { mode });
    return NextResponse.json(record, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không lưu được quyền điều khiển Fuzzy" }, { status: 500 });
  }
}
