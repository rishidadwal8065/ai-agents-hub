// Static site builder: content/*.md -> dist/ with SEO meta, JSON-LD, images, sitemap and RSS.
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { esc, slugify, parseFrontmatter, readingMinutes, titleCase } from "../src/lib/content.mjs";
import { faqLd, tocHtml as toc, crumbsLd as crumbsFor, coverSvg } from "../src/lib/seo.mjs";
import { loadConfig } from "../src/lib/config.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT = path.resolve(ROOT, process.env.CONTENT_DIR || "content");
const DIST = path.resolve(ROOT, process.env.OUT_DIR || "dist");
const IMG = path.join(CONTENT, "images");
const cfg = loadConfig(fs.readFileSync(process.env.CONFIG || path.join(ROOT, "keywords.json"), "utf8"));
const SITE = (process.env.SITE_URL || cfg.site.url).replace(/\/$/, "");
const BASE = new URL(SITE).pathname.replace(/\/$/, "");
const css = fs.readFileSync(path.join(ROOT, "public/style.css"), "utf8");
const year = new Date().getFullYear();
/** @param {[string, string][]} items */
const crumbsLd = (items) => crumbsFor(SITE, items);

marked.use({ renderer: {
  // H2/H3 get ids so the table of contents can link to them.
  heading({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    return `<h${depth} id="${slugify(text)}">${text}</h${depth}>\n`;
  },
  // Markdown is AI-written (untrusted): show raw HTML as text instead of running it.
  html({ text }) { return esc(text).replace(/>/g, "&gt;"); },
  // Only http(s), mailto and site-relative links; drops javascript: and data: urls.
  link({ href, title, tokens }) {
    const text = this.parser.parseInline(tokens);
    if (!/^(https?:|mailto:|\/|#)/i.test(href)) return text;
    const external = /^https?:/i.test(href) ? ' rel="nofollow noopener" target="_blank"' : "";
    return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ""}${external}>${text}</a>`;
  },
} });

/** @param {string} file */
function read(file) {
  const parsed = parseFrontmatter(fs.readFileSync(file, "utf8"));
  if (!parsed) throw new Error(`${path.relative(ROOT, file)} has no valid front matter`);
  return { meta: parsed.meta, html: String(marked.parse(parsed.body)), minutes: readingMinutes(parsed.body) };
}
/** @param {string} dir */
const mdFiles = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")) : [];

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, "images"), { recursive: true });

// The saved AI picture if there is one, otherwise a generated SVG cover, so every page has an image.
/** @param {string} name @param {string} label */
function cover(name, label) {
  const jpg = path.join(IMG, `${name}.jpg`);
  if (fs.existsSync(jpg)) {
    fs.copyFileSync(jpg, path.join(DIST, "images", `${name}.jpg`));
    return `/images/${name}.jpg`;
  }
  fs.writeFileSync(path.join(DIST, "images", `${name}.svg`), coverSvg(name, label, cfg.site.name));
  return `/images/${name}.svg`;
}

// Only link to pages that exist: guides are written over several days on the free tier.
/** @type {Set<string>} */
const live = new Set(["/", "/ai-agents-news/"]);
const NAV = [["/", "Home"], ["/what-are-ai-agents/", "Basics"], ["/ai-agents-examples/", "Examples"], ["/how-to-build-ai-agents/", "Build"], ["/ai-agents-for-business/", "Business"], ["/ai-agents-news/", "News"]];
/**
 * @typedef {{ meta: Record<string, any>, html: string, minutes: number, image: string }} Entry
 * @typedef {Entry & { slug: string }} Guide
 * @typedef {{ title: string, description: string, body: string, jsonld?: object | object[], date?: string, image?: string }} PageOpts
 */
/** @type {{ loc: string, lastmod?: string }[]} */
const urls = [];
/** @param {string} route @param {PageOpts} o */
function page(route, { title, description, body, jsonld = [], date, image }) {
  const canonical = `${SITE}${route}`;
  urls.push({ loc: canonical, lastmod: date });
  const og = image ? `<meta property="og:image" content="${SITE}${image}"><meta name="twitter:card" content="summary_large_image">` : "";
  const ld = (Array.isArray(jsonld) ? jsonld : [jsonld]).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("");
  const nav = NAV.filter(([h]) => live.has(h)).map(([h, t]) => `<a href="${h}"${h === route ? ' aria-current="page"' : ""}>${t}</a>`).join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#4338ca"><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%236366f1'/%3E%3Ccircle cx='16' cy='16' r='6' fill='white'/%3E%3C/svg%3E">
<meta property="og:site_name" content="${esc(cfg.site.name)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article">${og}
<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="${esc(cfg.site.name)}">${ld}<style>${css}</style></head>
<body><a class="skip" href="#main">Skip to content</a>
<header class="top"><div class="in"><a class="brand" href="/"><i aria-hidden="true"></i>${esc(cfg.site.name)}</a><nav aria-label="Main">${nav}</nav></div></header>
<main id="main" class="wrap">${body}</main>
<footer><div class="in"><span>© ${year} ${esc(cfg.site.name)} · ${esc(cfg.site.tagline)}</span><span><a href="/ai-agents-news/">News</a> · <a href="/feed.xml">RSS</a> · <a href="/sitemap.xml">Sitemap</a></span></div></footer></body></html>`;
  const out = path.join(DIST, route, "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`));
}

/** @param {string} type @param {Record<string, any>} meta @param {string} url @param {string} image */
const articleLd = (type, meta, url, image) => ({ "@context": "https://schema.org", "@type": type, headline: meta.title, description: meta.description, image: `${SITE}${image}`, dateModified: meta.updated || meta.date, datePublished: meta.date || meta.updated, mainEntityOfPage: url, author: { "@type": "Organization", name: cfg.site.name }, publisher: { "@type": "Organization", name: cfg.site.name } });
/** @param {string} src @param {string} alt */
const img = (src, alt, lazy = true) => `<img src="${src}" alt="${esc(alt)}" width="1200" height="630"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'}>`;
/** @param {string} href @param {string} image @param {string} title @param {string} desc */
const card = (href, image, title, desc, label = "") => `<li><a class="card" href="${href}">${img(image, "")}<div>${label ? `<small>${label}</small>` : ""}<strong>${esc(title)}</strong><span>${esc(desc)}</span></div></a></li>`;
/** @param {Entry[]} ds */
const newsList = (ds) => ds.length ? `<ul class="news-list">${ds.map((d) => `<li><a href="/news/${d.meta.date}/">${img(d.image, "")}<div><strong>${esc(d.meta.title)}</strong><span>${fmt(d.meta.date)} · ${d.minutes} min read</span></div></a></li>`).join("")}</ul>` : `<p class="empty">The first daily digest is on its way — check back tomorrow.</p>`;
/** @param {string} d */
const fmt = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** @param {Entry & { route: string, crumbs: [string, string][], type: string, after?: string }} o */
function articlePage({ route, meta, html, minutes, image, crumbs, type, after = "" }) {
  const url = `${SITE}${route}`;
  const trail = crumbs.map(([n, p]) => `<a href="${p}">${esc(n)}</a>`).join(" › ");
  page(route, { title: meta.title, description: meta.description, image, date: meta.updated || meta.date,
    jsonld: [articleLd(type, meta, url, image), crumbsLd([...crumbs, [meta.title, route]]), ...faqLd(html)],
    body: `<div class="article"><article><nav class="crumbs" aria-label="Breadcrumb">${trail}</nav><h1>${esc(meta.title)}</h1>
<p class="meta"><span>${meta.updated ? "Updated" : "Published"} ${fmt(meta.updated || meta.date)}</span><span>${minutes} min read</span></p>
${img(image, meta.title, false).replace("<img", '<img class="hero"')}<div class="prose">${html}</div>
<p class="note">This page is researched and written with AI and refreshed automatically. Check the linked sources before you rely on it.</p>${after}</article>${toc(html)}</div>` });
}

// Evergreen guides
/** @type {Guide[]} */
const guides = [];
for (const f of mdFiles(path.join(CONTENT, "pages"))) {
  const d = read(path.join(CONTENT, "pages", f));
  const slug = f.replace(/\.md$/, "");
  guides.push({ slug, image: cover(slug, d.meta.keyword), ...d });
}
// Order guides the way keywords.json lists them (beginner -> advanced).
/** @type {string[]} */
const order = cfg.pages.map((/** @type {{ slug: string }} */ p) => p.slug);
guides.sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
for (const g of guides) live.add(`/${g.slug}/`);

// News digests, newest first
/** @type {Entry[]} */
const digests = mdFiles(path.join(CONTENT, "news")).sort().reverse().map((f) => {
  const d = read(path.join(CONTENT, "news", f));
  return { ...d, image: cover(`news-${d.meta.date}`, d.meta.title) };
});

for (const g of guides) {
  const related = guides.filter((x) => x !== g).slice(0, 3);
  const after = related.length ? `<div class="sec-head"><h2>Keep reading</h2></div><ul class="grid">${related.map((r) => card(`/${r.slug}/`, r.image, r.meta.title, r.meta.description, "Guide")).join("")}</ul>` : "";
  articlePage({ route: `/${g.slug}/`, ...g, type: "Article", crumbs: [["Home", "/"], ["Guides", "/#guides"]], after });
}
for (const d of digests) {
  articlePage({ route: `/news/${d.meta.date}/`, ...d, type: "NewsArticle", crumbs: [["Home", "/"], ["AI agents news", "/ai-agents-news/"]],
    after: `<div class="sec-head"><h2>More AI agents news</h2><a href="/ai-agents-news/">All digests →</a></div>${newsList(digests.filter((x) => x !== d).slice(0, 4))}` });
}

// News hub + topic pages
const hub = cfg.news.hub;
const hubImg = cover(hub.slug, "AI agents news");
const latest = digests[0];
page(`/${hub.slug}/`, { image: hubImg, date: latest?.meta.date,
  title: `AI Agents News ${year}: Daily Updates & Agentic AI Breakthroughs`,
  description: `Daily AI agents news and updates for ${year}: launches, agentic AI breakthroughs, enterprise adoption and trends from X/Twitter — summarised with sources.`,
  jsonld: crumbsLd([["Home", "/"], ["AI agents news", `/${hub.slug}/`]]),
  body: `<section class="hero-band"><span class="eyebrow">Updated daily</span><h1>AI agents news (${year})</h1><p class="lead">One short, sourced digest a day: launches, agentic AI breakthroughs, enterprise and commerce adoption, and what's trending in agent tools.</p></section>
${latest ? `<div class="sec-head"><h2>Today's digest</h2></div><ul class="grid feature">${card(`/news/${latest.meta.date}/`, latest.image, latest.meta.title, latest.meta.description, fmt(latest.meta.date))}</ul><div class="sec-head"><h2>Archive</h2></div>` : ""}${newsList(digests.slice(1))}` });
for (const t of cfg.news.topicPages) {
  const ds = digests.filter((d) => (d.meta.topics || []).includes(t.topic));
  const title = titleCase(t.keyword);
  page(`/${t.slug}/`, { image: cover(t.slug, t.keyword), date: ds[0]?.meta.date, title: `${title} (${year})`,
    description: `Latest ${t.keyword}: daily digests covering ${t.topic} and AI agents, with links to original sources.`,
    jsonld: crumbsLd([["Home", "/"], ["AI agents news", `/${hub.slug}/`], [title, `/${t.slug}/`]]),
    body: `<section class="hero-band"><nav class="crumbs"><a href="/">Home</a> › <a href="/${hub.slug}/">AI agents news</a></nav><h1>${esc(title)}</h1><p class="lead">Every daily digest that covers ${esc(t.topic)} and AI agents, newest first.</p></section>${newsList(ds)}` });
}

// Home
const start = guides.find((g) => g.slug === "what-are-ai-agents");
page("/", { image: hubImg, date: latest?.meta.date,
  title: `${cfg.site.name}: What AI Agents Are, Examples, How to Build Them & Daily News`,
  description: "Clear guides to AI agents: what they are, real examples, the best tools, how to build them, business and enterprise use — plus daily AI agents news.",
  jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: cfg.site.name, url: SITE },
  body: `<section class="hero-band"><span class="eyebrow">Guides + daily news</span><h1>AI agents, explained simply and tracked daily</h1>
<p class="lead">Learn what AI agents are and how to use or build them, and keep up with the news in five minutes a day.</p>
<div class="cta">${start ? `<a class="btn primary" href="/${start.slug}/">Start with the basics</a>` : ""}<a class="btn${start ? "" : " primary"}" href="/ai-agents-news/">Today's news</a></div>
<ul class="chips">${guides.filter((g) => g !== start).slice(0, 6).map((g) => `<li><a href="/${g.slug}/">${esc(g.meta.keyword)}</a></li>`).join("")}</ul></section>
${start ? `<div class="sec-head"><h2>Start here</h2></div><ul class="grid feature">${card(`/${start.slug}/`, start.image, start.meta.title, start.meta.description, `${start.minutes} min read`)}</ul>` : ""}
<div class="sec-head" id="guides"><h2>Guides</h2></div>${guides.length ? `<ul class="grid">${guides.filter((g) => g !== start).map((g) => card(`/${g.slug}/`, g.image, g.meta.title, g.meta.description, `${g.minutes} min read`)).join("")}</ul>` : `<p class="empty">The guides are being written. The first ones appear after the next daily run.</p>`}
<div class="sec-head"><h2>Latest AI agents news</h2><a href="/ai-agents-news/">All news →</a></div>${newsList(digests.slice(0, 5))}` });

// 404, sitemap, robots, RSS
page("/404/", { title: "Page not found", description: "Not found", body: `<section class="hero-band"><h1>Page not found</h1><p class="lead">That page has moved or never existed.</p><div class="cta"><a class="btn primary" href="/">Go home</a><a class="btn" href="/ai-agents-news/">Latest news</a></div></section>` });
fs.renameSync(path.join(DIST, "404/index.html"), path.join(DIST, "404.html"));
fs.rmSync(path.join(DIST, "404"), { recursive: true });
urls.pop();
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("")}</urlset>`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(DIST, "feed.xml"), `<?xml version="1.0"?><rss version="2.0"><channel><title>${esc(cfg.site.name)}</title><link>${SITE}/</link><description>${esc(cfg.site.tagline)}</description>${digests.slice(0, 20).map((d) => `<item><title>${esc(d.meta.title)}</title><link>${SITE}/news/${d.meta.date}/</link><guid>${SITE}/news/${d.meta.date}/</guid><pubDate>${new Date(d.meta.date).toUTCString()}</pubDate><description>${esc(d.meta.description)}</description></item>`).join("")}</channel></rss>`);
// Cloudflare Pages: security headers for every page, long cache for pictures (names never change).
fs.writeFileSync(path.join(DIST, "_headers"), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
/images/*
  Cache-Control: public, max-age=31536000, immutable
`);
console.log(`built ${urls.length} pages -> dist/`);
