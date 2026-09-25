import assert from "node:assert/strict";
import { test } from "node:test";
import { threadLabel, UNFILED, sameThread, preferThreadLabel } from "./thread.ts";

test("ACME<>BETA threads as ACME", () => {
  assert.equal(
    threadLabel({
      title:
        '<meeting id="" title="ACME&lt;&gt;BETA 20m in Lisbon" date="Sep 4, 2026 11:14 AM GMT+1"',
    }),
    "ACME",
  );
});

test("a spoken company still files when the title is missing", () => {
  assert.equal(
    threadLabel({ title: null, hint: "Maple", spoken: "what do I owe Maple" }),
    "Maple",
  );
});

test("this week does not become a thread name", () => {
  assert.equal(
    threadLabel({ title: null, hint: "this week", spoken: "this week" }),
    UNFILED,
  );
  assert.equal(
    threadLabel({ title: "this week", hint: "this week", spoken: "this week" }),
    UNFILED,
  );
});

test("Acme and ACME are the same thread", () => {
  assert.equal(sameThread("ACME", "acme"), true);
  assert.equal(sameThread("ACME", "Maple"), false);
  assert.equal(preferThreadLabel("acme", "ACME"), "ACME");
});

test("Sorta pitches keep the person", () => {
  assert.equal(
    threadLabel({ title: "Sorta<>Alex Xxx" }),
    "Sorta · Alex",
  );
});
