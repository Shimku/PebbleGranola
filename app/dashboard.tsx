"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  capturesInThread,
  threadsFromCaptures,
  type ArchiveCapture,
} from "@/lib/archive";
import { RingMark } from "./mark";
import { ArchiveStage, MODES, type Mode } from "./stages";

export type Capture = ArchiveCapture;

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
  const [thread, setThread] = useState<string | null>(() =>
    threadsFromCaptures(initial.captures ?? [])[0]?.key ?? null,
  );
  const [error, setError] = useState<string | null>(initial.error ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const pinned = useRef(false);

  const captures = useMemo(() => status.captures ?? [], [status.captures]);
  const threads = useMemo(() => threadsFromCaptures(captures), [captures]);
  const activeThread = thread && threads.some((item) => item.key === thread)
    ? thread
    : threads[0]?.key ?? null;
  const items = activeThread
    ? capturesInThread(captures, activeThread, mode)
    : [];

  useEffect(() => {
    void refreshStatus();
    const tick = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      void refreshStatus();
    }, 2800);
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
    const nextCaptures = json.captures ?? [];
    setStatus((prev) => ({
      ...prev,
      ...json,
      captures: nextCaptures,
    }));
    const nextThreads = threadsFromCaptures(nextCaptures);
    if (!pinned.current && nextThreads[0]) {
      setThread(nextThreads[0].key);
    }
    if (json.error) setError(json.error);
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }

  async function disconnect() {
    await fetch("/api/granola/disconnect", { method: "POST" });
    await refreshStatus();
  }

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
          {threads.length > 0 ? (
            <div className="thread-rail" role="tablist" aria-label="Threads">
              {threads.map((item) => {
                const selected = item.key === activeThread;
                return (
                  <button
                    type="button"
                    role="tab"
                    key={item.key}
                    className={`thread-chip ${selected ? "is-on" : ""}`}
                    aria-selected={selected}
                    onClick={() => {
                      pinned.current = true;
                      setThread(item.key);
                    }}
                  >
                    <span className="thread-name">{item.label}</span>
                    <span className="thread-count">{item.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <p className="archive-hint">
            Read-only overview. New ring asks land on top. Past ones stay in the
            thread.
          </p>

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
            <ArchiveStage
              mode={mode}
              items={items}
              connected={status.connected}
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
              This site is the folder tree. Index lists (Granola thoughts, todos,
              catch up) stay yours. We reply in the Index thread. We do not write
              an empty note when a name misses.
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
