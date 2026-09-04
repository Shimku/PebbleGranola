"use client";

import { useEffect, useRef, useState } from "react";

export function CopyBit({
  text,
  tone = "paper",
  ghost = false,
}: {
  text: string;
  tone?: "paper" | "ink";
  ghost?: boolean;
}) {
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const copied = copiedFor === text;

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!text.trim()) return null;

  return (
    <button
      type="button"
      className={`copy-bit tone-${tone}${ghost ? " is-ghost" : ""}${copied ? " is-copied" : ""}`}
      aria-label={copied ? "Copied" : "Copy"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void write(text).then((ok) => {
          if (!ok) return;
          setCopiedFor(text);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopiedFor(null), 1400);
        });
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

async function write(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  }
}
