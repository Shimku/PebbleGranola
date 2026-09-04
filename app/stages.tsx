"use client";

import { useRef, type KeyboardEvent } from "react";

export type Mode = "afterthought" | "prep" | "todos";

export type ToolResult = {
  text: string;
  title: string | null;
  meetings: { id: string; title: string; date: string | null }[];
};

export const MODES: {
  id: Mode;
  title: string;
  short: string;
}[] = [
  { id: "afterthought", title: "Afterthought", short: "After" },
  { id: "prep", title: "Prep me", short: "Prep" },
  { id: "todos", title: "What I owe", short: "Owe" },
];

export function kindLabel(kind: Mode) {
  if (kind === "afterthought") return "Afterthought";
  if (kind === "prep") return "Prep";
  return "Open loops";
}

export function ToolStage({
  mode,
  utterance,
  onUtterance,
  result,
  busy,
  canRun,
  onRun,
}: {
  mode: Mode;
  utterance: string;
  onUtterance: (value: string) => void;
  result: ToolResult | null;
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  const lines = resultLines(result?.text ?? null);
  const ledger = splitLedger(lines);
  const meeting = result?.title ?? result?.meetings[0]?.title ?? null;

  function onKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) {
    if (!canRun) return;
    if (mode === "afterthought") {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onRun();
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onRun();
    }
  }

  if (mode === "afterthought") {
    return (
      <AfterthoughtView
        thought={utterance}
        onThought={onUtterance}
        onKeyDown={onKeyDown}
        meeting={meeting}
        lines={lines}
        busy={busy}
        canRun={canRun}
        onRun={onRun}
      />
    );
  }

  if (mode === "prep") {
    return (
      <PrepView
        who={utterance}
        onWho={onUtterance}
        onKeyDown={onKeyDown}
        lines={lines}
        busy={busy}
        canRun={canRun}
        onRun={onRun}
      />
    );
  }

  return (
    <OweView
      who={utterance}
      onWho={onUtterance}
      onKeyDown={onKeyDown}
      you={ledger.you}
      them={ledger.them}
      busy={busy}
      canRun={canRun}
      onRun={onRun}
    />
  );
}

