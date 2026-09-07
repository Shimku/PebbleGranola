import {
  callGranolaTool,
  granolaToolJson,
  granolaToolText,
  isGranolaTimeout,
} from "./granola-mcp";
import { type MeetingHit } from "./match";
import { meetingsFromUnknown } from "./meeting-parse";

export {
  actionLinesFromNotes,
  excerptMeetingNotes,
  meetingsFromUnknown,
  meetingSummary,
  noteBrief,
  summaryFromMarkup,
} from "./meeting-parse";

export async function listRecentMeetings(): Promise<MeetingHit[]> {
  const attempts: Record<string, unknown>[] = [
    { time_range: "last_30_days" },
    {},
  ];

  let lastError: unknown = null;
  for (const args of attempts) {
    try {
      const result = await callGranolaTool("list_meetings", args);
      const meetings = meetingsFromUnknown(result);
      console.log(
        JSON.stringify({
          granola: "list_meetings",
          count: meetings.length,
        }),
      );
      if (meetings.length) return meetings;
    } catch (error) {
      if (isGranolaTimeout(error)) {
        lastError = error;
        continue;
      }
      lastError = error;
    }
  }

  if (lastError && !isGranolaTimeout(lastError)) throw lastError;
  return [];
}

export async function getMeetingDetails(ids: string[]): Promise<unknown> {
  if (!ids.length) return null;
  try {
    return await granolaToolJson("get_meetings", { meeting_ids: ids.slice(0, 10) });
  } catch (error) {
    if (isGranolaTimeout(error)) return null;
    throw error;
  }
}

export async function askGranola(query: string, documentIds?: string[]) {
  const args: Record<string, unknown> = { query };
  if (documentIds?.length) args.document_ids = documentIds.slice(0, 10);
  try {
    return await granolaToolText("query_granola_meetings", args);
  } catch (error) {
    if (isGranolaTimeout(error)) return "";
    throw error;
  }
}

export async function granolaAccountInfo(): Promise<unknown> {
  try {
    return await granolaToolJson("get_account_info", {});
  } catch {
    try {
      return await granolaToolText("get_account_info", {});
    } catch (error) {
      if (isGranolaTimeout(error)) return null;
      throw error;
    }
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
