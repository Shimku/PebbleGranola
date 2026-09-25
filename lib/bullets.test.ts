import assert from "node:assert/strict";
import { test } from "node:test";
import { bulletLines, ringBullets } from "./bullets.ts";

test("keeps a few action lines and drops chain of thought", () => {
  const lines = bulletLines(
    `The user asked specifically about Acme. Let me focus on meetings.

OPEN ITEMS:
Set up the broker intro for Thursday or Friday
Coordinate pilot setup in London in October
Share Q1 UK site list with Acme
Also write an essay about the partnership vision and the long-term roadmap which is way too long for a lock screen notification because it rambles`,
  );
  assert.equal(lines.length, 3);
  assert.match(lines[0] ?? "", /broker/);
  assert.doesNotMatch(lines.join("\n"), /user asked/i);
});

test("drops the Kickoff prep echo and keeps real notes", () => {
  const text = ringBullets(
    "open loops, and names in four short bullets.",
    "PREP",
    "• Share the Q1 site list\n• Set up the broker intro",
  );
  assert.doesNotMatch(text, /open loops/i);
  assert.doesNotMatch(text, /four short bullets/i);
  assert.match(text, /Q1 site list/);
});

test("turns a Granola summary into short prep bullets", () => {
  const lines = bulletLines(`# Next Steps

- Set up the broker intro for Thursday or Friday next week
- Share Q1 site list with Acme for selection
- Confirm London pilot dates in October`);
  assert.equal(lines.length, 3);
  assert.match(lines[0] ?? "", /broker/);
  assert.doesNotMatch(lines.join("\n"), /Next Steps/);
});

test("caps at four bullets", () => {
  const lines = bulletLines(
    ["one item here", "two item here", "three item here", "four item here", "five item here"].join(
      "\n",
    ),
  );
  assert.equal(lines.length, 4);
});
