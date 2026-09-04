import { RingMark, TimerRing } from "./mark";

export type Mode = "afterthought" | "prep" | "todos";

export const MODES: {
  id: Mode;
  title: string;
  short: string;
  line: string;
  placeholder: string;
  sample: string;
}[] = [
  {
    id: "afterthought",
    title: "Afterthought",
    short: "After",
    line: "A thought for a meeting you already captured. Combined note stays here. Granola is not edited.",
    placeholder:
      "Add this to the last meeting: send Brad the deck before Thursday.",
    sample:
      "Add this to the last meeting: we should send Brad the deck before Thursday, and don't mention pricing yet.",
  },
  {
    id: "prep",
    title: "Prep me",
    short: "Prep",
    line: "Thirty seconds before you walk in. Latest Granola match, unless you ask wider. Pitches are titled Sorta<>Name Xxx.",
    placeholder:
      "Prep me for my next pitch of the visual canvas. What should I say, and what should I not say?",
    sample:
      "Prep me for my next pitch of the visual canvas. What should I repeat, and what should I not say?",
  },
  {
    id: "todos",
    title: "What I owe",
    short: "Owe",
    line: "Open loops from this week, or one client. Yours vs theirs. Dates stay if Granola had them.",
    placeholder: "What do I need to do from this week's client meetings?",
    sample: "What do I need to do from this week's client meetings?",
  },
];

export function kindLabel(kind: Mode) {
  if (kind === "afterthought") return "Afterthought";
  if (kind === "prep") return "Prep";
  return "Open loops";
}

export function ToolStage({
  mode,
  utterance,
  result,
  busy,
}: {
  mode: Mode;
  utterance: string;
  result: string | null;
  busy: boolean;
}) {
  if (mode === "afterthought") {
    return (
      <AfterthoughtStage
        utterance={utterance}
        result={result}
        busy={busy}
      />
    );
  }
  if (mode === "prep") {
    return <PrepStage result={result} busy={busy} />;
  }
  return <OweStage result={result} busy={busy} />;
}

function AfterthoughtStage({
  utterance,
  result,
  busy,
}: {
  utterance: string;
  result: string | null;
  busy: boolean;
}) {
  const thought =
    utterance.trim() || "Speak the leftover thought. It lands on the note.";
  const push = resultLines(result);

  return (
    <div className="stage">
      <article className="note-sheet">
        <header className="note-sheet-head">
          <p className="kicker">
            <span className="live-dot" aria-hidden />
            Granola note
          </p>
          <h3 className="font-serif note-title">Last matching meeting</h3>
          <p className="note-meta">Looked up live · not written back</p>
        </header>

        <div className="note-sheet-body">
          <p className="thought-band">{thought}</p>
        </div>

        <div
          className={`push-dock ${result ? "epaper-flash" : ""} ${busy ? "is-waiting" : ""}`}
        >
          <div className="push-meta">
            <span className="push-app">
              <RingMark size={14} />
              PEBBLE
            </span>
            <span>now</span>
          </div>
          <p className="push-title">
            {busy
              ? "Looking up Granola…"
              : (push[0] ?? "Idea added to [meeting]")}
          </p>
          {push.length > 1 ? (
            <p className="push-body">{push.slice(1).join(" ")}</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}

function PrepStage({
  result,
  busy,
}: {
  result: string | null;
  busy: boolean;
}) {
  const lines = resultLines(result);

  return (
    <div className="stage stage-prep">
      <div className="doorway">
        <TimerRing />
        <div className="doorway-copy">
          <p className="kicker kicker-light">Doorway</p>
          <h3>Thirty seconds</h3>
          <p>
            Latest Granola match. Pitches titled{" "}
            <span className="mono-inline">Sorta{"<>"}Name Xxx</span>.
          </p>
        </div>
      </div>
      <div
        className={`epaper-screen prep-screen ${result ? "epaper-flash" : ""} ${busy ? "is-waiting" : ""}`}
      >
        <p className="epaper-kicker">INDEX · PREP</p>
        {busy ? (
          <p className="epaper-title">Looking up Granola…</p>
        ) : lines.length ? (
          <>
            <p className="epaper-title">{lines[0]}</p>
            {lines.length > 1 ? (
              <p className="epaper-body">{lines.slice(1).join("\n")}</p>
            ) : null}
          </>
        ) : (
          <p className="epaper-body">
            A lock-screen brief you can read while walking in. One meeting,
            unless you say this week.
          </p>
        )}
      </div>
    </div>
  );
}

function OweStage({
  result,
  busy,
}: {
  result: string | null;
  busy: boolean;
}) {
  const lines = resultLines(result);

  const live = busy || lines.length > 0;

  return (
    <div className="stage stage-owe">
      {live ? (
        <div
          className={`epaper-screen owe-screen ${result ? "epaper-flash" : ""} ${busy ? "is-waiting" : ""}`}
        >
          <p className="epaper-kicker">INDEX · OPEN LOOPS</p>
          {busy ? (
            <p className="epaper-title">Looking up Granola…</p>
          ) : (
            <ul className="owe-live">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="ledger">
          <section>
            <h3>
              <span className="lane-dot lane-you" />
              You
            </h3>
            <ul className="ledger-rows">
              <li>
                <span className="tick" />
                <span>A deliverable with a date</span>
                <span className="date-chip">Thu</span>
              </li>
              <li>
                <span className="tick" />
                <span>Something you promised</span>
              </li>
            </ul>
          </section>
          <section>
            <h3>
              <span className="lane-dot lane-them" />
              Them
            </h3>
            <ul className="ledger-rows">
              <li>
                <span className="tick" />
                <span>What they still owe you</span>
              </li>
              <li>
                <span className="tick" />
                <span>An open question</span>
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function resultLines(result: string | null) {
  if (!result) return [];
  return result
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
