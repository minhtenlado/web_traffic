import { NextResponse } from "next/server";
import { configuredUsers, session } from "@/lib/server/auth";
import { readRecentAuditEvents } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await session();
  if (!current) return new Response(null, { status: 401 });
  if (current.role !== "admin") return new Response(null, { status: 403 });
  let lastLogin = new Map<string, number>();
  let loginHistoryAvailable = true;
  try {
    const events = await readRecentAuditEvents(500);
    for (const event of events) {
      if (event.category !== "auth" || event.action !== "Đăng nhập hệ thống") continue;
      const id = String(event.actor?.id || "");
      const at = Number(event.timestamp);
      if (id && Number.isFinite(at) && !lastLogin.has(id)) lastLogin.set(id, at);
    }
  } catch {
    loginHistoryAvailable = false;
  }
  try {
    const users = configuredUsers();
    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        status: "enabled",
        lastLoginAt: lastLogin.get(user.id) ?? null,
      })),
      source: "server_auth_configuration",
      management: "deployment_configuration",
      loginHistoryAvailable,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không đọc được danh sách tài khoản máy chủ" }, { status: 503 });
  }
}
