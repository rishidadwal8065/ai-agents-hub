// Pure helpers for reading and writing content. No file system or network access here.

/** @typedef {Record<string, unknown>} Meta */

/** @param {Meta} meta */
export function toFrontmatter(meta) {
  return "---\n" + Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n") + "\n---\n\n";
}

/**
 * Front matter is one `key: <json>` per line. Returns null if the header is missing or malformed.
 * @param {string} raw
 * @returns {{ meta: Record<string, any>, body: string } | null}
 */
export function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  /** @type {Record<string, any>} */
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i < 1) return null;
    try { meta[line.slice(0, i).trim()] = JSON.parse(line.slice(i + 1)); } catch { return null; }
  }
  return { meta, body: raw.slice(m[0].length).replace(/^\r?\n/, "") };
}

/** @param {unknown} s */
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** @param {unknown} s */
export const strip = (s) => String(s).replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** @param {string} s */
export const slugify = (s) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** @param {string} s */
export const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAi\b/g, "AI");

/** @param {string} md */
export const readingMinutes = (md) => Math.max(1, Math.round(md.split(/\s+/).filter(Boolean).length / 220));

/**
 * @param {string} isoDate
 * @param {number} days
 * @param {number} [now]
 */
export function isStale(isoDate, days, now = Date.now()) {
  const t = Date.parse(isoDate);
  return Number.isNaN(t) || (now - t) / 864e5 >= days;
}

/** @typedef {{ title: string, link: string, source: string, date: string }} RssItem */

/**
 * Minimal RSS reader for Google News feeds. Items without an http(s) link are dropped.
 * @param {string} xml
 * @returns {RssItem[]}
 */
export function parseRss(xml) {
  /** @param {string} s @param {string} t */
  const tag = (s, t) => strip((s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") ?? "").trim();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => ({ title: tag(m[1], "title"), link: tag(m[1], "link"), source: tag(m[1], "source"), date: tag(m[1], "pubDate") }))
    .filter((it) => it.title && /^https?:\/\//.test(it.link));
}

/**
 * AI output starts with `LABEL: value` lines, then a blank line and the body.
 * Returns null unless every label is present and the body is non-empty, so bad output is never published.
 * @param {string} text
 * @param {string[]} labels
 * @returns {{ fields: Record<string, string>, body: string } | null}
 */
export function parseAiHeader(text, labels) {
  const lines = text.trim().split(/\r?\n/);
  /** @type {Record<string, string>} */
  const fields = {};
  for (const [i, label] of labels.entries()) {
    const m = (lines[i] ?? "").match(new RegExp(`^\\**${label}:\\**\\s*(.+)$`));
    if (!m) return null;
    fields[label] = m[1].trim().replace(/^"|"$/g, "");
  }
  const body = lines.slice(labels.length).join("\n").trim();
  return body ? { fields, body } : null;
}
