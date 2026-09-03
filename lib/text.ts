const RING_MAX = 380;

export function clipForRing(text: string, max = RING_MAX): string {
  const cleaned = text
    .replace(/\[\[(\d+)\]\]\((https?:[^)]+)\)/g, "[$1]")
    .replace(/\[(\d+)\]\((https?:[^)]+)\)/g, "[$1]")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();

  if (cleaned.length <= max) return cleaned;

  const cut = cleaned.slice(0, max);
  const lastStop = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
    cut.lastIndexOf(".\n"),
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
