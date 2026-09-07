export type SummaryBlock =
  | { type: "heading"; text: string }
  | { type: "bullet"; text: string }
  | { type: "para"; text: string };

function stripMarks(value: string): string {
  return value.replace(/\*\*/g, "").replace(/^#{1,6}\s+/, "").trim();
}

function isBullet(line: string): boolean {
  return /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line);
}

function bulletText(line: string): string {
  return stripMarks(
    line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, ""),
  );
}

function isHeading(line: string, next: string | undefined): boolean {
  if (/^#{1,6}\s+\S/.test(line)) return true;
  if (isBullet(line)) return false;
  if (line.length > 70) return false;
  if (/[.!?]$/.test(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8) return false;
  if (next && isBullet(next)) return true;
  const small = /^(and|or|of|the|for|a|an|to|in|on|with)$/i;
  const titled = words.every(
    (word) => small.test(word) || /^[\dA-Z("'“]/.test(word),
  );
  return titled && words.length <= 6;
}

export function summaryBlocks(raw: string): SummaryBlock[] {
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const blocks: SummaryBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    const next = lines.slice(i + 1).find((item) => item.length > 0);
    if (isHeading(line, next)) {
      blocks.push({ type: "heading", text: stripMarks(line) });
      continue;
    }
    if (isBullet(line)) {
      blocks.push({ type: "bullet", text: bulletText(line) });
      continue;
    }
    blocks.push({ type: "para", text: stripMarks(line) });
  }

  return blocks.filter((block) => block.text.length > 0);
}
