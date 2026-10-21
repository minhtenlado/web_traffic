import { session } from "@/lib/server/auth";
import { database } from "@/lib/server/firebase";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await session(); if (!user) return new Response(null, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(id)) return new Response(null, { status: 400 });
  const data = (await database().ref(`traffic/commands/${id}`).get()).val();
  if (!data) return new Response(null, { status: 404 });
  if (data.actor !== user.id && user.role !== "admin") return new Response(null, { status: 403 });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
