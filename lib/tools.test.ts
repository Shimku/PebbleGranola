import assert from "node:assert/strict";
import { test } from "node:test";
import { RING_INSTRUCTIONS, TOOLS } from "./ring.ts";

test("ring instructions force a tool call before claiming notes are missing", () => {
  assert.match(RING_INSTRUCTIONS, /Always call exactly one tool/i);
  assert.match(RING_INSTRUCTIONS, /what they owe/);
  assert.match(RING_INSTRUCTIONS, /prepped me/);
  assert.match(RING_INSTRUCTIONS, /unavailable/);
  assert.match(RING_INSTRUCTIONS, /not the whole sentence/);
});

test("prep and todos descriptions require a tool call for spoken routing", () => {
  const prep = TOOLS.find((tool) => tool.name === "prep");
  const todos = TOOLS.find((tool) => tool.name === "todos");
  assert.match(prep?.description ?? "", /prepped me/);
  assert.match(prep?.description ?? "", /unavailable/);
  assert.match(todos?.description ?? "", /what they owe/);
  assert.match(todos?.description ?? "", /unavailable/);
});
