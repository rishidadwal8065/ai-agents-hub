// Validates keywords.json so a typo fails the run instead of publishing a broken site.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @param {any} cfg
 * @returns {string[]} human-readable errors; empty when valid
 */
export function validateConfig(cfg) {
  /** @type {string[]} */
  const errors = [];
  if (!cfg || typeof cfg !== "object") return ["config must be an object"];
  /** @param {unknown} v @param {string} where */
  const str = (v, where) => { if (typeof v !== "string" || !v.trim()) errors.push(`${where} must be a non-empty string`); };

  str(cfg.site?.name, "site.name");
  str(cfg.site?.tagline, "site.tagline");
  try { if (!/^https?:$/.test(new URL(cfg.site?.url).protocol)) throw new Error(); } catch { errors.push("site.url must be an absolute http(s) url"); }

  /** @type {Set<string>} */
  const slugs = new Set();
  /** @param {unknown} slug @param {string} where */
  const slug = (slug, where) => {
    if (typeof slug !== "string" || !SLUG.test(slug)) errors.push(`${where}: invalid slug "${slug}"`);
    else if (slugs.has(slug)) errors.push(`${where}: duplicate slug "${slug}"`);
    else slugs.add(slug);
  };

  if (!Array.isArray(cfg.pages) || cfg.pages.length === 0) errors.push("pages must be a non-empty array");
  else cfg.pages.forEach((/** @type {any} */ p, /** @type {number} */ i) => {
    slug(p?.slug, `pages[${i}]`);
    str(p?.keyword, `pages[${i}].keyword`);
    str(p?.angle, `pages[${i}].angle`);
    if (!Array.isArray(p?.also)) errors.push(`pages[${i}].also must be an array`);
  });

  const news = cfg.news;
  if (!news) errors.push("news section is missing");
  else {
    slug(news.hub?.slug, "news.hub");
    if (!Array.isArray(news.feeds) || news.feeds.length === 0) errors.push("news.feeds must be a non-empty array");
    else news.feeds.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
      str(f?.topic, `news.feeds[${i}].topic`);
      if (typeof f?.url !== "string" || !f.url.startsWith("https://")) errors.push(`news.feeds[${i}].url must use https`);
    });
    const topics = new Set((news.feeds ?? []).map((/** @type {any} */ f) => f?.topic));
    (news.topicPages ?? []).forEach((/** @type {any} */ t, /** @type {number} */ i) => {
      slug(t?.slug, `news.topicPages[${i}]`);
      if (!topics.has(t?.topic)) errors.push(`news.topicPages[${i}].topic "${t?.topic}" has no matching feed`);
    });
  }
  return errors;
}

/**
 * @param {string} text
 */
export function loadConfig(text) {
  const cfg = JSON.parse(text);
  const errors = validateConfig(cfg);
  if (errors.length) throw new Error(`keywords.json is invalid:\n- ${errors.join("\n- ")}`);
  return cfg;
}
