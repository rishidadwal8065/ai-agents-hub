# Architecture Decisions

## ADR-001: Static site, not Next.js + Supabase + Vercel
**Decision:** a small Node static site generator, built by GitHub Actions (hosting: see ADR-011).
**Reason:** the product has no users, logins or database, only content. Static HTML is the fastest option for SEO, costs $0, and can't be hacked through a server. The guide's recommended stack (Next.js, Supabase, Vercel) solves problems this product doesn't have.
**Revisit if:** we add accounts, comments or a newsletter with sign-ups.

## ADR-002: JavaScript with JSDoc types, checked by TypeScript
**Decision:** `.mjs` files with JSDoc annotations, and `tsc --checkJs --strict` in `npm run verify`.
**Reason:** strict type safety without a compile step; the scripts run directly with `node`.

## ADR-003: Content is committed to the repo
**Decision:** generated Markdown and images are committed by the bot under `content/`.
**Reason:** a free, permanent history of every published word; easy rollback (`git revert`); the build is reproducible; no database.

## ADR-004: Free AI providers by default
**Decision:** text and images from Cloudflare Workers AI (free tier): Llama 3.3 70B for text, FLUX schnell for images. Claude is supported when `ANTHROPIC_API_KEY` is set. (Originally GitHub Models; see ADR-012.)
**Reason:** the owner requires $0 running cost. Both have free daily allowances well above our ~12 requests a day.

## ADR-005: No watermarked images
**Decision:** Pollinations was removed (anonymous use adds a watermark and is heavily rate-limited). When no AI picture exists, the site draws its own SVG cover.
**Reason:** the owner requires zero-watermark pictures.

## ADR-006: Reliability over completeness
**Decision:** every AI, feed and image call is isolated. A failure skips that item and the next run retries; the deploy still happens.
**Reason:** free tiers rate-limit, and a missing page tomorrow is better than a broken site today.

## ADR-007: Validate AI output before publishing
**Decision:** AI responses must start with labelled lines (`TITLE:` / `DESC:`) and have a body; otherwise they are discarded.
**Reason:** found during testing: unlabelled output turned the first line of the article into the meta description.

## ADR-008: node:test instead of Jest or Vitest
**Decision:** use Node's built-in test runner and coverage.
**Reason:** no extra dependencies; fast; enough for pure functions and file-based integration tests.

## ADR-009: Untrusted Markdown is rendered safely
**Decision:** raw HTML in Markdown is escaped; links are limited to safe schemes.
**Reason:** the AI writes the Markdown, so it must be treated like user input.

## ADR-010: Design approved as-is
**Decision:** indigo accent, "AI Agents Hub", system fonts, "Start here" guide first on the home page (owner choice, 4 Oct 2026).

## Dependencies
| Package | Licence | Why |
|---|---|---|
| marked | MIT | Markdown → HTML |
| typescript (dev) | Apache-2.0 | Type checking of JSDoc |
| eslint, @eslint/js, globals (dev) | MIT | Linting |
| @types/node (dev) | MIT | Node types for the type checker |

## ADR-011: Cloudflare Pages on aiagentnewsfree.com
**Decision:** deploy `dist/` to Cloudflare Pages with `cloudflare/wrangler-action` (Direct Upload). The domain aiagentnewsfree.com is already on Cloudflare DNS. GitHub Actions still runs the daily content job.
**Reason:** owner choice. Free, global CDN, custom domain with automatic HTTPS, `_headers` support for security headers, and the same account powers the free AI pictures. One token (Pages Edit + Workers AI) covers both.
**Replaces:** GitHub Pages hosting.

## ADR-012: Text moves from GitHub Models to Cloudflare Workers AI
**Decision:** Cloudflare Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` writes the guides and digests.
**Reason:** GitHub Models was retired on 30 July 2026; its endpoint now answers a plain "OK", which broke the first live run. Cloudflare is already our host and picture provider, so the same free account and token cover everything. The free daily allowance may not fit all 10 guides on day 1; leftovers are written on the following days (ADR-006).

## ADR-013: 16 languages, translated gradually within the free AI budget
**Decision:** UI text for 16 languages lives in `src/lib/i18n.mjs` (hand-written). Articles are machine-translated by the daily run into `content/i18n/<lang>/`, at most `translation.maxPerRun` (10) per run: the newest digest in `newsLanguages` (es, pt, hi), then guides one language at a time in priority order. Translations must keep every link exactly (`sameLinks`) or they are discarded. Pages live under `/<lang>/` with `hreflang` alternates.
**Reason:** Cloudflare's free Workers AI allowance fits ~10 long translations a day; all 150 guide translations fill in over ~15 days without cost. Language pages with no translated content yet are `noindex` and left out of the sitemap, so Google never sees thin pages.

## ADR-014: A small same-origin script for the theme switch and search
**Decision:** `public/site.js` (served as `/assets/site.js`, loaded in `<head>`) applies the saved theme before paint, toggles light/dark, closes the language menu and filters the search page. CSP changes from `script-src 'none'` to `script-src 'self'`; there are still no inline scripts or event handlers (tested).
**Reason:** a remembered theme choice and live search need JavaScript. Without JS the site still works: the theme follows the system, the language menu is a native `<details>`, and the search page lists everything.
