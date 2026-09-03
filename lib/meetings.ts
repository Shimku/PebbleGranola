import { callGranolaTool, granolaToolJson, granolaToolText } from "./granola-mcp";
import { type MeetingHit } from "./match";
import { asRecord, asString } from "./text";

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
  return (
    asString(record.date) ||
    asString(record.created_at) ||
    asString(record.updated_at) ||
    asString(record.start_time) ||
    asString(calendar?.start) ||
    asString(calendar?.start_time) ||
    asString(calendar?.starts_at) ||
    null
  );
}

function asMeeting(value: unknown): MeetingHit | null {
  const record = asRecord(value);
  if (!record) return null;
  const id =
    asString(record.id) ||
    asString(record.meeting_id) ||
    asString(record.note_id) ||
    asString(record.document_id);
  if (!id) return null;
  return {
    id,
    title:
      asString(record.title) ||
      asString(record.name) ||
      asString(record.summary) ||
      "Untitled meeting",
    date: collectDate(record),
    attendees: collectAttendees(
      record.attendees ?? record.participants ?? record.people,
    ),
  };
}

function meetingsFromUnknown(value: unknown): MeetingHit[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(asMeeting).filter((item): item is MeetingHit => Boolean(item));
  }

  const record = asRecord(value);
  if (!record) return [];

  for (const key of ["meetings", "notes", "items", "results", "data"]) {
    if (Array.isArray(record[key])) {
      return meetingsFromUnknown(record[key]);
    }
  }

  if (Array.isArray(record.content)) {
    for (const item of record.content) {
      const inner = asRecord(item);
      const text = asString(inner?.text);
      if (!text) continue;
      try {
        const parsed = JSON.parse(text) as unknown;
        const found = meetingsFromUnknown(parsed);
        if (found.length) return found;
      } catch {
        continue;
      }
    }
  }

  const single = asMeeting(record);
  return single ? [single] : [];
}

export async function listRecentMeetings(): Promise<MeetingHit[]> {
  const attempts: Record<string, unknown>[] = [
    { time_range: "last_30_days" },
    { time_range: "this_week" },
    {},
  ];

  let lastError: unknown = null;
  for (const args of attempts) {
    try {
      const result = await granolaToolJson("list_meetings", args);
      const meetings = meetingsFromUnknown(result);
      if (meetings.length) return meetings;
      const nested = meetingsFromUnknown(await callGranolaTool("list_meetings", args));
      if (nested.length) return nested;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

export async function getMeetingDetails(ids: string[]): Promise<unknown> {
  if (!ids.length) return null;
  return granolaToolJson("get_meetings", { meeting_ids: ids.slice(0, 10) });
}

export async function askGranola(query: string, documentIds?: string[]) {
  const args: Record<string, unknown> = { query };
  if (documentIds?.length) args.document_ids = documentIds.slice(0, 10);
  return granolaToolText("query_granola_meetings", args);
}

export async function granolaAccountInfo(): Promise<unknown> {
  try {
    return await granolaToolJson("get_account_info", {});
  } catch {
    return granolaToolText("get_account_info", {});
  }
}

export function summarizeMeetingsForPrompt(meetings: MeetingHit[]): string {
  if (!meetings.length) return "No matching Granola notes in the last 30 days.";
  return meetings
    .map((meeting, index) => {
      const who = meeting.attendees.length
        ? ` · ${meeting.attendees.slice(0, 4).join(", ")}`
        : "";
      return `${index + 1}. ${meeting.title}${who}`;
    })
    .join("\n");
}
