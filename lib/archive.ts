import { bulletLines } from "./bullets.ts";
import { splitLedger } from "./ledger.ts";
import { cleanMeetingDate, cleanMeetingTitle, shortDate } from "./title.ts";
import { threadKey, threadLabel, UNFILED } from "./thread.ts";

export type CaptureKind = "afterthought" | "prep" | "todos";

export type ArchiveCapture = {
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

export type ArchiveThread = {
  key: string;
  label: string;
  count: number;
  latestAt: string;
};

export type CaptureView = {
  id: string;
  kind: CaptureKind;
  thread: string;
  title: string;
  when: string | null;
  thought: string;
  summary: string;
  bullets: string[];
  you: string[];
  them: string[];
  missed: boolean;
  created_at: string;
  output: string;
};

function asSource(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function viewFromCapture(capture: ArchiveCapture): CaptureView {
  const source = asSource(capture.source);
  const title =
    cleanMeetingTitle(asText(source.meetingTitle)) ||
    cleanMeetingTitle(capture.title) ||
    threadLabel({
      title: capture.title,
      hint: capture.hint,
      spoken: capture.input,
    });
  const when =
    shortDate(asText(source.meetingDate) || null) ||
    shortDate(cleanMeetingDate(capture.title, null));
  const thought =
    asText(source.thought) ||
    (capture.kind === "afterthought" ? capture.input.trim() : "");
  const summary = asText(source.summary);
  const missed = source.missed === true;
  const bullets = bulletLines(capture.output, 4);
  const ledger = splitLedger(
    capture.output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

  return {
    id: capture.id,
    kind: capture.kind,
    thread: threadLabel({
      title: capture.title,
      hint: capture.hint,
      spoken: capture.input,
    }),
    title: title || UNFILED,
    when,
    thought,
    summary,
    bullets,
    you: ledger.you.filter((line) => line.length > 2).slice(0, 4),
    them: ledger.them.filter((line) => line.length > 2).slice(0, 4),
    missed,
    created_at: capture.created_at,
    output: capture.output,
  };
}

export function threadsFromCaptures(captures: ArchiveCapture[]): ArchiveThread[] {
  const map = new Map<string, ArchiveThread>();
  for (const capture of captures) {
    const label = threadLabel({
      title: capture.title,
      hint: capture.hint,
      spoken: capture.input,
    });
    const key = threadKey(label);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        label,
        count: 1,
        latestAt: capture.created_at,
      });
      continue;
    }
    existing.count += 1;
    if (capture.created_at > existing.latestAt) {
      existing.latestAt = capture.created_at;
      existing.label = label;
    }
  }
  return [...map.values()].sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : a.latestAt > b.latestAt ? -1 : 0,
  );
}

export function capturesInThread(
  captures: ArchiveCapture[],
  key: string,
  kind?: CaptureKind,
): CaptureView[] {
  return captures
    .filter((capture) => {
      if (kind && capture.kind !== kind) return false;
      const label = threadLabel({
        title: capture.title,
        hint: capture.hint,
        spoken: capture.input,
      });
      return threadKey(label) === key;
    })
    .map(viewFromCapture);
}
