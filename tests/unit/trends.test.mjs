import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTrendsRss, recentTrends, nicheMatch, trendKey } from "../../src/lib/trends.mjs";

/** @param {string} term @param {string} date @param {string[][]} [news] */
const item = (term, date, news = []) => `<item><title>${term}</title><ht:approx_traffic>2000+</ht:approx_traffic><pubDate>${date}</pubDate>${news.map(([t, u, s]) => `<ht:news_item><ht:news_item_title><![CDATA[${t}]]></ht:news_item_title><ht:news_item_url>${u}</ht:news_item_url><ht:news_item_source>${s}</ht:news_item_source></ht:news_item>`).join("")}</item>`;

test("parses trends with their news items and drops bad links", () => {
  const xml = `<rss><channel>${item("openai devday", "Wed, 08 Oct 2026 10:00:00 +0000", [["OpenAI launches agents", "https://n.example/1", "Wire"], ["bad", "javascript:x", "X"]])}</channel></rss>`;
  const [t] = parseTrendsRss(xml);
  assert.equal(t.term, "openai devday");
  assert.equal(t.traffic, "2000+");
  assert.deepEqual(t.news, [{ title: "OpenAI launches agents", link: "https://n.example/1", source: "Wire" }]);
});

test("keeps only trends from the last N hours", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  const trends = parseTrendsRss([item("a", "Wed, 08 Oct 2026 09:00:00 +0000"), item("b", "Wed, 08 Oct 2026 07:00:00 +0000"), item("c", "not a date")].join(""));
  assert.deepEqual(recentTrends(trends, now, 4).map((t) => t.term), ["a"]);
});

test("niche filter matches whole words in the term or headlines, and honours excludes", () => {
  /** @param {string} term @param {string[]} [titles] */
  const t = (term, titles = []) => ({ term, traffic: "", date: "", news: titles.map((title) => ({ title, link: "https://x", source: "" })) });
  const niche = ["openai", "ai agent", "chatgpt"];
  assert.equal(nicheMatch(t("how to make sushi"), niche), null);
  assert.equal(nicheMatch(t("sam altman", ["Sam Altman says OpenAI will ship"]), niche), "openai");
  assert.equal(nicheMatch(t("Meta AI Agent launch"), niche), "ai agent");
  assert.equal(nicheMatch(t("chatgptx"), niche), null, "no partial words");
  assert.equal(nicheMatch(t("chatgpt stock"), niche, ["stock"]), null);
});

test("trend keys are url-safe", () => {
  assert.equal(trendKey("OpenAI DevDay 2026!"), "openai-devday-2026");
});
