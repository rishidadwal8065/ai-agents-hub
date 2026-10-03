// Static site builder: content (English + translations) -> outDir, in 16 languages.
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import { esc, slugify, parseFrontmatter, readingMinutes, titleCase } from "../lib/content.mjs";
import { faqLd, tocHtml, crumbsLd, coverSvg } from "../lib/seo.mjs";
import { LANGUAGES, t, langPath, language, formatDate } from "../lib/i18n.mjs";
import { INDEXNOW_KEY } from "../lib/indexnow.mjs";

/**
 * @typedef {{ meta: Record<string, any>, html: string, minutes: number, words: number, image: string, id: string }} Entry
 * @typedef {{ root: string, contentDir: string, outDir: string, cfg: any, site: string, css: string, js: string }} BuildOptions
 */

const marked = new Marked({ renderer: {
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

const ICON = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  moon: '<svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  chevron: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
};

/** @param {BuildOptions} o */
export function buildSite({ contentDir, outDir, cfg, site, css, js }) {
  const SITE = site.replace(/\/$/, "");
  const BASE = new URL(SITE).pathname.replace(/\/$/, "");
  const year = new Date().getFullYear();
  const codes = LANGUAGES.map((l) => l.code);
  const hub = cfg.news.hub.slug;
  /** @type {string[]} */
  const order = cfg.pages.map((/** @type {any} */ p) => p.slug);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, "images"), { recursive: true });
  fs.mkdirSync(path.join(outDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(outDir, "assets", "site.js"), js);
  // Real icon files: Google only shows a site icon in results when it can crawl one.
  /** @param {number} size */
  const mark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><circle cx="16" cy="16" r="6" fill="#fff"/></svg>`;
  fs.writeFileSync(path.join(outDir, "favicon.svg"), mark(32));
  fs.writeFileSync(path.join(outDir, "logo.svg"), mark(512));
  fs.writeFileSync(path.join(outDir, "site.webmanifest"), JSON.stringify({ name: cfg.site.name, short_name: "AI Agents", description: cfg.site.tagline, start_url: "/", display: "standalone", background_color: "#f8f9fc", theme_color: "#4f46e5", icons: [{ src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }] }, null, 2));
  fs.writeFileSync(path.join(outDir, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);
  const logo = { "@type": "ImageObject", url: `${SITE}/logo.svg`, width: 512, height: 512 };
  const org = { "@type": "Organization", name: cfg.site.name, url: `${SITE}/`, logo, description: cfg.site.tagline };
  /** Shorten at a word boundary so search results do not cut text mid-word. @param {string} s @param {number} n */
  const clip = (s, n) => { const c = [...s]; if (c.length <= n) return s; const cut = c.slice(0, n - 1).join(""); return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), n - 12)).replace(/[\s,;:.\-–—|]+$/, "")}…`; };
  /** Brand suffix only when it fits. @param {string} s */
  const titled = (s) => ([...s].length + cfg.site.name.length + 3 <= 60 ? `${s} | ${cfg.site.name}` : clip(s, 70));

  /** @param {string} file @param {string} id */
  function read(file, id) {
    const parsed = parseFrontmatter(fs.readFileSync(file, "utf8"));
    if (!parsed) throw new Error(`${file} has no valid front matter`);
    return { id, meta: parsed.meta, html: String(marked.parse(parsed.body)), minutes: readingMinutes(parsed.body), words: parsed.body.split(/\s+/).filter(Boolean).length, image: "" };
  }
  /** @param {string} dir @returns {Entry[]} */
  const load = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => read(path.join(dir, f), f.replace(/\.md$/, ""))) : [];

  // The saved AI picture if there is one, otherwise a generated SVG cover. Shared by all languages.
  /** @type {Map<string, string>} */
  const covers = new Map();
  /** @param {string} name @param {string} label */
  function cover(name, label) {
    const known = covers.get(name);
    if (known) return known;
    const jpg = path.join(contentDir, "images", `${name}.jpg`);
    let src = `/images/${name}.svg`;
    if (fs.existsSync(jpg)) { fs.copyFileSync(jpg, path.join(outDir, "images", `${name}.jpg`)); src = `/images/${name}.jpg`; }
    else fs.writeFileSync(path.join(outDir, "images", `${name}.svg`), coverSvg(name, label, cfg.site.name));
    covers.set(name, src);
    return src;
  }

  // ---- Load content ------------------------------------------------------------------------
  /** @type {Record<string, Entry[]>} */ const guides = {};
  /** @type {Record<string, Entry[]>} */ const digests = {};
  for (const lang of codes) {
    const base = lang === "en" ? contentDir : path.join(contentDir, "i18n", lang);
    guides[lang] = load(path.join(base, "pages")).filter((g) => order.includes(g.id)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    digests[lang] = load(path.join(base, "news")).sort((a, b) => String(b.meta.date).localeCompare(String(a.meta.date)));
  }
  for (const g of guides.en) g.image = cover(g.id, g.meta.keyword);
  for (const d of digests.en) d.image = cover(`news-${d.meta.date}`, d.meta.title);
  for (const lang of codes.slice(1)) {
    for (const g of guides[lang]) g.image = cover(g.id, g.meta.keyword);
    for (const d of digests[lang]) d.image = cover(`news-${d.meta.date}`, guides.en.length ? d.meta.title : d.meta.title);
  }
  const hubImg = cover(hub, "AI agents news");

  // Pages that exist in each language, by their English path.
  const shared = ["/", "/about/", `/${hub}/`, ...cfg.news.topicPages.map((/** @type {any} */ tp) => `/${tp.slug}/`), "/search/"];
  /** @type {Record<string, Set<string>>} */
  const exists = {};
  for (const lang of codes) exists[lang] = new Set([...shared, ...guides[lang].map((g) => `/${g.id}/`), ...digests[lang].map((d) => `/news/${d.meta.date}/`)]);
  /** @param {string} lang */
  const hasContent = (lang) => lang === "en" || guides[lang].length > 0 || digests[lang].length > 0;
  /** Languages in which page `key` exists and may be indexed. @param {string} key */
  const versions = (key) => codes.filter((l) => exists[l].has(key) && hasContent(l) && key !== "/search/");

  // ---- Layout --------------------------------------------------------------------------------
  /** @type {{ loc: string, lastmod?: string, key: string, lang: string, image?: string }[]} */
  const urls = [];
  /**
   * @param {string} lang
   * @param {string} key English path of the page, e.g. "/what-are-ai-agents/"
   * @param {{ title: string, description: string, body: string, jsonld?: object | object[], date?: string, image?: string, imageAlt?: string, noindex?: boolean, article?: { published: string, modified: string } }} p
   */
  function page(lang, key, { title: rawTitle, description: rawDesc, body, jsonld = [], date, image, imageAlt, noindex = false, article }) {
    const title = clip(rawTitle, 70);
    const description = clip(rawDesc, 160);
    const L = language(lang);
    const route = langPath(lang, key);
    const canonical = `${SITE}${route}`;
    const index = !noindex && hasContent(lang) && key !== "/search/";
    if (index) urls.push({ loc: canonical, lastmod: date, key, lang, image: image && `${SITE}${image}` });
    const alts = index ? versions(key) : [];
    const hreflang = alts.length > 1 || (alts.length === 1 && alts[0] !== "en")
      ? alts.map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE}${langPath(l, key)}">`).join("") + (alts.includes("en") ? `<link rel="alternate" hreflang="x-default" href="${SITE}${key}">` : "")
      : "";
    const og = (image ? `<meta property="og:image" content="${SITE}${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(imageAlt ?? title)}"><meta name="twitter:card" content="summary_large_image">` : "")
      + `<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}">`
      + alts.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${language(l).locale.replace("-", "_")}">`).join("")
      + (article ? `<meta property="article:published_time" content="${article.published}"><meta property="article:modified_time" content="${article.modified}">` : "");
    const ld = (Array.isArray(jsonld) ? jsonld : [jsonld]).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, "\\u003c")}</script>`).join("");
    /** @param {string} p @param {string} k */
    const navLink = (p, k) => {
      if (!exists.en.has(p)) return "";
      const href = exists[lang].has(p) ? langPath(lang, p) : p;
      return `<a href="${href}"${p === key ? ' aria-current="page"' : ""}>${esc(t(lang, k))}</a>`;
    };
    const nav = [["/", "nav_home"], ["/what-are-ai-agents/", "nav_basics"], ["/ai-agents-examples/", "nav_examples"], ["/how-to-build-ai-agents/", "nav_build"], ["/ai-agents-for-business/", "nav_business"], [`/${hub}/`, "nav_news"]].map(([p, k]) => navLink(p, k)).join("");
    const langMenu = LANGUAGES.map((l) => {
      const href = exists[l.code].has(key) ? langPath(l.code, key) : langPath(l.code, "/");
      return `<a href="${href}" hreflang="${l.code}" lang="${l.code}"${l.code === lang ? ' aria-current="true"' : ""}>${esc(l.name)}</a>`;
    }).join("");
    const footGuides = guides.en.slice(0, 5).map((g) => {
      const tr = guides[lang].find((x) => x.id === g.id);
      return `<li><a href="${tr ? langPath(lang, `/${g.id}/`) : `/${g.id}/`}">${esc((tr ?? g).meta.title)}</a></li>`;
    }).join("");
    const html = `<!doctype html><html lang="${lang}" dir="${L.dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta name="robots" content="${index ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" : "noindex, follow"}">${hreflang}
<meta name="theme-color" content="#4f46e5" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0b0c10" media="(prefers-color-scheme: dark)"><meta name="color-scheme" content="light dark">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/logo.svg"><link rel="manifest" href="/site.webmanifest">
<meta property="og:site_name" content="${esc(cfg.site.name)}"><meta property="og:locale" content="${L.locale.replace("-", "_")}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="${article ? "article" : "website"}">${og}
<link rel="alternate" type="application/rss+xml" href="/feed.xml" title="${esc(cfg.site.name)}">${ld}<script src="/assets/site.js"></script><style>${css}</style></head>
<body><a class="skip" href="#main">${esc(t(lang, "skip"))}</a><div class="progress" aria-hidden="true"></div>
<header class="top"><div class="in"><a class="brand" href="${langPath(lang, "/")}"><i aria-hidden="true"></i><span>${esc(cfg.site.name)}</span></a>
<nav class="main-nav" aria-label="Main">${nav}</nav>
<div class="actions"><a class="icon-btn" href="${langPath(lang, "/search/")}" aria-label="${esc(t(lang, "search"))}">${ICON.search}</a>
<button type="button" class="icon-btn theme-toggle" aria-label="${esc(t(lang, "theme"))}" title="${esc(t(lang, "theme"))}">${ICON.moon}${ICON.sun}</button>
<details class="lang"><summary aria-label="${esc(t(lang, "language"))}">${ICON.globe}<span>${esc(L.name)}</span>${ICON.chevron}</summary><div class="lang-menu" role="list">${langMenu}</div></details></div></div></header>
<main id="main" class="wrap">${body}</main>
<footer><div class="in"><div class="foot-brand"><a class="brand" href="${langPath(lang, "/")}"><i aria-hidden="true"></i><span>${esc(cfg.site.name)}</span></a><p>${esc(t(lang, "tagline"))}</p></div>
<div><h2>${esc(t(lang, "guides"))}</h2><ul>${footGuides}</ul></div>
<div><h2>${esc(t(lang, "nav_news"))}</h2><ul><li><a href="${langPath(lang, `/${hub}/`)}">${esc(t(lang, "news_name"))}</a></li>${cfg.news.topicPages.map((/** @type {any} */ tp) => `<li><a href="${langPath(lang, `/${tp.slug}/`)}">${esc(titleCase(tp.topic))}</a></li>`).join("")}<li><a href="/feed.xml">RSS</a></li></ul></div>
<div><h2>${esc(t(lang, "footer_site"))}</h2><ul><li><a href="${langPath(lang, "/search/")}">${esc(t(lang, "search"))}</a></li><li><a href="${langPath(lang, "/about/")}">${esc(t(lang, "about"))}</a></li><li><a href="/sitemap.xml">Sitemap</a></li><li><a href="#main">${esc(t(lang, "back_to_top"))} ↑</a></li></ul></div></div>
<p class="copy">© ${year} ${esc(cfg.site.name)} · ${esc(t(lang, "stat_langs", { n: LANGUAGES.length }))}</p></footer></body></html>`;
    const out = path.join(outDir, route, "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`));
  }

  // ---- Components ----------------------------------------------------------------------------
  /** @param {string} type @param {Record<string, any>} meta @param {string} url @param {string} image @param {string} lang @param {number} [words] */
  const articleLd = (type, meta, url, image, lang, words = 0) => ({ "@context": "https://schema.org", "@type": type, headline: clip(String(meta.title), 110), description: meta.description, inLanguage: lang, image: { "@type": "ImageObject", url: `${SITE}${image}`, width: 1200, height: 630 }, dateModified: meta.updated || meta.date, datePublished: meta.date || meta.updated, mainEntityOfPage: { "@type": "WebPage", "@id": url }, wordCount: words, ...(meta.keyword ? { keywords: meta.keyword, about: { "@type": "Thing", name: meta.keyword } } : {}), author: { "@type": "Organization", name: cfg.site.name, url: `${SITE}/about/` }, publisher: { ...org, "@type": "Organization" }, isAccessibleForFree: true });
  /** @param {string} name @param {{ url: string, name: string }[]} items */
  const itemList = (name, items) => ({ "@context": "https://schema.org", "@type": "ItemList", name, itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}${it.url}`, name: it.name })) });
  /** @param {string} src @param {string} alt */
  const img = (src, alt, lazy = true) => `<img src="${src}" alt="${esc(alt)}" width="1200" height="630"${lazy ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"'}>`;
  /** @param {string} lang @param {string} href @param {string} image @param {string} title @param {string} desc @param {string} label @param {string} [hl] */
  const card = (lang, href, image, title, desc, label, hl) => `<li><a class="card" href="${href}"${hl ? ` hreflang="${hl}"` : ""}><span class="card-img">${img(image, "")}${hl && hl !== lang ? `<b class="badge">${hl.toUpperCase()}</b>` : ""}</span><span class="card-body"><small>${label}</small><strong>${esc(title)}</strong><span>${esc(desc)}</span></span></a></li>`;
  /** @param {string} lang @param {Entry[]} ds */
  const newsList = (lang, ds) => ds.length
    ? `<ul class="news-list">${ds.map((d) => `<li><a href="${langPath(lang, `/news/${d.meta.date}/`)}">${img(d.image, "")}<span><time datetime="${d.meta.date}">${formatDate(lang, d.meta.date)}</time><strong>${esc(d.meta.title)}</strong><span>${esc(t(lang, "min_read", { n: d.minutes }))}</span></span></a></li>`).join("")}</ul>`
    : `<p class="empty">${esc(t(lang, "empty_news"))}${lang === "en" ? "" : ` <a href="/${hub}/" hreflang="en">${esc(t("en", "news_name"))} →</a>`}</p>`;
  /** In translated html, point internal links at the translated page when it exists. @param {string} lang @param {string} html */
  const localizeLinks = (lang, html) => lang === "en" ? html : html.replace(/href="(\/[^"#]*)(#[^"]*)?"/g, (m, p, hash = "") => exists[lang].has(p) ? `href="${langPath(lang, p)}${hash}"` : `href="${p}${hash}" hreflang="en"`);

  /**
   * @param {string} lang
   * @param {string} key
   * @param {Entry} e
   * @param {string} type
   * @param {[string, string][]} crumbs [label, path] in this language
   * @param {string} after
   */
  function articlePage(lang, key, e, type, crumbs, after) {
    const route = langPath(lang, key);
    const html = localizeLinks(lang, e.html);
    const trail = crumbs.map(([n, p]) => `<a href="${p}">${esc(n)}</a>`).join(`<span aria-hidden="true">›</span>`);
    const note = lang === "en" ? "" : `<p class="note translated">${esc(t(lang, "translated_note"))} <a href="${key}" hreflang="en">${esc(t(lang, "read_original"))}</a></p>`;
    const when = String(e.meta.date || e.meta.updated);
    page(lang, key, { title: titled(String(e.meta.title)), description: e.meta.description, image: e.image, imageAlt: e.meta.title, date: e.meta.updated || e.meta.date,
      article: { published: String(e.meta.date || e.meta.source_updated || e.meta.updated), modified: String(e.meta.updated || when) },
      jsonld: [articleLd(type, e.meta, `${SITE}${route}`, e.image, lang, e.words), crumbsLd(SITE, [...crumbs, [e.meta.title, route]]), ...faqLd(html)],
      body: `<div class="article"><article><nav class="crumbs" aria-label="Breadcrumb">${trail}</nav><h1>${esc(e.meta.title)}</h1>
<p class="meta"><span>${esc(t(lang, e.meta.updated ? "updated" : "published", { d: formatDate(lang, e.meta.updated || e.meta.date) }))}</span><span>${esc(t(lang, "min_read", { n: e.minutes }))}</span></p>
${note}${img(e.image, e.meta.title, false).replace("<img", '<img class="hero"')}<div class="prose">${html}</div>
<p class="note">${esc(t(lang, "ai_note"))}</p>${after}</article>${tocHtml(html).replace("<b>On this page</b>", `<b>${esc(t(lang, "on_this_page"))}</b>`)}</div>` });
  }

  // ---- Pages per language -------------------------------------------------------------------
  for (const lang of codes) {
    const G = guides[lang];
    const D = digests[lang];
    const home = langPath(lang, "/");
    const hubPath = langPath(lang, `/${hub}/`);
    /** Guide in this language if translated, else the English one (marked). @param {Entry} g */
    const pick = (g) => G.find((x) => x.id === g.id) ?? null;
    const missing = guides.en.filter((g) => !pick(g));

    for (const g of G) {
      const related = G.filter((x) => x !== g).slice(0, 3);
      const after = related.length ? `<section><div class="sec-head"><h2>${esc(t(lang, "keep_reading"))}</h2></div><ul class="grid">${related.map((r) => card(lang, langPath(lang, `/${r.id}/`), r.image, r.meta.title, r.meta.description, esc(t(lang, "guide")))).join("")}</ul></section>` : "";
      articlePage(lang, `/${g.id}/`, g, "Article", [[t(lang, "nav_home"), home], [t(lang, "guides"), `${home}#guides`]], after);
    }
    for (const d of D) {
      const text = `${d.meta.title} ${d.html}`.toLowerCase();
      const pool = guides.en.map((g) => pick(g) ?? g);
      const scored = pool.map((g) => ({ g, score: String(g.meta.keyword ?? "").split(" ").filter((w) => w.length > 3 && !["agents", "agent"].includes(w) && text.includes(w)).length }));
      const relatedGuides = [...scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score), ...scored.filter((x) => x.score === 0)].slice(0, 3).map((x) => x.g);
      const relatedHtml = relatedGuides.length ? `<section class="related-guides"><div class="sec-head"><h2>${esc(t(lang, "guides"))}</h2></div><ul class="grid compact">${relatedGuides.map((g) => { const own = G.includes(g); return card(lang, own ? langPath(lang, `/${g.id}/`) : `/${g.id}/`, g.image, g.meta.title, g.meta.description, esc(t(lang, "guide")), own ? undefined : "en"); }).join("")}</ul></section>` : "";
      articlePage(lang, `/news/${d.meta.date}/`, d, "NewsArticle", [[t(lang, "nav_home"), home], [t(lang, "news_name"), hubPath]],
        `${relatedHtml}<section><div class="sec-head"><h2>${esc(t(lang, "more_news"))}</h2><a href="${hubPath}">${esc(t(lang, "all_news"))} →</a></div>${newsList(lang, D.filter((x) => x !== d).slice(0, 4))}</section>`);
    }

    // News hub
    const latest = D[0];
    page(lang, `/${hub}/`, { image: hubImg, date: latest?.meta.date,
      title: lang === "en" ? `AI Agents News ${year}: Daily Updates & Agentic AI Breakthroughs` : titled(t(lang, "news_title", { y: year })),
      description: t(lang, "news_desc", { y: year }),
      jsonld: [crumbsLd(SITE, [[t(lang, "nav_home"), home], [t(lang, "news_name"), hubPath]]), ...(D.length ? [itemList(t(lang, "news_name"), D.slice(0, 20).map((d) => ({ url: langPath(lang, `/news/${d.meta.date}/`), name: String(d.meta.title) })))] : [])],
      body: `<section class="hero-band small"><span class="eyebrow"><i class="dot"></i>${esc(t(lang, "news_eyebrow"))}</span><h1>${esc(t(lang, "news_title", { y: year }))}</h1><p class="lead">${esc(t(lang, "news_lead"))}</p></section>
${latest ? `<div class="sec-head"><h2>${esc(t(lang, "todays_digest"))}</h2></div><ul class="grid feature">${card(lang, langPath(lang, `/news/${latest.meta.date}/`), latest.image, latest.meta.title, latest.meta.description, formatDate(lang, latest.meta.date))}</ul>${D.length > 1 ? `<div class="sec-head"><h2>${esc(t(lang, "archive"))}</h2></div>${newsList(lang, D.slice(1))}` : ""}` : newsList(lang, [])}` });

    // Topic pages
    for (const tp of cfg.news.topicPages) {
      const ds = D.filter((d) => (d.meta.topics || []).includes(tp.topic));
      const title = lang === "en" ? titleCase(tp.keyword) : `${t(lang, "news_name")}: ${titleCase(tp.topic)}`;
      page(lang, `/${tp.slug}/`, { image: cover(tp.slug, tp.keyword), date: ds[0]?.meta.date, title: `${title} (${year})`,
        description: t(lang, "topic_lead", { topic: titleCase(tp.topic) }),
        jsonld: crumbsLd(SITE, [[t(lang, "nav_home"), home], [t(lang, "news_name"), hubPath], [title, langPath(lang, `/${tp.slug}/`)]]),
        body: `<section class="hero-band small"><nav class="crumbs"><a href="${home}">${esc(t(lang, "nav_home"))}</a><span aria-hidden="true">›</span><a href="${hubPath}">${esc(t(lang, "news_name"))}</a></nav><h1>${esc(title)}</h1><p class="lead">${esc(t(lang, "topic_lead", { topic: titleCase(tp.topic) }))}</p></section>${newsList(lang, ds)}` });
    }

    // Search: every item is in the page; site.js filters it as you type. Without JS it is a full index.
    const items = [
      ...G.map((g) => ({ href: langPath(lang, `/${g.id}/`), hl: lang, e: g, label: t(lang, "guide") })),
      ...missing.map((g) => ({ href: `/${g.id}/`, hl: "en", e: g, label: t(lang, "guide") })),
      ...D.map((d) => ({ href: langPath(lang, `/news/${d.meta.date}/`), hl: lang, e: d, label: formatDate(lang, d.meta.date) })),
    ];
    page(lang, "/search/", { image: hubImg, title: `${t(lang, "search")} | ${cfg.site.name}`, description: t(lang, "search_lead"),
      body: `<section class="hero-band small"><h1>${esc(t(lang, "search"))}</h1><p class="lead">${esc(t(lang, "search_lead"))}</p>
<form class="search-box" role="search" action="${langPath(lang, "/search/")}"><label class="sr" for="q">${esc(t(lang, "search"))}</label>${ICON.search}<input id="q" name="q" type="search" placeholder="${esc(t(lang, "search_placeholder"))}" autocomplete="off"></form></section>
<ul class="results">${items.map((i) => `<li data-search="${esc([i.e.meta.title, i.e.meta.description, i.e.meta.keyword ?? "", ...(i.e.meta.topics ?? [])].join(" ").toLowerCase())}"><a href="${i.href}"${i.hl !== lang ? ` hreflang="${i.hl}"` : ""}><small>${esc(i.label)}${i.hl !== lang ? " · EN" : ""}</small><strong>${esc(i.e.meta.title)}</strong><span>${esc(i.e.meta.description)}</span></a></li>`).join("")}</ul>
<p id="no-results" class="empty" hidden>${esc(t(lang, "no_results"))}</p>` });

    // About: who runs the site and how content is made (trust signals for readers and search engines).
    page(lang, "/about/", { image: hubImg, title: titled(t(lang, "about_title")), description: t(lang, "about_text"),
      jsonld: [{ "@context": "https://schema.org", "@type": "AboutPage", name: t(lang, "about_title"), url: `${SITE}${langPath(lang, "/about/")}`, inLanguage: lang, about: org, mainEntity: org }, crumbsLd(SITE, [[t(lang, "nav_home"), home], [t(lang, "about"), langPath(lang, "/about/")]])],
      body: `<section class="hero-band small"><nav class="crumbs"><a href="${home}">${esc(t(lang, "nav_home"))}</a><span aria-hidden="true">›</span><span>${esc(t(lang, "about"))}</span></nav><h1>${esc(t(lang, "about_title"))}</h1><p class="lead">${esc(t(lang, "tagline"))}</p></section>
<div class="prose about"><p>${esc(t(lang, "about_text"))}</p><ul class="stats"><li><b>${guides.en.length}</b> ${esc(t(lang, "stat_guides", { n: "" }).trim())}</li><li><b>${digests.en.length}</b> ${esc(t(lang, "nav_news"))}</li><li><b>${LANGUAGES.length}</b> ${esc(t(lang, "stat_langs", { n: "" }).trim())}</li></ul>
<p><a class="btn primary" href="${hubPath}">${esc(t(lang, "cta_news"))} →</a></p></div>` });

    // Home
    const start = pick({ id: "what-are-ai-agents", meta: {}, html: "", minutes: 0, words: 0, image: "" });
    const rest = G.filter((g) => g !== start);
    const chips = G.length ? `<ul class="chips">${rest.slice(0, 6).map((g) => `<li><a href="${langPath(lang, `/${g.id}/`)}">${esc(g.meta.title.replace(/\s*\(.*\)$/, ""))}</a></li>`).join("")}</ul>` : "";
    page(lang, "/", { image: hubImg, date: (D[0] ?? digests.en[0])?.meta.date,
      title: [...`${cfg.site.name}: ${t(lang, "home_title")}`].length <= 70 ? `${cfg.site.name}: ${t(lang, "home_title")}` : t(lang, "home_title"), description: t(lang, "home_desc"),
      jsonld: [{ "@context": "https://schema.org", "@type": "WebSite", name: cfg.site.name, url: `${SITE}${home}`, inLanguage: lang, publisher: { "@type": "Organization", name: cfg.site.name, url: `${SITE}/` } },
        { "@context": "https://schema.org", ...org },
        ...(G.length ? [itemList(t(lang, "guides"), G.map((g) => ({ url: langPath(lang, `/${g.id}/`), name: String(g.meta.title) })))] : [])],
      body: `<section class="hero-band"><span class="eyebrow"><i class="dot"></i>${esc(t(lang, "hero_eyebrow"))}</span><h1>${esc(t(lang, "hero_title"))}</h1>
<p class="lead">${esc(t(lang, "hero_lead"))}</p>
<div class="cta">${start ? `<a class="btn primary" href="${langPath(lang, "/what-are-ai-agents/")}">${esc(t(lang, "cta_start"))} →</a>` : ""}<a class="btn${start ? "" : " primary"}" href="${hubPath}">${esc(t(lang, "cta_news"))}</a></div>
<ul class="stats"><li><b>${G.length || guides.en.length}</b> ${esc(t(lang, "stat_guides", { n: "" }).trim())}</li><li><b>24h</b> ${esc(t(lang, "stat_daily"))}</li><li><b>${LANGUAGES.length}</b> ${esc(t(lang, "stat_langs", { n: "" }).trim())}</li></ul>${chips}</section>
${start ? `<section><div class="sec-head"><h2>${esc(t(lang, "start_here"))}</h2></div><ul class="grid feature">${card(lang, langPath(lang, `/${start.id}/`), start.image, start.meta.title, start.meta.description, esc(t(lang, "min_read", { n: start.minutes })))}</ul></section>` : ""}
<section><div class="sec-head" id="guides"><h2>${esc(t(lang, "guides"))}</h2></div>${rest.length ? `<ul class="grid">${rest.map((g) => card(lang, langPath(lang, `/${g.id}/`), g.image, g.meta.title, g.meta.description, esc(t(lang, "min_read", { n: g.minutes })))).join("")}</ul>` : `<p class="empty">${esc(t(lang, "empty_guides"))}</p>`}</section>
${lang !== "en" && missing.length ? `<section><div class="sec-head"><h2>${esc(t(lang, "more_in_english"))}</h2></div><ul class="grid compact">${missing.map((g) => card(lang, `/${g.id}/`, g.image, g.meta.title, g.meta.description, esc(t("en", "min_read", { n: g.minutes })), "en")).join("")}</ul></section>` : ""}
<section><div class="sec-head"><h2>${esc(t(lang, "latest_news"))}</h2><a href="${hubPath}">${esc(t(lang, "all_news"))} →</a></div>${newsList(lang, D.slice(0, 5))}</section>` });
  }

  // ---- 404, sitemap, robots, RSS, headers ----------------------------------------------------
  page("en", "/404/", { title: "Page not found", description: "Not found", noindex: true, body: `<section class="hero-band small"><h1>${esc(t("en", "not_found"))}</h1><p class="lead">${esc(t("en", "not_found_lead"))}</p><div class="cta"><a class="btn primary" href="/">${esc(t("en", "go_home"))}</a><a class="btn" href="/${hub}/">${esc(t("en", "cta_news"))}</a></div></section>` });
  fs.renameSync(path.join(outDir, "404/index.html"), path.join(outDir, "404.html"));
  fs.rmSync(path.join(outDir, "404"), { recursive: true });
  // Sitemap with language alternates and images.
  /** @param {string} key */
  const altLinks = (key) => { const v = versions(key); return v.length > 1 ? v.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${langPath(l, key)}"/>`).join("") + (v.includes("en") ? `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${key}"/>` : "") : ""; };
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.map((u) => `<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${altLinks(u.key)}${u.image ? `<image:image><image:loc>${u.image}</image:loc></image:image>` : ""}</url>`).join("")}</urlset>`);
  // Google News sitemap: digests from the last two days (relative to the newest digest), in every language.
  const newest = digests.en[0]?.meta.date ?? "";
  const cutoff = newest ? new Date(Date.parse(newest) - 2 * 864e5).toISOString().slice(0, 10) : "";
  const recent = codes.flatMap((l) => digests[l].filter((d) => String(d.meta.date) >= cutoff && hasContent(l)).map((d) => ({ l, d })));
  fs.writeFileSync(path.join(outDir, "news-sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${recent.map(({ l, d }) => `<url><loc>${SITE}${langPath(l, `/news/${d.meta.date}/`)}</loc><news:news><news:publication><news:name>${esc(cfg.site.name)}</news:name><news:language>${l === "zh" ? "zh-cn" : l}</news:language></news:publication><news:publication_date>${d.meta.date}</news:publication_date><news:title>${esc(d.meta.title)}</news:title></news:news></url>`).join("")}</urlset>`);
  fs.writeFileSync(path.join(outDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\nSitemap: ${SITE}/news-sitemap.xml\n`);
  fs.writeFileSync(path.join(outDir, "feed.xml"), `<?xml version="1.0"?><rss version="2.0"><channel><title>${esc(cfg.site.name)}</title><link>${SITE}/</link><description>${esc(cfg.site.tagline)}</description>${digests.en.slice(0, 20).map((d) => `<item><title>${esc(d.meta.title)}</title><link>${SITE}/news/${d.meta.date}/</link><guid>${SITE}/news/${d.meta.date}/</guid><pubDate>${new Date(d.meta.date).toUTCString()}</pubDate><description>${esc(d.meta.description)}</description></item>`).join("")}</channel></rss>`);
  // Cloudflare Pages: security headers for every page, long cache for pictures (names never change).
  fs.writeFileSync(path.join(outDir, "_headers"), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
/images/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=3600
`);
  return urls.length;
}
