"use client";

import { useEffect, useMemo, useState } from "react";

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
  kicker: string;
  title: string;
  body: string;
  placeholder: string;
  sample: string;
  output: string;
}[] = [
  {
    id: "afterthought",
    kicker: "01",
    title: "Afterthought",
    body: "Speak a forgotten point. We pull the matching Granola summary, weave your thought in, and keep the blend here. Granola stays read-only.",
    placeholder: "Add this to the last meeting: send Brad the deck before Thursday.",
    sample:
      "Add this to the last meeting: we should send Brad the deck before Thursday, and don't mention pricing yet.",
    output: "Saved blend + Pebble notification. Optionally a Pebble note.",
  },
  {
    id: "prep",
    kicker: "02",
    title: "Prep me",
    body: "30 seconds before a call or a pitch. We take the last matching Granola note unless you ask for a wider recap.",
    placeholder: "Prep me for my next pitch of the visual canvas. What should I say, and what should I not say?",
    sample:
      "Prep me for my next pitch of the visual canvas. What should I repeat, and what should I not say?",
    output: "Short push notification.",
  },
  {
    id: "todos",
    kicker: "03",
    title: "What I owe",
    body: "Open loops from this week's notes, or from one client. Mine vs theirs. Dates kept if Granola had them.",
    placeholder: "What do I need to do from this week's client meetings?",
    sample: "What do I need to do from this week's client meetings?",
    output: "Short push notification.",
  },
];

