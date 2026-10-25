import { readFileSync } from "node:fs";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export interface User { id: string; username: string; fullName: string; email: string; role: "admin" | "operator" }
interface Account extends User { salt: string; hash: string }
function settings(): { secret: string; users: Account[] } {
  const inline = process.env.TRAFFIC_AUTH_JSON;
  const path = process.env.TRAFFIC_AUTH_FILE;
  if (!inline && !path) throw new Error("TRAFFIC_AUTH_JSON or TRAFFIC_AUTH_FILE is required");
  const config = JSON.parse(inline || readFileSync(path!, "utf8"));
  if (typeof config.secret !== "string" || config.secret.length < 32 || !Array.isArray(config.users) || !config.users.length ||
      config.users.some((u: Account) => !u || typeof u.username !== "string" || typeof u.salt !== "string" ||
        !u.salt || typeof u.hash !== "string" || !/^[a-f0-9]{128}$/i.test(u.hash) || !["admin", "operator"].includes(u.role))) {
    throw new Error("Invalid traffic auth configuration");
  }
  return config;
}
export function configuredUsers(): User[] {
  return settings().users.map(({ id, username, fullName, email, role }) => ({
    id, username, fullName, email, role,
  }));
}
function sign(payload: string) { return createHmac("sha256", settings().secret).update(payload).digest("base64url"); }
export function authenticate(username: string, password: string): User | null {
  const account = settings().users.find((u) => u.username === username.toLowerCase());
  const salt = account?.salt || "invalid-account";
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(account?.hash || "00".repeat(64), "hex");
  if (!account || expected.length !== actual.length || !timingSafeEqual(actual, expected)) return null;
  const { hash, salt: _salt, ...user } = account;
  return user;
}
export function sessionToken(user: User) {
  const payload = Buffer.from(JSON.stringify({ user, expires: Date.now()+8*3600_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}
export async function session(): Promise<User | null> {
  try {
    const token = (await cookies()).get("traffic_session")?.value || "";
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload)); const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const data = JSON.parse(Buffer.from(payload,"base64url").toString());
    return data.expires > Date.now() ? data.user : null;
  } catch { return null; }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
