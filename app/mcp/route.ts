import { handleMcpPost, isAuthorized } from "@/lib/pebble-mcp";
import { getPebbleToken, hasDatabaseUrl } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function mcpHeaders() {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

export async function GET() {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: "POST",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  if (!hasDatabaseUrl()) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Server is missing DATABASE_URL." },
      },
      { status: 500, headers: mcpHeaders() },
    );
  }

  const token = await getPebbleToken();
  if (!isAuthorized(request, token)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="pebble-granola"' },
    });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400, headers: mcpHeaders() },
    );
  }

  const handled = await handleMcpPost(body);
  if (handled.status === 202) {
    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(handled.payload, {
    status: handled.status,
    headers: mcpHeaders(),
  });
}
