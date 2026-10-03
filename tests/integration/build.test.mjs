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
    assert.match(h, /<html lang="en">/);
    assert.match(h, /name="viewport"/);
    assert.match(h, /class="skip" href="[^"]*#main"/);
    for (const [img] of h.matchAll(/<img [^>]*>/g)) assert.match(img, /alt="/, `${p}: ${img}`);
  }
});

test("sitemap lists every indexable page with absolute urls, and not the 404", () => {
  const sm = read("sitemap.xml");
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.length, pages().length - 1);
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
  const h = read("ai-agents-examples/index.html").replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
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
