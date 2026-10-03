# Project Memory

_Last updated: 4 Oct 2026_

## Current status
Code complete for v1 and verified locally (`npm run verify`: 48 tests pass, 99% line coverage on `src/`). **Not launched yet.**

## Completed
- Keyword plan (`keywords.json`), content pipeline, static build, daily workflow
- Free providers: GitHub Models (text), Cloudflare Workers AI (images, optional), SVG covers
- Approved UI/UX design (screens in `docs/design/`)
- Project docs, rules, tests, lint, typecheck, coverage gate in CI
- Security hardening: escaping raw HTML, link-scheme allow-list, JPEG check, account-id validation

## Current task
TASK-L1: launch. Waiting for the owner to finish `gh auth login` on this PC.

## Known issues
- Not yet run against live GitHub Models or Cloudflare (needs the deployed Actions environment).
- The default model `openai/gpt-4.1-mini` may need changing via the `AI_MODEL` repo variable if GitHub retires it.
- Browser end-to-end tests are not set up yet (TASKS.md, Phase 3).

## Next step
Create the public repo `ai-agents-hub`, push, enable Pages (GitHub Actions source), run the workflow, then run production QA (TEST_PLAN.md).
