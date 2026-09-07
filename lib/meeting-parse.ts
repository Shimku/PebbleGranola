import type { MeetingHit } from "./match";
import { asRecord, asString, extractToolText } from "./text.ts";
import {
  cleanMeetingDate,
  cleanMeetingTitle,
  decodeHtmlEntities,
  looksLikeMeetingMarkup,
} from "./title.ts";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const SKIP_NOTE_KEYS = new Set([
  "id",
  "ids",
  "meeting_id",
  "meeting_ids",
  "document_id",
  "document_ids",
  "note_id",
  "created_at",
  "updated_at",
  "url",
  "type",
  "jsonrpc",
  "title",
  "name",
]);

const PREFERRED_NOTE_KEYS = [
  "summary",
  "notes",
  "note",
  "markdown",
  "recap",
  "overview",
  "action_items",
  "actionItems",
  "next_steps",
  "transcript_summary",
];

function collectAttendees(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        const record = asRecord(item);
        return (
          asString(record?.name) ||
          asString(record?.email) ||
          asString(record?.display_name) ||
          ""
        );
      })
      .filter(Boolean);
  }
  if (typeof value === "string") return [value];
  return [];
}

function collectDate(record: Record<string, unknown>): string | null {
  const calendar = asRecord(record.calendar_event);
  const document = asRecord(record.document);
  const rawTitle =
    asString(record.title) || asString(record.name) || asString(document?.title);
  return (
    asString(record.date) ||
    asString(record.created_at) ||
    asString(record.updated_at) ||
    asString(record.start_time) ||
    asString(calendar?.start) ||
    asString(calendar?.start_time) ||
    asString(calendar?.starts_at) ||
    asString(document?.created_at) ||
    cleanMeetingDate(rawTitle, null)
  );
}

function asId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const record = asRecord(value);
  if (!record) return null;
  return (
    asId(record.id) ||
    asId(record.uuid) ||
    asId(record.meeting_id) ||
    asId(record.document_id) ||
    asId(record.note_id)
  );
}

function asMeeting(value: unknown): MeetingHit | null {
  const record = asRecord(value);
  if (!record) return null;
  const document = asRecord(record.document);
  const id =
    asId(record.id) ||
    asId(record.meeting_id) ||
    asId(record.note_id) ||
    asId(record.document_id) ||
    asId(record.documentId) ||
    asId(record.uuid) ||
    asId(document);
  if (!id) return null;
  const rawTitle =
    asString(record.title) ||
    asString(record.name) ||
    asString(record.summary) ||
    asString(document?.title) ||
    "";
  return {
    id,
    title: cleanMeetingTitle(rawTitle) || "Untitled meeting",
    date: collectDate(record),
    attendees: collectAttendees(
      record.attendees ?? record.participants ?? record.people,
    ),
  };
}

