import { granolaAnswer, isUnusableAnswer } from "./text.ts";

const MAX_BULLETS = 4;
const MAX_LINE = 140;

const HEADER =
  /^(open items?|mine|theirs|you|them|their open items?|next steps?|action items?|follow[- ]ups?|prep|here(?:'|’)s what)\b[:\s.-]*/i;

const SECTION =
  /^(next steps?|summary|overview|discussion|notes|action items?|follow[- ]ups?|prep|open items?|theirs?|mine|you|them)$/i;

const REASONING =
  /^(let me|the user asked|i'll |i will now|i should |searching |looking at |i need to |based on |i'm going to|focus on meetings|i'll read|let me read|idea added to <)/i;

function clipLine(line: string): string {
  if (line.length <= MAX_LINE) return line;
  const cut = line.slice(0, MAX_LINE);
  const space = cut.lastIndexOf(" ");
  const clipped = (space > 40 ? cut.slice(0, space) : cut).trim();
  return clipped;
}

function splitSentences(line: string): string[] {
  if (line.length <= MAX_LINE) return [line];
  const parts = line
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [];
  return parts.flatMap((part) => {
    if (part.length <= MAX_LINE) return [part];
    if (part.length <= 6) return [];
    return [clipLine(part)];
  });
}

function cleanLine(line: string): string {
  return line
    .replace(/^[-*•]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .replace(HEADER, "")
    .trim();
}

export function bulletLines(text: string, max = MAX_BULLETS): string[] {
  const focused = granolaAnswer(text);
  const lines = focused
    .split(/\n+/)
    .flatMap((line) => splitSentences(cleanLine(line)))
    .map((line) => cleanLine(line))
    .filter(Boolean)
    .filter((line) => !SECTION.test(line))
    .filter((line) => !isUnusableAnswer(line))
    .filter((line) => !REASONING.test(line))
    .filter((line) => line.length > 6);

  const unique: string[] = [];
  for (const line of lines) {
    const clipped = clipLine(line);
    const key = clipped.toLowerCase();
    if (unique.some((item) => item.toLowerCase() === key)) continue;
    unique.push(clipped);
    if (unique.length >= max) break;
  }
  return unique;
}

export function formatBullets(lines: string[], heading?: string): string {
  if (!lines.length) return "";
  const body = lines.map((line) => `• ${line}`).join("\n");
  return heading ? `${heading}\n${body}` : body;
}

export function ringBullets(
  text: string,
  heading: string,
  fallback: string,
  max = MAX_BULLETS,
): string {
  const lines = bulletLines(text, max);
  if (lines.length) return formatBullets(lines, heading);
  const fallbackLines = bulletLines(fallback, max);
  if (fallbackLines.length) return formatBullets(fallbackLines, heading);
  return fallback.trim();
}

export function looksThin(text: string): boolean {
  return bulletLines(text, MAX_BULLETS).length < 2;
}
