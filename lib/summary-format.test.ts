import assert from "node:assert/strict";
import { test } from "node:test";
import { summaryBlocks } from "./summary-format.ts";

test("Granola section titles become headings and dashes become bullets", () => {
  const blocks = summaryBlocks(`Overall Impressions

- Genuinely impressed: feels like legitimately new tech, rare "wow" moment
- Branding and aesthetics nail the premium feel

App Feedback

- Chat bubbles occasionally blend into background
- App throttles on account submenu taps`);

  assert.deepEqual(
    blocks.filter((block) => block.type === "heading").map((block) => block.text),
    ["Overall Impressions", "App Feedback"],
  );
  assert.equal(blocks.filter((block) => block.type === "bullet").length, 4);
  assert.match(blocks[1]?.text ?? "", /Genuinely impressed/);
});

test("markdown hashes are headings", () => {
  const blocks = summaryBlocks(`# Next Steps\n- Set up CBRE intro call`);
  assert.equal(blocks[0]?.type, "heading");
  assert.equal(blocks[0]?.text, "Next Steps");
  assert.equal(blocks[1]?.type, "bullet");
});
