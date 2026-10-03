// Static site builder: content/*.md -> dist/ with SEO meta, JSON-LD, images, sitemap and RSS.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIST = path.join(ROOT, "dist");
const IMG = path.join(ROOT, "content/images");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "keywords.json"), "utf8"));
const SITE = (process.env.SITE_URL || cfg.site.url).replace(/\/$/, "");
const BASE = new URL(SITE).pathname.replace(/\/$/, "");
const css = fs.readFileSync(path.join(ROOT, "public/style.css"), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function read(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => { const i = l.indexOf(":"); return [l.slice(0, i), JSON.parse(l.slice(i + 1))]; }));
  return { meta, html: marked.parse(raw.slice(m[0].length)) };
}
const mdFiles = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")) : [];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "images"), { recursive: true });

// The saved AI picture if there is one, otherwise a generated SVG cover, so every page has an image.
function cover(name, label) {
  const jpg = path.join(IMG, `${name}.jpg`);
  if (fs.existsSync(jpg)) {
    fs.copyFileSync(jpg, path.join(DIST, "images", `${name}.jpg`));
    return `/images/${name}.jpg`;
  }
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const lines = [""];
  for (const w of String(label).split(" ")) {
    const next = `${lines.at(-1)} ${w}`.trim();
    if (next.length > 24 && lines.at(-1)) lines.push(w); else lines[lines.length - 1] = next;
  }
  const circles = [0, 1, 2, 3, 4].map((i) => `<circle cx="${880 + i * 50}" cy="${110 + i * 95}" r="${30 + i * 14}" fill="#fff" opacity=".09"/>`).join("");
  const text = lines.slice(0, 3).map((l, i) => `<text x="80" y="${250 + i * 82}" font-family="system-ui,sans-serif" font-size="68" font-weight="700" fill="#fff">${esc(l)}</text>`).join("");
  fs.writeFileSync(path.join(DIST, "images", `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},65%,45%)"/><stop offset="1" stop-color="hsl(${(h + 60) % 360},65%,28%)"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/>${circles}${text}<text x="80" y="560" font-family="system-ui,sans-serif" font-size="30" fill="#fff" opacity=".8">${esc(cfg.site.name)}</text></svg>`);
  return `/images/${name}.svg`;
}
const hero = (src, alt) => `<img class="hero" src="${src}" alt="${esc(alt)}" width="1200" height="630">`;
const thumb = (src) => `<img src="${src}" alt="" width="1200" height="630" loading="lazy">`;

const urls = [];
function page(route, { title, description, body, jsonld, date, image }) {
  const canonical = `${SITE}${route}`;
  urls.push({ loc: canonical, lastmod: date });
  const nav = [["/", "Home"], ["/what-are-ai-agents/", "What are AI agents"], ["/how-to-build-ai-agents/", "Build"], ["/ai-agents-news/", "News"]];
  const og = image ? `<meta property="og:image" content="${SITE}${image}"><meta name="twitter:card" content="summary_large_image">` : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article">${og}
<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="${esc(cfg.site.name)}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}<style>${css}</style></head>
<body><header><a class="brand" href="/">${esc(cfg.site.name)}</a><nav>${nav.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}</nav></header>
<main>${body}</main><footer><p>${esc(cfg.site.name)} — ${esc(cfg.site.tagline)}. Articles and images are AI-generated and updated automatically; check sources before acting.</p></footer></body></html>`;
  const withBase = html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`);
  const out = path.join(DIST, route, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, withBase);
}

const article = (meta, url, image) => ({ "@context": "https://schema.org", "@type": "Article", headline: meta.title, description: meta.description, image: `${SITE}${image}`, dateModified: meta.updated || meta.date, datePublished: meta.date || meta.updated, mainEntityOfPage: url, publisher: { "@type": "Organization", name: cfg.site.name } });

// Evergreen guides
const guides = [];
for (const f of mdFiles(path.join(ROOT, "content/pages"))) {
  const { meta, html } = read(path.join(ROOT, "content/pages", f));
  const slug = f.replace(/\.md$/, "");
  const image = cover(slug, meta.keyword);
  guides.push({ slug, image, ...meta });
  page(`/${slug}/`, { ...meta, image, date: meta.updated, jsonld: article(meta, `${SITE}/${slug}/`, image),
    body: `<article><h1>${esc(meta.title)}</h1><p class="meta">Updated ${meta.updated}</p>${hero(image, meta.title)}${html}</article>` });
}

