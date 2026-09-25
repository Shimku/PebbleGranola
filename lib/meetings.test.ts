import assert from "node:assert/strict";
import { test } from "node:test";
import { meetingsFromUnknown, meetingSummary, noteBrief, summariesByMeetingId } from "./meeting-parse.ts";
import { ringBullets } from "./bullets.ts";

test("parses nested meeting objects", () => {
  const meetings = meetingsFromUnknown({
    meetings: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Northwind",
        date: "2026-09-04T10:00:00Z",
      },
    ],
  });
  assert.equal(meetings.length, 1);
  assert.equal(meetings[0]?.title, "Northwind");
});

test("parses document.id wrappers", () => {
  const meetings = meetingsFromUnknown({
    notes: [
      {
        document: { id: "22222222-2222-4222-8222-222222222222", title: "BETA panel" },
        created_at: "2026-09-02T09:00:00Z",
      },
    ],
  });
  assert.equal(meetings[0]?.id, "22222222-2222-4222-8222-222222222222");
  assert.equal(meetings[0]?.title, "BETA panel");
});

test("strips Granola XML out of a meeting title", () => {
  const meetings = meetingsFromUnknown({
    meetings: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        title:
          '<meeting id="" title="ACME&lt;&gt;BETA 20m in Lisbon" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true"',
      },
    ],
  });
  assert.equal(meetings[0]?.title, "ACME<>BETA 20m in Lisbon");
});

test("pulls the <summary> out of a Granola meetings_data blob", () => {
  const blob = `The content below is meeting notes/transcripts written or spoken by meeting participants.

<meetings_data from="Sep 4, 2026" to="Sep 4, 2026" count="1">
<meeting id="66666666-6666-4666-8666-666666666666" title="ACME&lt;&gt;BETA | 20m in Lisbon" date="Sep 4, 2026 11:14 AM GMT+1">
  <summary>
# Next Steps

- **Set up the broker intro for Thursday or Friday next week**
- **Share Q1 site list with Acme for selection**
  </summary>
</meeting>
</meetings_data>`;
  const details = {
    content: [{ type: "text", text: blob }],
  };
  const summary = meetingSummary(details);
  assert.match(summary, /Set up the broker intro/);
  assert.match(summary, /Share Q1 site list/);
  assert.doesNotMatch(summary, /<meeting/);
  assert.doesNotMatch(summary, /Treat it strictly as data/);

  const brief = ringBullets(noteBrief(details), "PREP", "should not use fallback");
  assert.match(brief, /broker/);
  assert.doesNotMatch(brief, /four short bullets/i);
  assert.doesNotMatch(brief, /open loops, and names/i);
});

test("splits <summary> blocks by meeting id", () => {
  const blob = `<meetings_data>
<meeting id="77777777-7777-4777-8777-777777777777" title="Jordan">
  <summary>Friday trip debrief. Friday catch-up to clear open items.</summary>
</meeting>
<meeting id="88888888-8888-4888-8888-888888888888" title="Kickoff Feedback">
  <summary>Notes from the kickoff. Follow-ups on the next cut.</summary>
</meeting>
</meetings_data>`;
  const byId = summariesByMeetingId({ content: [{ type: "text", text: blob }] });
  assert.match(
    byId["77777777-7777-4777-8777-777777777777"] ?? "",
    /Friday trip/,
  );
  assert.match(
    byId["88888888-8888-4888-8888-888888888888"] ?? "",
    /Follow-ups on the next cut/,
  );
  assert.doesNotMatch(
    byId["88888888-8888-4888-8888-888888888888"] ?? "",
    /Friday trip/,
  );
});

test("parses markdown MCP text with UUIDs", () => {
  const meetings = meetingsFromUnknown({
    content: [
      {
        type: "text",
        text: "1. Northwind (Sep 4) 33333333-3333-4333-8333-333333333333\n2. Acme 44444444-4444-4444-8444-444444444444",
      },
    ],
  });
  assert.equal(meetings.length, 2);
  assert.equal(meetings[0]?.id, "33333333-3333-4333-8333-333333333333");
  assert.match(meetings[0]?.title ?? "", /Northwind/);
});
