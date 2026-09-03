# Index x Granola

This is the home repo for the **Pebble Index 01 × Granola MCP** proxy (`Shimku/PebbleGranola`).

A tiny server that sits between a **Pebble Index 01** and **Granola MCP**.

Granola MCP is read-only. Index cannot speak OAuth. This app is the missing piece: you sign into Granola once in the browser, then the ring talks to us with a Bearer token.

Built as a one-take demo for X. Free Granola is enough. Notes older than 30 days are out of scope on purpose.

## What it does

Three tools, one double-click on the ring:

1. **Afterthought** – You already captured a meeting in Granola. Later you remember something. We fetch that note, weave your new thought in, save the blend **on this website**, and send a push like “idea added to [meeting].” That combo is the product. Granola is not modified. If Pebble also creates a list item, great; we do not depend on it.
2. **Prep me** – “Prep me for Acme” or “prep me for the visual canvas pitch.” We look up matching Granola notes from the last 30 days. Visual canvas / Sorta pitches are notes titled like `Sorta<>Name Xxx`. If you name a company or person, we use the **most recent** matching meeting, not all ten. Say “this week” or “all meetings with X” for a wider recap. Pitch wording asks Granola to coach from those recordings: what to repeat, what not to say.
3. **What I owe** – Open loops from this week or from one client. Mine vs theirs. Dates kept when Granola had them.

Calendar / Gmail reminders are **not** in this build. Too much extra OAuth for a flex video. If a date is in the notes, it stays in the notification. Single-click on Index can still create a normal Pebble reminder.

## How meeting lookup works

1. `list_meetings` over `last_30_days` (free-tier window).
2. Score title + attendees against the words you spoke. `Sorta<>Name Xxx` titles split on `<>`, so “visual canvas”, “Sorta”, or the name on the right-hand side all match.
3. Default: **most recent match**. Ten meetings with the same startup → the last one.
4. Then `query_granola_meetings` limited to those note IDs, with a prompt that demands a ring-sized answer.
5. We clip to ~380 characters so a lock-screen notification stays readable.

If the name does not match a title, Granola Chat still searches. The notification will say when we are guessing.

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
| This website | Connect Granola, copy Pebble settings, rehearse without the ring, browse combined afterthought notes |
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

Open [http://localhost:3000](http://localhost:3000), tap **Connect Granola**, then use **Rehearse without the ring**.

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

Say, while holding the double-click:

- “Add this to the last meeting: we should send the deck before Thursday.”
- “Prep me for my next pitch of the visual canvas. What should I say and what should I not say?”
- “What do I need to do from this week’s client meetings?”

## Environment

`DATABASE_URL` is a Postgres connection string. The app is not a static page: it stores your Granola login tokens and the combined afterthought notes. **Neon** is that Postgres (serverless, fine for this demo).

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