// News digests, newest first
const digests = mdFiles(path.join(ROOT, "content/news")).sort().reverse().map((f) => ({ f, ...read(path.join(ROOT, "content/news", f)) }));
for (const d of digests) {
  d.image = cover(`news-${d.meta.date}`, d.meta.title);
  page(`/news/${d.meta.date}/`, { ...d.meta, image: d.image, jsonld: { ...article(d.meta, `${SITE}/news/${d.meta.date}/`, d.image), "@type": "NewsArticle" },
    body: `<article><p class="meta"><a href="/ai-agents-news/">AI agents news</a> · ${d.meta.date}</p><h1>${esc(d.meta.title)}</h1>${hero(d.image, d.meta.title)}${d.html}</article>` });
}
const list = (ds) => ds.length ? `<ul class="cards">${ds.map((d) => `<li><a href="/news/${d.meta.date}/">${thumb(d.image)}<strong>${esc(d.meta.title)}</strong><span>${d.meta.date} — ${esc(d.meta.description)}</span></a></li>`).join("")}</ul>` : `<p class="empty">The first digest is being written — check back tomorrow.</p>`;
const year = new Date().getFullYear();
const hub = cfg.news.hub;
const hubImg = cover(hub.slug, "AI agents news");
page(`/${hub.slug}/`, { image: hubImg, title: `AI Agents News ${year}: Daily Updates & Agentic AI Breakthroughs`, date: digests[0]?.meta.date,
  description: `Daily AI agents news and updates for ${year}: launches, agentic AI breakthroughs, enterprise adoption and trends from X/Twitter — summarised with sources.`,
  body: `<h1>AI agents news (${year})</h1>${hero(hubImg, "AI agents news")}<p class="lead">A daily, sourced digest of AI agents updates: product launches, agentic AI breakthroughs, enterprise and commerce adoption, and what's trending in agentic tools.</p>${digests[0] ? `<h2>Latest: ${esc(digests[0].meta.title)}</h2>${digests[0].html}<h2>Archive</h2>` : ""}${list(digests.slice(1))}` });
for (const t of cfg.news.topicPages) {
  const ds = digests.filter((d) => (d.meta.topics || []).includes(t.topic));
  const image = cover(t.slug, t.keyword);
  page(`/${t.slug}/`, { image, title: `${t.keyword.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAi\b/g, "AI")} (${year})`, date: ds[0]?.meta.date,
    description: `Latest ${t.keyword}: daily digests covering ${t.topic} and AI agents, with links to original sources.`,
    body: `<h1>${esc(t.keyword.replace(/^\w/, (c) => c.toUpperCase()))}</h1>${hero(image, t.keyword)}<p class="lead">Digests that include ${esc(t.topic)} AI agent stories.</p>${list(ds)}` });
}

// Home
page("/", { image: hubImg, title: `${cfg.site.name} — What AI Agents Are, Examples, How to Build Them & Daily News`, date: digests[0]?.meta.date,
  description: "Clear guides to AI agents: what they are, examples, the best tools, how to build them, business and enterprise use — plus daily AI agents news.",
  jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: cfg.site.name, url: SITE },
  body: `<h1>AI agents, explained — and tracked daily</h1><p class="lead">${esc(cfg.site.tagline)}.</p>
<h2>Guides</h2>${guides.length ? `<ul class="cards">${guides.map((g) => `<li><a href="/${g.slug}/">${thumb(g.image)}<strong>${esc(g.title)}</strong><span>${esc(g.description)}</span></a></li>`).join("")}</ul>` : `<p class="empty">Guides are being written.</p>`}
<h2>Latest AI agents news</h2>${list(digests.slice(0, 5))}` });

// 404, sitemap, robots, RSS
page("/404/", { title: "Page not found", description: "Not found", body: `<h1>Page not found</h1><p><a href="/">Go home</a></p>` });
fs.renameSync(path.join(DIST, "404/index.html"), path.join(DIST, "404.html"));
fs.rmSync(path.join(DIST, "404"), { recursive: true });
urls.pop();
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("")}</urlset>`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, "feed.xml"), `<?xml version="1.0"?><rss version="2.0"><channel><title>${esc(cfg.site.name)}</title><link>${SITE}/</link><description>${esc(cfg.site.tagline)}</description>${digests.slice(0, 20).map((d) => `<item><title>${esc(d.meta.title)}</title><link>${SITE}/news/${d.meta.date}/</link><guid>${SITE}/news/${d.meta.date}/</guid><pubDate>${new Date(d.meta.date).toUTCString()}</pubDate><description>${esc(d.meta.description)}</description></item>`).join("")}</channel></rss>`);
fs.writeFileSync(path.join(DIST, ".nojekyll"), "");
console.log(`built ${urls.length} pages -> dist/`);
