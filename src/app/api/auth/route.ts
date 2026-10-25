import { NextResponse } from "next/server";
import { authenticate, session, sessionToken, sameOrigin } from "@/lib/server/auth";
import { appendAuditEvent } from "@/lib/server/audit";
const attempts = new Map<string, { count: number; until: number }>();
export async function GET() { const user = await session(); return NextResponse.json({ user }, { status: user ? 200 : 401 }); }
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin không hợp lệ" }, { status: 403 });
  try {
    const { username, password } = await request.json();
    if (typeof username !== "string" || typeof password !== "string" || username.length > 128 || password.length > 256) return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    const key = username.toLowerCase(); const entry = attempts.get(key);
    if (entry && entry.until > Date.now() && entry.count >= 5) return NextResponse.json({ error: "Thử lại sau 60 giây" }, { status: 429 });
    const user = authenticate(key, password);
    if (!user) {
      const count = entry && entry.until > Date.now() ? entry.count+1 : 1;
      if (attempts.size > 1000) attempts.clear();
      attempts.set(key, { count, until: Date.now()+60000 });
      return NextResponse.json({ error: "Tài khoản hoặc mật khẩu không đúng" }, { status: 401 });
    }
    attempts.delete(key);
    const response = NextResponse.json({ user });
    response.cookies.set("traffic_session", sessionToken(user), {
      httpOnly: true, sameSite: "strict", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 8*3600,
    });
    await appendAuditEvent(request, user, "auth", "Đăng nhập hệ thống");
    return response;
  } catch { return NextResponse.json({ error: "Dịch vụ đăng nhập chưa sẵn sàng" }, { status: 503 }); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  const user = await session();
  if (user) await appendAuditEvent(request, user, "auth", "Đăng xuất hệ thống");
  const response = NextResponse.json({ success: true }); response.cookies.delete("traffic_session"); return response;
}
