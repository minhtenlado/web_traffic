import { database } from "./firebase";
import type { User } from "./auth";

export type AuditCategory = "auth" | "control" | "alerts";

function requestIp(request: Request) {
  const candidate = request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return candidate?.slice(0, 64) || "";
}

export async function appendAuditEvent(
  request: Request,
  user: User,
  category: AuditCategory,
  action: string,
  details?: Record<string, string | number | boolean>,
) {
  try {
    const ref = database().ref("system/auditLog");
    const now = Date.now();
    await ref.push({
      timestamp: now,
      actor: { id: user.id, username: user.username, name: user.fullName, role: user.role },
      category,
      action: action.slice(0, 180),
      ...(details ? { details } : {}),
      ip: requestIp(request),
      source: "web_admin",
    });

    // Keep this operational journal bounded in RTDB instead of growing forever.
    const oldest = await ref.orderByChild("timestamp").limitToFirst(501).get();
    const keys: string[] = [];
    oldest.forEach((child) => { if (child.key) keys.push(child.key); return false; });
    const removeCount = Math.max(0, keys.length - 500);
    await Promise.all(keys.slice(0, removeCount).map((key) => ref.child(key).remove()));
  } catch {
    // Auditing must not prevent a successful login, alert acknowledgement, or command queue write.
  }
}

export async function readRecentAuditEvents(limit = 500) {
  const snapshot = await database().ref("system/auditLog")
    .orderByChild("timestamp").limitToLast(Math.min(500, Math.max(1, limit))).get();
  const events: Array<Record<string, any>> = [];
  snapshot.forEach((child) => {
    const value = child.val();
    if (!value || !Number.isFinite(Number(value.timestamp))) return false;
    events.push({ id: child.key, ...value });
    return false;
  });
  return events.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
}