function meetingsFromText(text: string): MeetingHit[] {
  const found: MeetingHit[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\n+/)) {
    const match = line.match(UUID_RE);
    if (!match) continue;
    const id = match[0];
    if (seen.has(id)) continue;
    seen.add(id);
    const title = cleanMeetingTitle(
      line
        .replace(UUID_RE, "")
        .replace(/[|`*_#>-]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    found.push({
      id,
      title: title || "Untitled meeting",
      date: null,
      attendees: [],
    });
  }
  return found;
}

export function meetingsFromUnknown(value: unknown): MeetingHit[] {
  if (!value) return [];
  if (typeof value === "string") {
    const parsed = (() => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    })();
    if (parsed) {
      const fromJson = meetingsFromUnknown(parsed);
      if (fromJson.length) return fromJson;
    }
    return meetingsFromText(value);
  }
  if (Array.isArray(value)) {
    const fromArray = value
      .map(asMeeting)
      .filter((item): item is MeetingHit => Boolean(item));
    if (fromArray.length) return fromArray;
    return value.flatMap((item) => meetingsFromUnknown(item));
  }

  const record = asRecord(value);
  if (!record) return [];

  for (const key of [
    "meetings",
    "notes",
    "items",
    "results",
    "data",
    "documents",
    "list",
  ]) {
    if (Array.isArray(record[key])) {
      const nested = meetingsFromUnknown(record[key]);
      if (nested.length) return nested;
    }
  }

  if (Array.isArray(record.content)) {
    const texts: string[] = [];
    for (const item of record.content) {
      if (typeof item === "string") {
        texts.push(item);
        continue;
      }
      const inner = asRecord(item);
      const text = asString(inner?.text);
      if (!text) continue;
      texts.push(text);
      try {
        const parsed = JSON.parse(text) as unknown;
        const found = meetingsFromUnknown(parsed);
        if (found.length) return found;
      } catch {
        // text may be a markdown list instead of JSON
      }
    }
    const fromText = meetingsFromText(texts.join("\n"));
    if (fromText.length) return fromText;
  }

  const extracted = extractToolText(value);
  if (extracted && extracted !== JSON.stringify(value)) {
    const fromExtracted = meetingsFromUnknown(extracted);
    if (fromExtracted.length) return fromExtracted;
  }

  const single = asMeeting(record);
  return single ? [single] : [];
}

function isJunkNote(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 12) return true;
  if (/^the content below is meeting notes/i.test(trimmed) && !/<summary/i.test(trimmed)) {
    return true;
  }
  if (looksLikeMeetingMarkup(trimmed) && !/<summary[\s>]/i.test(trimmed)) return true;
  if (/^\{[\s\S]*\}$/.test(trimmed) && trimmed.includes('"id"')) return true;
  return false;
}

export function formatGranolaSummary(inner: string): string {
  return decodeHtmlEntities(inner)
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function summaryFromMarkup(raw: string): string {
  if (!raw) return "";
  const decoded = decodeHtmlEntities(raw);
  const match = decoded.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
  if (!match?.[1]) return "";
  return formatGranolaSummary(match[1]);
}

function meetingIdFromOpenTag(attrs: string): string {
  const match = attrs.match(/\bid\s*=\s*"([^"]*)"/i);
  return match?.[1]?.trim() ?? "";
}

export function summariesByMeetingId(details: unknown): Record<string, string> {
  if (!details) return {};
  const decoded = decodeHtmlEntities(extractToolText(details));
  const found: Record<string, string> = {};
  const re = /<meeting\b([^>]*)>([\s\S]*?)<\/meeting>/gi;
  let match: RegExpExecArray | null = re.exec(decoded);
  while (match) {
    const id = meetingIdFromOpenTag(match[1] ?? "");
    const inner = summaryFromMarkup(match[2] ?? "");
    if (id && inner) found[id] = inner;
    match = re.exec(decoded);
  }
  return found;
}

function collectNoteText(value: unknown, into: string[], depth = 0): void {
  if (depth > 6 || !value) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const fromXml = summaryFromMarkup(trimmed);
    if (fromXml) {
      into.push(fromXml);
      return;
    }
    if (!isJunkNote(trimmed)) into.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectNoteText(item, into, depth + 1);
    return;
  }
  const record = asRecord(value);
  if (!record) return;

  let preferred = false;
  for (const key of PREFERRED_NOTE_KEYS) {
    if (record[key] == null) continue;
    collectNoteText(record[key], into, depth + 1);
    preferred = true;
  }
  if (preferred && into.length) return;

  for (const [key, nested] of Object.entries(record)) {
    if (SKIP_NOTE_KEYS.has(key)) continue;
    if (PREFERRED_NOTE_KEYS.includes(key)) continue;
    collectNoteText(nested, into, depth + 1);
  }
}

export function excerptMeetingNotes(details: unknown, max = 1600): string {
  if (!details) return "";
  const chunks: string[] = [];
  collectNoteText(details, chunks);
  const unique = [...new Set(chunks)];
  return unique.join("\n\n").slice(0, max).trim();
}

export function actionLinesFromNotes(details: unknown): string {
  const excerpt = excerptMeetingNotes(details, 4000);
  if (!excerpt) return "";
  const lines = excerpt
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s+/, "").trim())
    .filter(Boolean)
    .filter((line) => !looksLikeMeetingMarkup(line));
  const hits = lines.filter((line) =>
    /action|todo|follow[- ]up|owe|send |schedule |i will|i'll |next step|promise|deliver|intro call|share /i.test(
      line,
    ),
  );
  return (hits.length ? hits.slice(0, 4) : lines.slice(0, 4)).join("\n");
}

export function meetingSummary(details: unknown): string {
  if (!details) return "";
  const extracted = extractToolText(details);
  const fromXml = summaryFromMarkup(extracted);
  if (fromXml) return fromXml.slice(0, 2800).trim();

  const excerpt = excerptMeetingNotes(details, 2800);
  if (!excerpt) return "";
  const nested = summaryFromMarkup(excerpt);
  if (nested) return nested.slice(0, 2800).trim();
  return excerpt
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => !looksLikeMeetingMarkup(block))
    .slice(0, 6)
    .join("\n\n")
    .slice(0, 2800)
    .trim();
}

export function noteBrief(details: unknown, preferActions = false): string {
  if (!details) return "";
  if (preferActions) {
    const actions = actionLinesFromNotes(details);
    if (actions) return actions;
  }
  return meetingSummary(details) || excerptMeetingNotes(details, 2000);
}
