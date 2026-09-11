import { clearSessionCookieHeader } from "@/lib/site-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader(request) } },
  );
}
