# Tasks

Workflow per task: Understand → Plan → Test first → Implement → `npm run verify` → Review → Commit → Update docs.

## Phase 1: Foundation ✅
- [x] TASK-001 Keyword plan (`keywords.json`)
- [x] TASK-002 Content pipeline (guides, daily digest)
- [x] TASK-003 Static build with SEO (meta, canonical, sitemap, RSS, structured data)
- [x] TASK-004 Daily GitHub Actions workflow and Pages deploy
- [x] TASK-005 Free text model with Claude as an option (now Cloudflare Workers AI, see TASK-023)
- [x] TASK-006 Watermark-free pictures (Cloudflare + SVG covers)
- [x] TASK-007 UI/UX design (approved 4 Oct 2026)

## Phase 2: Structure and quality ✅
- [x] TASK-008 Project docs (PRD, Architecture, Design, Test plan, Security, Decisions, Memory), Rules, Tasks
- [x] TASK-009 Move logic into `src/` (lib, services, generate) with injected dependencies
- [x] TASK-010 Unit and integration tests, coverage gate, ESLint, strict type checking, `npm run verify`
- [x] TASK-011 CI runs verify before generate and deploy
- [x] TASK-012 Fix: a headline in several feeds lost its topics (regression test)
- [x] TASK-013 Fix: the menu and chips linked to unwritten guides (regression test)
- [x] TASK-014 Fix: unlabelled AI output became the meta description (regression test)
- [x] TASK-015 Security: escape raw HTML in Markdown, allow-list link schemes, JSON-LD escaping

## Phase L: Launch 🔜
- [x] TASK-L0 Hosting switched to Cloudflare Pages + aiagentnewsfree.com (`_headers`, wrangler deploy)
- [x] TASK-L1 Create the public GitHub repo and push (owner: finish `gh auth login`)
- [x] TASK-L1b Owner: create the Cloudflare Pages project `aiagentnewsfree`, API token, and add the 2 GitHub secrets
- [x] TASK-L2 First manual workflow run; check the log for AI or model errors
- [x] TASK-L3 Production QA: pages, pictures, sitemap, RSS, 404, security headers OK; http→https and www still open (TASK-L4)
- [ ] TASK-L4 Attach aiagentnewsfree.com + www redirect + Always Use HTTPS in Cloudflare
- [ ] TASK-L5 Google Search Console and Bing Webmaster Tools: verify, submit the sitemap

- [x] TASK-023 Fix: GitHub Models retired; text on Cloudflare Workers AI, plus a Cloudflare settings check in CI

## Phase 3: Hardening
- [ ] TASK-016 Playwright e2e at 375 / 768 / 1280px (home → guide → news), run in CI
- [ ] TASK-017 Lighthouse CI budget (SEO and accessibility ≥ 95)
- [ ] TASK-018 Weekly link check for external source links

## Phase 4: Growth (after 4–6 weeks of Search Console data)
- [ ] TASK-019 Add keywords that show impressions but have no page
- [ ] TASK-020 Owner hand-edits the 4 Easy-keyword pages
- [ ] TASK-022 Cloudflare Web Analytics (free, no cookies)
