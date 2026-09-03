import { disconnectGranola } from "@/lib/granola-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await disconnectGranola();
  return Response.json({ ok: true });
}
