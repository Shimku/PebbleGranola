export type Mode = "afterthought" | "prep" | "todos";

export type DeskCapture = {
  id: string;
  kind: Mode;
  title: string | null;
  hint: string | null;
  input: string;
  output: string;
  meeting_ids: string[];
};

export type DeskResult = {
  text: string;
  title: string | null;
  meetings: { id: string; title: string; date: string | null }[];
};

const KINDS: Mode[] = ["afterthought", "prep", "todos"];

export function latestByKind(
  captures: DeskCapture[],
): Record<Mode, DeskCapture | null> {
  const latest: Record<Mode, DeskCapture | null> = {
    afterthought: null,
    prep: null,
    todos: null,
  };
  for (const capture of captures) {
    if (!latest[capture.kind]) latest[capture.kind] = capture;
  }
  return latest;
}

export function draftFromCapture(capture: DeskCapture): string {
  if (capture.kind === "todos") {
    const hint = capture.hint?.trim();
    if (hint && hint !== "this week" && hint !== "last meeting") return hint;
  }
  return capture.input?.trim() ?? "";
}

export function resultFromCapture(capture: DeskCapture): DeskResult {
  return {
    text: capture.output,
    title: capture.title,
    meetings: capture.meeting_ids.map((id) => ({
      id,
      title: capture.title ?? "",
      date: null,
    })),
  };
}

export function deskFromCaptures(captures: DeskCapture[]): {
  drafts: Record<Mode, string>;
  results: Record<Mode, DeskResult | null>;
} {
  const latest = latestByKind(captures);
  const drafts: Record<Mode, string> = {
    afterthought: "",
    prep: "",
    todos: "",
  };
  const results: Record<Mode, DeskResult | null> = {
    afterthought: null,
    prep: null,
    todos: null,
  };
  for (const kind of KINDS) {
    const capture = latest[kind];
    if (!capture) continue;
    drafts[kind] = draftFromCapture(capture);
    results[kind] = resultFromCapture(capture);
  }
  return { drafts, results };
}
