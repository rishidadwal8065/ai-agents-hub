# AI Agents Hub

A website that runs itself. It targets the "ai agents" keywords listed in `keywords.json`.

- `npm run generate` uses a free AI model (GitHub Models, no key needed) to write 10 guide pages once (and rewrites each one every 90 days), plus one news digest a day built from Google News RSS headlines.
- `npm run build` turns the content into a static site in `dist/` with canonical tags, JSON-LD, a sitemap, robots.txt and an RSS feed.
- `.github/workflows/auto.yml` runs both steps every day, commits the new content and deploys to GitHub Pages.

## One-time setup
1. Create a GitHub repo and push this folder to `main`.
2. Settings → Secrets → Actions: add `ANTHROPIC_API_KEY`.
3. Settings → Pages → Source: **GitHub Actions**.
4. (Optional) Custom domain: set the repo variable `SITE_URL`, e.g. `https://aiagentshub.com`.
5. Actions → "Generate, build and deploy" → Run workflow (first run). After that it runs daily.
6. Add the site to Google Search Console and submit `/sitemap.xml`.

To target more keywords, add entries to `keywords.json`.

## Cost
$0: public GitHub repo (free Actions + Pages), GitHub Models free tier for text, pictures are watermark-free generated covers, or Cloudflare Workers AI (free tier) if you add the two CF secrets. Optional custom domain ~$10/year.

## Watermark-free AI pictures (optional, free)
1. Create a free Cloudflare account at dash.cloudflare.com.
2. Copy your **Account ID** (right side of the dashboard home page).
3. My Profile → API Tokens → Create Token → template **"Workers AI"** → create, then copy the token.
4. In the GitHub repo: Settings → Secrets → Actions → add `CF_ACCOUNT_ID` and `CF_API_TOKEN`.
Without these, every page uses the site's own generated covers (also no watermark).
