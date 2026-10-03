# Product Requirements Document

## Product
AI Agents Hub: a website that writes, illustrates, builds and publishes itself every day.

## Problem
People searching "ai agents" (54k related searches) want plain answers ("what are ai agents"), practical guides (examples, best tools, business use, how to build) and current news. Much of what ranks today is either hype or vendor marketing.

## Target users
1. **Curious beginners**: searching "what are ai agents" or "ai agents explained".
2. **Business decision-makers**: "ai agents for business", "enterprise ai agents", "best ai agents".
3. **Builders**: "how to build ai agents", "tool discovery for ai agents", "private ai agents".
4. **News followers**: "ai agents news", "ai agents news 2026", "ai agents updates", "shopify ai agents news".

## Goal
Rank for the keywords in `keywords.json` with clear, sourced, frequently updated pages, without any human work after launch and at $0 running cost.

## Core features (MVP)
1. Ten evergreen guides, one per keyword (see `keywords.json`), each rewritten every 90 days.
2. A daily news digest built only from that day's Google News headlines, with source links.
3. A news hub and topic pages (Shopify).
4. A picture on every page: an AI illustration (Cloudflare, free) or a generated cover. Never a watermark.
5. SEO basics: titles, descriptions, canonical links, sitemap, RSS, robots.txt, structured data (Article, NewsArticle, FAQ, Breadcrumbs).
6. Daily automation on GitHub Actions, deployed to Cloudflare Pages at aiagentnewsfree.com.

## Out of scope (v1)
- User accounts, comments, newsletter
- Paid AI models or paid hosting
- Ads or monetisation
- A CMS or admin panel
- Translations
- A mobile app

## Success criteria
1. The site deploys to https://aiagentnewsfree.com with only two secrets (`CF_ACCOUNT_ID`, `CF_API_TOKEN`), which also run the free AI for text and pictures.
2. A daily run adds one digest and never breaks the live site, even when an AI or image service fails.
3. Every page passes the automated checks: no broken internal links, valid structured data, one H1, alt text on every image.
4. Lighthouse SEO and accessibility scores ≥ 95 on mobile.
5. Within 3 months: pages indexed in Google Search Console, with impressions for the Easy keywords.

## Keyword map
| Page | Main keyword | Also targets |
|---|---|---|
| `/` | ai agents | — |
| `/what-are-ai-agents/` | what are ai agents | ai agents explained |
| `/ai-agents-examples/` | ai agents examples | — |
| `/best-ai-agents/` | best ai agents | — |
| `/ai-agents-for-business/` | ai agents for business | — |
| `/enterprise-ai-agents/` | enterprise ai agents | — |
| `/how-to-build-ai-agents/` | how to build ai agents | — |
| `/autonomous-ai-agents/` | autonomous ai agents | — |
| `/private-ai-agents/` | private ai agents | — |
| `/tool-discovery-for-ai-agents/` | tool discovery for ai agents | — |
| `/moltbook-ai-agents/` | moltbook ai agents | ai agents moltbook |
| `/ai-agents-news/` | ai agents news | news 2026, updates, agentic ai breakthroughs 2026, twitter trends 2026 |
| `/shopify-ai-agents-news/` | shopify ai agents news | — |
| `/news/YYYY-MM-DD/` | long-tail daily news | — |
