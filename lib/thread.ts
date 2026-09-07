import { cleanMeetingTitle, pairSides } from "./title.ts";

export const UNFILED = "Unfiled";

const SKIP_HINTS = new Set([
  "this week",
  "last meeting",
  "last call",
  "the last meeting",
]);

function firstWords(value: string, count = 2): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, count)
    .join(" ");
}

function fromHint(hint: string | null | undefined): string {
  const trimmed = hint?.trim() ?? "";
  if (!trimmed || SKIP_HINTS.has(trimmed.toLowerCase())) return "";
  return firstWords(cleanMeetingTitle(trimmed) || trimmed, 2);
}

export function threadLabel(input: {
  title?: string | null;
  hint?: string | null;
  spoken?: string | null;
}): string {
  const cleaned = cleanMeetingTitle(input.title);
  if (cleaned) {
    const { left, right } = pairSides(cleaned);
    if (left) {
      if (/^sorta$/i.test(left) && right) {
        return `Sorta · ${firstWords(right, 1)}`;
      }
      return left;
    }
    return firstWords(cleaned, 3);
  }
  return fromHint(input.hint) || fromHint(input.spoken) || UNFILED;
}

export function threadKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}
