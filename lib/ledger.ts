export type LedgerLane = "you" | "them";

const YOU_HEADER =
  /^(you|yours|me|my items?|i owe|owed by me|mine|open items?)\b[:\s-]*/i;
const THEM_HEADER =
  /^(them|theirs|they|their items?|waiting on|owed to me|their open items?)\b[:\s-]*/i;

function leftover(line: string, header: RegExp): string {
  return line
    .replace(header, "")
    .replace(/^\([^)]*\)[:\s.-]*/, "")
    .trim();
}

export function splitLedger(lines: string[]) {
  const you: string[] = [];
  const them: string[] = [];
  let lane: LedgerLane | null = null;

  for (const raw of lines) {
    const line = raw.replace(/^[-•*]\s*/, "").trim();
    if (!line) continue;

    if (THEM_HEADER.test(line)) {
      lane = "them";
      const rest = leftover(line, THEM_HEADER);
      if (rest) them.push(rest);
      continue;
    }
    if (YOU_HEADER.test(line)) {
      lane = "you";
      const rest = leftover(line, YOU_HEADER);
      if (rest) you.push(rest);
      continue;
    }

    const theirs = /\b(they|them|their|waiting on)\b/i.test(line);
    const mine = /\b(i |i'm|i owe|send|my |need to)\b/i.test(line);
    if (theirs && !mine) {
      them.push(line);
      lane = "them";
    } else if (lane === "them") {
      them.push(line);
    } else {
      you.push(line);
      lane = "you";
    }
  }

  return { you, them };
}