function kindLabel(kind: Capture["kind"]) {
  if (kind === "afterthought") return "Afterthought";
  if (kind === "prep") return "Prep";
  return "Open loops";
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
      const args =
        mode === "afterthought"
          ? { thought: utterance }
          : { who_or_topic: utterance, scope: mode === "prep" ? "pitch" : "recent" };

      const response = await fetch("/api/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: mode,
          args:
            mode === "prep" && !/pitch/i.test(utterance)
              ? { who_or_topic: utterance, scope: "last" }
              : args,
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-col gap-6 border-b border-[var(--line)] pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] tracking-[0.28em] uppercase text-[var(--gold)]">
            Index 01 · Granola MCP
          </p>
          <h1 className="font-serif mt-3 text-4xl leading-[1.05] sm:text-6xl">
            Meeting memory,
            <span className="italic text-[var(--gold-2)]"> on a ring.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--muted)]">
            Double-click-hold on Index. Ask Granola. Get a notification you can
            actually read while walking. Afterthoughts are saved here because
            Granola MCP cannot write back.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <span
            className={`rounded-full border px-3 py-1 text-xs tracking-wide ${
              status.connected
                ? "border-[var(--gold)] text-[var(--gold-2)]"
                : "border-[var(--line)] text-[var(--muted)]"
            }`}
          >
            {status.connected
              ? `Granola · ${status.account?.email ?? "connected"}`
              : "Granola · not connected"}
          </span>
          {status.connected ? (
            <button
              onClick={() => void disconnect()}
              className="text-xs text-[var(--muted)] underline-offset-4 hover:underline"
            >
              Disconnect
            </button>
          ) : (
            <a
              href="/api/granola/connect"
              className="rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-medium text-[var(--bg)]"
            >
              Connect Granola
            </a>
          )}
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {status.claimUrl ? (
        <p className="text-sm text-[var(--muted)]">
          The demo database expires in 72 hours unless you{" "}
          <a className="text-[var(--gold-2)] underline-offset-4 hover:underline" href={status.claimUrl}>
            claim this Neon database
          </a>
          .
        </p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {MODES.map((item) => {
          const selected = item.id === mode;
          return (
            <button
              key={item.id}
              onClick={() => {
                setMode(item.id);
                setUtterance(item.sample);
                setResult(null);
              }}
              className={`rounded-3xl border p-5 text-left transition ${
                selected
                  ? "border-[var(--gold)] bg-[var(--bg-2)]"
                  : "border-[var(--line)] bg-transparent hover:border-[var(--gold)]/40"
              }`}
            >
              <p className="font-mono text-[11px] text-[var(--gold)]">{item.kicker}</p>
              <h2 className="font-serif mt-2 text-2xl">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.body}</p>
              <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-[var(--gold-2)]">
                {item.output}
              </p>
            </button>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] bg-[var(--paper)] p-6 text-[var(--paper-ink)] sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a7b66]">
            Rehearse without the ring
          </p>
          <h2 className="font-serif mt-2 text-3xl">{active.title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#6f6354]">
            Same tools the ring calls. Use this to record the X video if the
            double-click path is being fussy, then do it live on Index.
          </p>
          <textarea
            value={utterance}
            onChange={(event) => setUtterance(event.target.value)}
            className="mt-5 min-h-32 w-full rounded-2xl border border-[#e2d8c8] bg-white px-4 py-3 text-[15px] leading-6 outline-none"
            placeholder={active.placeholder}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              disabled={busy || !status.connected}
              onClick={() => void tryTool()}
              className="rounded-full bg-[var(--bg)] px-5 py-2 text-sm text-[var(--ink)] disabled:opacity-40"
            >
              {busy ? "Asking Granola…" : "Run this"}
            </button>
            {!status.connected ? (
              <span className="text-sm text-[#8a7b66]">Connect Granola first.</span>
            ) : null}
          </div>
          {result ? (
            <div className="mt-6 rounded-2xl bg-[#231c14] p-4 text-[var(--paper)]">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--gold)]">
                Ring-sized answer
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{result}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[28px] border border-[var(--line)] p-6 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)]">
            Pebble setup
          </p>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <li>1. Connect Granola on this page. Free tier is fine (last 30 days).</li>
            <li>2. In the Pebble app: Index → MCP & Tool Settings → new sandbox group. Model: Default or High Capability (cloud).</li>
            <li>3. Add an MCP server. Streamable HTTP on. URL below. Authorization: the Bearer token.</li>
            <li>4. Tick the <span className="text-[var(--ink)]">ring_voice</span> prompt.</li>
            <li>5. Index settings → Double click and hold → this sandbox.</li>
            <li>6. Keep single-click as normal notes. Double-click is Granola.</li>
          </ol>
          <CopyField
            label="MCP URL"
            value={status.mcpUrl}
            copied={copied === "url"}
            onCopy={() => void copy("url", status.mcpUrl)}
          />
          <CopyField
            label="Authorization header"
            value={status.pebbleToken ? `Bearer ${status.pebbleToken}` : ""}
            copied={copied === "token"}
            onCopy={() =>
              void copy("token", `Bearer ${status.pebbleToken}`)
            }
          />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--gold)]">
              Saved here
            </p>
            <h2 className="font-serif mt-1 text-3xl">Afterthoughts and briefs</h2>
          </div>
          <p className="max-w-sm text-right text-xs leading-5 text-[var(--muted)]">
            This is the durable copy. The ring only gets the clipped
            notification. Nothing is written back to Granola.
          </p>
        </div>
        {status.captures.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-[var(--line)] px-5 py-10 text-sm text-[var(--muted)]">
            Nothing yet. Run a rehearsal above, or double-click the ring.
          </p>
        ) : (
          <div className="grid gap-3">
            {status.captures.map((capture) => (
              <article
                key={capture.id}
                className="rounded-3xl border border-[var(--line)] bg-[var(--bg-2)] p-5"
              >
                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.16em] text-[var(--gold)]">
                  <span>{kindLabel(capture.kind)}</span>
                  <span className="text-[var(--muted)]">
                    {new Date(capture.created_at).toLocaleString()}
                  </span>
                  {capture.title ? (
                    <span className="text-[var(--muted)]">{capture.title}</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--ink)]">
                  {capture.output}
                </p>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
                  You said: {capture.input}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-[var(--line)] pt-6 text-xs leading-5 text-[var(--muted)]">
        Built for a one-take Index 01 demo. Meeting lookup uses Granola MCP on
        the free plan: personal notes, last 30 days, no transcripts. Prep
        defaults to the most recent matching meeting when you name a company or
        person. Say “this week” if you want a wider recap.
      </footer>
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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {label}
        </p>
        <button
          onClick={onCopy}
          disabled={!value}
          className="text-[11px] text-[var(--gold-2)] disabled:opacity-40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="block overflow-x-auto rounded-xl bg-black/30 px-3 py-2 font-mono text-[11px] text-[var(--ink)]">
        {value || "Available after the database boots"}
      </code>
    </div>
  );
}
