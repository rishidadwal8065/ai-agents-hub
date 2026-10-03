// IndexNow tells Bing, Yandex, Seznam, Naver and others about new or changed URLs immediately.
// The key is public by design: it is published at /<key>.txt to prove we own the site.

export const INDEXNOW_KEY = "dcbd1cdf75d4bbfb593e05b668905643";

/**
 * URLs in a sitemap whose <lastmod> is on or after `since` (YYYY-MM-DD).
 * @param {string} sitemapXml
 * @param {string} since
 */
export function changedUrls(sitemapXml, since) {
  return [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((m) => ({ loc: (m[1].match(/<loc>([^<]+)<\/loc>/) || [])[1], lastmod: (m[1].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] }))
    .filter((u) => u.loc && u.lastmod && u.lastmod >= since)
    .map((u) => String(u.loc));
}

/**
 * Request body for https://api.indexnow.org/indexnow (max 10,000 URLs per request).
 * @param {string} site absolute site url
 * @param {string[]} urls
 */
export function indexNowPayload(site, urls) {
  const base = site.replace(/\/$/, "");
  return { host: new URL(base).host, key: INDEXNOW_KEY, keyLocation: `${base}/${INDEXNOW_KEY}.txt`, urlList: urls.slice(0, 10000) };
}
