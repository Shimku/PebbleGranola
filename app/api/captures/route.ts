import { requireDashboard } from "@/lib/site-auth";
import { deleteCaptures, listCaptures } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = requireDashboard(request);
  if (blocked) return blocked;
  const captures = await listCaptures(50);
  return Response.json({ captures });
}

export async function DELETE(request: Request) {
  const blocked = requireDashboard(request);
  if (blocked) return blocked;

  let body: { id?: string; ids?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ids = [
    ...(Array.isArray(body.ids) ? body.ids : []),
    ...(typeof body.id === "string" ? [body.id] : []),
  ];
  const removed = await deleteCaptures(ids);
  return Response.json({ ok: true, removed });
}
