import { requireDashboard } from "@/lib/site-auth";
import { rotatePebbleToken } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = requireDashboard(request);
  if (blocked) return blocked;
  try {
    const pebbleToken = await rotatePebbleToken();
    return Response.json({ pebbleToken });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not rotate token.";
    return Response.json({ error: message }, { status: 409 });
  }
}
