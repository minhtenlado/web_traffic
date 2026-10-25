import { readFileSync } from "node:fs";
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { database } from "./firebase";

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: "admin" | "operator";
}
interface Account extends User { salt: string; hash: string; active?: boolean }
interface PasswordOverride { salt: string; hash: string; changedAt: number }
const accountPath = "system/webAdminUsers";
const passwordOverridePath = "system/webAdminPasswordOverrides";

export class AccountExistsError extends Error {
  constructor() { super("Tài khoản đã tồn tại"); this.name = "AccountExistsError"; }
}

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

function toUser(account: Account): User {
  return { id: account.id, username: account.username, fullName: account.fullName, email: account.email, role: account.role };
}

function accountKey(username: string) {
  return `u_${Buffer.from(username, "utf8").toString("hex")}`;
}

function isPasswordOverride(value: unknown): value is PasswordOverride {
  if (!value || typeof value !== "object") return false;
  const override = value as Partial<PasswordOverride>;
  return typeof override.salt === "string" && /^[a-f0-9]{128}$/i.test(String(override.hash || "")) &&
    Number.isFinite(Number(override.changedAt));
}

async function passwordCredential(account: Account): Promise<Pick<Account, "salt" | "hash">> {
  const snapshot = await database().ref(`${passwordOverridePath}/${accountKey(account.username.toLowerCase())}`).get();
  const override = snapshot.val();
  return isPasswordOverride(override) ? override : account;
}

export async function setAdminPasswordOverride(user: User, password: string): Promise<number> {
  if (user.role !== "admin") throw new Error("Chỉ Admin mới được đổi mật khẩu quản trị");
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    throw new Error("Mật khẩu phải dài từ 12 đến 128 ký tự");
  }
  const salt = randomBytes(16).toString("hex");
  const changedAt = Date.now();
  const override: PasswordOverride = { salt, hash: scryptSync(password, salt, 64).toString("hex"), changedAt };
  await database().ref(`${passwordOverridePath}/${accountKey(user.username.toLowerCase())}`).set(override);
  return changedAt;
}

function isAccount(value: unknown): value is Account {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<Account>;
  return typeof account.id === "string" && typeof account.username === "string" &&
    typeof account.fullName === "string" && typeof account.email === "string" &&
    account.role === "operator" && typeof account.salt === "string" &&
    /^[a-f0-9]{128}$/i.test(String(account.hash || "")) && account.active !== false;
}

export async function configuredUsers(): Promise<User[]> {
  const configured = settings().users;
  const snapshot = await database().ref(accountPath).get();
  const users = new Map(configured.map((account) => [account.username.toLowerCase(), toUser(account)]));
  snapshot.forEach((child) => {
    const account = child.val();
    if (isAccount(account) && !users.has(account.username.toLowerCase())) {
      users.set(account.username.toLowerCase(), toUser(account));
    }
    return false;
  });
  return Array.from(users.values());
}

export async function createOperatorAccount(input: {
  username: string;
  fullName: string;
  email: string;
  password: string;
}): Promise<User> {
  const username = input.username.toLowerCase();
  if (settings().users.some((account) => account.username.toLowerCase() === username)) {
    throw new AccountExistsError();
  }

  const salt = randomBytes(16).toString("hex");
  const account: Account = {
    id: randomUUID(), username, fullName: input.fullName, email: input.email,
    role: "operator", salt,
    hash: scryptSync(input.password, salt, 64).toString("hex"), active: true,
  };
  const result = await database().ref(`${accountPath}/${accountKey(username)}`).transaction(
    (current) => current === null ? account : undefined,
  );
  if (!result.committed) throw new AccountExistsError();
  return toUser(account);
}

function sign(payload: string) { return createHmac("sha256", settings().secret).update(payload).digest("base64url"); }

export async function authenticate(username: string, password: string): Promise<User | null> {
  const normalized = username.toLowerCase();
  const configured = settings().users.find((u) => u.username.toLowerCase() === normalized);
  const snapshot = configured ? null : await database().ref(`${accountPath}/${accountKey(normalized)}`).get();
  const dynamic = snapshot?.val();
  const account = configured || (isAccount(dynamic) && dynamic.username.toLowerCase() === normalized ? dynamic : undefined);
  const credential = account ? await passwordCredential(account) : undefined;
  const salt = credential?.salt || "invalid-account";
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(credential?.hash || "00".repeat(64), "hex");
  if (!account || expected.length !== actual.length || !timingSafeEqual(actual, expected)) return null;
  return toUser(account);
}

export function sessionToken(user: User, issuedAt = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ user, issuedAt, expires: issuedAt+8*3600_000 })).toString("base64url");
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
    if (data.expires <= Date.now()) return null;
    if (data.user?.role === "admin") {
      const override = (await database().ref(`${passwordOverridePath}/${accountKey(String(data.user.username || "").toLowerCase())}`).get()).val();
      if (isPasswordOverride(override) && Number(data.issuedAt || 0) <= override.changedAt) return null;
    }
    return data.user;
  } catch { return null; }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
