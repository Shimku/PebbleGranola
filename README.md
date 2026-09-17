# Index × Granola

Pebble Index 01 cannot speak Granola’s browser OAuth. Granola MCP will not take a static Bearer. This tiny Next.js app is the translator.

Sign in once on the site. Paste one MCP URL into Pebble. Double-click the ring for prep, what you owe, or an afterthought. The phone notification is the notes. The site is the archive. Granola stays read-only.

This is a **personal proxy**. One Granola login, one ring, one password. Deploy your own. It is not a multi-user host, and it is not affiliated with Pebble or Granola.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Shimku/PebbleGranola&env=SITE_PASSWORD,DATABASE_URL&envDescription=SITE_PASSWORD%20locks%20the%20archive%20(8%2B%20chars).%20DATABASE_URL%20is%20a%20Neon%20Postgres%20url.&project-name=index-granola&repository-name=index-granola)

Free Granola is enough. Notes older than 30 days are out of scope on purpose.

## What it does

Three tools, one double-click on the ring. New asks append under a company thread.

1. **Afterthought** – Granola meeting summary with the spoken thought on top.
2. **Prep me** – A few bullets before a call.
3. **What I owe** – Open loops, mine vs theirs.

A named miss does not invent a meeting. Pairing stays behind **Pair** once Granola is connected.

## Deploy your own

1. Click **Deploy with Vercel** above (or fork this repo and import it).
2. Create a [Neon](https://neon.tech) Postgres database. Paste its URL into `DATABASE_URL`.
3. Set `SITE_PASSWORD` (8+ characters). This locks the website. `/mcp` stays open for the ring.
4. Deploy. Open the site, sign in, tap **Connect Granola**.
5. Copy the MCP URL and Bearer from **Pair**. Paste them into Pebble.

Do **not** turn on Vercel Deployment Protection or SSO on production. Pebble can only send `Authorization`, so a Vercel login wall would kill the ring.

| Surface | Role |
| --- | --- |
| The website | Connect Granola, copy Pebble settings, browse the thread archive |
| `POST /mcp` | Streamable HTTP MCP for the Pebble cloud agent (Bearer auth, no OAuth) |
| Pebble Answers | The notification you read on the phone |
| Granola | Source of truth. Never written to |

## Pebble app settings

You need an Index 01 paired with the Pebble app, and a free Granola account with some notes in the last 30 days.

1. Sign in, then Connect Granola on the website.
2. Pebble app → Index → **MCP & Tool Settings** → create a sandbox group. Model: **Default** or **High Capability** (cloud). The offline Index agent cannot use custom MCP.
3. **MCP Servers** → add one:
   - URL: `https://YOUR-DOMAIN/mcp`
   - Streamable: **on**
   - Authorization: `Bearer …` (copy from the site, include the word Bearer)
   - Prompts: enable `ring_voice`
4. Index tab settings → **Double click and hold** → this sandbox.
5. Leave **single click** as the normal local notes/reminders path.

The website does not have a Run button. Speak from the ring.

## Local run

```bash
cp .env.example .env.local
# DATABASE_URL = Neon Postgres
# SITE_PASSWORD = 8+ characters
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, tap **Connect Granola**.

If you used [neon.new](https://neon.new), open the claim URL on the site within 72 hours or the data disappears.

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string |
| `SITE_PASSWORD` | yes | Locks the website. `/mcp` stays open for the ring Bearer. |
| `NEON_CLAIM_URL` | no | Shown in the UI so you can keep a neon.new database |
| `PEBBLE_MCP_TOKEN` | no | Generated on first boot if unset. If set, it wins over the DB token. |
| `APP_URL` | no | Defaults to the current host. Set this if OAuth redirects to the wrong place |

## How it finds, extracts, and presents

**Find.** `list_meetings` over `last_30_days`. Score the cleaned title and attendees against the words you spoke. Titles like `VERV<>ASA` match “Verve” / `verv` on the left of `<>`. Close spellings (Bonbon / Bonvan) still hit. If you named a company and nothing scores, we say so and stop.

Granola sometimes stores the title as a `<meeting title="…">` blob. We pull `title=` out before matching or showing anything.

**Extract.** `get_meetings` for that note’s `<summary>`. Local bullets only. Prompt echoes and “notes unavailable” bluffs are dropped.

**Present.** MCP `Response` with a few bullets (or two lines for an afterthought). That is the Index notification. The same record is stored and grouped on this site by thread, then by tab.

## Why not point Pebble at mcp.granola.ai?

Pebble custom MCP only sends a static `Authorization` header. Granola MCP only speaks browser OAuth. The proxy is required, even though Cursor can talk to Granola MCP directly.

## Security

Each deploy is one locker. Set `SITE_PASSWORD` before you share the URL. Visitors see a lock screen. The archive, Granola email, and Bearer are not in that HTML.

`POST /mcp` is reachable on purpose so the ring can call it. Anyone who has the Bearer can query your notes through that path. Rotate it under **Pair** if it ever leaked, then paste the new value in Pebble.

This app files afterthoughts next door on purpose. Granola has no write tool to put a hallway thought onto a meeting note.

## License

MIT. See [LICENSE](LICENSE).
