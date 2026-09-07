const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (raw, code: string) => {
      const lower = code.toLowerCase();
      if (lower.startsWith("#x")) {
        const n = Number.parseInt(lower.slice(2), 16);
        return Number.isFinite(n) ? String.fromCodePoint(n) : raw;
      }
      if (lower.startsWith("#")) {
        const n = Number.parseInt(lower.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : raw;
      }
      return ENTITIES[lower] ?? raw;
    })
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">");
}

export function looksLikeMeetingMarkup(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/<meeting\b/i.test(trimmed)) return true;
  if (/\btitle="[^"]+"/.test(trimmed) && /\bdate="/.test(trimmed)) return true;
  if (/captured by me=/i.test(trimmed)) return true;
  if (/is workspace visible=/i.test(trimmed)) return true;
  return false;
}

function attr(raw: string, name: string): string {
  const match = raw.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : "";
}

export function meetingAttrsFromMarkup(raw: string): {
  title: string;
  date: string;
} | null {
  if (!looksLikeMeetingMarkup(raw)) return null;
  const title = attr(raw, "title");
  const date = attr(raw, "date");
  if (!title && !date) return null;
  return { title, date };
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const FALLBACK_TITLES = new Set([
  "afterthought",
  "open loops",
  "untitled meeting",
  "untitled",
]);

export function cleanMeetingTitle(value: string | null | undefined): string {
  if (!value) return "";
  const decoded = decodeHtmlEntities(value).replace(/\u2014/g, " - ").trim();
  const fromMarkup = meetingAttrsFromMarkup(decoded);
  const title = fromMarkup?.title || decoded;
  const stripped = stripTags(title)
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!stripped) return "";
  if (FALLBACK_TITLES.has(stripped.toLowerCase())) return "";
  return stripped;
}

export function cleanMeetingDate(
  title: string | null | undefined,
  date: string | null | undefined,
): string | null {
  if (date?.trim()) return date.trim();
  const decoded = decodeHtmlEntities(title ?? "");
  const fromMarkup = meetingAttrsFromMarkup(decoded);
  return fromMarkup?.date || null;
}

export function pairSides(title: string): { left: string; right: string } {
  const cleaned = cleanMeetingTitle(title);
  const index = cleaned.indexOf("<>");
  if (index < 0) return { left: "", right: "" };
  return {
    left: cleaned.slice(0, index).trim(),
    right: cleaned.slice(index + 2).trim(),
  };
}

export function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  const loose = value.match(
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:,\s*\d{4})?/i,
  );
  return loose?.[0] ?? null;
}
