"use client";

import { useEffect, useState } from "react";
import { RingMark } from "./mark";
import {
  MODES,
  ToolStage,
  kindLabel,
  type Mode,
  type ToolResult,
} from "./stages";

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

export function Dashboard({ initial }: { initial: StatusPayload }) {
  const [status, setStatus] = useState(initial);
  const [mode, setMode] = useState<Mode>("afterthought");
  const [utterance, setUtterance] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState<string | null>(initial.error ?? null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function refreshStatus() {
    const response = await fetch("/api/status", { cache: "no-store" });
    const json = (await response.json()) as StatusPayload;
    setStatus((prev) => ({
      ...prev,
      ...json,
      captures: json.captures ?? prev.captures,
    }));
    if (json.error) setError(json.error);
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
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
              scope:
                mode === "prep" ? (wantsPitch ? "pitch" : "last") : "recent",
            };

      const response = await fetch("/api/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: mode,
          args,
        }),
      });
      const json = (await response.json()) as ToolResult & { error?: string };
      if (!response.ok) throw new Error(json.error || "Request failed");
      setResult({
        text: json.text,
        title: json.title ?? null,
        meetings: json.meetings ?? [],
      });
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

  const ready =
    status.connected && (mode === "todos" || utterance.trim().length > 0);
  const canRun = ready && !busy;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <RingMark size={26} />
          <p>
            <span className="brand-index">Index</span>
            <span className="brand-x">×</span>
            <span className="font-serif-italic brand-granola">Granola</span>
          </p>
        </div>
        <div className="header-actions">
          <span
            className={`status-dot ${status.connected ? "is-on" : ""}`}
            title={
              status.connected
                ? status.account?.email ?? "Granola connected"
                : "Granola not connected"
            }
          />
          <a className="text-link" href="#pair">
            Pair
          </a>
          {status.connected ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              className="text-link"
            >
              Disconnect
            </button>
          ) : (
            <a href="/api/granola/connect" className="olive-btn">
              Connect Granola
            </a>
          )}
        </div>
      </header>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}

      {status.claimUrl ? (
        <p className="banner banner-mute">
          This demo database lasts 72 hours unless you{" "}
          <a href={status.claimUrl}>claim it in Neon</a>.
        </p>
      ) : null}

      {!status.connected ? (
        <p className="banner banner-setup">
          Connect Granola, then copy the MCP fields into the Pebble app.
        </p>
      ) : null}

      <div className="app-grid">
        <section className="workspace" aria-labelledby="tool-tabs">
          <div
            className="tabs"
            role="tablist"
            aria-label="Tools"
            id="tool-tabs"
          >
            {MODES.map((item) => {
              const selected = item.id === mode;
              return (
                <button
                  type="button"
                  role="tab"
                  key={item.id}
                  id={`tab-${item.id}`}
                  aria-selected={selected}
                  aria-controls="tool-panel"
                  onClick={() => {
                    setMode(item.id);
                    setUtterance("");
                    setResult(null);
                  }}
                >
                  <span className="tab-full">{item.title}</span>
                  <span className="tab-short">{item.short}</span>
                </button>
              );
            })}
          </div>

          <div
            className={`stage stage-${mode}`}
            role="tabpanel"
            id="tool-panel"
            aria-labelledby={`tab-${mode}`}
          >
            <ToolStage
              key={mode}
              mode={mode}
              utterance={utterance}
              onUtterance={setUtterance}
              result={result}
              busy={busy}
              canRun={canRun}
              onRun={() => void tryTool()}
            />
          </div>
        </section>

        <aside className="pair steel-panel" id="pair">
          <div className="pair-head">
            <p className="kicker kicker-light">Pair the ring</p>
            <span className="index-badge">INDEX 01</span>
          </div>
          <h2>Pebble setup</h2>
          <p className="pair-status">
            Granola:{" "}
            {status.connected
              ? status.account?.email ?? "connected"
              : "not connected"}
          </p>
          <ol className="pair-steps">
            <li>Connect Granola on this page. Free tier is fine.</li>
            <li>
              Pebble app → Index → MCP &amp; Tool Settings → new sandbox.
              Model: Default or High Capability (cloud).
            </li>
            <li>Add MCP. Streamable HTTP on. URL and Bearer below.</li>
            <li>
              Enable the <span className="pair-emph">ring_voice</span> prompt.
            </li>
            <li>Double click and hold → this sandbox.</li>
            <li>Single-click stays normal notes.</li>
            <li>
              Visual canvas pitches are Granola notes titled{" "}
              <span className="pair-emph">Sorta{"<>"}Name Xxx</span>.
            </li>
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
            onCopy={() =>
              void copy("token", `Bearer ${status.pebbleToken}`)
            }
          />
        </aside>
      </div>

      <section className="notes" aria-labelledby="notes-title">
        <div className="notes-head">
          <h2 id="notes-title">Log</h2>
        </div>
        {(status.captures ?? []).length === 0 ? (
          <p className="notes-empty">Nothing yet.</p>
        ) : (
          <div className="notes-list">
            {(status.captures ?? []).map((capture) => (
              <article key={capture.id} className="note-row">
                <div className="note-row-meta">
                  <span
                    className={`kind-dot kind-${capture.kind}`}
                    aria-hidden
                  />
                  <span>{kindLabel(capture.kind)}</span>
                  <time
                    dateTime={capture.created_at}
                    suppressHydrationWarning
                  >
                    {new Date(capture.created_at).toLocaleString()}
                  </time>
                  {capture.title ? (
                    <span className="note-row-title">{capture.title}</span>
                  ) : null}
                </div>
                <p className="note-row-out">{capture.output}</p>
                <p className="note-row-in">{capture.input}</p>
              </article>
            ))}
          </div>
        )}
      </section>
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
    <button
      type="button"
      className="copy-row"
      onClick={onCopy}
      disabled={!value}
    >
      <span className="copy-row-text">
        <span className="copy-label">{label}</span>
        <code>{value || "Available after the database boots"}</code>
      </span>
      <span className="copy-action">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
