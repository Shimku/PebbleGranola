import { appUrlFromRequest } from "@/lib/config";
import { getStatusPayload, hasDatabaseUrl } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasDatabaseUrl()) {
    return Response.json(
      {
        connected: false,
        hasDatabase: false,
        error: "DATABASE_URL is not set",
      },
      { status: 503 },
    );
  }

  try {
    const status = await getStatusPayload(appUrlFromRequest(request));
    return Response.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status failed";
    return Response.json({ error: message, hasDatabase: true }, { status: 500 });
  }
}
