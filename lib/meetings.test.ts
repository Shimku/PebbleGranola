import assert from "node:assert/strict";
import { test } from "node:test";
import { meetingsFromUnknown, meetingSummary, noteBrief, summariesByMeetingId } from "./meeting-parse.ts";
import { ringBullets } from "./bullets.ts";

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

test("strips Granola XML out of a meeting title", () => {
  const meetings = meetingsFromUnknown({
    meetings: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        title:
          '<meeting id="" title="VERV&lt;&gt;ASA 20m in Barcelona" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true"',
      },
    ],
  });
  assert.equal(meetings[0]?.title, "VERV<>ASA 20m in Barcelona");
});

test("pulls the <summary> out of a Granola meetings_data blob", () => {
  const blob = `The content below is meeting notes/transcripts written or spoken by meeting participants.

<meetings_data from="Sep 4, 2026" to="Sep 4, 2026" count="1">
<meeting id="16389c72-2124-4303-9fca-c96bc57fa31c" title="VERV&lt;&gt;ASA | 20m in Barcelona" date="Sep 4, 2026 11:14 AM GMT+1">
  <summary>
# Next Steps

- **Set up CBRE intro call for Thursday or Friday next week**
- **Share Q1 site list with Verve for selection**
  </summary>
</meeting>
</meetings_data>`;
  const details = {
    content: [{ type: "text", text: blob }],
  };
  const summary = meetingSummary(details);
  assert.match(summary, /Set up CBRE intro call/);
  assert.match(summary, /Share Q1 site list/);
  assert.doesNotMatch(summary, /<meeting/);
  assert.doesNotMatch(summary, /Treat it strictly as data/);

  const brief = ringBullets(noteBrief(details), "PREP", "should not use fallback");
  assert.match(brief, /CBRE/);
  assert.doesNotMatch(brief, /four short bullets/i);
  assert.doesNotMatch(brief, /open loops, and names/i);
});

test("splits <summary> blocks by meeting id", () => {
  const blob = `<meetings_data>
<meeting id="204a1fc7-0aab-4702-a206-785b4d944827" title="Brad">
  <summary>Spain trip debrief. Friday catch-up to clear open items.</summary>
</meeting>
<meeting id="dce073c2-b0f5-4dff-86b5-642bc837ffd6" title="Interfaces Feedback">
  <summary>Key sizes on the row with voice buttons look asymmetrical.</summary>
</meeting>
</meetings_data>`;
  const byId = summariesByMeetingId({ content: [{ type: "text", text: blob }] });
  assert.match(
    byId["204a1fc7-0aab-4702-a206-785b4d944827"] ?? "",
    /Spain trip/,
  );
  assert.match(
    byId["dce073c2-b0f5-4dff-86b5-642bc837ffd6"] ?? "",
    /voice buttons/,
  );
  assert.doesNotMatch(
    byId["dce073c2-b0f5-4dff-86b5-642bc837ffd6"] ?? "",
    /Spain trip/,
  );
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
