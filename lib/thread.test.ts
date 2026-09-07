import assert from "node:assert/strict";
import { test } from "node:test";
import { threadLabel, UNFILED, sameThread, preferThreadLabel } from "./thread.ts";

test("VERV<>ASA threads as VERV", () => {
  assert.equal(
    threadLabel({
      title:
        '<meeting id="" title="VERV&lt;&gt;ASA 20m in Barcelona" date="Sep 4, 2026 11:14 AM GMT+1"',
    }),
    "VERV",
  );
});

test("a spoken company still files when the title is missing", () => {
  assert.equal(
    threadLabel({ title: null, hint: "Bonbon", spoken: "what do I owe Bonbon" }),
    "Bonbon",
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

test("Verve and VERV are the same thread", () => {
  assert.equal(sameThread("VERV", "verve"), true);
  assert.equal(sameThread("VERV", "Bonbon"), false);
  assert.equal(preferThreadLabel("verve", "VERV"), "VERV");
});

test("Sorta pitches keep the person", () => {
  assert.equal(
    threadLabel({ title: "Sorta<>Nikita Xxx" }),
    "Sorta · Nikita",
  );
});
