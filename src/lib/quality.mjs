// Quality gates for AI-written content (pure). Weak output is retried once, cleaned, or not published.

const GENERIC_WORDS = /\b(news|digest|updates?|roundup|round-up|recap|latest|today'?s|daily|weekly|in the news|headlines|developments)\b/gi;
const FILLER = /^(in today's (fast-paced|digital|ever-changing|rapidly evolving) (world|landscape|age)|in conclusion|to sum up|in summary|as we all know|it is important to note that|in the ever-evolving world of [^,]+),?\s*/i;

/**
 * True when a digest title says nothing about the actual stories ("AI Agents in the News").
 * @param {string} title
 */
export function isGenericTitle(title) {
  const words = title.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean);
  const meaningful = title.replace(GENERIC_WORDS, " ").toLowerCase().replace(/\b(ai|agents?|agentic|the|a|an|in|on|of|and|for|to|:|-)\b/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return words.length < 4 || meaningful.split(" ").filter((w) => w.length > 2).length < 2;
}

/**
 * A digest title from the top headline, without the " - Source" suffix Google News adds.
 * @param {string} headline
 */
export function fallbackDigestTitle(headline) {
  const clean = headline.replace(/\s+[-–|]\s+[^-–|]{2,40}$/, "").trim();
  const chars = [...clean];
  if (chars.length <= 70) return clean;
  const cut = chars.slice(0, 69).join("");
  return `${cut.slice(0, cut.lastIndexOf(" ")).trim()}…`;
}

/**
 * True when every significant word of the keyword appears in the title.
 * @param {string} title
 * @param {string} keyword
 */
export function titleHasKeyword(title, keyword) {
  const t = title.toLowerCase();
  return keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 1).every((w) => t.includes(w.replace(/s$/, "")));
}

/**
 * Problems that make a guide not worth publishing as-is. Empty array = good.
 * @param {string} md
 * @returns {string[]}
 */
export function guideIssues(md) {
  /** @type {string[]} */
  const issues = [];
  const words = md.split(/\s+/).filter(Boolean).length;
  if (words < 700) issues.push(`only ${words} words; write at least 1,200 words`);
  if (!/^\|.+\|\s*\n\|\s*:?-{3,}/m.test(md)) issues.push("no comparison table; add one Markdown table");
  if (!/^##\s+(FAQ|Frequently asked questions)\b/im.test(md) || !/^###\s+.+\?\s*$/m.test(md)) issues.push('no "## FAQ" section with "### Question?" items');
  if (/^#\s/m.test(md)) issues.push("contains an H1; use H2/H3 only");
  if (md.split("\n").some((l) => FILLER.test(l.trim()))) issues.push("filler phrases (e.g. \"In today's fast-paced world\", \"In conclusion\"); remove them");
  return issues;
}

/**
 * Deterministic clean-up: drop "Introduction"/"Overview" headings, rename "Conclusion",
 * strip filler openers.
 * @param {string} md
 */
export function cleanGuide(md) {
  return md
    .replace(/^##\s+(Introduction|Overview)\b.*\n+/gim, "")
    .replace(/^##\s+(Conclusion|Final thoughts|Wrapping up)\b.*$/gim, "## Key takeaways")
    .split("\n")
    .map((line) => {
      const m = line.match(FILLER);
      if (!m) return line;
      const rest = line.slice(m[0].length);
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    })
    .join("\n")
    .trim();
}
