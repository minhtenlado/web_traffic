import { NextResponse } from "next/server";
import { AccountExistsError, configuredUsers, createOperatorAccount, sameOrigin, session } from "@/lib/server/auth";
import { appendAuditEvent, readRecentAuditEvents } from "@/lib/server/audit";

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
    const users = await configuredUsers();
    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        status: "enabled",
        lastLoginAt: lastLogin.get(user.id) ?? null,
      })),
      source: "server_auth_configuration_and_firebase_rtdb",
      management: "firebase_rtdb",
      loginHistoryAvailable,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Không đọc được danh sách tài khoản máy chủ" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const current = await session();
  if (!current) return new Response(null, { status: 401 });
  if (current.role !== "admin") return new Response(null, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin không hợp lệ" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Nội dung yêu cầu không phải JSON hợp lệ" }, { status: 400 }); }

  try {
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    const input = body as Record<string, unknown>;
    const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
    const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const password = typeof input.password === "string" ? input.password : "";
    const passwordConfirm = typeof input.passwordConfirm === "string" ? input.passwordConfirm : "";

    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      return NextResponse.json({ error: "Tên tài khoản phải có 3–32 ký tự: chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang" }, { status: 400 });
    }
    if (!fullName || fullName.length > 100) return NextResponse.json({ error: "Họ tên là bắt buộc và tối đa 100 ký tự" }, { status: 400 });
    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ error: "Địa chỉ email không hợp lệ" }, { status: 400 });
    }
    if (password.length < 12 || password.length > 128) {
      return NextResponse.json({ error: "Mật khẩu phải dài từ 12 đến 128 ký tự" }, { status: 400 });
    }
    if (password !== passwordConfirm) return NextResponse.json({ error: "Mật khẩu xác nhận không khớp" }, { status: 400 });

    const user = await createOperatorAccount({ username, fullName, email, password });
    await appendAuditEvent(request, current, "auth", "Tạo tài khoản vận hành viên", { username, role: user.role });
    return NextResponse.json({ user }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AccountExistsError) {
      return NextResponse.json({ error: "Tên tài khoản đã được sử dụng" }, { status: 409 });
    }
    return NextResponse.json({ error: "Không thể lưu tài khoản vào Firebase" }, { status: 503 });
  }
}
