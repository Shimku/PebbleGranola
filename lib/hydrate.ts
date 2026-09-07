import { meetingSummary, summariesByMeetingId } from "./meeting-parse";
import { getMeetingDetails } from "./meetings";
import { patchCaptureSource, type Capture } from "./store";

function sourceRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

export function captureNeedsSummary(capture: Capture): boolean {
  const source = sourceRecord(capture.source);
  if (source.missed === true) return false;
  if (typeof source.summary === "string" && source.summary.trim()) return false;
  return capture.meeting_ids.length > 0;
}

export async function fillMissingSummaries(captures: Capture[]): Promise<Capture[]> {
  const need = captures.filter(captureNeedsSummary);
  if (!need.length) return captures;

  const ids = [...new Set(need.flatMap((capture) => capture.meeting_ids))].slice(
    0,
    10,
  );
  const details = await getMeetingDetails(ids);
  const byId = summariesByMeetingId(details);
  const fallback = meetingSummary(details);

  return Promise.all(
    captures.map(async (capture) => {
      if (!captureNeedsSummary(capture)) return capture;
      const summary =
        capture.meeting_ids.map((id) => byId[id]).find(Boolean) ||
        (capture.meeting_ids.length === 1 ? fallback : "");
      if (!summary) return capture;
      const source = { ...sourceRecord(capture.source), summary };
      try {
        await patchCaptureSource(capture.id, source);
      } catch {
        // Still return the hydrated row for this response.
      }
      return { ...capture, source };
    }),
  );
}
