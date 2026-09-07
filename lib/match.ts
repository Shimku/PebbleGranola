import {
  cleanMeetingDate,
  cleanMeetingTitle,
  pairSides,
  shortDate,
} from "./title.ts";

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
  "week",
]);

function normalize(value: string): string {
  return cleanMeetingTitle(value)
    .toLowerCase()
    .replace(/<>/g, " ")
    .replace(/[^a-z0-9@.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSortaTitle(title: string): boolean {
  const cleaned = cleanMeetingTitle(title);
  if (/^sorta\s*<>/i.test(cleaned)) return true;
  return /^sorta\b/i.test(normalize(cleaned));
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
  return normalize(pairSides(title).right);
}

function titleLeft(title: string): string {
  return normalize(pairSides(title).left);
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = new Array<number>(rows * cols);
  for (let i = 0; i < rows; i += 1) dp[i * cols] = i;
  for (let j = 0; j < cols; j += 1) dp[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i * cols + j] = Math.min(
        dp[(i - 1) * cols + j] + 1,
        dp[i * cols + j - 1] + 1,
        dp[(i - 1) * cols + j - 1] + cost,
      );
    }
  }
  return dp[a.length * cols + b.length];
}

function prefixHit(a: string, b: string): boolean {
  if (a.length < 3 || b.length < 3) return false;
  return a.startsWith(b) || b.startsWith(a);
}

function closeWord(a: string, b: string): boolean {
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min < 4) return false;
  if (Math.abs(a.length - b.length) > 2) return false;
  const allowed = max >= 6 ? 2 : 1;
  return levenshtein(a, b) <= allowed;
}

function tokenHits(haystack: string, token: string): number {
  if (!haystack || !token) return 0;
  if (haystack === token) return 16;
  if (haystack.includes(token)) return 10;
  if (prefixHit(haystack, token)) return 12;
  if (closeWord(haystack, token)) return 11;
  const words = haystack.split(" ");
  let best = 0;
  for (const word of words) {
    if (word === token) best = Math.max(best, 14);
    else if (prefixHit(word, token)) best = Math.max(best, 12);
    else if (closeWord(word, token)) best = Math.max(best, 11);
  }
  return best;
}

function bump(score: number, extra: number): number {
  return score > 0 ? score + extra : 0;
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
  const left = titleLeft(meeting.title);
  const right = titleRight(meeting.title);
  const people = meeting.attendees.map(normalize);
  const sorta = isSortaTitle(meeting.title);
  let score = 0;

  if (visual && sorta) score += 28;

  if (needle) {
    score += tokenHits(title, needle);
    if (left) score += bump(tokenHits(left, needle), 4);
    if (right) score += tokenHits(right, needle);
    for (const person of people) {
      score += bump(tokenHits(person, needle), 2);
    }

    for (const word of hintWords(hint)) {
      if (word === "visual" || word === "canvas" || word === "pitch") {
        if (sorta) score += 4;
        continue;
      }
      score += Math.max(
        tokenHits(title, word),
        bump(tokenHits(left, word), 3),
        tokenHits(right, word),
        ...people.map((person) => tokenHits(person, word)),
      );
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
  const visual =
    looksLikeVisualCanvasHint(trimmed ?? "") || Boolean(options.preferSorta);

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
  const title = cleanMeetingTitle(meeting.title) || "Untitled meeting";
  const when =
    shortDate(meeting.date) ||
    shortDate(cleanMeetingDate(meeting.title, meeting.date)) ||
    "undated";
  return `${title} (${when})`;
}
