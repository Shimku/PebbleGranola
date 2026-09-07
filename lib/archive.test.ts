import assert from "node:assert/strict";
import { test } from "node:test";
import {
  capturesInThread,
  threadsFromCaptures,
  viewFromCapture,
  type ArchiveCapture,
} from "./archive.ts";

const xml =
  '<meeting id="" title="VERV&lt;&gt;ASA 20m in Barcelona" date="Sep 4, 2026 11:14 AM GMT+1" captured by me="true"';

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

test("a later Verve ask does not replace the earlier one", () => {
  const captures = [
    cap({
      id: "2",
      kind: "todos",
      title: "VERV<>ASA 20m in Barcelona",
      hint: "Verve",
      input: "Verve",
      output: "OPEN ITEMS\n• Share Q1 UK site list",
      created_at: "2026-09-07T13:00:00.000Z",
    }),
    cap({
      id: "1",
      kind: "afterthought",
      title: xml,
      input: "I should have scheduled a call with them.",
      output: "Added to VERV<>ASA, Sep 4.\nI should have scheduled a call with them.",
      source: {
        summary: "Align on site selection and Q1 pilot.",
        thought: "I should have scheduled a call with them.",
        meetingTitle: "VERV<>ASA 20m in Barcelona",
        meetingDate: "2026-09-04T10:14:00Z",
      },
      created_at: "2026-09-07T12:30:00.000Z",
    }),
  ];

  const threads = threadsFromCaptures(captures);
  assert.equal(threads[0]?.label, "VERV");
  assert.equal(threads[0]?.count, 2);

  const after = capturesInThread(captures, threads[0]!.key, "afterthought");
  const owe = capturesInThread(captures, threads[0]!.key, "todos");
  assert.equal(after.length, 1);
  assert.equal(owe.length, 1);
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
  assert.equal(view.title, "VERV<>ASA 20m in Barcelona");
  assert.equal(view.thread, "VERV");
  assert.doesNotMatch(view.title, /captured by me/);
});
