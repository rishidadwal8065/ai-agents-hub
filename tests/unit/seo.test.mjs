import { test } from "node:test";
import assert from "node:assert/strict";
import { faqLd, tocHtml, crumbsLd, coverSvg } from "../../src/lib/seo.mjs";

const html = `<h2 id="how-it-works">How it works</h2><p>x</p><h2 id="limits">Limits</h2><h2 id="faq">FAQ</h2><h3 id="q1">Is it safe?</h3>\n<p>Mostly <b>yes</b>.</p><h3 id="q2">Cost?</h3><p>Varies.</p>`;

test("faqLd builds FAQPage from the FAQ section", () => {
  const [ld] = faqLd(html);
  assert.equal(ld["@type"], "FAQPage");
  assert.deepEqual(ld.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), [["Is it safe?", "Mostly yes."], ["Cost?", "Varies."]]);
});

test("faqLd returns nothing without a FAQ section", () => {
  assert.deepEqual(faqLd("<h2 id=\"x\">X</h2>"), []);
});

test("tocHtml lists h2 headings and skips short pages", () => {
  assert.match(tocHtml(html), /href="#how-it-works">How it works/);
  assert.equal(tocHtml(`<h2 id="a">A</h2><h2 id="b">B</h2>`), "");
});

test("crumbsLd numbers items with absolute urls", () => {
  const ld = crumbsLd("https://s.example", [["Home", "/"], ["News", "/news/"]]);
  assert.deepEqual(ld.itemListElement[1], { "@type": "ListItem", position: 2, name: "News", item: "https://s.example/news/" });
});

test("coverSvg is a valid, escaped, deterministic svg", () => {
  const a = coverSvg("slug-a", "Agents <&> tools for business owners today", "Hub");
  assert.match(a, /^<svg[\s\S]*<\/svg>$/);
  assert.ok(a.includes("&lt;&amp;&gt;") || a.includes("&lt;&amp;>"), "label is escaped");
  assert.equal(a, coverSvg("slug-a", "Agents <&> tools for business owners today", "Hub"));
  assert.notEqual(a, coverSvg("slug-b", "Agents <&> tools for business owners today", "Hub"));
});
