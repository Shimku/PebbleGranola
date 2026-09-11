import { appUrlFromRequest, MISSING_DB_MESSAGE } from "@/lib/config";
import { startGranolaConnect } from "@/lib/granola-oauth";
import { requireDashboard } from "@/lib/site-auth";
import { hasDatabaseUrl } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function start(request: Request) {
  const appUrl = appUrlFromRequest(request);
  const blocked = requireDashboard(request);
  if (blocked) {
    if (request.headers.get("accept")?.includes("application/json")) {
      return blocked;
    }
    return Response.redirect(
      `${appUrl}/?error=${encodeURIComponent("Sign in first.")}`,
      302,
    );
  }

  if (!hasDatabaseUrl()) {
    return Response.redirect(
      `${appUrl}/?error=${encodeURIComponent(MISSING_DB_MESSAGE)}`,
      302,
    );
  }
  const redirectUri = `${appUrl}/api/granola/callback`;
  try {
    const url = await startGranolaConnect(redirectUri);
    return Response.redirect(url, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connect failed";
    return Response.redirect(
      `${appUrl}/?error=${encodeURIComponent(message)}`,
      302,
    );
  }
}

export async function GET(request: Request) {
  return start(request);
}

export async function POST(request: Request) {
  return start(request);
}
