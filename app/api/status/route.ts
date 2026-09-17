import { appUrlFromRequest, MISSING_DB_MESSAGE } from "@/lib/config";
import { requireDashboard } from "@/lib/site-auth";
import { getStatusPayload, hasDatabaseUrl } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPTY_STATUS = {
  connected: false,
  hasDatabase: false,
  pebbleToken: "",
  pebbleTokenLocked: false,
  mcpUrl: "",
  appUrl: "",
  captures: [],
  claimUrl: null,
  account: null,
};

export async function GET(request: Request) {
  const blocked = requireDashboard(request);
  if (blocked) return blocked;

  if (!hasDatabaseUrl()) {
    return Response.json({
      ...EMPTY_STATUS,
      error: MISSING_DB_MESSAGE,
    });
  }

  try {
    const status = await getStatusPayload(appUrlFromRequest(request));
    return Response.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status failed";
    return Response.json(
      { ...EMPTY_STATUS, hasDatabase: true, error: message },
      { status: 500 },
    );
  }
}
