"use client";

import { useEffect, useMemo, useState } from "react";
import { RingMark } from "./mark";

export type Capture = {
  id: string;
  kind: "afterthought" | "prep" | "todos";
  title: string | null;
  hint: string | null;
  input: string;
  output: string;
  meeting_ids: string[];
  created_at: string;
};

export type StatusPayload = {
  connected: boolean;
  hasDatabase: boolean;
  pebbleToken: string;
  mcpUrl: string;
  appUrl: string;
  captures: Capture[];
  claimUrl: string | null;
  account: { email?: string; workspace?: string } | null;
  error?: string;
};

type Mode = "afterthought" | "prep" | "todos";

const MODES: {
  id: Mode;
  title: string;
  body: string;
  placeholder: string;
  sample: string;
  result: string;
}[] = [
  {
    id: "afterthought",
    title: "Afterthought",
    body: "A thought that belongs on a meeting you already captured. We pull that Granola summary, weave yours in, and save it here. Granola is not edited.",
    placeholder:
      "Add this to the last meeting: send Brad the deck before Thursday.",
    sample:
      "Add this to the last meeting: we should send Brad the deck before Thursday, and don't mention pricing yet.",
    result: "Combined note here, clipped push on the phone",
  },
  {
    id: "prep",
    title: "Prep me",
    body: "Thirty seconds before a call. Visual canvas recordings are titled Sorta<>Name Xxx. We use the latest match unless you ask for a wider recap.",
    placeholder:
      "Prep me for my next pitch of the visual canvas. What should I say, and what should I not say?",
    sample:
      "Prep me for my next pitch of the visual canvas. What should I repeat, and what should I not say?",
    result: "Lock-screen push",
  },
  {
    id: "todos",
    title: "What I owe",
    body: "Open loops from this week, or from one client. Yours vs theirs. Dates kept if Granola had them.",
    placeholder: "What do I need to do from this week's client meetings?",
    sample: "What do I need to do from this week's client meetings?",
    result: "Lock-screen push",
  },
];

function kindLabel(kind: Capture["kind"]) {
  if (kind === "afterthought") return "Afterthought";
  if (kind === "prep") return "Prep";
  return "Open loops";
}

function kindDot(kind: Capture["kind"]) {
  if (kind === "afterthought") return "bg-[var(--pebble)]";
  if (kind === "prep") return "bg-[var(--olive)]";
  return "bg-[var(--yellow)]";
}

