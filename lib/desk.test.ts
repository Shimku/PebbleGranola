import assert from "node:assert/strict";
import { test } from "node:test";
import { splitLedger } from "./ledger.ts";
import { deskFromCaptures } from "./desk.ts";

test("MINE / THEIRS headers fill the ledger", () => {
  const { you, them } = splitLedger([
    "MINE",
    "Send the site list",
    "THEIRS",
    "HeatVentors: data by Sep 9",
  ]);
  assert.deepEqual(you, ["Send the site list"]);
  assert.deepEqual(them, ["HeatVentors: data by Sep 9"]);
});

test("OPEN ITEMS and THEIR OPEN ITEMS split", () => {
  const { you, them } = splitLedger([
    "OPEN ITEMS:",
    "Set up CBRE intro call",
    "THEIR OPEN ITEMS (Verve):",
    "Pick UK sites",
  ]);
  assert.deepEqual(you, ["Set up CBRE intro call"]);
  assert.deepEqual(them, ["Pick UK sites"]);
});

test("chain of thought does not become an open item", () => {
  const { you, them } = splitLedger([
    "(Mon Sep 7, 2020). Let me focus on meetings from this week",
    "Set up CBRE intro call",
  ]);
  assert.deepEqual(you, ["Set up CBRE intro call"]);
  assert.deepEqual(them, []);
});

test("open loops prompt echo does not become a ledger row", () => {
  const { you, them } = splitLedger([
    "open loops, and names in four short bullets.",
    "Set up CBRE intro call",
  ]);
  assert.deepEqual(you, ["Set up CBRE intro call"]);
  assert.deepEqual(them, []);
});

test("deskFromCaptures uses the newest of each kind", () => {
  const desk = deskFromCaptures([
    {
      id: "2",
      kind: "todos",
      title: "Verve",
      hint: "Verve",
      input: "Verve",
      output: "OPEN ITEMS:\nCall CBRE",
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
      title: "VERV<>ASA",
      hint: "verve",
      input: "verve",
      output: "UK pilot, five sites.",
      meeting_ids: ["abc"],
    },
  ]);
  assert.equal(desk.drafts.todos, "Verve");
  assert.equal(desk.results.todos?.title, "Verve");
  assert.equal(desk.drafts.prep, "verve");
  assert.match(desk.results.prep?.text ?? "", /UK pilot/);
  assert.equal(desk.results.afterthought, null);
});