function AfterthoughtView({
  thought,
  onThought,
  onKeyDown,
  meeting,
  lines,
  busy,
  canRun,
  onRun,
}: {
  thought: string;
  onThought: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  meeting: string | null;
  lines: string[];
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className={`tool tool-note ${busy ? "is-busy" : ""}`}>
      <article className="note" onClick={() => areaRef.current?.focus()}>
        <span className="note-spine" aria-hidden />
        {meeting ? (
          <p className="note-meeting font-serif-italic">{meeting}</p>
        ) : null}
        <div className="note-write">
          <div className="note-hl" aria-hidden>
            <Highlight text={thought} />
          </div>
          <textarea
            ref={areaRef}
            id="field-afterthought"
            aria-label="Thought"
            value={thought}
            onChange={(event) => onThought(event.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
        </div>
        <footer className="note-foot">
          {busy || lines.length > 0 ? (
            <aside className="ink-chip">
              <p className="ink-app">Index</p>
              {busy ? (
                <span className="ink-meter" aria-hidden />
              ) : (
                <p className="ink-copy">{lines.join(" ")}</p>
              )}
            </aside>
          ) : (
            <span />
          )}
          <IndexRun busy={busy} disabled={!canRun} onRun={onRun} />
        </footer>
      </article>
    </div>
  );
}

function Highlight({ text }: { text: string }) {
  if (!text) return null;
  const endsWithBreak = text.endsWith("\n");
  const body = text.replace(/ $/, "\u00a0");
  return (
    <>
      <span>{body}</span>
      {endsWithBreak ? <br /> : null}
    </>
  );
}

function PrepView({
  who,
  onWho,
  onKeyDown,
  lines,
  busy,
  canRun,
  onRun,
}: {
  who: string;
  onWho: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  lines: string[];
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  const whoRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`tool tool-brief ${busy ? "is-busy" : ""}`}>
      <article className="lock" onClick={() => whoRef.current?.focus()}>
        <header className="lock-head">
          <p className="lock-app">Index</p>
          {busy ? <span className="ink-meter lock-head-meter" aria-hidden /> : null}
        </header>
        <label className="lock-kicker" htmlFor="field-prep">
          For
        </label>
        <input
          ref={whoRef}
          id="field-prep"
          className="lock-who font-serif"
          value={who}
          onChange={(event) => onWho(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="lock-rule" aria-hidden />
        <div className="lock-body">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <footer className="lock-foot">
          <IndexRun busy={busy} disabled={!canRun} onRun={onRun} />
        </footer>
      </article>
    </div>
  );
}

function OweView({
  who,
  onWho,
  onKeyDown,
  you,
  them,
  busy,
  canRun,
  onRun,
}: {
  who: string;
  onWho: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  you: string[];
  them: string[];
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  return (
    <div className={`tool tool-owe ${busy ? "is-busy" : ""}`}>
      <div className="tool-bar is-lead">
        <label className="bar-label" htmlFor="field-owe">
          For
        </label>
        <input
          id="field-owe"
          value={who}
          onChange={(event) => onWho(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <IndexRun busy={busy} disabled={!canRun} onRun={onRun} />
      </div>
      <div className="ledger">
        <Lane label="You" tone="you" items={you} />
        <Lane label="Them" tone="them" items={them} />
      </div>
    </div>
  );
}

function Lane({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "you" | "them";
  items: string[];
}) {
  return (
    <section className={`lane lane-${tone}`}>
      <h3>
        <span className="lane-dot" aria-hidden />
        {label}
      </h3>
      {items.length === 0 ? (
        <div className="lane-empty" />
      ) : (
        <ul>
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              style={{ animationDelay: `${index * 55}ms` }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IndexRun({
  busy,
  disabled,
  onRun,
}: {
  busy: boolean;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <button
      type="button"
      className={`index-run ${busy ? "is-busy" : ""}`}
      disabled={disabled}
      onClick={onRun}
      aria-label={busy ? "Running" : "Run"}
    >
      <span className={`index-cap ${busy ? "is-live" : ""}`} aria-hidden />
      <span>Run</span>
    </button>
  );
}

function resultLines(result: string | null) {
  if (!result) return [];
  return result
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const YOU_HEADER = /^(you|yours|me|my items?|i owe|owed by me)\b[:\s-]*/i;
const THEM_HEADER = /^(them|theirs|they|their items?|waiting on|owed to me)\b[:\s-]*/i;

export function splitLedger(lines: string[]) {
  const you: string[] = [];
  const them: string[] = [];
  let lane: "you" | "them" | null = null;

  for (const raw of lines) {
    const line = raw.replace(/^[-•*]\s*/, "");
    if (YOU_HEADER.test(line) && line.replace(YOU_HEADER, "").trim().length < 2) {
      lane = "you";
      const rest = line.replace(YOU_HEADER, "").trim();
      if (rest) you.push(rest);
      continue;
    }
    if (
      THEM_HEADER.test(line) &&
      line.replace(THEM_HEADER, "").trim().length < 2
    ) {
      lane = "them";
      const rest = line.replace(THEM_HEADER, "").trim();
      if (rest) them.push(rest);
      continue;
    }
    if (YOU_HEADER.test(line)) {
      lane = "you";
      const rest = line.replace(YOU_HEADER, "").trim();
      if (rest) you.push(rest);
      continue;
    }
    if (THEM_HEADER.test(line)) {
      lane = "them";
      const rest = line.replace(THEM_HEADER, "").trim();
      if (rest) them.push(rest);
      continue;
    }

    const theirs = /\b(they|them|their|waiting on)\b/i.test(line);
    const mine = /\b(i |i'm|i owe|send|my |need to)\b/i.test(line);
    if (theirs && !mine) {
      them.push(line);
      lane = "them";
    } else if (lane === "them") {
      them.push(line);
    } else {
      you.push(line);
      lane = "you";
    }
  }

  return { you, them };
}
