import {
  RING_INSTRUCTIONS,
  RING_PROMPT,
  TOOLS,
  pebbleResult,
  promptText,
  runTool,
  toolErrorText,
} from "./tools";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function jsonRpcResult(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function jsonRpcError(
  id: string | number | null | undefined,
  message: string,
  code = -32000,
) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export function isAuthorized(request: Request, token: string): boolean {
  const provided = readBearer(request);
  if (!provided) return false;
  return timingSafeEqual(provided, token);
}

async function handleCall(request: JsonRpcRequest): Promise<unknown> {
  const method = request.method ?? "";
  const id = request.id;
  const params = request.params ?? {};

  if (method === "initialize") {
    const requested =
      typeof params.protocolVersion === "string"
        ? params.protocolVersion
        : "2025-06-18";
    const protocolVersion = [
      "2025-06-18",
      "2025-03-26",
      "2024-11-05",
    ].includes(requested)
      ? requested
      : "2025-06-18";

    return jsonRpcResult(id, {
      protocolVersion,
      capabilities: {
        tools: { listChanged: false },
        prompts: { listChanged: false },
      },
      serverInfo: { name: "pebble-granola", version: "0.1.0" },
      instructions: RING_INSTRUCTIONS,
    });
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return null;
  }

  if (method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (method === "tools/list") {
    return jsonRpcResult(id, { tools: TOOLS });
  }

  if (method === "prompts/list") {
    return jsonRpcResult(id, {
      prompts: [
        {
          name: RING_PROMPT.name,
          title: RING_PROMPT.title,
          description: RING_PROMPT.description,
        },
      ],
    });
  }

  if (method === "prompts/get") {
    const name = typeof params.name === "string" ? params.name : "";
    if (name && name !== RING_PROMPT.name) {
      return jsonRpcError(id, `Unknown prompt: ${name}`, -32602);
    }
    return jsonRpcResult(id, {
      description: RING_PROMPT.description,
      messages: [
        {
          role: "user",
          content: { type: "text", text: promptText() },
        },
      ],
    });
  }

  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : "";
    const args =
      params.arguments && typeof params.arguments === "object"
        ? (params.arguments as Record<string, unknown>)
        : {};
    try {
      const result = await runTool(name, args);
      return jsonRpcResult(id, pebbleResult(result.text, result.kind));
    } catch (error) {
      return jsonRpcResult(id, {
        ...pebbleResult(toolErrorText(error), "prep"),
        isError: true,
      });
    }
  }

  if (method.startsWith("notifications/")) {
    return null;
  }

  return jsonRpcError(id, `Method not found: ${method}`, -32601);
}

export async function handleMcpPost(body: unknown): Promise<{
  status: number;
  payload: unknown | null;
}> {
  if (Array.isArray(body)) {
    const results = [];
    for (const item of body) {
      const handled = await handleCall(item as JsonRpcRequest);
      if (handled) results.push(handled);
    }
    return { status: 200, payload: results };
  }

  const handled = await handleCall(body as JsonRpcRequest);
  if (!handled) return { status: 202, payload: null };
  return { status: 200, payload: handled };
}
