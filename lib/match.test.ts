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

const northwind = hit("a", "Northwind sync", "2026-09-01T10:00:00Z", ["Jordan"]);
const contoso = hit("d", "Contoso pitching", "2026-09-02T10:00:00Z");
const sortaOld = hit("s1", "Sorta<>Riley Walkthrough", "2026-08-20T10:00:00Z");
const sortaNew = hit("s2", "Sorta<>Alex Xxx", "2026-09-02T18:00:00Z");
const random = hit("r", "Weekly standup", "2026-09-03T09:00:00Z");
const all = [northwind, contoso, sortaOld, sortaNew, random];

test("Sorta<> titles are detected", () => {
  assert.equal(isSortaTitle("Sorta<>Alex Xxx"), true);
  assert.equal(isSortaTitle("sorta <> Riley"), true);
  assert.equal(isSortaTitle("Northwind sync"), false);
});

test("visual canvas / sorta language is detected", () => {
  assert.equal(looksLikeVisualCanvasHint("prep me for the visual canvas"), true);
  assert.equal(looksLikeVisualCanvasHint("Sorta pitch"), true);
  assert.equal(looksLikeVisualCanvasHint("canvas rehearsal"), true);
  assert.equal(looksLikeVisualCanvasHint("Contoso pitching"), false);
});

test("saying visual canvas picks the latest Sorta<> note, not Northwind", () => {
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
  const picked = pickMeetings(all, "Alex", "last");
  assert.equal(picked[0]?.id, "s2");
});

test("tomorrow's Contoso demo is not hardcoded", () => {
  const picked = pickMeetings(all, "Contoso", "last");
  assert.equal(picked[0]?.id, "d");
});

test("Northwind still wins when you say Northwind", () => {
  const picked = pickMeetings(all, "yesterday's Northwind meeting", "last");
  assert.equal(picked[0]?.id, "a");
});

test("Sorta titles outscore random meetings for a canvas hint", () => {
  assert.ok(
    scoreMeeting(sortaNew, "visual canvas") >
      scoreMeeting(random, "visual canvas"),
  );
});

const acmeXml = hit(
  "v",
  '<meeting id="" title="ACME&lt;&gt;BETA 20m in Lisbon" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true"',
  "2026-09-04T10:14:00Z",
);
const maplen = hit("b", "Maplen intro", "2026-09-03T15:00:00Z");

test("spoken Acme matches ACME<>BETA even when the title is XML", () => {
  const picked = pickMeetings([acmeXml, northwind, random], "Acme", "last");
  assert.equal(picked[0]?.id, "v");
});

test("typed acm still matches ACME", () => {
  const picked = pickMeetings([acmeXml, northwind], "acm", "last");
  assert.equal(picked[0]?.id, "v");
});

const jordan = hit("br", "Jordan<>North Catch-up 07.09.26", "2026-09-07T14:01:00Z");
const kickoff = hit("if", "Kickoff Feedback", "2026-09-03T17:17:00Z");
const maplenBeta = hit("ba", "Maplen<>BETA | 20m in Lisbon", "2026-09-04T08:32:00Z");

test("spoken Jordan matches Jordan<>North Catch-up", () => {
  const picked = pickMeetings([jordan, northwind, random], "Jordan", "last");
  assert.equal(picked[0]?.id, "br");
});

test("what they owe from the meeting with Jordan still finds Jordan", () => {
  const picked = pickMeetings(
    [jordan, northwind, random],
    "What they owe from the meeting with Jordan?",
    "last",
  );
  assert.equal(picked[0]?.id, "br");
});

test("prepped me for kickoff matches Kickoff Feedback", () => {
  const picked = pickMeetings(
    [kickoff, northwind, random],
    "Prepped me for the next meeting with kickoff.",
    "last",
  );
  assert.equal(picked[0]?.id, "if");
});

test("Maple fuzzy-matches a Maplen title", () => {
  const picked = pickMeetings([maplen, northwind, random], "Maple", "last");
  assert.equal(picked[0]?.id, "b");
});

test("Maple fuzzy-matches Maplen<>BETA", () => {
  const picked = pickMeetings([maplenBeta, northwind, random], "Maple", "last");
  assert.equal(picked[0]?.id, "ba");
});

test("an unknown company does not fall back to a random meeting", () => {
  const picked = pickMeetings(all, "Maple", "last");
  assert.equal(picked.length, 0);
});

test("formatMeetingLabel does not dump XML", () => {
  const label = formatMeetingLabel(acmeXml);
  assert.match(label, /ACME<>BETA/);
  assert.doesNotMatch(label, /<meeting/);
});
