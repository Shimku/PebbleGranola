import { GRANOLA_MCP_URL } from "./config";
import { getFreshGranolaToken } from "./granola-oauth";
import { asRecord, extractToolText, tryParseJson } from "./text";

type JsonRpc =
  | { jsonrpc: "2.0"; id: number; method: string; params?: unknown }
  | { jsonrpc: "2.0"; method: string; params?: unknown };

type Session = {
  token: string;
  id?: string;
  ready: boolean;
};

let session: Session | null = null;

async function parseMcpResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  if (contentType.includes("text/event-stream")) {
    const dataLines = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter((line) => line && line !== "[DONE]");
    const last = dataLines.at(-1);
    if (!last) {
      throw new Error("Granola MCP returned an empty stream");
    }
    return JSON.parse(last) as unknown;
  }

  if (!raw) return null;
  return JSON.parse(raw) as unknown;
}

async function rpc(message: JsonRpc, token: string, sessionId?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetch(GRANOLA_MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(message),
  });

  const nextSession = response.headers.get("mcp-session-id") ?? sessionId;

  if (response.status === 401 || response.status === 403) {
    const error = new Error("GRANOLA_UNAUTHORIZED");
    (error as Error & { status: number }).status = response.status;
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Granola MCP HTTP ${response.status}: ${body.slice(0, 400)}`);
  }

  if (!("id" in message)) {
    return { result: null, sessionId: nextSession };
  }

  const parsed = await parseMcpResponse(response);
  const record = asRecord(parsed);
  if (record?.error) {
    throw new Error(`Granola MCP error: ${JSON.stringify(record.error)}`);
  }
  return { result: record?.result ?? parsed, sessionId: nextSession };
}

async function ensureSession(token: string): Promise<Session> {
  if (session?.ready && session.token === token) return session;

  const initialized = await rpc(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "pebble-granola", version: "0.1.0" },
      },
    },
    token,
  );

  const next: Session = {
    token,
    id: initialized.sessionId,
    ready: true,
  };

  await rpc(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    token,
    next.id,
  );

  session = next;
  return next;
}

export async function callGranolaTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const token = await getFreshGranolaToken();
  try {
    return await callWithToken(token, name, args);
  } catch (error) {
    if (error instanceof Error && error.message === "GRANOLA_UNAUTHORIZED") {
      session = null;
      const retryToken = await getFreshGranolaToken();
      return callWithToken(retryToken, name, args);
    }
    throw error;
  }
}

async function callWithToken(
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const active = await ensureSession(token);
  const called = await rpc(
    {
      jsonrpc: "2.0",
      id: Date.now() % 1_000_000,
      method: "tools/call",
      params: { name, arguments: args },
    },
    token,
    active.id,
  );
  return called.result;
}

export async function granolaToolText(
  name: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const result = await callGranolaTool(name, args);
  return extractToolText(result);
}

export async function granolaToolJson(
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const result = await callGranolaTool(name, args);
  const text = extractToolText(result);
  return tryParseJson(text) ?? result;
}
