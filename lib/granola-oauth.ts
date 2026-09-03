import { createHash, randomBytes } from "node:crypto";
import {
  GRANOLA_AUTH_ISSUER,
  GRANOLA_RESOURCE,
} from "./config";
import {
  getGranolaOAuth,
  saveOauthPending,
  setGranolaOAuth,
  takeOauthPending,
  type GranolaOAuth,
} from "./store";

type AuthorizationServerMetadata = {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
};

type ClientRegistration = {
  client_id: string;
  client_secret?: string;
  redirect_uris?: string[];
};

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

async function getAuthMetadata(): Promise<AuthorizationServerMetadata> {
  const response = await fetch(
    `${GRANOLA_AUTH_ISSUER}/.well-known/oauth-authorization-server`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Granola auth discovery failed (${response.status})`);
  }
  return (await response.json()) as AuthorizationServerMetadata;
}

async function registerClient(
  metadata: AuthorizationServerMetadata,
  redirectUri: string,
): Promise<ClientRegistration> {
  const endpoint = metadata.registration_endpoint;
  if (!endpoint) {
    throw new Error("Granola auth server did not advertise dynamic client registration");
  }

  const attempts = [
    {
      client_name: "Index x Granola",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
      application_type: "web",
    },
    {
      client_name: "Index x Granola",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
    },
  ];

  let lastError = "unknown";
  for (const body of attempts) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      return (await response.json()) as ClientRegistration;
    }
    const error = await readJson(response);
    lastError = `${response.status}: ${JSON.stringify(error)}`;
  }

  throw new Error(`Granola client registration failed (${lastError})`);
}

export async function startGranolaConnect(redirectUri: string): Promise<string> {
  const metadata = await getAuthMetadata();
  if (!metadata.authorization_endpoint) {
    throw new Error("Granola authorization endpoint missing");
  }

  const client = await registerClient(metadata, redirectUri);
  const { verifier, challenge } = pkcePair();
  const state = base64Url(randomBytes(24));

  await saveOauthPending({
    state,
    verifier: JSON.stringify({
      verifier,
      client_id: client.client_id,
      client_secret: client.client_secret ?? "",
    }),
    redirect_uri: redirectUri,
  });

  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", "mcp offline_access");
  url.searchParams.set("resource", GRANOLA_RESOURCE);
  return url.toString();
}

export async function finishGranolaConnect(input: {
  code: string;
  state: string;
}): Promise<void> {
  const pending = await takeOauthPending(input.state);
  if (!pending) {
    throw new Error("This Granola sign-in expired. Try Connect Granola again.");
  }

  const packed = JSON.parse(pending.verifier) as {
    verifier: string;
    client_id: string;
    client_secret?: string;
  };
  const verifier = packed.verifier;
  const clientId = packed.client_id;
  const clientSecret = packed.client_secret;
  const metadata = await getAuthMetadata();
  if (!metadata.token_endpoint) {
    throw new Error("Granola token endpoint missing");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: pending.redirect_uri,
    client_id: clientId,
    code_verifier: verifier,
    resource: GRANOLA_RESOURCE,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await readJson(response);
  if (!response.ok || typeof json.access_token !== "string") {
    throw new Error(
      `Granola token exchange failed (${response.status}): ${JSON.stringify(json)}`,
    );
  }

  const expiresIn =
    typeof json.expires_in === "number" ? json.expires_in : 3600;

  await setGranolaOAuth({
    client_id: clientId,
    client_secret: clientSecret || undefined,
    redirect_uri: pending.redirect_uri,
    access_token: json.access_token,
    refresh_token:
      typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expires_at: Date.now() + expiresIn * 1000,
    token_type: typeof json.token_type === "string" ? json.token_type : "Bearer",
    scope: typeof json.scope === "string" ? json.scope : undefined,
  });
}

export async function getFreshGranolaToken(): Promise<string> {
  const current = await getGranolaOAuth();
  if (!current) {
    throw new Error("Granola is not connected yet.");
  }

  const skew = 60_000;
  if (current.access_token && current.expires_at - skew > Date.now()) {
    return current.access_token;
  }

  if (!current.refresh_token) {
    throw new Error("Granola sign-in expired. Reconnect Granola in the web app.");
  }

  const refreshed = await refreshGranolaToken(current);
  return refreshed.access_token;
}

async function refreshGranolaToken(current: GranolaOAuth): Promise<GranolaOAuth> {
  const metadata = await getAuthMetadata();
  if (!metadata.token_endpoint) {
    throw new Error("Granola token endpoint missing");
  }
  if (!current.refresh_token) {
    throw new Error("No Granola refresh token");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: current.refresh_token,
    client_id: current.client_id,
    resource: GRANOLA_RESOURCE,
  });
  if (current.client_secret) body.set("client_secret", current.client_secret);

  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await readJson(response);
  if (!response.ok || typeof json.access_token !== "string") {
    throw new Error("Granola session expired. Reconnect Granola in the web app.");
  }

  const expiresIn =
    typeof json.expires_in === "number" ? json.expires_in : 3600;
  const next: GranolaOAuth = {
    ...current,
    access_token: json.access_token,
    refresh_token:
      typeof json.refresh_token === "string"
        ? json.refresh_token
        : current.refresh_token,
    expires_at: Date.now() + expiresIn * 1000,
  };
  await setGranolaOAuth(next);
  return next;
}

export async function disconnectGranola(): Promise<void> {
  await setGranolaOAuth(null);
}
