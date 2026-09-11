import { requireDashboard } from "@/lib/site-auth";
import { getGranolaOAuth } from "@/lib/store";
import { runTool, toolErrorText } from "@/lib/tools";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = requireDashboard(request);
  if (blocked) return blocked;

  if (!(await getGranolaOAuth())) {
    return Response.json(
      { error: "Connect Granola first." },
      { status: 401 },
    );
  }

  let body: { tool?: string; args?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tool = body.tool;
  if (tool !== "afterthought" && tool !== "prep" && tool !== "todos") {
    return Response.json({ error: "Unknown tool" }, { status: 400 });
  }

  try {
    const result = await runTool(tool, body.args ?? {});
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: toolErrorText(error) }, { status: 400 });
  }
}
