// Builds the site from fixture content and checks the output like a crawler would.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "aah-build-"));
const SITE = "https://example.test/hub";
const pages = () => fs.readdirSync(OUT, { recursive: true }).map(String).filter((f) => f.endsWith(".html"));
/** @param {string} p */
const read = (p) => fs.readFileSync(path.join(OUT, p), "utf8");

before(() => {
  execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: ROOT, env: { ...process.env, CONTENT_DIR: "tests/fixtures/content", OUT_DIR: OUT, SITE_URL: SITE }, stdio: "pipe" });
});

test("builds every expected route", () => {
  for (const p of ["index.html", "404.html", "what-are-ai-agents/index.html", "ai-agents-examples/index.html", "ai-agents-news/index.html", "shopify-ai-agents-news/index.html", "news/2026-10-04/index.html", "news/2026-10-03/index.html", "sitemap.xml", "robots.txt", "feed.xml"]) {
    assert.ok(fs.existsSync(path.join(OUT, p)), `missing ${p}`);
  }
});

test("every internal link and image resolves to a built file", () => {
  const broken = [];
  for (const p of pages()) {
    for (const [, url] of read(p).matchAll(/(?:href|src)="(\/hub\/[^"#]*)/g)) {
      const rel = decodeURIComponent(url.slice("/hub/".length));
      const target = path.join(OUT, rel);
      const ok = fs.existsSync(target) && (fs.statSync(target).isFile() || fs.existsSync(path.join(target, "index.html")));
      if (!ok) broken.push(`${p} -> ${url}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("links are prefixed with the base path (GitHub Pages project sites)", () => {
  assert.doesNotMatch(read("index.html"), /href="\/(?!\/|hub\/)/);
});

test("each page has one h1, a title, description, canonical and og:image", () => {
  for (const p of pages().filter((f) => f !== "404.html")) {
    const h = read(p);
    assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, `${p} h1 count`);
    assert.match(h, /<title>[^<]+<\/title>/, p);
    assert.match(h, /<meta name="description" content="[^"]+"/, p);
    assert.match(h, new RegExp(`<link rel="canonical" href="${SITE}/`), p);
    assert.match(h, /<meta property="og:image" content="https:\/\//, p);
  }
});

test("all JSON-LD blocks parse, and the guide exposes FAQ + breadcrumbs", () => {
  for (const p of pages()) for (const [, j] of read(p).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(j);
  const guide = read("what-are-ai-agents/index.html");
  assert.match(guide, /"@type":"FAQPage"/);
  assert.match(guide, /"@type":"BreadcrumbList"/);
});

test("no template leaks such as undefined or NaN in visible output", () => {
  for (const p of pages()) assert.doesNotMatch(read(p).replace(/<script[\s\S]*?<\/script>/g, ""), />[^<]*\b(undefined|NaN|\[object Object\])\b/, p);
});

test("pages have viewport, lang, skip link and alt text on every image", () => {
  for (const p of pages()) {
    const h = read(p);
    assert.match(h, /<html lang="[a-z]{2}" dir="(ltr|rtl)">/);
    assert.match(h, /name="viewport"/);
    assert.match(h, /class="skip" href="[^"]*#main"/);
    for (const [img] of h.matchAll(/<img [^>]*>/g)) assert.match(img, /alt="/, `${p}: ${img}`);
  }
});

test("sitemap lists every indexable page once, with absolute urls, and not the 404", () => {
  const sm = read("sitemap.xml");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const indexable = pages().filter((p) => p !== "404.html" && !read(p).includes('content="noindex'));
  assert.equal(locs.length, indexable.length);
  assert.equal(new Set(locs).size, locs.length, "no duplicates");
  assert.ok(locs.every((l) => l.startsWith(`${SITE}/`)));
  assert.ok(!locs.some((l) => l.includes("404")));
});

test("topic page only lists digests with that topic", () => {
  const shop = read("shopify-ai-agents-news/index.html");
  assert.match(shop, /Agents move into checkout/);
  assert.doesNotMatch(shop, /Older digest/);
});

test("missing AI images fall back to generated svg covers", () => {
  assert.ok(fs.existsSync(path.join(OUT, "images/what-are-ai-agents.svg")));
});

test("build fails loudly on an invalid keywords.json instead of publishing a broken site", () => {
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), "aah-cfg-"));
  fs.writeFileSync(path.join(bad, "keywords.json"), JSON.stringify({ site: {}, pages: [] }));
  assert.throws(() => execFileSync(process.execPath, ["scripts/build.mjs"], { cwd: ROOT, env: { ...process.env, CONFIG: path.join(bad, "keywords.json"), CONTENT_DIR: "tests/fixtures/content", OUT_DIR: path.join(bad, "out") }, stdio: "pipe" }));
});

test("raw HTML from AI-written markdown is escaped, not executed", () => {
  // Only the site's own script and JSON-LD data blocks are allowed; nothing from the article body.
  const h = read("ai-agents-examples/index.html").replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "").replace('<script src="/hub/assets/site.js"></script>', "");
  assert.doesNotMatch(h, /<script/i);
  assert.doesNotMatch(h, /<iframe/i);
  assert.doesNotMatch(h, /<img[^>]*onerror/i);
});

test("javascript: links are dropped and external links are nofollow", () => {
  const h = read("ai-agents-examples/index.html");
  assert.doesNotMatch(h, /href="javascript:/i);
  assert.match(h, /<a href="https:\/\/example.com\/ok" rel="nofollow noopener" target="_blank">good<\/a>/);
});

test("Cloudflare Pages _headers sets security headers and long caching for images", () => {
  const h = read("_headers");
  for (const header of ["X-Content-Type-Options: nosniff", "Referrer-Policy: strict-origin-when-cross-origin", "X-Frame-Options: DENY", "Content-Security-Policy:"]) assert.ok(h.includes(header), header);
  assert.match(h, /\/images\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
});

// --- Languages, theme, search, header ------------------------------------------

test("translated pages exist under the language prefix with lang and dir set", () => {
  const es = read("es/what-are-ai-agents/index.html");
  assert.match(es, /<html lang="es" dir="ltr"/);
  assert.match(es, /¿Qué son los agentes de IA\?/);
  const ar = read("ar/what-are-ai-agents/index.html");
  assert.match(ar, /<html lang="ar" dir="rtl"/);
  assert.match(read("index.html"), /<html lang="en" dir="ltr"/);
});

test("every language with content gets a home, news hub, topic page and search page", () => {
  for (const code of ["es", "ar"]) {
    for (const p of ["index.html", "ai-agents-news/index.html", "shopify-ai-agents-news/index.html", "search/index.html"]) {
      assert.ok(fs.existsSync(path.join(OUT, code, p)), `${code}/${p}`);
    }
  }
});

test("UI text is translated on language pages", () => {
  assert.match(read("es/index.html"), /Empieza por lo básico|Empieza con lo básico/);
  assert.match(read("ar/index.html"), /<html lang="ar" dir="rtl">/);
});

test("hreflang alternates are reciprocal and include x-default", () => {
  const en = read("what-are-ai-agents/index.html");
  const es = read("es/what-are-ai-agents/index.html");
  for (const h of [en, es]) {
    assert.match(h, new RegExp(`<link rel="alternate" hreflang="en" href="${SITE}/what-are-ai-agents/">`));
    assert.match(h, new RegExp(`<link rel="alternate" hreflang="es" href="${SITE}/es/what-are-ai-agents/">`));
    assert.match(h, new RegExp(`<link rel="alternate" hreflang="x-default" href="${SITE}/what-are-ai-agents/">`));
  }
  assert.doesNotMatch(en, /<link rel="alternate" hreflang="pt"/, "no alternate for an untranslated page");
});

test("links inside translations point to the translated page when it exists, else to English", () => {
  const es = read("es/what-are-ai-agents/index.html");
  assert.match(es, /href="\/hub\/es\/ai-agents-news\/"/);
  assert.match(es, /href="\/hub\/ai-agents-examples\/"/);
});

test("the language menu offers the same page in each available language", () => {
  const en = read("what-are-ai-agents/index.html");
  const menu = en.slice(en.indexOf('class="lang-menu"'), en.indexOf("</details>", en.indexOf('class="lang-menu"')));
  assert.match(menu, /href="\/hub\/es\/what-are-ai-agents\/"[^>]*hreflang="es"[^>]*>Español/);
  const ex = read("ai-agents-examples/index.html");
  assert.match(ex.slice(ex.indexOf('class="lang-menu"')), /href="\/hub\/es\/"[^>]*>Español/, "untranslated page falls back to that language's home");
  assert.match(menu, /aria-current="true"[^>]*>English/);
  assert.doesNotMatch(menu, /Português|Polski/, "languages with no content are not offered");
  assert.equal((menu.match(/<a /g) || []).length, 3);
});

test("translated pages say they were machine-translated and link the original", () => {
  const es = read("es/what-are-ai-agents/index.html");
  assert.match(es, /class="note translated"/);
  assert.match(es, /href="\/hub\/what-are-ai-agents\/"/);
});

test("language homes list English guides that are not translated yet, marked EN", () => {
  const es = read("es/index.html");
  assert.match(es, /href="\/hub\/ai-agents-examples\/"[^>]*hreflang="en"/);
});

// Regression (Search Console, 4 Oct 2026): 49 empty-language pages were crawled from the menu and reported "Excluded by noindex".
test("languages with no translated content get no pages; their urls redirect to English", () => {
  for (const l of ["pl", "pt", "fr"]) assert.ok(!fs.existsSync(path.join(OUT, l)), `${l}/ should not be built`);
  assert.doesNotMatch(read("es/index.html"), /noindex/);
  const sm = read("sitemap.xml");
  assert.ok(sm.includes(`${SITE}/es/what-are-ai-agents/`));
  assert.ok(!sm.includes(`${SITE}/pl/`));
  const r = read("_redirects");
  assert.match(r, /^\/hub\/pl\/\* \/hub\/:splat 302$/m);
  assert.match(r, /^\/hub\/pl \/hub\/ 302$/m);
  assert.doesNotMatch(r, /\/hub\/(es|ar)\b/, "languages with content are not redirected");
});

test("only the 404 and search pages are noindex, so Search Console has nothing to report", () => {
  const noindex = pages().filter((p) => read(p).includes('content="noindex'));
  assert.deepEqual(noindex.filter((p) => p !== "404.html" && !/(^|\/)search\/index\.html$/.test(p)), []);
});

test("language news hub lists translated digests", () => {
  assert.match(read("es/ai-agents-news/index.html"), /Los agentes llegan al pago/);
  assert.ok(fs.existsSync(path.join(OUT, "es/news/2026-10-04/index.html")));
});

test("theme toggle: button in header, script loaded early, CSS supports both themes", () => {
  const h = read("index.html");
  assert.match(h, /<script src="\/hub\/assets\/site\.js"><\/script>/);
  assert.ok(h.indexOf("site.js") < h.indexOf("<body"), "loaded in head to avoid a flash");
  assert.match(h, /<button[^>]*class="icon-btn theme-toggle"[^>]*aria-label="[^"]+"/);
  const js = read("assets/site.js");
  assert.match(js, /localStorage/);
  assert.match(js, /data-theme|dataset\.theme/);
  assert.match(h, /\[data-theme=["']?dark["']?\]/);
});

test("search page lists every guide and digest for the script to filter", () => {
  const s = read("search/index.html");
  assert.match(s, /<input[^>]*type="search"/);
  assert.match(s, /data-search="[^"]*what are ai agents/i);
  assert.match(s, /href="\/hub\/news\/2026-10-04\/"/);
  assert.match(read("index.html"), /href="\/hub\/search\/"[^>]*aria-label/);
});

test("CSP allows only same-origin scripts", () => {
  const h = read("_headers");
  assert.match(h, /script-src 'self'/);
  assert.doesNotMatch(h, /unsafe-eval/);
});

test("pages have no inline event handlers or inline scripts besides JSON-LD", () => {
  for (const p of pages()) {
    const h = read(p);
    assert.doesNotMatch(h, /\son[a-z]+="/i, p);
    const scripts = [...h.matchAll(/<script(?![^>]*type="application\/ld\+json")(?![^>]*src=)[^>]*>/g)];
    assert.equal(scripts.length, 0, p);
  }
});

// --- Advanced SEO ---------------------------------------------------------------------

test("sitemap has hreflang alternates and images", () => {
  const sm = read("sitemap.xml");
  assert.match(sm, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
  assert.match(sm, /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/);
  const entry = sm.split("<url>").find((u) => u.includes(`<loc>${SITE}/what-are-ai-agents/</loc>`)) ?? "";
  assert.match(entry, new RegExp(`<xhtml:link rel="alternate" hreflang="es" href="${SITE}/es/what-are-ai-agents/"/>`));
  assert.match(entry, /<xhtml:link rel="alternate" hreflang="x-default"/);
  assert.match(entry, /<image:image><image:loc>https:\/\/[^<]+<\/image:loc><\/image:image>/);
});

test("news sitemap lists recent digests in Google News format", () => {
  const ns = read("news-sitemap.xml");
  assert.match(ns, /xmlns:news="http:\/\/www\.google\.com\/schemas\/sitemap-news\/0\.9"/);
  assert.match(ns, new RegExp(`<loc>${SITE}/news/2026-10-04/</loc>`));
  assert.match(ns, /<news:publication><news:name>AI Agents Hub<\/news:name><news:language>en<\/news:language><\/news:publication>/);
  assert.match(ns, /<news:publication_date>2026-10-04<\/news:publication_date>/);
  assert.match(ns, new RegExp(`<loc>${SITE}/es/news/2026-10-04/</loc>[^]*?<news:language>es</news:language>`));
  assert.match(read("robots.txt"), new RegExp(`Sitemap: ${SITE}/news-sitemap.xml`));
});

test("real favicon, logo and web manifest files exist and are linked", () => {
  for (const f of ["favicon.svg", "logo.svg", "site.webmanifest"]) assert.ok(fs.existsSync(path.join(OUT, f)), f);
  const h = read("index.html");
  assert.match(h, /<link rel="icon" href="\/hub\/favicon\.svg" type="image\/svg\+xml">/);
  assert.match(h, /<link rel="manifest" href="\/hub\/site\.webmanifest">/);
  assert.doesNotMatch(h, /rel="icon" href="data:/);
  const m = JSON.parse(read("site.webmanifest"));
  assert.equal(m.name, "AI Agents Hub");
});

test("home has Organization (with logo) and ItemList structured data", () => {
  const types = [...read("index.html").matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const org = types.find((j) => j["@type"] === "Organization");
  assert.ok(org, "Organization");
  assert.match(org.logo.url, /\/logo\.svg$/);
  assert.match(org.url, /^https:\/\//);
  const list = types.find((j) => j["@type"] === "ItemList");
  assert.ok(list && list.itemListElement.length >= 1, "ItemList");
  assert.match(list.itemListElement[0].url, /^https:\/\//);
});

test("articles have rich Article data: author, publisher logo, word count, language", () => {
  const ld = [...read("what-are-ai-agents/index.html").matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((j) => j["@type"] === "Article");
  assert.ok(ld);
  assert.equal(ld.author["@type"], "Organization");
  assert.match(ld.author.url, /\/about\/$/);
  assert.match(ld.publisher.logo.url, /\/logo\.svg$/);
  assert.ok(ld.wordCount > 0);
  assert.equal(ld.inLanguage, "en");
  assert.match(ld.datePublished, /^\d{4}-\d{2}-\d{2}/);
});

test("meta tags for previews: large image preview, image size/alt, article times, twitter", () => {
  const h = read("what-are-ai-agents/index.html");
  assert.match(h, /<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">/);
  assert.match(h, /<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="[^"]+">/);
  assert.match(h, /<meta property="article:modified_time" content="2026-10-01">/);
  assert.match(h, /<meta name="twitter:title" content="[^"]+"><meta name="twitter:description" content="[^"]+">/);
  assert.match(h, /<meta property="og:locale:alternate" content="es_ES">/);
});

test("titles stay under 70 and descriptions under 165 characters", () => {
  for (const p of pages()) {
    const h = read(p);
    const title = (h.match(/<title>([^<]*)<\/title>/) || [])[1] ?? "";
    const desc = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] ?? "";
    const decode = (/** @type {string} */ s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<");
    assert.ok([...decode(title)].length <= 70, `${p} title ${title.length}: ${title}`);
    assert.ok([...decode(desc)].length <= 165, `${p} description ${desc.length}`);
  }
});

test("about page exists in every language, is linked from the footer, and is an AboutPage", () => {
  assert.match(read("about/index.html"), /"@type":"AboutPage"/);
  assert.ok(fs.existsSync(path.join(OUT, "es/about/index.html")));
  assert.match(read("index.html"), /<footer[\s\S]*href="\/hub\/about\/"/);
});

test("news pages link to related guides (internal linking)", () => {
  const n = read("news/2026-10-04/index.html");
  const related = n.slice(n.indexOf('class="related-guides"'));
  assert.match(related, /href="\/hub\/(what-are-ai-agents|ai-agents-examples)\/"/);
});

test("IndexNow key file is published", () => {
  const files = fs.readdirSync(OUT).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
  assert.equal(files.length, 1);
  assert.equal(read(files[0]).trim(), files[0].replace(".txt", ""));
});
