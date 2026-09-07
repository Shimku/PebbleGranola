const RING_MAX = 380;

const REASONING_LINE =
  /^(let me|the user asked|i'll |i will now|i should |searching |looking at |i need to |based on the most recent|let me now|i'm going to|focus on meetings|i'll read|let me read|let me focus|let me compile)/i;

export function isPromptEcho(line: string): boolean {
  const t = line
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[.,:;!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  if (/four short bullets/.test(t)) return true;
  if (/names in four/.test(t)) return true;
  if (/open loops/.test(t) && /names/.test(t) && t.length < 90) return true;
  if (/last decision/.test(t) && /open loops/.test(t)) return true;
  if (/without guessing/.test(t)) return true;
  if (/names i will forget/.test(t)) return true;
  if (/what not to reopen/.test(t)) return true;
  if (/no markdown/.test(t) || /no chain of thought/.test(t) || /no preamble/.test(t)) {
    return true;
  }
  if (/be specific to my notes/.test(t)) return true;
  if (/^prep me in \d/.test(t)) return true;
  if (/^what do i still owe/.test(t)) return true;
  if (/max \d+ bullets/.test(t) || /cover:/.test(t)) return true;
  return false;
}

export function isUnusableAnswer(line: string): boolean {
  if (isPromptEcho(line)) return true;
  if (/i don['’]?t have the notes/i.test(line)) return true;
  if (/notes for that conversation available here/i.test(line)) return true;
  if (/no meeting notes are available/i.test(line)) return true;
  if (/no matching granola note/i.test(line)) return true;
  if (/^last (matching )?note:/i.test(line.trim())) return true;
  return false;
}

function dropEchoLines(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !isUnusableAnswer(line) && !REASONING_LINE.test(line))
    .join("\n")
    .trim();
}

export function granolaAnswer(text: string): string {
  if (!text.trim()) return "";

  const stripped = text
    .replace(/\u2014/g, " - ")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[\[(\d+)\]\]\((https?:[^)]+)\)/g, "[$1]")
    .replace(/\[(\d+)\]\((https?:[^)]+)\)/g, "[$1]")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const marker = stripped.search(
    /here(?:'|’)?s what|open items?\b|idea added|^mine\b|^theirs\b/im,
  );
  const focused = marker >= 0 ? stripped.slice(marker) : stripped;
  const blocks = focused
    .split(/\n{2,}/)
    .map((block) => dropEchoLines(block))
    .filter(Boolean);
  const kept = blocks.filter((block) => !REASONING_LINE.test(block));
  const body = (kept.length ? kept : blocks).join("\n").trim();
  return isUnusableAnswer(body) ? "" : body;
}

export function clipForRing(text: string, max = RING_MAX): string {
  const cleaned = granolaAnswer(text)
    .replace(/[^\S\n]+/g, " ")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length <= max) return cleaned;

  const cut = cleaned.slice(0, max);
  const lastStop = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
    cut.lastIndexOf(".\n"),
    cut.lastIndexOf("\n"),
  );
  const clipped = (lastStop > 90 ? cut.slice(0, lastStop + 1) : cut).trim();
  return clipped.endsWith(".") || clipped.endsWith("!") || clipped.endsWith("?")
    ? clipped
    : `${clipped}…`;
}

export function extractToolText(result: unknown): string {
  if (typeof result === "string") return result;
  if (!result || typeof result !== "object") return "";

  const obj = result as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.output === "string") return obj.output;
  if (typeof obj.answer === "string") return obj.answer;

  if (Array.isArray(obj.content)) {
    const parts = obj.content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          const text = (item as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter(Boolean);
    if (parts.length) return parts.join("\n");
  }

  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

export function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
