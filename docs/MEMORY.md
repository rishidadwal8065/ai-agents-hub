# Project Memory

_Last updated: 4 Oct 2026_

## Current status
Code complete for v1 and verified locally (`npm run verify`: 118 tests pass, 99% line coverage on `src/`). **Live since 3 Oct 2026** at https://aiagentnewsfree.com (first run: 10 guides, 1 digest from 75 headlines, 13 AI pictures).

## Completed
- Keyword plan (`keywords.json`), content pipeline, static build, daily workflow
- Live at https://aiagentnewsfree.com (Cloudflare Worker `ai-agents-hub`, Git-connected; HTTPS and security headers verified)
- Free providers: Cloudflare Workers AI for text (Llama 3.3) and images (FLUX), SVG covers
- Approved UI/UX design (screens in `docs/design/`)
- Project docs, rules, tests, lint, typecheck, coverage gate in CI
- 16 languages (translations fill in ~10/day, newest digest in es/pt/hi first), light/dark switch, search, upgraded UI (4 Oct 2026)
- Advanced SEO (see docs/SEO.md): News sitemap, IndexNow, rich structured data, About page
- Content quality v2 (4 Oct 2026): stricter brief + quality gates; all guides are rewritten over the next runs, translations follow
- Security hardening: escaping raw HTML, link-scheme allow-list, JPEG check, account-id validation

## Current task
TASK-L4: owner turns on Always Use HTTPS and adds www; then TASK-L5 (Search Console).

## Known issues
- GitHub Models was retired (30 Jul 2026); text switched to Cloudflare Workers AI.
- The first deploy from Actions failed with a Cloudflare auth error (code 10000); the workflow now has a "Check Cloudflare settings" step that says which setting is wrong.
- Browser end-to-end tests are not set up yet (TASKS.md, Phase 3).

## Next step
Owner: Cloudflare SSL/TLS > Edge Certificates > Always Use HTTPS; add www.aiagentnewsfree.com to the Pages project; Google Search Console + sitemap.
