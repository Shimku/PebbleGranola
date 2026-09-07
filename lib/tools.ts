import { looksThin, ringBullets } from "./bullets";
import {
  actionLinesFromNotes,
  askGranola,
  excerptMeetingNotes,
  getMeetingDetails,
  granolaAccountInfo,
  listRecentMeetings,
  meetingSummary,
  summarizeMeetingsForPrompt,
} from "./meetings";
import {
  pickMeetings,
  type MatchMode,
  type MeetingHit,
} from "./match";
import { asRecord, asString, clipForRing } from "./text";
import { insertCapture, setGranolaAccount, type CaptureKind } from "./store";
import { cleanMeetingTitle, shortDate } from "./title";

export const RING_INSTRUCTIONS = `You are answering through a Pebble Index 01 ring. The user only gets a short phone notification.

Call exactly one tool, then read the tool output back almost verbatim. Do not add a preamble, markdown, or extra advice.

Routing:
- afterthought: they are adding a thought, forgotten point, or post-meeting note onto a Granola meeting.
- prep: they want a 30-second briefing before a call, pitch, or conversation.
- todos: they want open deliverables / what they owe.

If they name a person, company, client, or product, pass it as meeting_hint or who_or_topic.
If they say "last meeting", "the call I just had", or name nothing, omit the hint and use scope "last".
If they say "last call with X" use scope "last". If they say "this week" or "all meetings with X" use scope "recent".
Visual canvas / Sorta pitches are Granola notes titled like "Sorta<>Name Xxx". If they say visual canvas, Sorta, or a Sorta<> title, pass those words through. Use scope "pitch" for coaching.

Never invent a meeting. If the tool says nothing matched, say that. Do not create an empty note.`;

export const RING_PROMPT = {
  name: "ring_voice",
  title: "Index ring voice",
  description: "How to talk to Granola from a Pebble Index 01",
  arguments: [] as { name: string; description: string; required: boolean }[],
};

export const TOOLS = [
  {
    name: "afterthought",
    description:
      "Attach a spoken afterthought to a Granola meeting. Fetches that meeting's summary and files the new thought on top. Use after a call, when the user forgot to capture something.",
    inputSchema: {
      type: "object",
      properties: {
        thought: {
          type: "string",
          description: "The user's new thought, verbatim.",
        },
        meeting_hint: {
          type: "string",
          description:
            "Person, company, product, or meeting title. Omit to use the most recent Granola note.",
        },
      },
      required: ["thought"],
    },
  },
  {
    name: "prep",
    description:
      "30-second briefing before a conversation. Use for prepare me, what should I know, what should I say or not say, remind me before this pitch or call.",
    inputSchema: {
      type: "object",
      properties: {
        who_or_topic: {
          type: "string",
          description: "Person, company, client, product, or pitch topic.",
        },
        scope: {
          type: "string",
          enum: ["last", "recent", "pitch"],
          description:
            "last = most recent matching meeting. recent = a few recent matching meetings. pitch = coaching from Sorta<> / visual canvas recordings. Default last.",
        },
      },
      required: ["who_or_topic"],
    },
  },
  {
    name: "todos",
    description:
      "Open deliverables from Granola notes. Use for what did I promise, what do I need to do, action items, what I owe, follow-ups.",
    inputSchema: {
      type: "object",
      properties: {
        who_or_topic: {
          type: "string",
          description:
            "Client, person, or project. Omit for the most recent meeting.",
        },
        scope: {
          type: "string",
          enum: ["last", "recent"],
          description:
            "last = latest matching meeting, including 'last meeting'. recent = this week / several meetings. Default last.",
        },
      },
    },
  },
];

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
    return { kind: "afterthought", text, title: hint ?? null, meetings: [] };
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

  return { kind: "afterthought", text, title, meetings };
}

async function briefFromNotes(
  details: unknown,
  heading: string,
  fallback: string,
): Promise<string> {
  const local =
    actionLinesFromNotes(details) || excerptMeetingNotes(details, 900);
  return ringBullets(local, heading, fallback);
}

async function maybeAsk(
  query: string,
  ids: string[],
  heading: string,
  local: string,
): Promise<string> {
  if (!looksThin(local) || !ids.length) return local;
  const raw = await askGranola(query, ids);
  return ringBullets(raw, heading, local);
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
    return { kind: "prep", text, title: topic, meetings: [] };
  }

  const details = meetings.length
    ? await getMeetingDetails(meetings.map((meeting) => meeting.id))
    : null;
  const title = displayTitle(meetings[0], topic);
  const fallback = meetings[0]
    ? `Last matching note: ${title}.`
    : `No Granola notes matched "${topic}" in the last 30 days.`;
  const local = await briefFromNotes(details, "PREP", fallback);
  const query = pitch
    ? [
        `Coach me in 4 short bullets for: ${topic}.`,
        meetings.length
          ? `Prefer these notes:\n${summarizeMeetingsForPrompt(meetings)}`
          : `Search my last 30 days of Granola notes for this idea.`,
        `What to repeat, what to avoid, one opener. No markdown. No chain of thought.`,
      ].join("\n")
    : [
        `Prep me in 4 short bullets for: ${topic}.`,
        `Use the MOST RECENT matching Granola note.`,
        meetings.length
          ? `Matched notes:\n${summarizeMeetingsForPrompt(meetings)}`
          : `If nothing matches, say so in one line.`,
        `Last decision, open loops, names. No markdown. No chain of thought.`,
      ].join("\n");
  const text = clipForRing(
    await maybeAsk(
      query,
      meetings.map((meeting) => meeting.id),
      "PREP",
      local,
    ),
  );

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
    return { kind: "todos", text, title: topic ?? null, meetings: [] };
  }

  const details = meetings.length
    ? await getMeetingDetails(meetings.map((meeting) => meeting.id))
    : null;
  const title = displayTitle(meetings[0], topic ?? "Open loops");
  const fallback = meetings[0]
    ? `Last note: ${title}.`
    : "No Granola notes in the last 30 days.";
  const local = await briefFromNotes(details, "OPEN ITEMS", fallback);
  const query = [
    topic
      ? `What do I still owe from conversations about ${topic}?`
      : `What did I promise from my most recent Granola meeting?`,
    meetings.length
      ? `Prefer these notes:\n${summarizeMeetingsForPrompt(meetings)}`
      : `Search the last 30 days.`,
    `MY open items only unless theirs are blocking. One line each. Max 4 bullets. No markdown. No chain of thought.`,
  ].join("\n");
  const text = clipForRing(
    await maybeAsk(
      query,
      meetings.map((meeting) => meeting.id),
      "OPEN ITEMS",
      local,
    ),
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

export function pebbleResult(text: string, kind?: CaptureKind) {
  void kind;
  return {
    content: [{ type: "text", text }],
    structuredContent: {
      output: text,
      semanticResult: { type: "Response", text },
    },
    _meta: { coreSchema: 1 },
  };
}

export function promptText(): string {
  return RING_INSTRUCTIONS;
}

export { extractToolText } from "./text";
