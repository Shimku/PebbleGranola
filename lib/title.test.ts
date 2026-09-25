import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanMeetingDate,
  cleanMeetingTitle,
  pairSides,
  shortDate,
} from "./title.ts";

const xml =
  '<meeting id="" title="ACME&lt;&gt;BETA 20m in Lisbon" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true" listed as participant="true" is workspace visible="false"';

test("cleanMeetingTitle pulls title= out of Granola XML", () => {
  assert.equal(cleanMeetingTitle(xml), "ACME<>BETA 20m in Lisbon");
});

test("cleanMeetingTitle leaves a normal title alone", () => {
  assert.equal(cleanMeetingTitle("Northwind sync"), "Northwind sync");
});

test("cleanMeetingTitle drops generic fallbacks", () => {
  assert.equal(cleanMeetingTitle("Afterthought"), "");
  assert.equal(cleanMeetingTitle("Open loops"), "");
});

test("pairSides splits Left<>Right", () => {
  assert.deepEqual(pairSides(xml), {
    left: "ACME",
    right: "BETA 20m in Lisbon",
  });
});

test("date comes from the markup when the title field is XML", () => {
  assert.match(cleanMeetingDate(xml, null) ?? "", /Sep 4/);
  assert.match(shortDate("Sep 4, 2026 11:14 AM GMT+1") ?? "", /Sep 4/);
});
