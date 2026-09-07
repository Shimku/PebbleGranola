export const RING_INSTRUCTIONS = `You are answering through a Pebble Index 01 ring. The user only gets a short phone notification.

Always call exactly one tool before you reply. Never answer from memory. Never say notes are unavailable, missing, or not here until a tool has returned that.

Routing:
- todos: what they owe, what I owe, what does X owe, what did I promise, action items, follow-ups from a meeting.
- prep: prep me, prepped me, prepare me, briefing, what should I know before a call.
- afterthought: a new thought or forgotten point to attach to a meeting.

who_or_topic / meeting_hint is ONLY the person, company, client, or product. Pass Brad, Interfaces, Verve, or Bonbon, not the whole sentence.

If they say "last meeting", "the call I just had", or name nothing, omit the hint and use scope "last".
If they say "last call with X" use scope "last". If they say "this week" or "all meetings with X" use scope "recent".
Visual canvas / Sorta pitches are Granola notes titled like "Sorta<>Name Xxx". If they say visual canvas, Sorta, or a Sorta<> title, pass those words through. Use scope "pitch" for coaching.

Never invent a meeting. If the tool says nothing matched, read that line back. Do not create an empty note.
On a real match, Index files into Granola Thoughts (afterthought), Granola Catch Up (prep), or Granola To-Dos (owe).`;

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
      "Attach a spoken afterthought to a Granola meeting. Fetches that meeting's summary and files the new thought on top. Always call this instead of saying notes are unavailable. Use after a call, when they forgot to capture something.",
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
      "30-second briefing from Granola notes. Always call this for prep me, prepped me, prepare me, or what should I know before a call. Pass who_or_topic as the person or meeting name only. Never say notes are unavailable without calling this.",
    inputSchema: {
      type: "object",
      properties: {
        who_or_topic: {
          type: "string",
          description:
            "Person, company, client, or product. Pass Brad or Interfaces, not the whole spoken sentence.",
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
      "Open deliverables from Granola notes. Always call this for what they owe, what I owe, what does X owe, what did I promise, action items, follow-ups. Pass who_or_topic as the person or company only. Never say notes are unavailable without calling this.",
    inputSchema: {
      type: "object",
      properties: {
        who_or_topic: {
          type: "string",
          description:
            "Client, person, or project. Pass Brad, not the whole sentence. Omit for the most recent meeting.",
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
