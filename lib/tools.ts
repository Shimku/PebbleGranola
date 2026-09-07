import { RING_INSTRUCTIONS, RING_PROMPT, TOOLS } from "./ring";
import { ringBullets } from "./bullets";
import {
  getMeetingDetails,
  granolaAccountInfo,
  listRecentMeetings,
  meetingSummary,
  noteBrief,
} from "./meetings";
import {
  pickMeetings,
  type MatchMode,
  type MeetingHit,
} from "./match";
import { asRecord, asString, clipForRing } from "./text";
import { insertCapture, setGranolaAccount, type CaptureKind } from "./store";
import { cleanMeetingTitle, shortDate } from "./title";

export { RING_INSTRUCTIONS, RING_PROMPT, TOOLS };

export type ToolRun = {
  kind: CaptureKind;
  text: string;
  title: string | null;
  meetings: MeetingHit[];
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asMode(value: unknown, fallback: MatchMode): MatchMode {
  return value === "last" || value === "recent" ? value : fallback;
}

async function matchedMeetings(
  hint: string | undefined,
  mode: MatchMode,
  preferSorta = false,
): Promise<MeetingHit[]> {
  const all = await listRecentMeetings();
  return pickMeetings(all, hint, mode, { preferSorta });
}

function missText(name: string): string {
  return `No Granola note matched "${name}".`;
}

function displayTitle(meeting: MeetingHit | undefined, fallback: string): string {
  return cleanMeetingTitle(meeting?.title) || fallback;
}

export async function refreshAccount(): Promise<void> {
  try {
    const info = await granolaAccountInfo();
    const record = asRecord(info) ?? {};
    const email =
      asString(record.email) ||
      asString(record.account_email) ||
      asString(asRecord(record.user)?.email);
    const workspace =
      asString(record.workspace) ||
      asString(record.active_workspace) ||
      asString(asRecord(record.workspace)?.name);
    await setGranolaAccount({
      email: email ?? undefined,
      workspace: workspace ?? undefined,
      raw: info,
    });
  } catch {
    // Account lookup is best-effort. Tools can still run.
  }
}

export async function runTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolRun> {
  if (name === "afterthought") return runAfterthought(args);
  if (name === "prep") return runPrep(args);
  if (name === "todos") return runTodos(args);
  throw new Error(`Unknown tool: ${name}`);
}

async function runAfterthought(args: Record<string, unknown>): Promise<ToolRun> {
  const thought = str(args.thought) || str(args.text);
  if (!thought) throw new Error("I need the thought to attach.");

  const hint = str(args.meeting_hint) || str(args.who_or_topic) || undefined;
  const meetings = await matchedMeetings(hint, "last");
  const missed = Boolean(hint) && meetings.length === 0;

  if (missed) {
    const text = missText(hint as string);
    await insertCapture({
      kind: "afterthought",
      title: hint,
      hint: hint ?? null,
      input: thought,
      output: text,
      meeting_ids: [],
      source: { thought, missed: true },
    });
    return {
      kind: "afterthought",
      text,
      title: hint ?? null,
      meetings: [],
    };
  }

  const target = meetings[0];
  const details = target
    ? await getMeetingDetails(meetings.map((meeting) => meeting.id))
    : null;
  const summary = meetingSummary(details);
  const title = displayTitle(target, "Afterthought");
  const when = shortDate(target?.date);
  const text = target
    ? [`Added to ${title}${when ? `, ${when}` : ""}.`, thought].join("\n")
    : [`Added to your latest Granola note.`, thought].join("\n");

  await insertCapture({
    kind: "afterthought",
    title,
    hint: hint ?? null,
    input: thought,
    output: text,
    meeting_ids: meetings.map((meeting) => meeting.id),
    source: {
      summary,
      thought,
      meetingTitle: title,
      meetingDate: target?.date ?? null,
      missed: false,
    },
  });

  return {
    kind: "afterthought",
    text,
    title,
    meetings,
  };
}

async function briefFromNotes(
  details: unknown,
  heading: string,
  fallback: string,
  preferActions = false,
): Promise<string> {
  const local = noteBrief(details, preferActions);
  return ringBullets(local, heading, fallback);
}

async function runPrep(args: Record<string, unknown>): Promise<ToolRun> {
  const topic = str(args.who_or_topic) || str(args.topic) || str(args.hint);
  if (!topic) throw new Error("Tell me who or what to prep for.");

  const scopeArg = str(args.scope);
  const pitch = scopeArg === "pitch";
  const mode: MatchMode = pitch ? "recent" : asMode(scopeArg, "last");
  const meetings = await matchedMeetings(topic, mode, pitch);
  const missed = meetings.length === 0 && !pitch;

  if (missed) {
    const text = missText(topic);
    await insertCapture({
      kind: "prep",
      title: topic,
      hint: topic,
      input: topic,
      output: text,
      meeting_ids: [],
      source: { missed: true },
    });
    return {
      kind: "prep",
      text,
      title: topic,
      meetings: [],
    };
  }

  const details = meetings.length
    ? await getMeetingDetails(meetings.map((meeting) => meeting.id))
    : null;
  const title = displayTitle(meetings[0], topic);
  const fallback = meetings[0]
    ? `Last matching note: ${title}.`
    : `No Granola notes matched "${topic}" in the last 30 days.`;
  const text = clipForRing(await briefFromNotes(details, "PREP", fallback));

  await insertCapture({
    kind: "prep",
    title,
    hint: topic,
    input: topic,
    output: text,
    meeting_ids: meetings.map((meeting) => meeting.id),
    source: {
      summary: meetingSummary(details),
      missed: false,
      pitch,
    },
  });

  return { kind: "prep", text, title, meetings };
}

async function runTodos(args: Record<string, unknown>): Promise<ToolRun> {
  const topic = str(args.who_or_topic) || str(args.meeting_hint) || undefined;
  const mode = asMode(args.scope, "last");
  const meetings = await matchedMeetings(topic, mode);
  const missed = Boolean(topic) && meetings.length === 0;

  if (missed) {
    const text = missText(topic as string);
    await insertCapture({
      kind: "todos",
      title: topic,
      hint: topic ?? null,
      input: topic as string,
      output: text,
      meeting_ids: [],
      source: { missed: true },
    });
    return {
      kind: "todos",
      text,
      title: topic ?? null,
      meetings: [],
    };
  }

  const details = meetings.length
    ? await getMeetingDetails(meetings.map((meeting) => meeting.id))
    : null;
  const title = displayTitle(meetings[0], topic ?? "Open loops");
  const fallback = meetings[0]
    ? `Last note: ${title}.`
    : "No Granola notes in the last 30 days.";
  const text = clipForRing(
    await briefFromNotes(details, "OPEN ITEMS", fallback, true),
  );

  await insertCapture({
    kind: "todos",
    title,
    hint: topic ?? null,
    input: topic ?? (mode === "last" ? "last meeting" : "this week"),
    output: text,
    meeting_ids: meetings.map((meeting) => meeting.id),
    source: { summary: meetingSummary(details), missed: false },
  });

  return { kind: "todos", text, title, meetings };
}

export function toolErrorText(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Something went wrong talking to Granola.";
  if (message.includes("not connected") || message.includes("Reconnect")) {
    return clipForRing(
      "Granola is not connected. Open the Index x Granola site and tap Connect Granola.",
    );
  }
  if (message === "GRANOLA_TIMEOUT" || /timeout|aborted/i.test(message)) {
    return clipForRing("Granola took too long. Try that again in a moment.");
  }
  return clipForRing(message);
}

export function promptText(): string {
  return RING_INSTRUCTIONS;
}

export { pebbleResult } from "./pebble-result";
export { extractToolText } from "./text";
