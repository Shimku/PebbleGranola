import { listCaptures } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const captures = await listCaptures(50);
  return Response.json({ captures });
}
