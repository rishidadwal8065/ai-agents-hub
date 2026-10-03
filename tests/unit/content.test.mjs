import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, toFrontmatter, slugify, esc, strip, titleCase, parseRss, parseAiHeader, isStale, readingMinutes } from "../../src/lib/content.mjs";

test("frontmatter round-trips values, arrays and quotes", () => {
  const meta = { title: 'He said "hi": ok', topics: ["a", "b"], updated: "2026-10-04" };
  const parsed = parseFrontmatter(toFrontmatter(meta) + "Body text\n");
  assert.deepEqual(parsed?.meta, meta);
  assert.equal(parsed?.body, "Body text\n");
});

test("frontmatter returns null for files without a header or with broken values", () => {
  assert.equal(parseFrontmatter("no header"), null);
  assert.equal(parseFrontmatter("---\ntitle: not-json\n---\nx"), null);
});

test("slugify makes url-safe ids", () => {
  assert.equal(slugify("Agents vs <b>Chatbots</b>!"), "agents-vs-chatbots");
  assert.equal(slugify("  FAQ  "), "faq");
});

test("esc escapes html and attribute characters", () => {
  assert.equal(esc(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;>&amp;&lt;/a>");
});

test("strip removes tags and decodes common entities", () => {
  assert.equal(strip("<p>Tom &amp; Jerry&#39;s &quot;show&quot;</p>"), `Tom & Jerry's "show"`);
});

test("titleCase capitalises words and keeps AI uppercase", () => {
  assert.equal(titleCase("what are ai agents"), "What Are AI Agents");
});

test("parseRss reads items, CDATA and entities", () => {
  const xml = `<rss><channel><item><title><![CDATA[Agents &amp; tools]]></title><link>https://a.example/1</link><source url="x">Wire</source><pubDate>Sat, 04 Oct 2026</pubDate></item><item><title>Second</title><link>https://a.example/2</link></item></channel></rss>`;
  const items = parseRss(xml);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { title: "Agents & tools", link: "https://a.example/1", source: "Wire", date: "Sat, 04 Oct 2026" });
  assert.equal(items[1].source, "");
});

test("parseRss drops items whose link is not http(s)", () => {
  assert.equal(parseRss(`<item><title>x</title><link>javascript:alert(1)</link></item>`).length, 0);
});

test("parseAiHeader reads labelled header lines and the body", () => {
  const r = parseAiHeader("TITLE: Big day\nDESC: Short summary\n\n## Body", ["TITLE", "DESC"]);
  assert.deepEqual(r, { fields: { TITLE: "Big day", DESC: "Short summary" }, body: "## Body" });
});

test("parseAiHeader rejects output that is missing a label (regression: description became article text)", () => {
  assert.equal(parseAiHeader("Here is your article\n\n## Body", ["DESC"]), null);
  assert.equal(parseAiHeader("DESC: ok", ["DESC"]), null, "empty body is rejected");
});

test("isStale compares age in days", () => {
  const now = Date.parse("2026-10-04");
  assert.equal(isStale("2026-10-01", 90, now), false);
  assert.equal(isStale("2026-06-01", 90, now), true);
  assert.equal(isStale("not a date", 90, now), true);
});

test("readingMinutes is at least one", () => {
  assert.equal(readingMinutes("one two"), 1);
  assert.equal(readingMinutes("w ".repeat(1100)), 5);
});
