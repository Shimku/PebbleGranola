import { appUrlFromRequest, MISSING_DB_MESSAGE } from "@/lib/config";
import { Dashboard, type StatusPayload } from "./dashboard";
import { getStatusPayload, hasDatabaseUrl } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const params = await searchParams;
  let initial: StatusPayload = {
    connected: false,
    hasDatabase: hasDatabaseUrl(),
    pebbleToken: "",
    mcpUrl: "",
    appUrl: "",
    captures: [],
    claimUrl: null,
    account: null,
  };

  if (hasDatabaseUrl()) {
    try {
      initial = await getStatusPayload(appUrlFromRequest());
    } catch (error) {
      initial = {
        ...initial,
        error: error instanceof Error ? error.message : "Could not load status",
      };
    }
  } else {
    initial.error = MISSING_DB_MESSAGE;
  }

  if (params.error) {
    initial = { ...initial, error: params.error };
  }

  return <Dashboard initial={initial} />;
}
