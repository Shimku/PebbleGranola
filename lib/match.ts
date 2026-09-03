export type MeetingHit = {
  id: string;
  title: string;
  date: string | null;
  attendees: string[];
};

export type MatchMode = "last" | "recent";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9@.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function recencyMs(meeting: MeetingHit): number {
  if (!meeting.date) return 0;
  const parsed = Date.parse(meeting.date);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function scoreMeeting(meeting: MeetingHit, hint: string): number {
  const needle = normalize(hint);
  if (!needle) return 0;

  const title = normalize(meeting.title);
  const people = meeting.attendees.map(normalize);
  let score = 0;

  if (title.includes(needle)) score += 22;
  if (people.some((person) => person.includes(needle))) score += 18;

  for (const word of needle.split(" ").filter((part) => part.length > 2)) {
    if (title.includes(word)) score += 6;
    if (people.some((person) => person.includes(word))) score += 7;
  }

  return score;
}

export function pickMeetings(
  meetings: MeetingHit[],
  hint: string | undefined,
  mode: MatchMode,
): MeetingHit[] {
  const dated = [...meetings].sort((a, b) => recencyMs(b) - recencyMs(a));
  const trimmed = hint?.trim();

  if (!trimmed) {
    return mode === "last" ? dated.slice(0, 1) : dated.slice(0, 5);
  }

  const matched = dated
    .map((meeting) => ({ meeting, score: scoreMeeting(meeting, trimmed) }))
    .filter((row) => row.score >= 5)
    .map((row) => row.meeting);

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
