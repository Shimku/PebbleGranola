import { appUrlFromRequest } from "@/lib/config";
import { startGranolaConnect } from "@/lib/granola-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const appUrl = appUrlFromRequest(request);
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
