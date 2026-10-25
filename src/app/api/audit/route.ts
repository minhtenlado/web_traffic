import { NextResponse } from "next/server";
import { session } from "@/lib/server/auth";
import { readRecentAuditEvents } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await session();
  if (!user) return new Response(null, { status: 401 });
  if (user.role !== "admin") return new Response(null, { status: 403 });
  try {
    const entries = await readRecentAuditEvents(500);
    const events = entries.map((event) => ({
      id: event.id,
      timestamp: new Date(Number(event.timestamp)).toISOString(),
      user: String(event.actor?.name || event.actor?.username || "Hệ thống"),
      role: event.actor?.role === "admin" ? "Admin" : "Vận hành viên",
      action: String(event.action || "Hoạt động"),
      ip: String(event.ip || ""),
      category: String(event.category || "system"),
      details: event.details || {},
    }));
    return NextResponse.json({ events, source: "firebase_rtdb", limit: 500 }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Không đọc được nhật ký máy chủ" }, { status: 503 });
  }
}
