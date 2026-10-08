# Project Memory

_Last updated: 7 Oct 2026_

## Current status
Code complete for v1 and verified locally (`npm run verify`: 121 tests pass, 99% line coverage on `src/`). **Live since 3 Oct 2026** at https://aiagentnewsfree.com (first run: 10 guides, 1 digest from 75 headlines, 13 AI pictures).

## Completed
- Keyword plan (`keywords.json`), content pipeline, static build, daily workflow
- Live at https://aiagentnewsfree.com (Cloudflare Worker `ai-agents-hub`, Git-connected; HTTPS, www→root 301 and security headers verified)
- Free providers: Cloudflare Workers AI for text (Llama 3.3) and images (FLUX), SVG covers
- Approved UI/UX design (screens in `docs/design/`)
- Project docs, rules, tests, lint, typecheck, coverage gate in CI
- 16 languages (translations fill in ~10/day, newest digest in es/pt/hi first), light/dark switch, search, upgraded UI (4 Oct 2026)
- Advanced SEO (see docs/SEO.md): News sitemap, IndexNow, rich structured data, About page
- Content quality v2 (4 Oct 2026): stricter brief + quality gates; 3 guides are rewritten per run (about 4 days), translations follow; the free AI allowance resets at 00:00 UTC
- Search Console fix (7 Oct 2026): empty languages no longer get noindex placeholder pages (were 49 "Excluded by noindex"); they 302 to English until translated
- Trending news (8 Oct 2026): a 4-hourly run (MODE=trends) reads Google Trends "trending now" RSS for US/IN/GB, keeps searches from the last 4 hours that match `trends.niche`, and writes up to 2 stories per run to content/news/<date>-<trend>.md (deduped via trends-seen.json). News URLs now use the file name, so digests keep /news/<date>/
- Security hardening: escaping raw HTML, link-scheme allow-list, JPEG check, account-id validation

## Current task
None: launch complete. The site runs itself (daily at 06:17 UTC).

## Known issues
- GitHub Models was retired (30 Jul 2026); text switched to Cloudflare Workers AI.
- The first deploy from Actions failed with a Cloudflare auth error (code 10000); the workflow now has a "Check Cloudflare settings" step that says which setting is wrong.
- Browser end-to-end tests are not set up yet (TASKS.md, Phase 3).

## Next step
In ~1 week: review the rewritten guides and Search Console data; then Phase 3 (Playwright e2e, Lighthouse CI) and Phase 4 (new keywords from Search Console).
