"use client";

import {
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { IndexRing } from "./index-ring";
import { usePointerTilt, useReducedMotion } from "./motion";

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
  field: "thought" | "for";
  optional?: boolean;
}[] = [
  { id: "afterthought", title: "Afterthought", short: "After", field: "thought" },
  { id: "prep", title: "Prep me", short: "Prep", field: "for" },
  { id: "todos", title: "What I owe", short: "Owe", field: "for", optional: true },
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
  const reduced = useReducedMotion();
  const { wellRef, worldRef, ringRef, onPointerMove, onPointerLeave } =
    usePointerTilt(!reduced);
  const active = MODES.find((item) => item.id === mode) ?? MODES[0];
  const lines = resultLines(result?.text ?? null);
  const ledger = splitLedger(lines);
  const meeting = result?.title ?? result?.meetings[0]?.title ?? null;

  function onKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
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

  return (
    <div
      ref={wellRef}
      className={`well well-${mode} ${busy ? "is-busy" : ""} ${result ? "has-result" : ""}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div ref={worldRef} className="world">
        {mode === "afterthought" ? (
          <Sheet
            thought={utterance}
            onThought={onUtterance}
            onKeyDown={onKeyDown}
            meeting={meeting}
            busy={busy}
          />
        ) : null}
        {mode === "todos" ? (
          <Trays you={ledger.you} them={ledger.them} busy={busy} />
        ) : null}
        {mode !== "todos" ? (
          <PushCard
            lines={lines}
            busy={busy}
            flash={Boolean(result) && !busy}
            pose={mode === "prep" ? "hero" : "dock"}
          />
        ) : null}
      </div>

      {mode !== "todos" ? (
        <div
          ref={ringRef}
          className={`ring-slot ${mode === "prep" ? "is-hero" : "is-dock"}`}
        >
          <IndexRing
            face={mode === "prep" ? "epaper" : "cream"}
            pose={mode === "prep" ? "hero" : "dock"}
            busy={busy}
            reducedMotion={reduced}
          />
        </div>
      ) : null}

      <div className="deck">
        {active.field === "for" ? (
          <label className="deck-label" htmlFor="utterance">
            For{active.optional ? " · optional" : ""}
          </label>
        ) : null}
        {active.field === "for" ? (
          <input
            id="utterance"
            value={utterance}
            onChange={(event) => onUtterance(event.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
        ) : (
          <span className="deck-spacer" />
        )}
        <button
          type="button"
          className="index-run"
          disabled={!canRun}
          onClick={onRun}
          aria-label={busy ? "Running" : "Run"}
        >
          <span className="index-cap" aria-hidden />
          <span>{busy ? "Hold" : "Run"}</span>
        </button>
      </div>
    </div>
  );
}

function Sheet({
  thought,
  onThought,
  onKeyDown,
  meeting,
  busy,
}: {
  thought: string;
  onThought: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  meeting: string | null;
  busy: boolean;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <article className={`sheet ${busy ? "is-busy" : ""} ${thought.trim() ? "has-ink" : ""}`}>
      {Array.from({ length: 7 }, (_, index) => (
        <span
          key={index}
          className="sheet-ply"
          style={{
            transform: `translate3d(${0.35 * (index + 1)}px, ${0.45 * (index + 1)}px, ${-0.85 * (index + 1)}px)`,
          }}
        />
      ))}
      <span className="sheet-spine" aria-hidden />
      <div
        className="sheet-face"
        onClick={() => areaRef.current?.focus()}
      >
        {meeting ? (
          <h3 className="font-serif sheet-title">{meeting}</h3>
        ) : (
          <span className="sheet-rule" aria-hidden />
        )}
        <div className="sheet-editor">
          <textarea
            ref={areaRef}
            id="utterance"
            aria-label="Thought"
            value={thought}
            onChange={(event) => onThought(event.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
        </div>
      </div>
    </article>
  );
}

function Trays({
  you,
  them,
  busy,
}: {
  you: string[];
  them: string[];
  busy: boolean;
}) {
  return (
    <div className={`trays ${busy ? "is-busy" : ""}`}>
      <Tray label="You" tone="you" items={you} />
      <Tray label="Them" tone="them" items={them} />
    </div>
  );
}

function Tray({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "you" | "them";
  items: string[];
}) {
  return (
    <section className={`tray tray-${tone}`}>
      <h3>{label}</h3>
      <div className="tray-well">
        {items.length === 0 ? (
          <div className="tray-empty" />
        ) : (
          items.map((item, index) => (
            <article
              key={`${item}-${index}`}
              className="owe-card"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="owe-card-edge" aria-hidden />
              <p>{item}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function PushCard({
  lines,
  busy,
  flash,
  pose,
}: {
  lines: string[];
  busy: boolean;
  flash: boolean;
  pose: "hero" | "dock";
}) {
  if (!busy && lines.length === 0) return null;
  return (
    <aside
      className={`push-card is-${pose} ${flash ? "is-flash" : ""} ${busy ? "is-busy" : ""}`}
    >
      <span className="push-card-edge" aria-hidden />
      <div className="push-card-face">
        <p className="push-card-app">INDEX</p>
        {busy ? (
          <span className="push-shimmer" aria-hidden />
        ) : (
          <>
            <p className="font-serif push-card-title">{lines[0]}</p>
            {lines.length > 1 ? (
              <p className="push-card-body">{lines.slice(1).join(" ")}</p>
            ) : null}
          </>
        )}
      </div>
    </aside>
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
    if (THEM_HEADER.test(line) && line.replace(THEM_HEADER, "").trim().length < 2) {
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
