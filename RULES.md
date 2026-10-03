# Development Rules

Read before changing anything: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, this file, `TASKS.md`, `docs/MEMORY.md`.

## General
- JavaScript ES modules with JSDoc types; `tsc --checkJs --strict` must pass. No `@ts-ignore` or `eslint-disable` without a written reason.
- One task at a time from TASKS.md. Don't modify unrelated files.
- Reuse `src/lib` helpers; never duplicate logic between `scripts/` and `src/`.
- Keep functions small. Keep logic out of `scripts/` (wiring only).
- New dependency: it must be free/open source and recorded in `docs/DECISIONS.md`.

## Before coding
- Read the relevant docs and the existing code.
- For anything bigger than a small fix, write a short plan first.

## Test-first
1. Write or extend tests **before** the implementation.
2. Every bug fix starts with a failing regression test.
3. Never delete, skip or weaken a test to make it pass.
4. `npm run verify` must pass before a task is done. Coverage must not drop below the thresholds in `package.json`.

## Content and AI
- All network calls live in `src/services/`. `src/generate.mjs` gets them injected.
- AI output and RSS text are untrusted: validate before writing, escape before rendering.
- A failure in one item must never stop the run or the deploy.
- Never put invented facts in prompts; news uses only the day's headlines with source links.

## UI
- Follow `docs/DESIGN.md`. Colours only through `:root` tokens in `public/style.css`.
- Mobile first (375 / 768 / 1280px), light and dark mode, alt text on every image, empty states.
- Only link to pages that exist.

## Security
- Never commit secrets; use GitHub Actions secrets. Secrets go only to the content step.
- See `docs/SECURITY.md`.

## Git
- Small commits, one task each, Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Branch for larger work; CI must be green before merging to `main`.

## After each task, report
Files changed · tests added · `npm run verify` result · coverage % · open issues. Then update `TASKS.md` and `docs/MEMORY.md` (and `docs/DECISIONS.md` if a decision was made).
