import { disconnectGranola } from "@/lib/granola-oauth";
import { requireDashboard } from "@/lib/site-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = requireDashboard(request);
  if (blocked) return blocked;
  await disconnectGranola();
  return Response.json({ ok: true });
}
