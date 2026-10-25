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

    // Firebase rules do not currently index this node. Read the bounded audit
    // collection and sort locally instead of issuing an orderByChild query.
    const snapshot = await ref.get();
    const entries: Array<{ key: string; timestamp: number }> = [];
    snapshot.forEach((child) => {
      if (child.key) {
        const value = child.val();
        const timestamp = Number(value?.timestamp);
        entries.push({ key: child.key, timestamp: Number.isFinite(timestamp) ? timestamp : 0 });
      }
      return false;
    });
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const excess = Math.max(0, entries.length - 500);
    await Promise.all(entries.slice(0, excess).map(({ key }) => ref.child(key).remove()));
  } catch {
    // Auditing must not prevent a successful login, alert acknowledgement, or command queue write.
  }
}

export async function readRecentAuditEvents(limit = 500) {
  const snapshot = await database().ref("system/auditLog").get();
  const events: Array<Record<string, any>> = [];
  snapshot.forEach((child) => {
    const value = child.val();
    if (!value || !Number.isFinite(Number(value.timestamp))) return false;
    events.push({ id: child.key, ...value });
    return false;
  });
  return events.sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .slice(0, Math.min(500, Math.max(1, limit)));
}
