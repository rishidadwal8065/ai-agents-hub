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
$0: public GitHub repo (free Actions + Pages) and GitHub Models free tier. Optional custom domain ~$10/year.
