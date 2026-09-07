import { bulletLines } from "./bullets.ts";
import { splitLedger } from "./ledger.ts";
import { meetingSummary } from "./meeting-parse.ts";
import { granolaAnswer, isPromptEcho } from "./text.ts";
import { cleanMeetingDate, cleanMeetingTitle, shortDate } from "./title.ts";
import {
  preferThreadLabel,
  sameThread,
  threadKey,
  threadLabel,
  UNFILED,
} from "./thread.ts";

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

function summaryFromSource(source: Record<string, unknown>, kind: CaptureKind): string {
  const stored = asText(source.summary);
  if (stored) return stored;
  const fromDetails = meetingSummary(source.details);
  if (fromDetails) return fromDetails;
  if (kind !== "afterthought") return "";
  const granola = granolaAnswer(asText(source.granola));
  if (!granola) return "";
  if (/internal instructions|not able to share|i need to search/i.test(granola)) {
    return "";
  }
  if (/no meeting notes are available/i.test(granola)) return "";
  return granola.slice(0, 2800);
}

export function slimCapture(capture: ArchiveCapture): ArchiveCapture {
  const source = asSource(capture.source);
  return {
    ...capture,
    title: cleanMeetingTitle(capture.title) || capture.title,
    source: {
      summary: summaryFromSource(source, capture.kind),
      thought:
        asText(source.thought) ||
        (capture.kind === "afterthought" ? capture.input.trim() : ""),
      meetingTitle:
        cleanMeetingTitle(asText(source.meetingTitle)) ||
        cleanMeetingTitle(capture.title),
      meetingDate: asText(source.meetingDate) || cleanMeetingDate(capture.title, null),
      missed: source.missed === true,
    },
  };
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
  const summary = summaryFromSource(source, capture.kind);
  const missed = source.missed === true;
  let bullets = bulletLines(capture.output, 4);
  if (bullets.length < 2 && summary) {
    const fromNotes = bulletLines(summary, 4);
    if (fromNotes.length) bullets = fromNotes;
  }
  const ledgerSource =
    capture.output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !isPromptEcho(line));
  let ledger = splitLedger(ledgerSource);
  if (!ledger.you.length && !ledger.them.length && bullets.length) {
    ledger = splitLedger(bullets);
  }

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
  const list: ArchiveThread[] = [];
  for (const capture of captures) {
    const label = threadLabel({
      title: capture.title,
      hint: capture.hint,
      spoken: capture.input,
    });
    const existing = list.find((thread) => sameThread(thread.label, label));
    if (!existing) {
      list.push({
        key: threadKey(label),
        label,
        count: 1,
        latestAt: capture.created_at,
      });
      continue;
    }
    existing.count += 1;
    existing.label = preferThreadLabel(existing.label, label);
    existing.key = threadKey(existing.label);
    if (capture.created_at > existing.latestAt) {
      existing.latestAt = capture.created_at;
    }
  }
  return list.sort((a, b) =>
    a.latestAt < b.latestAt ? 1 : a.latestAt > b.latestAt ? -1 : 0,
  );
}

export function capturesInThread(
  captures: ArchiveCapture[],
  key: string,
  kind?: CaptureKind,
): CaptureView[] {
  const thread = threadsFromCaptures(captures).find((item) => item.key === key);
  if (!thread) return [];
  return captures
    .filter((capture) => {
      if (kind && capture.kind !== kind) return false;
      const label = threadLabel({
        title: capture.title,
        hint: capture.hint,
        spoken: capture.input,
      });
      return sameThread(label, thread.label);
    })
    .map(viewFromCapture);
}
