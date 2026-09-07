import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatMeetingLabel,
  isSortaTitle,
  looksLikeVisualCanvasHint,
  pickMeetings,
  scoreMeeting,
  type MeetingHit,
} from "./match.ts";

function hit(
  id: string,
  title: string,
  date: string,
  attendees: string[] = [],
): MeetingHit {
  return { id, title, date, attendees };
}

const amazon = hit("a", "Amazon sync", "2026-09-01T10:00:00Z", ["Brad"]);
const diageo = hit("d", "Diageo pitching", "2026-09-02T10:00:00Z");
const sortaOld = hit("s1", "Sorta<>Maya Walkthrough", "2026-08-20T10:00:00Z");
const sortaNew = hit("s2", "Sorta<>Nikita Xxx", "2026-09-02T18:00:00Z");
const random = hit("r", "Weekly standup", "2026-09-03T09:00:00Z");
const all = [amazon, diageo, sortaOld, sortaNew, random];

test("Sorta<> titles are detected", () => {
  assert.equal(isSortaTitle("Sorta<>Nikita Xxx"), true);
  assert.equal(isSortaTitle("sorta <> Maya"), true);
  assert.equal(isSortaTitle("Amazon sync"), false);
});

test("visual canvas / sorta language is detected", () => {
  assert.equal(looksLikeVisualCanvasHint("prep me for the visual canvas"), true);
  assert.equal(looksLikeVisualCanvasHint("Sorta pitch"), true);
  assert.equal(looksLikeVisualCanvasHint("canvas rehearsal"), true);
  assert.equal(looksLikeVisualCanvasHint("Diageo pitching"), false);
});

test("saying visual canvas picks the latest Sorta<> note, not Amazon", () => {
  const picked = pickMeetings(all, "visual canvas", "last");
  assert.equal(picked.length, 1);
  assert.equal(picked[0]?.id, "s2");
});

test("pitch scope returns recent Sorta<> notes", () => {
  const picked = pickMeetings(all, "visual canvas pitch", "recent", {
    preferSorta: true,
  });
  assert.deepEqual(
    picked.map((row) => row.id),
    ["s2", "s1"],
  );
});

test("a name on the right of Sorta<> still matches", () => {
  const picked = pickMeetings(all, "Nikita", "last");
  assert.equal(picked[0]?.id, "s2");
});

test("tomorrow's Diageo demo is not hardcoded", () => {
  const picked = pickMeetings(all, "Diageo", "last");
  assert.equal(picked[0]?.id, "d");
});

test("Amazon still wins when you say Amazon", () => {
  const picked = pickMeetings(all, "yesterday's Amazon meeting", "last");
  assert.equal(picked[0]?.id, "a");
});

test("Sorta titles outscore random meetings for a canvas hint", () => {
  assert.ok(
    scoreMeeting(sortaNew, "visual canvas") >
      scoreMeeting(random, "visual canvas"),
  );
});

const vervXml = hit(
  "v",
  '<meeting id="" title="VERV&lt;&gt;ASA 20m in Barcelona" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true"',
  "2026-09-04T10:14:00Z",
);
const bonvan = hit("b", "Bonvan intro", "2026-09-03T15:00:00Z");

test("spoken Verve matches VERV<>ASA even when the title is XML", () => {
  const picked = pickMeetings([vervXml, amazon, random], "Verve", "last");
  assert.equal(picked[0]?.id, "v");
});

test("typed verv still matches VERV", () => {
  const picked = pickMeetings([vervXml, amazon], "verv", "last");
  assert.equal(picked[0]?.id, "v");
});

const brad = hit("br", "Brad<>FI Catch-up 07.09.26", "2026-09-07T14:01:00Z");
const interfaces = hit("if", "Interfaces Feedback", "2026-09-03T17:17:00Z");
const bonvanAsa = hit("ba", "Bonvan<>ASA | 20m in Barcelona", "2026-09-04T08:32:00Z");

test("spoken Brad matches Brad<>FI Catch-up", () => {
  const picked = pickMeetings([brad, amazon, random], "Brad", "last");
  assert.equal(picked[0]?.id, "br");
});

test("what they owe from the meeting with Brad still finds Brad", () => {
  const picked = pickMeetings(
    [brad, amazon, random],
    "What they owe from the meeting with Brad?",
    "last",
  );
  assert.equal(picked[0]?.id, "br");
});

test("prepped me for interfaces matches Interfaces Feedback", () => {
  const picked = pickMeetings(
    [interfaces, amazon, random],
    "Prepped me for the next meeting with interfaces.",
    "last",
  );
  assert.equal(picked[0]?.id, "if");
});

test("Bonbon fuzzy-matches a Bonvan title", () => {
  const picked = pickMeetings([bonvan, amazon, random], "Bonbon", "last");
  assert.equal(picked[0]?.id, "b");
});

test("Bonbon fuzzy-matches Bonvan<>ASA", () => {
  const picked = pickMeetings([bonvanAsa, amazon, random], "Bonbon", "last");
  assert.equal(picked[0]?.id, "ba");
});

test("an unknown company does not fall back to a random meeting", () => {
  const picked = pickMeetings(all, "Bonbon", "last");
  assert.equal(picked.length, 0);
});

test("formatMeetingLabel does not dump XML", () => {
  const label = formatMeetingLabel(vervXml);
  assert.match(label, /VERV<>ASA/);
  assert.doesNotMatch(label, /<meeting/);
});
