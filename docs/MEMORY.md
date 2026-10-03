# Project Memory

_Last updated: 4 Oct 2026_

## Current status
Code complete for v1 and verified locally (`npm run verify`: 50 tests pass, 99% line coverage on `src/`). **Not launched yet.**

## Completed
- Keyword plan (`keywords.json`), content pipeline, static build, daily workflow
- Live at https://aiagentnewsfree.com (Cloudflare Pages, HTTPS and security headers verified)
- Free providers: Cloudflare Workers AI for text (Llama 3.3) and images (FLUX), SVG covers
- Approved UI/UX design (screens in `docs/design/`)
- Project docs, rules, tests, lint, typecheck, coverage gate in CI
- Security hardening: escaping raw HTML, link-scheme allow-list, JPEG check, account-id validation

## Current task
TASK-L1: launch on Cloudflare Pages at aiagentnewsfree.com. Waiting for the owner to finish `gh auth login`, and to create the Cloudflare Pages project, API token and 2 GitHub secrets.

## Known issues
- GitHub Models was retired (30 Jul 2026); text switched to Cloudflare Workers AI.
- The first deploy from Actions failed with a Cloudflare auth error (code 10000); the workflow now has a "Check Cloudflare settings" step that says which setting is wrong.
- Browser end-to-end tests are not set up yet (TASKS.md, Phase 3).

## Next step
Create the public repo `ai-agents-hub`, push, run the workflow (deploys with wrangler), attach the custom domain, then run production QA (TEST_PLAN.md).
