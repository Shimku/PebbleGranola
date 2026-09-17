import { createHmac } from "node:crypto";
import { timingSafeEqual } from "./secret.ts";

export const SITE_COOKIE = "pg_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function sitePassword(): string | null {
  const value = process.env.SITE_PASSWORD?.trim();
  return value && value.length >= 8 ? value : null;
}

export function hasSitePassword(): boolean {
  return Boolean(sitePassword());
}

export function sessionTokenFor(password: string): string {
  return createHmac("sha256", password)
    .update("index-x-granola-session-v1")
    .digest("hex");
}

export function isValidSession(
  password: string,
  cookieValue: string | undefined | null,
): boolean {
  if (!cookieValue) return false;
  return timingSafeEqual(sessionTokenFor(password), cookieValue);
}

export function isDashboardAuthenticated(request: Request): boolean {
  const password = sitePassword();
  if (!password) return false;
  const cookie = readCookie(request, SITE_COOKIE);
  return isValidSession(password, cookie);
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return null;
}

export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const row = loginAttempts.get(ip);
  if (!row) return true;
  if (now > row.resetAt) {
    loginAttempts.delete(ip);
    return true;
  }
  return row.count < LOGIN_MAX_ATTEMPTS;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const row = loginAttempts.get(ip);
  if (!row || now > row.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  row.count += 1;
}

export function clearLoginFailures(ip: string): void {
  loginAttempts.delete(ip);
}

export function sessionCookieHeader(password: string, request: Request): string {
  const secure = isHttps(request);
  const parts = [
    `${SITE_COOKIE}=${sessionTokenFor(password)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${COOKIE_MAX_AGE}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(request: Request): string {
  const secure = isHttps(request);
  const parts = [
    `${SITE_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function isHttps(request: Request): boolean {
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    new URL(request.url).protocol.replace(":", "");
  return proto === "https";
}

export function unauthorizedJson(message = "Unauthorized"): Response {
  return Response.json({ error: message }, { status: 401 });
}

export function requireDashboard(request: Request): Response | null {
  if (!hasSitePassword()) {
    return Response.json(
      { error: "SITE_PASSWORD is not set. The dashboard stays closed." },
      { status: 503 },
    );
  }
  if (!isDashboardAuthenticated(request)) {
    return unauthorizedJson();
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    if (!isSameOrigin(request)) {
      return Response.json({ error: "Bad origin" }, { status: 403 });
    }
  }
  return null;
}
