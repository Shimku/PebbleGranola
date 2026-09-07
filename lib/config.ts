import {
  INJECTED_DATABASE_URL,
  INJECTED_NEON_CLAIM_URL,
} from "./injected-secrets";

export const GRANOLA_MCP_URL = "https://mcp.granola.ai/mcp";
export const GRANOLA_RESOURCE = "https://mcp.granola.ai/mcp";
export const GRANOLA_AUTH_ISSUER = "https://mcp-auth.granola.ai";

export const MISSING_DB_MESSAGE =
  "Connect Granola needs Postgres. This deploy has no DATABASE_URL, so login cannot start.";

export function databaseUrl(): string | null {
  const env =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim();
  const raw = env || INJECTED_DATABASE_URL.trim() || null;
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return raw;
  }
}

export function neonClaimUrl(): string | null {
  const env = process.env.NEON_CLAIM_URL?.trim();
  if (env) return env;
  const injected = INJECTED_NEON_CLAIM_URL.trim();
  return injected.length > 0 ? injected : null;
}

export function envPebbleToken(): string | null {
  const token = process.env.PEBBLE_MCP_TOKEN?.trim();
  return token ? token : null;
}

export function appUrlFromRequest(request?: Request): string {
  const explicit = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  if (request) {
    const url = new URL(request.url);
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      url.protocol.replace(":", "");
    const host =
      request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      request.headers.get("host") ||
      url.host;
    return `${proto}://${host}`;
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production}`;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
