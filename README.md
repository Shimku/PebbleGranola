![Index × Granola](public/og.png)

# Index × Granola

The phone notification is the notes. This site is the archive.

Double-click and hold Index 01 for afterthought, prep, or what you owe. Sign in here. Paste one MCP URL into Pebble. Granola stays read-only.

One Granola account, one ring, one password. Deploy your own. Not affiliated with Pebble or Granola.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Shimku/PebbleGranola&env=SITE_PASSWORD,DATABASE_URL&envDescription=SITE_PASSWORD%20locks%20the%20archive%20(8%2B%20chars).%20DATABASE_URL%20is%20a%20Neon%20Postgres%20url.&project-name=index-granola&repository-name=index-granola)

Free Granola is enough. It only looks at the last 30 days.

## Pair the ring

1. Sign in, tap **Connect Granola**.
2. Pebble app → Index → **MCP & Tool Settings** → new sandbox. Model: **Default** or **High Capability** (cloud). Offline Index cannot use custom MCP.
3. Add MCP. Streamable HTTP on. Copy URL and Bearer from **Pair**.
4. Enable `ring_voice`.
5. **Double click and hold** → this sandbox. Leave single click as local notes.

No Run button on the site. Speak from the ring.

Pebble only sends a static Bearer. Granola MCP wants browser OAuth. Do not turn on Vercel Deployment Protection on the production domain; the ring cannot log into Vercel.

## Deploy

1. **Deploy with Vercel** (or fork and import).
2. Neon Postgres URL → `DATABASE_URL`.
3. `SITE_PASSWORD`, 8+ characters. Locks the website. `/mcp` stays open for the ring.
4. Connect Granola. Copy Pair into Pebble.

## Local

```bash
cp .env.example .env.local
# DATABASE_URL = Neon Postgres
# SITE_PASSWORD = 8+ characters
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) → sign in → Connect Granola.

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres |
| `SITE_PASSWORD` | yes | Locks the website |
| `NEON_CLAIM_URL` | no | If you used neon.new |
| `PEBBLE_MCP_TOKEN` | no | Generated on first boot if unset |
| `APP_URL` | no | Set if OAuth redirects to the wrong host |

## License

MIT. See [LICENSE](LICENSE).
