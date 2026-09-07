"use client";

import type { CaptureView } from "@/lib/archive";

export type Mode = "afterthought" | "prep" | "todos";

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

export function ArchiveStage({
  mode,
  items,
  connected,
}: {
  mode: Mode;
  items: CaptureView[];
  connected: boolean;
}) {
  if (!items.length) {
    return (
      <EmptyArchive mode={mode} connected={connected} />
    );
  }

  return (
    <div className="archive-stack">
      {items.map((item) => (
        <ArchiveCard key={item.id} mode={mode} item={item} />
      ))}
    </div>
  );
}

function EmptyArchive({
  mode,
  connected,
}: {
  mode: Mode;
  connected: boolean;
}) {
  const copy =
    mode === "afterthought"
      ? "Afterthoughts from the ring land here. The Granola summary stays underneath your new line."
      : mode === "prep"
        ? "Prep briefs from the ring land here. Newest on top."
        : "Open items from the ring land here. Newest on top.";

  return (
    <div className="archive-empty">
      <p>{copy}</p>
      <p className="archive-empty-sub">
        {connected
          ? "This page is read-only. Double-click and hold the ring to add the next one."
          : "Connect Granola, then pair the ring. This page will not ask you to type."}
      </p>
    </div>
  );
}

function ArchiveCard({ mode, item }: { mode: Mode; item: CaptureView }) {
  if (mode === "afterthought") {
    return <AfterthoughtCard item={item} />;
  }
  if (mode === "prep") {
    return <PrepCard item={item} />;
  }
  return <OweCard item={item} />;
}

function AfterthoughtCard({ item }: { item: CaptureView }) {
  return (
    <article className="note note-readonly">
      <span className="note-spine" aria-hidden />
      <header className="note-head">
        <p className="note-meeting font-serif-italic">{item.title}</p>
        <time className="note-when" dateTime={item.created_at}>
          {item.when ?? formatWhen(item.created_at)}
        </time>
      </header>
      {item.missed ? (
        <p className="note-miss">{item.output}</p>
      ) : (
        <>
          {item.thought ? (
            <p className="note-thought">
              <span>{item.thought}</span>
            </p>
          ) : null}
          {item.summary ? (
            <div className="note-summary">{item.summary}</div>
          ) : null}
        </>
      )}
    </article>
  );
}

function PrepCard({ item }: { item: CaptureView }) {
  const lines = item.missed ? [] : item.bullets;

  return (
    <article className="lock lock-readonly">
      <header className="lock-head">
        <p className="lock-app">Index</p>
        <time className="lock-when" dateTime={item.created_at}>
          {formatWhen(item.created_at)}
        </time>
      </header>
      <p className="lock-kicker">For</p>
      <p className="lock-who-read font-serif">{item.title}</p>
      <div className={`lock-body ${lines.length || item.missed ? "" : "is-empty"}`}>
        {item.missed ? (
          <p>{item.output}</p>
        ) : (
          lines.slice(0, 4).map((line) => <p key={line}>{line}</p>)
        )}
      </div>
    </article>
  );
}

function OweCard({ item }: { item: CaptureView }) {
  const you = item.you.slice(0, 4);
  const them = item.them.slice(0, 4);
  const fallback =
    !you.length && !them.length
      ? item.bullets.slice(0, 4)
      : [];

  return (
    <article className="tool-owe tool-owe-readonly">
      <header className="owe-head owe-head-read">
        <p className="owe-title font-serif">{item.title}</p>
        <time dateTime={item.created_at}>{formatWhen(item.created_at)}</time>
      </header>
      {item.missed ? (
        <p className="note-miss">{item.output}</p>
      ) : (
        <div className="ledger">
          <Lane
            label="You"
            tone="you"
            items={you.length ? you : fallback}
          />
          <Lane label="Them" tone="them" items={them} />
        </div>
      )}
    </article>
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
        <div className="lane-sheet" aria-hidden />
      ) : (
        <ul className="lane-sheet">
          {items.map((entry, index) => (
            <li
              key={`${entry}-${index}`}
              style={{ animationDelay: `${index * 55}ms` }}
            >
              {entry.replace(/^[-•*]\s*/, "")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
