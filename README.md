# Index x Granola

This is the home repo for the **Pebble Index 01 × Granola MCP** proxy (`Shimku/PebbleGranola`).

A tiny server that sits between a **Pebble Index 01** and **Granola MCP**.

Granola MCP is read-only. Index cannot speak OAuth. This app is the missing piece: you sign into Granola once in the browser, then the ring talks to us with a Bearer token.

Built as a one-take demo for X. Free Granola is enough. Notes older than 30 days are out of scope on purpose.

## What it does

Three tools, one double-click on the ring. The website is an archive. The ring is the writer. New asks append under a company thread. Remove a card with **Remove**, or clear a thread with **×** on the selected chip.

1. **Afterthought** – Granola meeting summary with the spoken thought on top. Filed into **Granola Thoughts** in Index when the meeting matches.
2. **Prep me** – A few bullets before a call. Filed into **Granola Catch Up**.
3. **What I owe** – Open loops, mine vs theirs. Filed into **Granola To-Dos**.

A named miss does not write an empty Index note. Pairing stays behind **Pair** once Granola is connected.

## How it finds, extracts, and presents

**Find.** `list_meetings` over `last_30_days`. Score the cleaned title and attendees against the words you spoke. Titles like `VERV<>ASA` match “Verve” / “verv” on the left of `<>`. Close spellings (Bonbon / Bonvan) still hit. If you named a company and nothing scores, we say so and stop. We do not glue your ask onto a random latest meeting.

Granola sometimes stores the title as a `<meeting title="…">` blob. We pull `title=` out before matching or showing anything.

**Extract.** `get_meetings` for that note’s summary and action lines. Local bullets first. Granola Chat (`query_granola_meetings`) only if the note is too thin. Chain of thought and prompt echoes are stripped.

**Present.** MCP `Response` with a few bullets (or two lines for an afterthought). That is the Index notification. The same record is stored and grouped on this site by thread (VERV, Bonbon, …) then by tab.

## Prerequisites

You need:

- Index 01 paired with the Pebble app
- A free Granola account with some notes in the last 30 days (a real meeting, a pitch recording, anything)
- 2 minutes on this site to Connect Granola
- 2 minutes in Pebble to paste the MCP URL + Bearer token

You do **not** need a paid Granola plan, the Granola API, or write access.

## Where it lives

| Surface | Role |
| --- | --- |
| This website | Connect Granola, copy Pebble settings, browse the thread archive |
| `POST /mcp` | Streamable HTTP MCP for the Pebble cloud agent (protocol 2025-06-18, Bearer auth, no OAuth) |
| Pebble Answers | The notification you read on the phone or watch |
| Granola | Source of truth. Never written to |

This is the home repo for the project.

## Local run

```bash
cp .env.example .env.local
# put a Postgres URL in DATABASE_URL
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), tap **Connect Granola**.

If you used a neon.new database, open the claim URL on the homepage within 72 hours or the data disappears.

## Pebble app settings

1. Connect Granola on the website.
2. Pebble app → Index → **MCP & Tool Settings** → create a sandbox group. Model: **Default** or **High Capability** (cloud). The offline Index agent cannot use custom MCP.
3. **MCP Servers** → add one:
   - URL: `https://YOUR-DOMAIN/mcp`
   - Streamable: **on**
   - Authorization: `Bearer …` (copy from the site, include the word Bearer)
   - Prompts: enable `ring_voice`
4. Index tab settings → **Double click and hold** → this sandbox.
5. Leave **single click** as the normal local notes/reminders path.

The website does not have a Run button. Speak from the ring.

## Environment

`DATABASE_URL` is a Postgres connection string. The app is not a static page: it stores your Granola login tokens and the archive. **Neon** is that Postgres (serverless, fine for this demo).

If we used [neon.new](https://neon.new) to spin one up instantly, it dies after **72 hours** unless you open the claim URL on the homepage and attach it to a Neon account.

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `NEON_CLAIM_URL` | no | Shown in the UI so you can keep a neon.new database |
| `PEBBLE_MCP_TOKEN` | no | Generated and stored on first boot if unset |
| `APP_URL` | no | Defaults to the current host. Set this if OAuth redirects to the wrong place |

## Why not point Pebble at mcp.granola.ai?

Pebble custom MCP only sends a static `Authorization` header. Granola MCP only speaks browser OAuth. The proxy is required, even though Cursor can talk to Granola MCP directly.

## Demo notes for the Granola team

The interesting product gap is not “search from a ring.” It is **afterthoughts**: hallway thoughts that belong on a meeting note, with no write tool to put them there. This app files them next door on purpose.
