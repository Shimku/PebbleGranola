import {
  askGranola,
  getMeetingDetails,
  granolaAccountInfo,
  listRecentMeetings,
  summarizeMeetingsForPrompt,
} from "./meetings";
import {
  formatMeetingLabel,
  pickMeetings,
  type MatchMode,
  type MeetingHit,
} from "./match";
import { asRecord, asString, clipForRing, extractToolText } from "./text";
import { insertCapture, setGranolaAccount, type CaptureKind } from "./store";

export const RING_INSTRUCTIONS = `You are answering through a Pebble Index 01 ring. The user only gets a short phone (or watch) notification.

Call exactly one tool, then read the tool output back almost verbatim. Do not add a preamble, markdown, or extra advice.

Routing:
- afterthought: they are adding a thought, forgotten point, or post-meeting note onto a Granola meeting.
- prep: they want a 30-second briefing before a call, pitch, or conversation.
- todos: they want open deliverables / what they owe.

If they name a person, company, client, or product, pass it as meeting_hint or who_or_topic.
If they say "last meeting", "the call I just had", or name nothing, omit the hint so we use the most recent Granola note.
If they say "last call with X" use scope "last". If they say "this week" or "all meetings with X" use scope "recent".
Visual canvas / Sorta pitches are Granola notes titled like "Sorta<>Name Xxx". If they say visual canvas, Sorta, or a Sorta<> title, pass those words through. Use scope "pitch" for coaching.`;

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
      "Attach a spoken afterthought to a Granola meeting. Use after a call, when the user forgot to capture something, or when they want Granola context plus their new thought saved together.",
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
      "Open deliverables from Granola notes. Use for what do I need to do, action items, what I owe, follow-ups.",
    inputSchema: {
      type: "object",
      properties: {
        who_or_topic: {
          type: "string",
          description: "Client, person, or project. Omit for this week's open loops.",
        },
        scope: {
          type: "string",
          enum: ["last", "recent"],
          description: "last = latest matching meeting. recent = this week / several meetings. Default recent.",
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
  const details = meetings.length
    ? await getMeetingDetails(meetings.map((meeting) => meeting.id))
    : null;

  const target = meetings[0]
    ? formatMeetingLabel(meetings[0])
    : hint
      ? `notes matching "${hint}" in the last 30 days`
      : "your most recent Granola note";

  const query = [
    `The owner just left an afterthought on their Pebble Index ring.`,
    `Attach it to: ${target}.`,
    meetings.length
      ? `Matched Granola notes:\n${summarizeMeetingsForPrompt(meetings)}`
      : `No confident title match. Use the most relevant note from the last 30 days, or say you could not find one.`,
    `Afterthought: ${thought}`,
    `Return at most 6 short lines:`,
    `1) which meeting you used (title + date)`,
    `2) two lines of what Granola already captured`,
    `3) the afterthought woven in, clearly marked as new`,
    `No markdown. No preamble.`,
  ].join("\n");

  const raw = await askGranola(
    query,
    meetings.map((meeting) => meeting.id),
  );
  const prefix = meetings[0]
    ? `Idea added to ${meetings[0].title}.`
    : "Idea added.";
  const body = clipForRing(raw, 380 - prefix.length - 1);
  const text = `${prefix} ${body}`.trim();
  const title = meetings[0]?.title ?? "Afterthought";

  await insertCapture({
    kind: "afterthought",
    title,
    hint: hint ?? null,
    input: thought,
    output: text,
    meeting_ids: meetings.map((meeting) => meeting.id),
    source: { details, granola: raw },
  });

  return { kind: "afterthought", text, title, meetings };
}

async function runPrep(args: Record<string, unknown>): Promise<ToolRun> {
  const topic = str(args.who_or_topic) || str(args.topic) || str(args.hint);
  if (!topic) throw new Error("Tell me who or what to prep for.");

  const scopeArg = str(args.scope);
  const pitch = scopeArg === "pitch";
  const mode: MatchMode = pitch ? "recent" : asMode(scopeArg, "last");
  const meetings = await matchedMeetings(topic, mode, pitch);

  const query = pitch
    ? [
        `I am about to pitch this idea again: ${topic}.`,
        `I have been recording test pitches in Granola. Those notes are usually titled like "Sorta<>Name Xxx".`,
        meetings.length
          ? `Prefer these notes:\n${summarizeMeetingsForPrompt(meetings)}`
          : `Search my last 30 days of Granola notes for this idea.`,
        `Coach me in 6 short lines: what to repeat, what to avoid, one sharp opener, one thing I keep forgetting.`,
        `Be specific to my notes, not generic pitch advice. No markdown.`,
      ].join("\n")
    : [
        `Prep me in 30 seconds for: ${topic}.`,
        mode === "last"
          ? `Use the MOST RECENT matching Granola note, not the whole history.`
          : `Use the recent matching Granola notes from the last 30 days.`,
        meetings.length
          ? `Matched notes:\n${summarizeMeetingsForPrompt(meetings)}`
          : `If nothing matches that name, say so in one line, then use the closest notes.`,
        `Cover: last decision, open loops, names I will forget, what not to reopen. No markdown.`,
      ].join("\n");

  const raw = await askGranola(
    query,
    meetings.map((meeting) => meeting.id),
  );
  const text = clipForRing(raw);
  const title = meetings[0]?.title ?? topic;

  await insertCapture({
    kind: "prep",
    title,
    hint: topic,
    input: topic,
    output: text,
    meeting_ids: meetings.map((meeting) => meeting.id),
    source: { granola: raw, pitch },
  });

  return { kind: "prep", text, title, meetings };
}

async function runTodos(args: Record<string, unknown>): Promise<ToolRun> {
  const topic = str(args.who_or_topic) || str(args.meeting_hint) || undefined;
  const mode = asMode(args.scope, "recent");
  const meetings = await matchedMeetings(topic, mode);

  const query = [
    topic
      ? `What do I still owe from conversations about ${topic}?`
      : `What do I still owe from my Granola notes this week?`,
    meetings.length
      ? `Prefer these notes:\n${summarizeMeetingsForPrompt(meetings)}`
      : `Search the last 30 days.`,
    `Split MY open items vs THEIRS. One line each. Skip completed work.`,
    `If a date was mentioned, keep it. Max 6 lines. No markdown.`,
  ].join("\n");

  const raw = await askGranola(
    query,
    meetings.map((meeting) => meeting.id),
  );
  const text = clipForRing(raw);
  const title = meetings[0]?.title ?? topic ?? "Open loops";

  await insertCapture({
    kind: "todos",
    title,
    hint: topic ?? null,
    input: topic ?? "this week",
    output: text,
    meeting_ids: meetings.map((meeting) => meeting.id),
    source: { granola: raw },
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
  return clipForRing(message);
}

export function pebbleResult(text: string, kind: CaptureKind) {
  const semanticResult =
    kind === "afterthought"
      ? {
          type: "ListItemCreation",
          content: text,
          listUsed: "Granola afterthoughts",
        }
      : { type: "Response", text };

  return {
    content: [{ type: "text", text }],
    structuredContent: {
      output: text,
      semanticResult,
    },
    _meta: { coreSchema: 1 },
  };
}

export function promptText(): string {
  return RING_INSTRUCTIONS;
}

export { extractToolText };
