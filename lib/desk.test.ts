import assert from "node:assert/strict";
import { test } from "node:test";
import { splitLedger } from "./ledger.ts";
import { deskFromCaptures } from "./desk.ts";

test("MINE / THEIRS headers fill the ledger", () => {
  const { you, them } = splitLedger([
    "MINE",
    "Send the site list",
    "THEIRS",
    "Northwind: data by Sep 9",
  ]);
  assert.deepEqual(you, ["Send the site list"]);
  assert.deepEqual(them, ["Northwind: data by Sep 9"]);
});

test("OPEN ITEMS and THEIR OPEN ITEMS split", () => {
  const { you, them } = splitLedger([
    "OPEN ITEMS:",
    "Set up the broker intro",
    "THEIR OPEN ITEMS (Acme):",
    "Pick UK sites",
  ]);
  assert.deepEqual(you, ["Set up the broker intro"]);
  assert.deepEqual(them, ["Pick UK sites"]);
});

test("chain of thought does not become an open item", () => {
  const { you, them } = splitLedger([
    "(Mon Sep 7, 2020). Let me focus on meetings from this week",
    "Set up the broker intro",
  ]);
  assert.deepEqual(you, ["Set up the broker intro"]);
  assert.deepEqual(them, []);
});

test("open loops prompt echo does not become a ledger row", () => {
  const { you, them } = splitLedger([
    "open loops, and names in four short bullets.",
    "Set up the broker intro",
  ]);
  assert.deepEqual(you, ["Set up the broker intro"]);
  assert.deepEqual(them, []);
});

test("deskFromCaptures uses the newest of each kind", () => {
  const desk = deskFromCaptures([
    {
      id: "2",
      kind: "todos",
      title: "Acme",
      hint: "Acme",
      input: "Acme",
      output: "OPEN ITEMS:\nCall the broker",
      meeting_ids: ["abc"],
    },
    {
      id: "1",
      kind: "todos",
      title: "Old",
      hint: null,
      input: "this week",
      output: "stale",
      meeting_ids: [],
    },
    {
      id: "3",
      kind: "prep",
      title: "ACME<>BETA",
      hint: "acme",
      input: "acme",
      output: "UK pilot, five sites.",
      meeting_ids: ["abc"],
    },
  ]);
  assert.equal(desk.drafts.todos, "Acme");
  assert.equal(desk.results.todos?.title, "Acme");
  assert.equal(desk.drafts.prep, "acme");
  assert.match(desk.results.prep?.text ?? "", /UK pilot/);
  assert.equal(desk.results.afterthought, null);
});
