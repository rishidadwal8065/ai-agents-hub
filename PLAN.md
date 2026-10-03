# AI Agents Hub: final plan

**Goal:** rank for the "ai agents" keyword cluster (54k related searches) with a site that writes, illustrates, builds and publishes itself every day, for $0.

## 1. How it works

```
Every day 06:17 UTC (GitHub Actions)
  1. generate.mjs:  guides (AI writes each one once, rewrites every 90 days)
                    news digest built from Google News RSS headlines (1 a day)
                    pictures from Pollinations (a few a day, until all done)
  2. commit the new content to the repo
  3. build.mjs:     static HTML, sitemap, RSS, structured data
  4. deploy to GitHub Pages
```

| Part | Tool | Cost |
|---|---|---|
| Text | GitHub Models (free tier, built-in token) | $0 |
| Pictures | Pollinations, with a generated SVG cover as fallback | $0 |
| Automation | GitHub Actions (public repo) | $0 |
| Hosting | GitHub Pages | $0 |
| Domain (optional, recommended) | any registrar | ~$10/year |

## 2. Keyword map

| Page | Main keyword | Also targets | Difficulty |
|---|---|---|---|
| `/` home | ai agents | — | Easy |
| `/what-are-ai-agents/` | what are ai agents | ai agents explained | Hard |
| `/ai-agents-examples/` | ai agents examples | — | ? |
| `/best-ai-agents/` | best ai agents | — | **Easy** |
| `/ai-agents-for-business/` | ai agents for business | — | **Easy** |
| `/enterprise-ai-agents/` | enterprise ai agents | — | ? |
| `/how-to-build-ai-agents/` | how to build ai agents | — | ? |
| `/autonomous-ai-agents/` | autonomous ai agents | — | Hard |
| `/private-ai-agents/` | private ai agents | — | ? |
| `/tool-discovery-for-ai-agents/` | tool discovery for ai agents | — | ? |
| `/moltbook-ai-agents/` | moltbook ai agents | ai agents moltbook | Hard |
| `/ai-agents-news/` | ai agents news | news 2026 (**Easy**), updates, breakthroughs 2026, twitter trends 2026 | Hard / Easy |
| `/shopify-ai-agents-news/` | shopify ai agents news | — | ? |
| `/news/YYYY-MM-DD/` | long-tail news queries | — | — |

Focus first on the **Easy** ones: home, best ai agents, ai agents for business, ai agents news 2026.

## 3. Design (UI/UX)

- **Home:** a hero section with one clear action ("Start with the basics") and a second one ("Today's news"), topic chips, a featured "Start here" guide, a card grid of guides and the latest news.
- **Articles:** breadcrumbs, date and reading time, a large cover picture, comfortable reading width, a sticky "On this page" contents box on desktop, a styled FAQ, and "Keep reading" cards.
- **News:** today's digest featured at the top, plus a compact archive list with thumbnails.
- **Phones:** single column, a one-line menu you can swipe, 16px side margins.
- **Dark mode:** follows the device setting automatically.
- **Accessibility:** "skip to content" link, visible keyboard focus, alt text on pictures.
- **Speed:** no web fonts and no JavaScript, CSS inlined, pictures lazy-loaded with fixed sizes, so layout doesn't jump and Core Web Vitals stay strong.
- **Search features:** structured data for Article, NewsArticle, FAQ and Breadcrumbs, social preview pictures, canonical links, sitemap, RSS.

## 4. Launch (one time, about 10 minutes)

1. Create a **public** GitHub repo and push this folder to `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → "Generate, build and deploy" → **Run workflow**.
4. Check the site at `https://<user>.github.io/<repo>/`. If the run log says the AI model isn't available, set a repo variable `AI_MODEL` to one listed in GitHub Models.
5. Set `site.url` in `keywords.json` (or the `SITE_URL` repo variable) to the real address.
6. Google Search Console: verify the site and submit `/sitemap.xml`. Do the same in Bing Webmaster Tools.

## 5. Timeline

| When | What happens |
|---|---|
| Day 1 | Site is live: news hub, the first digest, guides written (up to the free-tier daily limit) |
| Days 2–5 | Remaining guides and pictures fill in on their own |
| Weeks 2–4 | Google indexes the pages; first impressions show up in Search Console |
| Months 2–3 | Easy keywords can start ranking; about 60 news pages exist |
| Month 3+ | Guides refresh every 90 days; add new keywords from Search Console data |

## 6. Risks and how they're handled

| Risk | Mitigation |
|---|---|
| Google demotes mass-produced AI content | Fewer, deeper pages; sourced news; an AI disclosure on every page. **Best fix: spend 10 minutes now and then improving the 4 Easy-keyword pages by hand.** |
| AI states something wrong | News is built only from real headlines with links; prompts forbid made-up statistics; the page footer asks readers to check sources |
| Free tier limits (text or pictures) | Failures never break the site; the next run retries; fallback covers |
| A free service shuts down | Change one function in `generate.mjs` (Gemini free tier or Claude as backups) |

## 7. Optional upgrades later (still free)

- A custom domain, which helps a site look trustworthy and rank.
- Cloudflare Web Analytics, which is free and needs no cookie banner.
- A newsletter sign-up for the daily digest (Buttondown has a free tier).
- More keyword pages: add a row to `keywords.json`, and the next run writes the page.
