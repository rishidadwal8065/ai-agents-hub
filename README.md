# AI Agents Hub

A website that writes, illustrates, builds and publishes itself every day, for $0. It targets the "ai agents" keyword cluster listed in `keywords.json`.

| | |
|---|---|
| What and why | [docs/PRD.md](docs/PRD.md) |
| How it works | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Look and feel | [docs/DESIGN.md](docs/DESIGN.md) · screens in [docs/design/](docs/design/) |
| Rules for contributors and AI agents | [RULES.md](RULES.md) |
| What's next | [TASKS.md](TASKS.md) · current state in [docs/MEMORY.md](docs/MEMORY.md) |
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

## Launch (one time)
1. Push to a **public** GitHub repo named `ai-agents-hub`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → "Generate, build and deploy" → **Run workflow**. After that it runs daily at 06:17 UTC.
4. Google Search Console: verify the site and submit `/sitemap.xml`.

No secrets are needed: text uses GitHub Models through the built-in `GITHUB_TOKEN`.

### Optional: watermark-free AI pictures (free)
1. Create a free account at dash.cloudflare.com and copy the **Account ID**.
2. My Profile → API Tokens → Create Token → template **"Workers AI"** → copy the token.
3. Repo → Settings → Secrets → Actions: add `CF_ACCOUNT_ID` and `CF_API_TOKEN`.

Without them, every page gets a generated cover (also with no watermark).

## Cost
$0: GitHub Actions and Pages (public repo), GitHub Models free tier, Cloudflare Workers AI free tier. A custom domain (~$10/yr) is optional.

## Add a keyword
Add an entry to `pages` in `keywords.json`, then run `npm test` (it validates the file). The next daily run writes the page.
