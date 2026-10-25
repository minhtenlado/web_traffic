import { NextResponse } from "next/server";
import { authenticate, sameOrigin, session, sessionToken, setAdminPasswordOverride } from "@/lib/server/auth";
import { appendAuditEvent } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origin không hợp lệ" }, { status: 403 });

  const current = await session();
  if (!current) return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn" }, { status: 401 });
  if (current.role !== "admin") return NextResponse.json({ error: "Chỉ Admin mới được đổi mật khẩu quản trị" }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Nội dung yêu cầu không phải JSON hợp lệ" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });

  const input = body as Record<string, unknown>;
  const currentPassword = typeof input.currentPassword === "string" ? input.currentPassword : "";
  const newPassword = typeof input.newPassword === "string" ? input.newPassword : "";
  const passwordConfirm = typeof input.passwordConfirm === "string" ? input.passwordConfirm : "";
  if (!currentPassword || currentPassword.length > 256) return NextResponse.json({ error: "Hãy nhập mật khẩu hiện tại" }, { status: 400 });
  if (newPassword.length < 12 || newPassword.length > 128) {
    return NextResponse.json({ error: "Mật khẩu mới phải dài từ 12 đến 128 ký tự" }, { status: 400 });
  }
  if (newPassword !== passwordConfirm) return NextResponse.json({ error: "Mật khẩu xác nhận không khớp" }, { status: 400 });
  if (newPassword === currentPassword) return NextResponse.json({ error: "Mật khẩu mới phải khác mật khẩu hiện tại" }, { status: 400 });

  try {
    const verified = await authenticate(current.username, currentPassword);
    if (!verified || verified.id !== current.id || verified.role !== "admin") {
      return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 401 });
    }

    const changedAt = await setAdminPasswordOverride(verified, newPassword);
    await appendAuditEvent(request, verified, "auth", "Đổi mật khẩu Admin");

    const response = NextResponse.json({ success: true, message: "Đã đổi mật khẩu. Các phiên Admin khác cần đăng nhập lại." }, {
      headers: { "Cache-Control": "no-store" },
    });
    response.cookies.set("traffic_session", sessionToken(verified, changedAt + 1), {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 8 * 3600,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Không thể lưu mật khẩu mới. Hãy kiểm tra kết nối Firebase rồi thử lại." }, { status: 503 });
  }
}
