import { appUrlFromRequest } from "@/lib/config";
import { finishGranolaConnect } from "@/lib/granola-oauth";
import { refreshAccount } from "@/lib/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const appUrl = appUrlFromRequest(request);
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (error) {
    const description =
      url.searchParams.get("error_description") || error;
    return Response.redirect(
      `${appUrl}/?error=${encodeURIComponent(description)}`,
      302,
    );
  }

  if (!code || !state) {
    return Response.redirect(
      `${appUrl}/?error=${encodeURIComponent("Missing OAuth code")}`,
      302,
    );
  }

  try {
    await finishGranolaConnect({ code, state });
    await refreshAccount();
    return Response.redirect(`${appUrl}/?connected=1`, 302);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "OAuth failed";
    return Response.redirect(
      `${appUrl}/?error=${encodeURIComponent(message)}`,
      302,
    );
  }
}
