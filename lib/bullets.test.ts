import assert from "node:assert/strict";
import { test } from "node:test";
import { bulletLines, ringBullets } from "./bullets.ts";

test("keeps a few action lines and drops chain of thought", () => {
  const lines = bulletLines(
    `The user asked specifically about Verve. Let me focus on meetings.

OPEN ITEMS:
Set up CBRE intro call for Thursday or Friday
Coordinate pilot setup in London in October
Share Q1 UK site list with Verve
Also write an essay about the partnership vision and the long-term roadmap which is way too long for a lock screen notification because it rambles`,
  );
  assert.equal(lines.length, 3);
  assert.match(lines[0] ?? "", /CBRE/);
  assert.doesNotMatch(lines.join("\n"), /user asked/i);
});

test("drops prompt echoes like open loops, or names without guessing", () => {
  const text = ringBullets(
    "open loops, or names without guessing.",
    "PREP",
    "• UK site list still open\n• CBRE intro this week",
  );
  assert.doesNotMatch(text, /names without guessing/);
  assert.match(text, /UK site list/);
});

test("caps at four bullets", () => {
  const lines = bulletLines(
    ["one item here", "two item here", "three item here", "four item here", "five item here"].join(
      "\n",
    ),
  );
  assert.equal(lines.length, 4);
});
