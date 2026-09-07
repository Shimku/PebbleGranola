import assert from "node:assert/strict";
import { test } from "node:test";
import { clipForRing, granolaAnswer, isPromptEcho, isUnusableAnswer } from "./text.ts";

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

test("granolaAnswer drops a Chat prompt echo", () => {
  const answer = granolaAnswer("open loops, and names in four short bullets.");
  assert.equal(answer, "");
});

test("isPromptEcho catches the four-bullet instruction fragment", () => {
  assert.equal(
    isPromptEcho("open loops, and names in four short bullets."),
    true,
  );
  assert.equal(isPromptEcho("Set up CBRE intro call for Thursday"), false);
});

test("isUnusableAnswer catches Index saying notes are not here", () => {
  assert.equal(
    isUnusableAnswer("I don’t have the notes for that conversation available here."),
    true,
  );
  assert.equal(isUnusableAnswer("Friday catch-up to clear open action items"), false);
});
