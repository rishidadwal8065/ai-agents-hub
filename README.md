# AI Agents Hub

A website that writes, illustrates, builds and publishes itself every day, for $0. It targets the "ai agents" keyword cluster listed in `keywords.json`.

| | |
|---|---|
| What and why | [docs/PRD.md](docs/PRD.md) |
| How it works | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Look and feel | [docs/DESIGN.md](docs/DESIGN.md) · screens in [docs/design/](docs/design/) |
| Rules for contributors and AI agents | [RULES.md](RULES.md) |
| What's next | [TASKS.md](TASKS.md) · current state in [docs/MEMORY.md](docs/MEMORY.md) |
| SEO | [docs/SEO.md](docs/SEO.md) |
| Testing · Security · Decisions | [TEST_PLAN](docs/TEST_PLAN.md) · [SECURITY](docs/SECURITY.md) · [DECISIONS](docs/DECISIONS.md) |

## Commands
```bash
npm ci               # install
npm run build        # build dist/ from content/
npm run generate     # write new content (needs keys, see .env.example)
npm test             # unit + integration tests
npm run verify       # lint → typecheck → tests with coverage → build (CI gate)
```
Preview locally: `npm run build`, then serve `dist/` (for example `python -m http.server -d dist`).

## Live site
**https://aiagentnewsfree.com**, served by the Cloudflare Worker **`ai-agents-hub`**, which is connected to this GitHub repo.

## How it runs
1. Every day at 06:17 UTC, GitHub Actions checks the code, writes new guides, news, translations and pictures, and pushes them.
2. Every push to `main` makes Cloudflare build the site and deploy it (`wrangler.jsonc`).

## Setup (already done)
- GitHub secrets `CF_ACCOUNT_ID` and `CF_API_TOKEN` (token permission: **Account → Workers AI → Read**) for the free AI.
- Cloudflare → Workers & Pages → **ai-agents-hub** → Settings → Build: connected to `rishidadwal8065/ai-agents-hub`, branch `main`, deploy command `npx wrangler deploy`.
- Custom domain `aiagentnewsfree.com` on that Worker (add `www.aiagentnewsfree.com` there too).
- Google Search Console: sitemap `https://aiagentnewsfree.com/sitemap.xml`.

If a content run fails, open the **Check Cloudflare settings** step in the Actions log: it says which setting is wrong.

## Cost
$0 to run: GitHub Actions (public repo), Cloudflare Workers (static assets) and Workers AI free tiers. The only cost is the domain renewal.

## Add a keyword
Add an entry to `pages` in `keywords.json`, then run `npm test` (it validates the file). The next daily run writes the page.

