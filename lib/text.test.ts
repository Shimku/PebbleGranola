import assert from "node:assert/strict";
import { test } from "node:test";
import { clipForRing, granolaAnswer } from "./text.ts";

const ramble = `The user asked specifically about **this week** (Mon Sep 7, 2026). Let me focus on meetings from this week - but since the current date is Sep 7 and the most recent meetings are from Sep 4, I'll read the most recent meetings.

Here's what's still open, split by owner:
MINE
Send startup teams the site list with annual energy consumption
Set up CBRE intro call for Thursday or Friday this week
THEIRS
HeatVentors: send site proposal data by Sep 9`;

test("granolaAnswer drops chain of thought and keeps the ledger", () => {
  const answer = granolaAnswer(ramble);
  assert.match(answer, /Here's what's still open/i);
  assert.doesNotMatch(answer, /The user asked specifically/);
  assert.match(answer, /CBRE intro call/);
});

test("clipForRing does not return the reasoning preamble", () => {
  const clipped = clipForRing(ramble);
  assert.doesNotMatch(clipped, /The user asked specifically/);
  assert.match(clipped, /still open/i);
});
