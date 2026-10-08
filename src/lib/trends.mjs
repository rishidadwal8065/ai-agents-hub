// Pure helpers for Google Trends "trending now" feeds. No file system or network access here.
import { strip, slugify } from "./content.mjs";

/** @typedef {{ title: string, link: string, source: string }} TrendNews */
/** @typedef {{ term: string, traffic: string, date: string, news: TrendNews[] }} Trend */

/** @param {string} s @param {string} t */
const tag = (s, t) => strip((s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "").trim();

/**
 * Reads https://trends.google.com/trending/rss?geo=XX. News items without an http(s) link are dropped.
 * @param {string} xml
 * @returns {Trend[]}
 */
export function parseTrendsRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
    term: tag(m[1], "title"),
    traffic: tag(m[1], "ht:approx_traffic"),
    date: tag(m[1], "pubDate"),
    news: [...m[1].matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)]
      .map((n) => ({ title: tag(n[1], "ht:news_item_title"), link: tag(n[1], "ht:news_item_url"), source: tag(n[1], "ht:news_item_source") }))
      .filter((n) => n.title && /^https?:\/\//.test(n.link)),
  })).filter((t) => t.term);
}

/**
 * Trends that started trending within the last `hours`. Items with an unreadable date are dropped.
 * @param {Trend[]} trends @param {number} now @param {number} hours
 */
export const recentTrends = (trends, now, hours) => trends.filter((t) => {
  const at = Date.parse(t.date);
  return !Number.isNaN(at) && now - at <= hours * 36e5 && at <= now + 36e5;
});

/** @param {string} s */
const norm = (s) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/**
 * The first niche term found (as whole words) in the trend itself or its news headlines, or null.
 * Headlines count because a trend like "sam altman" is usually about OpenAI.
 * @param {Trend} trend @param {string[]} niche @param {string[]} [exclude]
 */
export function nicheMatch(trend, niche, exclude = []) {
  const text = norm([trend.term, ...trend.news.map((n) => n.title)].join(" "));
  if (exclude.some((x) => text.includes(norm(x)))) return null;
  return niche.find((k) => text.includes(norm(k))) ?? null;
}

/** @param {string} term */
export const trendKey = (term) => slugify(term).slice(0, 60).replace(/-$/, "");
