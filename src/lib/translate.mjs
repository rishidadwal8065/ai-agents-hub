// Which translations to make next (pure), and a guard that translations keep every link.

/**
 * @typedef {{ id: string, updated: string }} Source
 * @typedef {{ lang: string, kind: "news" | "pages", id: string, updated: string }} Job
 */

/**
 * Plan this run's translations within the free daily budget.
 * Order: the newest digest in the news languages, then guides one language at a time
 * (so each language becomes complete before the next starts). Translations whose
 * source_updated matches the English page are skipped; outdated ones are redone.
 * @param {{ guides: Source[], digests: Source[], languages: string[], newsLanguages: string[], max: number, existing: Map<string, string> }} o
 * @returns {Job[]}
 */
export function planTranslations({ guides, digests, languages, newsLanguages, max, existing }) {
  /** @type {Job[]} */
  const jobs = [];
  /** @param {string} lang @param {"news" | "pages"} kind @param {Source} s */
  const want = (lang, kind, s) => { if (existing.get(`${lang}/${kind}/${s.id}`) !== s.updated) jobs.push({ lang, kind, id: s.id, updated: s.updated }); };
  const newest = [...digests].sort((a, b) => b.id.localeCompare(a.id))[0];
  if (newest) for (const lang of newsLanguages) want(lang, "news", newest);
  for (const lang of languages) for (const g of guides) want(lang, "pages", g);
  return jobs.slice(0, Math.max(0, max));
}

/**
 * Link and image targets in markdown, sorted.
 * @param {string} md
 */
export function linksOf(md) {
  return [...md.matchAll(/!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)].map((m) => m[1]).sort();
}

/**
 * True when the translation has exactly the same link targets as the source.
 * @param {string} source
 * @param {string} translation
 */
export function sameLinks(source, translation) {
  return JSON.stringify(linksOf(source)) === JSON.stringify(linksOf(translation));
}
