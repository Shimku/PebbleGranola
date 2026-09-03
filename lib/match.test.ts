import assert from "node:assert/strict";
import { test } from "node:test";
import {
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
