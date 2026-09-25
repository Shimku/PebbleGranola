"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RingMark } from "./mark";

export function Gate({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!configured) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(json.error || "Could not sign in.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="app-shell gate-shell">
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
          <a
            className="text-link"
            href="https://github.com/Shimku/PebbleGranola"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>

      <section className="steel-panel gate-panel">
        <p className="kicker kicker-light">Personal instance</p>
        <h1>This archive is locked</h1>
        {configured ? (
          <form className="gate-form" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="site-password">
              Site password
            </label>
            <input
              id="site-password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Site password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
            <button type="submit" className="olive-btn" disabled={busy}>
              {busy ? "Signing in" : "Sign in"}
            </button>
          </form>
        ) : (
          <p className="gate-copy">
            Set <code>SITE_PASSWORD</code> (8+ characters) on this deploy, then
            refresh.
          </p>
        )}
        {error ? (
          <p className="banner banner-danger" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
