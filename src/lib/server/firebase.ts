import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { readFileSync } from "node:fs";
export function database() {
  const existing = getApps().find((app) => app.name === "traffic-server");
  const inline = process.env.FIREBASE_ADMIN_KEY_JSON;
  const file = process.env.FIREBASE_ADMIN_KEY_PATH;
  if (!existing && !inline && !file) throw new Error("FIREBASE_ADMIN_KEY_JSON or FIREBASE_ADMIN_KEY_PATH is required");
  const app = existing || initializeApp({
    credential: cert(JSON.parse(inline || readFileSync(file!, "utf8"))),
    databaseURL: "https://trafic-42620-default-rtdb.asia-southeast1.firebasedatabase.app",
  }, "traffic-server");
  return getDatabase(app);
}
