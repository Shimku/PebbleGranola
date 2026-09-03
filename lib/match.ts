export type MeetingHit = {
  id: string;
  title: string;
  date: string | null;
  attendees: string[];
};

export type MatchMode = "last" | "recent";

export type PickOptions = {
  /** Pitch coaching: prefer Granola notes titled Sorta<>… */
  preferSorta?: boolean;
};

const SKIP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "meeting",
  "call",
  "notes",
  "next",
  "last",
  "about",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/<>/g, " ")
    .replace(/[^a-z0-9@.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSortaTitle(title: string): boolean {
  const trimmed = title.trim();
  if (/^sorta\s*<>/i.test(trimmed)) return true;
  return /^sorta\b/i.test(normalize(trimmed));
}

export function looksLikeVisualCanvasHint(hint: string): boolean {
  const n = normalize(hint);
  if (!n) return false;
  if (/\bvisual\s+canvas\b/.test(n)) return true;
  if (n.includes("visualcanvas")) return true;
  if (/\bsorta\b/.test(n)) return true;
  if (/\bcanvas\b/.test(n) && /\b(pitch|demo|rehearsal|recording)\b/.test(n)) {
    return true;
  }
  return false;
}

function hintWords(hint: string): string[] {
  return normalize(hint)
    .split(" ")
    .filter((part) => part.length > 2 && !SKIP_WORDS.has(part));
}

function titleRight(title: string): string {
  if (!title.includes("<>")) return "";
  return normalize(title.split("<>").slice(1).join(" "));
}

export function recencyMs(meeting: MeetingHit): number {
  if (!meeting.date) return 0;
  const parsed = Date.parse(meeting.date);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function scoreMeeting(
  meeting: MeetingHit,
  hint: string,
  preferSorta = false,
): number {
  const needle = normalize(hint);
  const visual = looksLikeVisualCanvasHint(hint) || preferSorta;
  if (!needle && !visual) return 0;

  const title = normalize(meeting.title);
  const right = titleRight(meeting.title);
  const people = meeting.attendees.map(normalize);
  const sorta = isSortaTitle(meeting.title);
  let score = 0;

  if (visual && sorta) score += 28;

  if (needle) {
    if (title.includes(needle)) score += 22;
    if (right && right.includes(needle)) score += 16;
    if (people.some((person) => person.includes(needle))) score += 18;

    for (const word of hintWords(hint)) {
      if (word === "visual" || word === "canvas" || word === "pitch") {
        if (sorta) score += 4;
        continue;
      }
      if (title.includes(word)) score += 6;
      if (right.includes(word)) score += 8;
      if (people.some((person) => person.includes(word))) score += 7;
    }
  }

  return score;
}

export function pickMeetings(
  meetings: MeetingHit[],
  hint: string | undefined,
  mode: MatchMode,
  options: PickOptions = {},
): MeetingHit[] {
  const dated = [...meetings].sort((a, b) => recencyMs(b) - recencyMs(a));
  const trimmed = hint?.trim();
  const visual = looksLikeVisualCanvasHint(trimmed ?? "") || Boolean(options.preferSorta);

  if (!trimmed && !visual) {
    return mode === "last" ? dated.slice(0, 1) : dated.slice(0, 5);
  }

  if (!trimmed && visual) {
    const sorta = dated.filter((meeting) => isSortaTitle(meeting.title));
    const pool = sorta.length ? sorta : dated;
    return mode === "last" ? pool.slice(0, 1) : pool.slice(0, 6);
  }

  let matched = dated
    .map((meeting) => ({
      meeting,
      score: scoreMeeting(meeting, trimmed as string, visual),
    }))
    .filter((row) => row.score >= 5)
    .map((row) => row.meeting);

  if (matched.length === 0 && visual) {
    matched = dated.filter((meeting) => isSortaTitle(meeting.title));
  }

  if (matched.length === 0) return [];

  const recentFirst = [...matched].sort((a, b) => recencyMs(b) - recencyMs(a));
  return mode === "last" ? recentFirst.slice(0, 1) : recentFirst.slice(0, 6);
}

export function formatMeetingLabel(meeting: MeetingHit): string {
  const when = meeting.date
    ? new Date(meeting.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "undated";
  return `${meeting.title} (${when})`;
}
