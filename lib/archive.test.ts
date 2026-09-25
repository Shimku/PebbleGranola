import assert from "node:assert/strict";
import { test } from "node:test";
import {
  capturesInThread,
  threadsFromCaptures,
  viewFromCapture,
  type ArchiveCapture,
} from "./archive.ts";

const xml =
  '<meeting id="" title="ACME&lt;&gt;BETA 20m in Lisbon" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true"';

function cap(
  partial: Partial<ArchiveCapture> & Pick<ArchiveCapture, "id" | "kind">,
): ArchiveCapture {
  return {
    title: null,
    hint: null,
    input: "",
    output: "",
    meeting_ids: [],
    source: null,
    created_at: "2026-09-07T12:00:00.000Z",
    ...partial,
  };
}

test("a later Acme ask does not replace the earlier one", () => {
  const captures = [
    cap({
      id: "2",
      kind: "todos",
      title: "ACME<>BETA 20m in Lisbon",
      hint: "Acme",
      input: "Acme",
      output: "OPEN ITEMS\n• Share Q1 UK site list",
      created_at: "2026-09-07T13:00:00.000Z",
    }),
    cap({
      id: "1",
      kind: "afterthought",
      title: xml,
      input: "I should have scheduled a call with them.",
      output: "Added to ACME<>BETA, Sep 4.\nI should have scheduled a call with them.",
      source: {
        summary: "Align on site selection and Q1 pilot.",
        thought: "I should have scheduled a call with them.",
        meetingTitle: "ACME<>BETA 20m in Lisbon",
        meetingDate: "2026-09-04T10:14:00Z",
      },
      created_at: "2026-09-07T12:30:00.000Z",
    }),
    cap({
      id: "3",
      kind: "prep",
      title: "Acme",
      hint: "acme",
      input: "acme",
      output: "PREP\n• UK site list still open",
      created_at: "2026-09-07T13:05:00.000Z",
    }),
    cap({
      id: "4",
      kind: "todos",
      title: "this week",
      hint: "this week",
      input: "this week",
      output: "OPEN ITEMS\n• Something else",
      created_at: "2026-09-07T14:00:00.000Z",
    }),
  ];

  const threads = threadsFromCaptures(captures);
  assert.equal(threads.length, 2);
  assert.equal(threads[1]?.label, "ACME");
  assert.equal(threads[1]?.count, 3);
  assert.equal(threads[0]?.label, "Unfiled");

  const after = capturesInThread(captures, threads[1]!.key, "afterthought");
  const owe = capturesInThread(captures, threads[1]!.key, "todos");
  const prep = capturesInThread(captures, threads[1]!.key, "prep");
  assert.equal(after.length, 1);
  assert.equal(owe.length, 1);
  assert.equal(prep.length, 1);
  assert.match(after[0]?.thought ?? "", /scheduled a call/);
  assert.match(after[0]?.summary ?? "", /Q1 pilot/);
  assert.doesNotMatch(after[0]?.title ?? "", /<meeting/);
});

test("viewFromCapture strips XML from old afterthoughts", () => {
  const view = viewFromCapture(
    cap({
      id: "x",
      kind: "afterthought",
      title: xml,
      input: "I should have scheduled a call with them.",
      output: `Idea added to ${xml}. New: I should have scheduled a call with them.`,
    }),
  );
  assert.equal(view.title, "ACME<>BETA 20m in Lisbon");
  assert.equal(view.thread, "ACME");
  assert.doesNotMatch(view.title, /captured by me/);
});

test("afterthought summary is pulled from stored Granola XML", () => {
  const view = viewFromCapture(
    cap({
      id: "s",
      kind: "afterthought",
      title: xml,
      input: "I should have scheduled a call with them.",
      source: {
        details: {
          content: [
            {
              type: "text",
              text: `<meetings_data><meeting title="ACME"><summary># Next Steps\n- **Set up the broker intro**</summary></meeting></meetings_data>`,
            },
          ],
        },
      },
    }),
  );
  assert.match(view.thought, /scheduled a call/);
  assert.match(view.summary, /Set up the broker intro/);
  assert.doesNotMatch(view.summary, /<summary/);
});

test("prep cards recover notes when the stored output is a prompt echo", () => {
  const view = viewFromCapture(
    cap({
      id: "echo",
      kind: "prep",
      title: "Kickoff Feedback",
      hint: "kickoff",
      input: "kickoff",
      output: "open loops, and names in four short bullets.",
      source: {
        summary:
          "Set up the broker intro for Thursday or Friday\nShare Q1 site list with Acme",
      },
    }),
  );
  assert.doesNotMatch(view.bullets.join("\n"), /four short bullets/i);
  assert.match(view.bullets.join("\n"), /broker/);
});

test("Jordan owe cards drop the notes-unavailable bluff once a summary exists", () => {
  const view = viewFromCapture(
    cap({
      id: "jordan",
      kind: "todos",
      title: "Jordan<>North Catch-up 07.09.26",
      hint: "Jordan",
      input: "Jordan",
      output: "OPEN ITEMS\n• I don’t have the notes for that conversation available here.",
      source: {
        summary:
          "Friday catch-up to clear open action items\nLoop SMEs in while Jordan is on vacation",
      },
    }),
  );
  assert.doesNotMatch(view.bullets.join("\n"), /don.t have the notes/i);
  assert.match(view.bullets.join("\n"), /Friday catch-up/);
});

test("a Last note fallback is replaced by the hydrated summary", () => {
  const view = viewFromCapture(
    cap({
      id: "jordan2",
      kind: "todos",
      title: "Jordan<>North Catch-up 07.09.26",
      hint: "Jordan",
      output: "OPEN ITEMS\n• Last note: Jordan<>North Catch up 07.09.26.",
      source: {
        summary:
          "Friday catch-up to clear open action items\nLoop SMEs in while Jordan is on vacation",
      },
    }),
  );
  assert.doesNotMatch(view.you.join("\n"), /Last note/);
  assert.match(view.you.join("\n"), /Friday catch-up/);
});
