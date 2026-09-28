import assert from "node:assert/strict";
import { test } from "node:test";
import { pebbleResult } from "./pebble-result.ts";

test("ring results are a Response so the phone shows the reply", () => {
  const result = pebbleResult(
    "OPEN ITEMS\n• Schedule the follow-up\n• Friday catch-up to clear open items",
  );
  assert.equal(result._meta.coreSchema, 1);
  assert.equal(result.structuredContent.semanticResult.type, "Response");
  assert.match(result.structuredContent.semanticResult.text, /Schedule the follow-up/);
  assert.equal(
    result.structuredContent.output,
    result.structuredContent.semanticResult.text,
  );
  assert.equal(
    JSON.stringify(result.structuredContent.semanticResult).includes("ListItem"),
    false,
  );
});
