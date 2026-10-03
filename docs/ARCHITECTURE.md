# Architecture

## Overview
A static site generator with a daily content pipeline. There is no server and no database: content is Markdown files in the repo, and the output is plain HTML served by the Cloudflare Worker `ai-agents-hub` (static assets) at https://aiagentnewsfree.com.

```
GitHub Actions (daily 06:17 UTC, or manual)
  │
  ├─ npm run verify          lint → typecheck → tests + coverage → build
  │
  ├─ scripts/generate.mjs    wires real services into src/generate.mjs
  │     ├─ src/services/ai.mjs   Cloudflare Workers AI (text + images), Claude optional
  │     ├─ Google News RSS        headlines for the digest
  │     └─ writes content/pages/*.md, content/news/*.md, content/images/*.jpg
  │
  ├─ git commit + push content/   (so every published word is in history)
  │
  ├─ translations            ≤10/run into content/i18n/<lang>/ (src/lib/translate.mjs plans them)
  │
  ├─ scripts/build.mjs       → src/site/build.mjs: content/ → dist/ in 16 languages (HTML, hreflang, sitemap, RSS, covers)
  │
  └─ (end of GitHub job)

Cloudflare Workers Builds (on every push to main)
  └─ npx wrangler deploy → wrangler.jsonc: npm run build → publish ./dist → Worker ai-agents-hub → aiagentnewsfree.com
```

## Stack
| Concern | Choice |
|---|---|
| Language | JavaScript (ES modules) with JSDoc types, checked by `tsc --checkJs --strict` |
| Runtime | Node.js 22+ |
| Markdown | `marked` |
| Tests | `node:test` (built into Node), with coverage thresholds |
| Lint | ESLint 9 (`@eslint/js` recommended) |
| Hosting | Cloudflare Worker with static assets (free), Git-connected; custom domain aiagentnewsfree.com; `_headers` for security and caching |
| CI/CD | GitHub Actions |
| Text AI | Cloudflare Workers AI, Llama 3.3 70B (free tier); Claude if `ANTHROPIC_API_KEY` is set |
| Image AI | Cloudflare Workers AI FLUX schnell (free tier) |

Why not Next.js, Supabase or Vercel: see DECISIONS.md, ADR-001. Why Cloudflare: ADR-011.

## Folder structure
```
src/
  generate.mjs        content pipeline (all network access injected → testable offline)
  lib/content.mjs     front matter, RSS parsing, AI-output parsing, text helpers (pure)
  lib/seo.mjs         structured data, table of contents, SVG covers (pure)
  lib/config.mjs      keywords.json validation
  lib/i18n.mjs        16 languages + all UI text (hand-written), t(), langPath(), formatDate()
  lib/translate.mjs   which translations to make next; link-preservation guard
  site/build.mjs      the site renderer (layout, pages for every language)
  services/ai.mjs     the only code that talks to AI providers
scripts/
  generate.mjs        entry point: env → services → generate()
  build.mjs           static site renderer
public/style.css      the whole design system (tokens in :root, light + dark)
public/site.js        theme switch, language menu, search filter
content/              generated content, committed by the bot
  pages/  news/  images/  i18n/<lang>/{pages,news}/
tests/
  unit/  integration/  fixtures/
keywords.json         the keyword plan and news feeds (the main thing to edit)
```

## Rules
- Pure logic lives in `src/lib` and has unit tests. No file or network access there.
- Only `src/services` calls external APIs. `src/generate.mjs` receives them as arguments.
- `scripts/` only wires things together; keep logic out of it.
- A failure in one guide, feed or image must never stop the run or the deploy.
- Content is only written when the AI output passes validation (`parseAiHeader`).
- The build fails on an invalid `keywords.json` or front matter instead of publishing a broken site.
- Internal links in templates start with `/`; the build adds a base path if `SITE_URL` has one (the custom domain has none).
- Menus only link to pages that exist.

## Environment
See `.env.example`. Locally nothing is required: `npm run build` builds whatever is in `content/`.
