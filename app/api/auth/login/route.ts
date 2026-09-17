import { timingSafeEqual } from "@/lib/secret";
import {
  clearLoginFailures,
  clientIp,
  isSameOrigin,
  loginAllowed,
  recordLoginFailure,
  sessionCookieHeader,
  sessionTokenFor,
  sitePassword,
} from "@/lib/site-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const password = sitePassword();
  if (!password) {
    return Response.json(
      { error: "SITE_PASSWORD is not set." },
      { status: 503 },
    );
  }

  if (!isSameOrigin(request)) {
    return Response.json({ error: "Bad origin" }, { status: 403 });
  }

  const ip = clientIp(request);
  if (!loginAllowed(ip)) {
    return Response.json(
      { error: "Too many attempts. Try again in a bit." },
      { status: 429 },
    );
  }

  let body: { password?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const submitted = typeof body.password === "string" ? body.password : "";
  const ok = timingSafeEqual(
    sessionTokenFor(submitted || "invalid-login-attempt"),
    sessionTokenFor(password),
  );

  if (!ok) {
    recordLoginFailure(ip);
    return Response.json({ error: "Wrong password." }, { status: 401 });
  }

  clearLoginFailures(ip);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": sessionCookieHeader(password, request) } },
  );
}