export function Dashboard({ initial }: { initial: StatusPayload }) {
  const [status, setStatus] = useState(initial);
  const [mode, setMode] = useState<Mode>("afterthought");
  const [utterance, setUtterance] = useState(MODES[0].sample);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initial.error ?? null);
  const [copied, setCopied] = useState<string | null>(null);

  const active = useMemo(
    () => MODES.find((item) => item.id === mode) ?? MODES[0],
    [mode],
  );

  useEffect(() => {
    void refreshStatus();
  }, []);

  async function refreshStatus() {
    const response = await fetch("/api/status", { cache: "no-store" });
    const json = (await response.json()) as StatusPayload;
    setStatus(json);
    if (json.error) setError(json.error);
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1400);
  }

  async function tryTool() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const wantsPitch =
        /pitch/i.test(utterance) ||
        /visual canvas/i.test(utterance) ||
        /\bsorta\b/i.test(utterance);
      const args =
        mode === "afterthought"
          ? { thought: utterance }
          : {
              who_or_topic: utterance,
              scope: mode === "prep" ? (wantsPitch ? "pitch" : "last") : "recent",
            };

      const response = await fetch("/api/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: mode,
          args,
        }),
      });
      const json = (await response.json()) as { text?: string; error?: string };
      if (!response.ok) throw new Error(json.error || "Request failed");
      setResult(json.text ?? "");
      await refreshStatus();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Try failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await fetch("/api/granola/disconnect", { method: "POST" });
    await refreshStatus();
  }

  return (
    <div className="mx-auto flex w-full max-w-[1120px] flex-col px-5 pb-16 pt-5 sm:px-8 sm:pt-7">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
        <div className="flex items-center gap-2.5">
          <RingMark size={28} />
          <p className="text-[15px] leading-none">
            <span className="font-medium tracking-tight">Index</span>
            <span className="mx-1.5 text-[var(--mute)]">×</span>
            <span className="font-serif-italic text-[17px]">Granola</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-[13px] text-[var(--mute)] sm:flex">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                status.connected ? "bg-[var(--olive)]" : "bg-[var(--steel-2)]"
              }`}
            />
            {status.connected
              ? status.account?.email ?? "Granola connected"
              : "Granola not connected"}
          </span>
          {status.connected ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              className="text-[13px] text-[var(--mute)] underline-offset-4 hover:text-[var(--ink)] hover:underline"
            >
              Disconnect
            </button>
          ) : (
            <a
              href="/api/granola/connect"
              className="rounded-full bg-[var(--olive)] px-3.5 py-1.5 text-[13px] font-medium text-white"
            >
              Connect Granola
            </a>
          )}
        </div>
      </header>

      <section className="border-b border-[var(--hairline)] py-10 sm:py-14">
        <h1 className="font-serif text-[2.45rem] leading-[1.05] text-[var(--ink-2)] sm:text-[3.6rem] lg:text-[4.1rem]">
          Speak it to Index.
          <br />
          We <span className="hl">look up</span>{" "}
          <span className="font-serif-italic">Granola</span>.
        </h1>
        <p className="mt-6 max-w-lg text-[15px] leading-7 text-[var(--mute-2)]">
          Double-click-hold. Afterthoughts stay here as a combined note. Granola
          is not edited. The ring gets a clipped lock-screen push.
        </p>
        <DeskPreview />
      </section>

      {error ? (
        <div className="mt-6 rounded-xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {status.claimUrl ? (
        <p className="mt-6 text-sm text-[var(--mute)]">
          This demo database lasts 72 hours unless you{" "}
          <a
            className="text-[var(--olive-ink)] underline decoration-[var(--hairline)] underline-offset-4 hover:decoration-[var(--olive)]"
            href={status.claimUrl}
          >
            claim it in Neon
          </a>
          .
        </p>
      ) : null}

      <section className="pt-10">
        <p className="text-[12px] text-[var(--mute)]">What you can say</p>
        <div className="mt-3 overflow-hidden rounded-[14px] bg-[var(--elevated)] hairline">
          <div className="grid md:grid-cols-3">
            {MODES.map((item, index) => {
              const selected = item.id === mode;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    setMode(item.id);
                    setUtterance(item.sample);
                    setResult(null);
                  }}
                  className={`p-5 text-left sm:p-6 ${
                    index > 0 ? "border-t border-[var(--hairline)] md:border-t-0 md:border-l" : ""
                  } ${selected ? "bg-[var(--sprout)]" : "hover:bg-[var(--paper)]"}`}
                >
                  <h2 className="font-serif text-[1.55rem] leading-tight text-[var(--ink-2)]">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-[13.5px] leading-6 text-[var(--mute-2)]">
                    {item.body}
                  </p>
                  <p className="mt-4 text-[12px] text-[var(--olive-ink)]">
                    {item.result}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-3 pt-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[14px] bg-[var(--elevated)] p-6 hairline sm:p-8">
          <p className="text-[12px] text-[var(--mute)]">Rehearse without the ring</p>
          <h2 className="font-serif mt-1 text-[1.9rem] text-[var(--ink-2)]">
            {active.title}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[var(--mute-2)]">
            Same tools the ring calls. Use this if double-click is being fussy,
            then do it live on Index.
          </p>
          <label className="sr-only" htmlFor="utterance">
            What you would say to Index
          </label>
          <textarea
            id="utterance"
            value={utterance}
            onChange={(event) => setUtterance(event.target.value)}
            className="mt-5 min-h-32 w-full resize-y rounded-lg border-0 bg-[var(--paper)] px-3.5 py-3 text-[15px] leading-6 text-[var(--ink)] outline-none hairline"
            placeholder={active.placeholder}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy || !status.connected}
              onClick={() => void tryTool()}
              className="rounded-full bg-[var(--ink-2)] px-4 py-2 text-sm text-white disabled:opacity-35"
            >
              {busy ? "Asking Granola…" : "Run this"}
            </button>
            {!status.connected ? (
              <span className="text-sm text-[var(--mute)]">
                Connect Granola first.
              </span>
            ) : null}
          </div>
          {result ? (
            <div className="epaper-screen mt-6 rounded-lg px-4 py-3">
              <p className="text-[11px] tracking-[0.08em] text-[var(--pebble)]">
                PEBBLE INDEX
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {result}
              </p>
            </div>
          ) : null}
        </div>

        <div className="steel-panel rounded-[10px] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-[#9a9a94]">Pair the ring</p>
            <span className="rounded-sm bg-[var(--pebble)] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">
              INDEX 01
            </span>
          </div>
          <h2 className="mt-2 text-[1.2rem] font-medium tracking-tight text-white">
            Pebble setup
          </h2>
          <ol className="mt-4 space-y-2.5 text-[13px] leading-6 text-[#bdbdb6]">
            <li>1. Connect Granola on this page. Free tier is fine.</li>
            <li>
              2. Pebble app → Index → MCP & Tool Settings → new sandbox. Model:
              Default or High Capability (cloud).
            </li>
            <li>3. Add MCP. Streamable HTTP on. URL and Bearer below.</li>
            <li>
              4. Enable the{" "}
              <span className="text-white">ring_voice</span> prompt.
            </li>
            <li>5. Double click and hold → this sandbox.</li>
            <li>6. Single-click stays normal notes.</li>
          </ol>
          <CopyField
            label="MCP URL"
            value={status.mcpUrl}
            copied={copied === "url"}
            onCopy={() => void copy("url", status.mcpUrl)}
          />
          <CopyField
            label="Authorization"
            value={status.pebbleToken ? `Bearer ${status.pebbleToken}` : ""}
            copied={copied === "token"}
            onCopy={() => void copy("token", `Bearer ${status.pebbleToken}`)}
          />
        </div>
      </section>

      <section className="pt-12">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] text-[var(--mute)]">Combined notes</p>
            <h2 className="font-serif mt-1 text-[1.9rem] text-[var(--ink-2)]">
              Afterthoughts and briefs
            </h2>
          </div>
          <p className="max-w-sm text-[13px] leading-5 text-[var(--mute)] sm:text-right">
            Granola summary plus what you said. The ring only gets the clipped
            push.
          </p>
        </div>
        {status.captures.length === 0 ? (
          <p className="rounded-[14px] bg-[var(--elevated)] px-5 py-12 text-sm text-[var(--mute)] hairline">
            Nothing yet. Run a rehearsal above, or double-click the ring.
          </p>
        ) : (
          <div className="overflow-hidden rounded-[14px] bg-[var(--elevated)] hairline">
            {status.captures.map((capture, index) => (
              <article
                key={capture.id}
                className={`p-5 sm:p-6 ${
                  index > 0 ? "border-t border-[var(--hairline)]" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-[var(--mute)]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${kindDot(capture.kind)}`}
                  />
                  <span>{kindLabel(capture.kind)}</span>
                  <span>
                    {new Date(capture.created_at).toLocaleString()}
                  </span>
                  {capture.title ? (
                    <span className="text-[var(--ink)]">{capture.title}</span>
                  ) : null}
                </div>
                <p className="mt-3 text-[15px] leading-7">{capture.output}</p>
                <p className="mt-3 text-[13px] leading-6 text-[var(--mute)]">
                  You said: {capture.input}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="mt-12 border-t border-[var(--hairline)] pt-5 text-[12px] leading-5 text-[var(--mute)]">
        Free Granola: last 30 days, summaries, no transcripts. Visual canvas
        pitches match notes titled Sorta{"<>"}Name Xxx. Say “this week” for a
        wider recap.
      </footer>
    </div>
  );
}

function DeskPreview() {
  return (
    <div className="mt-10 grid gap-3 md:grid-cols-2">
      <article className="rounded-[14px] bg-[var(--elevated)] p-5 hairline sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-serif text-[1.45rem] leading-snug text-[var(--ink-2)]">
              Sorta{"<>"}Nikita Xxx
            </h3>
            <p className="mt-1 text-[12px] text-[var(--mute)]">
              Today · visual canvas
            </p>
          </div>
          <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--press)]" />
        </div>
        <p className="font-serif mt-5 text-[16px] text-[var(--ink-2)]">
          Afterthought
        </p>
        <ul className="note-list mt-2 space-y-1 text-[14px] leading-6 text-[var(--mute-2)]">
          <li>Send Brad the deck before Thursday.</li>
          <li>Don’t mention pricing yet.</li>
        </ul>
        <p className="font-serif mt-4 text-[16px] text-[var(--ink-2)]">
          Next steps
        </p>
        <ul className="note-list mt-2 space-y-1 text-[14px] leading-6 text-[var(--mute-2)]">
          <li>Deck to Brad, before Thursday.</li>
        </ul>
      </article>

      <div className="rounded-[18px] bg-[#2c2e31] p-[5px]">
        <div className="epaper-screen flex h-full min-h-[220px] flex-col rounded-[13px] px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-[11px] text-[#8d8d86]">
            <span>Index 01</span>
            <span>now</span>
          </div>
          <p className="text-[11px] tracking-[0.08em] text-[var(--pebble)]">
            PEBBLE
          </p>
          <p className="font-serif mt-1 text-[1.35rem] leading-snug text-white">
            Idea added to Sorta{"<>"}Nikita Xxx
          </p>
          <p className="mt-2 text-[13px] leading-5 text-[var(--epaper-ink)]">
            Send Brad the deck before Thursday. Don’t mention pricing.
          </p>
          <div className="mt-auto flex items-center gap-2 pt-4 text-[11px] text-[#8d8d86]">
            <RingMark size={16} />
            Double-click-hold
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="mt-5">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[11px] text-[#8a8a84]">{label}</p>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="text-[11px] text-[var(--pebble)] disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="block overflow-x-auto rounded-md bg-black/45 px-3 py-2 font-mono text-[11px] text-[#e8e8e2]">
        {value || "Available after the database boots"}
      </code>
    </div>
  );
}
