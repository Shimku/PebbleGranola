import assert from "node:assert/strict";
import { test } from "node:test";
import { meetingsFromUnknown } from "./meeting-parse.ts";

test("parses nested meeting objects", () => {
  const meetings = meetingsFromUnknown({
    meetings: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "HeatVentors",
        date: "2026-09-04T10:00:00Z",
      },
    ],
  });
  assert.equal(meetings.length, 1);
  assert.equal(meetings[0]?.title, "HeatVentors");
});

test("parses document.id wrappers", () => {
  const meetings = meetingsFromUnknown({
    notes: [
      {
        document: { id: "22222222-2222-4222-8222-222222222222", title: "ASA panel" },
        created_at: "2026-09-02T09:00:00Z",
      },
    ],
  });
  assert.equal(meetings[0]?.id, "22222222-2222-4222-8222-222222222222");
  assert.equal(meetings[0]?.title, "ASA panel");
});

test("parses markdown MCP text with UUIDs", () => {
  const meetings = meetingsFromUnknown({
    content: [
      {
        type: "text",
        text: "1. MagnoTherm (Sep 4) 33333333-3333-4333-8333-333333333333\n2. Verve 44444444-4444-4444-8444-444444444444",
      },
    ],
  });
  assert.equal(meetings.length, 2);
  assert.equal(meetings[0]?.id, "33333333-3333-4333-8333-333333333333");
  assert.match(meetings[0]?.title ?? "", /MagnoTherm/);
});
