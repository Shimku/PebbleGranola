"use client";

import { useEffect, useRef, useState } from "react";
import {
  deskFromCaptures,
  draftFromCapture,
  resultFromCapture,
  type DeskCapture,
} from "@/lib/desk";
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

const EMPTY_DRAFTS: Record<Mode, string> = {
  afterthought: "",
  prep: "",
  todos: "",
};

const EMPTY_RESULTS: Record<Mode, ToolResult | null> = {
  afterthought: null,
  prep: null,
  todos: null,
};

const EMPTY_DIRTY: Record<Mode, boolean> = {
  afterthought: false,
  prep: false,
  todos: false,
};

function seedDesk(captures: Capture[]) {
  const seeded = deskFromCaptures(captures as DeskCapture[]);
  return {
    drafts: { ...EMPTY_DRAFTS, ...seeded.drafts },
    results: { ...EMPTY_RESULTS, ...seeded.results } as Record<
      Mode,
      ToolResult | null
    >,
  };
}

export function Dashboard({ initial }: { initial: StatusPayload }) {
  const [status, setStatus] = useState(initial);
  const [mode, setMode] = useState<Mode>("afterthought");
  const [drafts, setDrafts] = useState(
    () => seedDesk(initial.captures ?? []).drafts,
  );
  const [results, setResults] = useState(
    () => seedDesk(initial.captures ?? []).results,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initial.error ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dirty = useRef({ ...EMPTY_DIRTY });

  const utterance = drafts[mode];
  const result = results[mode];

  function setUtterance(value: string) {
    dirty.current[mode] = true;
    setDrafts((prev) => ({ ...prev, [mode]: value }));
  }

  useEffect(() => {
    void refreshStatus();
    const tick = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshStatus();
    }, 4000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function refreshStatus() {
    const response = await fetch("/api/status", { cache: "no-store" });
    const json = (await response.json()) as StatusPayload;
    const captures = json.captures ?? [];
    setStatus((prev) => ({
      ...prev,
      ...json,
      captures,
    }));
    const incoming = deskFromCaptures(captures as DeskCapture[]);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const kind of MODES) {
        if (dirty.current[kind.id]) continue;
        next[kind.id] = incoming.drafts[kind.id];
      }
      return next;
    });
    setResults((prev) => {
      const next = { ...prev };
      for (const kind of MODES) {
        if (dirty.current[kind.id]) continue;
        next[kind.id] = incoming.results[kind.id];
      }
      return next;
    });
    if (json.error) setError(json.error);
  }

  function openCapture(capture: Capture) {
    dirty.current[capture.kind] = true;
    setMode(capture.kind);
    setActiveId(capture.id);
    setDrafts((prev) => ({
      ...prev,
      [capture.kind]: draftFromCapture(capture as DeskCapture),
    }));
    setResults((prev) => ({
      ...prev,
      [capture.kind]: resultFromCapture(capture as DeskCapture),
    }));
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }

  async function tryTool() {
    const tool = mode;
    const spoken = drafts[tool];
    setBusy(true);
    setError(null);
    setResults((prev) => ({ ...prev, [tool]: null }));
    try {
      const wantsPitch =
        /pitch/i.test(spoken) ||
        /visual canvas/i.test(spoken) ||
        /\bsorta\b/i.test(spoken);
      const wantsWeek = /\b(this week|all meetings)\b/i.test(spoken);
      const args =
        tool === "afterthought"
          ? { thought: spoken }
          : {
              who_or_topic: spoken,
              scope:
                tool === "prep"
                  ? wantsPitch
                    ? "pitch"
                    : "last"
                  : wantsWeek
                    ? "recent"
                    : "last",
            };

      const response = await fetch("/api/try", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool,
          args,
        }),
      });
      const json = (await response.json()) as ToolResult & { error?: string };
      if (!response.ok) throw new Error(json.error || "Request failed");
      setResults((prev) => ({
        ...prev,
        [tool]: {
          text: json.text,
          title: json.title ?? null,
          meetings: json.meetings ?? [],
        },
      }));
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
          ) : status.hasDatabase ? (
            <a href="/api/granola/connect" className="olive-btn">
              Connect Granola
            </a>
          ) : (
            <button
              type="button"
              className="olive-btn"
              disabled
              title="Needs DATABASE_URL"
            >
              Connect Granola
            </button>
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
                  onClick={() => setMode(item.id)}
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
              <button
                type="button"
                key={capture.id}
                className={`note-row ${activeId === capture.id ? "is-on" : ""}`}
                onClick={() => openCapture(capture)}
              >
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
              </button>
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
