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

function usable(value: string): string {
  if (!value || SKIP_HINTS.has(value.toLowerCase())) return "";
  return value;
}

export function threadLabel(input: {
  title?: string | null;
  hint?: string | null;
  spoken?: string | null;
}): string {
  const cleaned = usable(cleanMeetingTitle(input.title));
  if (cleaned) {
    const { left, right } = pairSides(cleaned);
    if (left) {
      if (/^sorta$/i.test(left) && right) {
        return `Sorta · ${firstWords(right, 1)}`;
      }
      return left;
    }
    const words = firstWords(cleaned, 3);
    if (usable(words)) return words;
  }
  return fromHint(input.hint) || fromHint(input.spoken) || UNFILED;
}

function stem(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function sameThread(a: string, b: string): boolean {
  if (a === UNFILED || b === UNFILED) return a === b;
  const x = stem(a);
  const y = stem(b);
  if (!x || !y) return false;
  if (x === y) return true;
  return (
    x.length >= 3 && y.length >= 3 && (x.startsWith(y) || y.startsWith(x))
  );
}

export function preferThreadLabel(current: string, incoming: string): string {
  if (current === UNFILED) return incoming;
  if (incoming === UNFILED) return current;
  const score = (value: string) => {
    let n = 0;
    if (/^[A-Z][A-Z0-9]{1,7}$/.test(value)) n += 4;
    if (/^[A-Z][a-z]+$/.test(value)) n += 2;
    if (value === value.toLowerCase()) n -= 1;
    n -= value.length / 50;
    return n;
  };
  return score(incoming) > score(current) ? incoming : current;
}

export function threadKey(label: string): string {
  return stem(label) || UNFILED.toLowerCase();
}
