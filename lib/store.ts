import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import { slimCapture } from "./archive";
import { databaseUrl, envPebbleToken, neonClaimUrl } from "./config";

type Sql = NeonQueryFunction<false, false>;

let sql: Sql | null = null;
let schemaReady: Promise<void> | null = null;

export type GranolaOAuth = {
  client_id: string;
  client_secret?: string;
  redirect_uri: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
};

export type CaptureKind = "afterthought" | "prep" | "todos";

export type Capture = {
  id: string;
  kind: CaptureKind;
  title: string | null;
  hint: string | null;
  input: string;
  output: string;
  meeting_ids: string[];
  source: unknown;
  created_at: string;
};

export type GranolaAccount = {
  email?: string;
  workspace?: string;
  raw?: unknown;
};

function db(): Sql {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!sql) sql = neon(url);
  return sql;
}

export function hasDatabaseUrl(): boolean {
  return Boolean(databaseUrl());
}

export async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const q = db();
      await q`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await q`CREATE TABLE IF NOT EXISTS oauth_pending (
        state TEXT PRIMARY KEY,
        verifier TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await q`CREATE TABLE IF NOT EXISTS captures (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT,
        hint TEXT,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        meeting_ids TEXT[] NOT NULL DEFAULT '{}',
        source JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await q`CREATE INDEX IF NOT EXISTS captures_created_at ON captures (created_at DESC)`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

async function getSetting<T>(key: string): Promise<T | null> {
  await ensureSchema();
  const rows = await db()`SELECT value FROM settings WHERE key = ${key} LIMIT 1`;
  const value = rows[0]?.value;
  return (value as T) ?? null;
}

async function setSetting(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  await db()`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export async function getGranolaOAuth(): Promise<GranolaOAuth | null> {
  return getSetting<GranolaOAuth>("granola_oauth");
}

export async function setGranolaOAuth(value: GranolaOAuth | null): Promise<void> {
  if (!value) {
    await ensureSchema();
    await db()`DELETE FROM settings WHERE key = ${"granola_oauth"}`;
    await db()`DELETE FROM settings WHERE key = ${"granola_account"}`;
    return;
  }
  await setSetting("granola_oauth", value);
}

export async function getGranolaAccount(): Promise<GranolaAccount | null> {
  return getSetting<GranolaAccount>("granola_account");
}

export async function setGranolaAccount(value: GranolaAccount): Promise<void> {
  await setSetting("granola_account", value);
}

export async function getPebbleToken(): Promise<string> {
  const existing = await getSetting<string>("pebble_token");
  if (typeof existing === "string" && existing.length > 16) return existing;

  const fromEnv = envPebbleToken();
  const token = fromEnv ?? randomBytes(32).toString("hex");
  await setSetting("pebble_token", token);
  return token;
}

export async function saveOauthPending(input: {
  state: string;
  verifier: string;
  redirect_uri: string;
}): Promise<void> {
  await ensureSchema();
  await db()`
    INSERT INTO oauth_pending (state, verifier, redirect_uri)
    VALUES (${input.state}, ${input.verifier}, ${input.redirect_uri})
    ON CONFLICT (state) DO UPDATE SET verifier = EXCLUDED.verifier, redirect_uri = EXCLUDED.redirect_uri
  `;
}

export async function takeOauthPending(
  state: string,
): Promise<{ verifier: string; redirect_uri: string } | null> {
  await ensureSchema();
  const rows = await db()`
    DELETE FROM oauth_pending
    WHERE state = ${state}
    RETURNING verifier, redirect_uri
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    verifier: String(row.verifier),
    redirect_uri: String(row.redirect_uri),
  };
}

export async function insertCapture(input: {
  kind: CaptureKind;
  title?: string | null;
  hint?: string | null;
  input: string;
  output: string;
  meeting_ids?: string[];
  source?: unknown;
}): Promise<Capture> {
  await ensureSchema();
  const id = randomBytes(12).toString("hex");
  const meetingIds = input.meeting_ids ?? [];
  const source = input.source ?? null;
  const rows = await db()`
    INSERT INTO captures (id, kind, title, hint, input, output, meeting_ids, source)
    VALUES (
      ${id},
      ${input.kind},
      ${input.title ?? null},
      ${input.hint ?? null},
      ${input.input},
      ${input.output},
      ${meetingIds},
      ${JSON.stringify(source)}::jsonb
    )
    RETURNING id, kind, title, hint, input, output, meeting_ids, source, created_at
  `;
  return mapCapture(rows[0]);
}

export async function listCaptures(limit = 80): Promise<Capture[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT id, kind, title, hint, input, output, meeting_ids, source, created_at
    FROM captures
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapCapture);
}

export async function deleteCaptures(ids: string[]): Promise<number> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return 0;
  await ensureSchema();
  let removed = 0;
  for (const id of unique) {
    const rows = await db()`DELETE FROM captures WHERE id = ${id} RETURNING id`;
    if (rows[0]) removed += 1;
  }
  return removed;
}

function mapCapture(row: Record<string, unknown>): Capture {
  return {
    id: String(row.id),
    kind: row.kind as CaptureKind,
    title: row.title ? String(row.title) : null,
    hint: row.hint ? String(row.hint) : null,
    input: String(row.input),
    output: String(row.output),
    meeting_ids: Array.isArray(row.meeting_ids)
      ? row.meeting_ids.map(String)
      : [],
    source: row.source ?? null,
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function getStatusPayload(appUrl: string) {
  const connected = Boolean(await getGranolaOAuth());
  const account = await getGranolaAccount();
  const pebbleToken = await getPebbleToken();
  const captures = (await listCaptures(80)).map(slimCapture);
  const claimUrl = neonClaimUrl();

  return {
    connected,
    account,
    pebbleToken,
    mcpUrl: `${appUrl}/mcp`,
    appUrl,
    captures,
    claimUrl,
    hasDatabase: hasDatabaseUrl(),
  };
}
