import { granolaAnswer } from "./text.ts";

const MAX_BULLETS = 4;
const MAX_LINE = 140;

const HEADER =
  /^(open items?|mine|theirs|you|them|their open items?|next steps?|action items?|follow[- ]ups?|prep|here(?:'|’)s what)\b[:\s.-]*/i;

const PROMPT_ECHO =
  /open loops, or names without guessing|names i will forget|what not to reopen|no markdown|no chain of thought|no preamble|max \d+|cover:|last decision|be specific to my notes/i;

const REASONING =
  /^(let me|the user asked|i'll |i will now|i should |searching |looking at |i need to |based on |i'm going to|focus on meetings|i'll read|let me read|idea added to <)/i;

export function bulletLines(text: string, max = MAX_BULLETS): string[] {
  const focused = granolaAnswer(text);
  const lines = focused
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^[-*•]\s+/, "")
        .replace(/^\d+[.)]\s+/, "")
        .replace(HEADER, "")
        .trim(),
    )
    .filter(Boolean)
    .filter((line) => !PROMPT_ECHO.test(line))
    .filter((line) => !REASONING.test(line))
    .filter((line) => line.length > 6 && line.length <= MAX_LINE);

  const unique: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (unique.some((item) => item.toLowerCase() === key)) continue;
    unique.push(line);
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
