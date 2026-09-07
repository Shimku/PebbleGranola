import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanMeetingDate,
  cleanMeetingTitle,
  pairSides,
  shortDate,
} from "./title.ts";

const xml =
  '<meeting id="" title="VERV&lt;&gt;ASA 20m in Barcelona" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true" listed as participant="true" is workspace visible="false"';

test("cleanMeetingTitle pulls title= out of Granola XML", () => {
  assert.equal(cleanMeetingTitle(xml), "VERV<>ASA 20m in Barcelona");
});

test("cleanMeetingTitle leaves a normal title alone", () => {
  assert.equal(cleanMeetingTitle("Amazon sync"), "Amazon sync");
});

test("cleanMeetingTitle drops generic fallbacks", () => {
  assert.equal(cleanMeetingTitle("Afterthought"), "");
  assert.equal(cleanMeetingTitle("Open loops"), "");
});

test("pairSides splits Left<>Right", () => {
  assert.deepEqual(pairSides(xml), {
    left: "VERV",
    right: "ASA 20m in Barcelona",
  });
});

test("date comes from the markup when the title field is XML", () => {
  assert.match(cleanMeetingDate(xml, null) ?? "", /Sep 4/);
  assert.match(shortDate("Sep 4, 2026 11:14 AM GMT+1") ?? "", /Sep 4/);
});
