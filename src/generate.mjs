// Content pipeline: writes guides, the daily news digest and pictures into the content folder.
// All network access is injected (complete / fetchFn / image) so it can be tested offline.
import fs from "node:fs";
import path from "node:path";
import { toFrontmatter, parseFrontmatter, parseRss, parseAiHeader, isStale, titleCase } from "./lib/content.mjs";
import { planTranslations, sameLinks } from "./lib/translate.mjs";
import { LANGUAGES, language } from "./lib/i18n.mjs";
import { isGenericTitle, fallbackDigestTitle, guideIssues, cleanGuide, titleHasKeyword } from "./lib/quality.mjs";

export const REFRESH_DAYS = 90;
const MAX_IMAGE_FAILURES = 3;

/**
 * @typedef {(system: string, prompt: string) => Promise<string>} Complete
 * @typedef {(prompt: string) => Promise<Buffer>} ImageFn
 * @typedef {{ cfg: any, contentDir: string, today: string, complete: Complete | null, fetchFn: typeof fetch, image?: ImageFn | null, log?: (msg: string) => void }} Options
 */

/** @param {any} cfg */
const systemPrompt = (cfg) => `You are a senior editor at ${cfg.site.name}, writing for practitioners and business readers who want clear, useful answers about AI agents.
Voice: plain English, confident, specific, no hype. Short paragraphs (2-4 sentences). Active voice. Speak to the reader as "you".
Facts: never invent statistics, quotes, prices, dates, benchmark numbers or product features. Name only well-known real products and companies, and describe them in general terms. If something is uncertain or changing fast, say so.
Format: GitHub-flavoured Markdown only. No front matter. No H1. Never write headings called "Introduction", "Overview" or "Conclusion". Never use filler such as "In today's fast-paced world", "In conclusion", "It is important to note".`;

/** Raised when the writing instructions change, so existing guides are rewritten once. */
export const CONTENT_VERSION = 2;

/** @param {any} p @param {string} today @param {string} links */
const guidePrompt = (p, today, links) => `Write an in-depth guide (1,500-2,200 words) that ranks for the Google search "${p.keyword}"${p.also.length ? ` and also answers: ${p.also.join(", ")}` : ""}.
Angle: ${p.angle}
Today is ${today}.

Structure, in this order:
1. A 2-3 sentence direct answer to "${p.keyword}" as the first paragraph (this is what Google may quote).
2. "## Key takeaways": 4-5 short bullets.
3. 5-8 H2 sections whose headings are specific and useful (for example "How an AI agent decides what to do next", not "Overview"). Use H3s inside where helpful.
4. At least one Markdown comparison table with 3+ rows.
5. Concrete examples: real scenarios with a role, a task and the result.
6. Where it fits the topic: a numbered step-by-step section, and a "## Common mistakes" section.
7. "## FAQ" with 4-6 real search questions as "### Question?" and 2-3 sentence answers.
Link naturally to 2-4 of these related pages, using exactly these relative links:
${links}

Output format:
Line 1: "TITLE: " + an SEO title of at most 60 characters that contains "${p.keyword}" and promises a clear benefit (no year in brackets, no clickbait).
Line 2: "DESC: " + a meta description of at most 155 characters with the keyword and a reason to click.
Then a blank line and the article.`;

/** @param {string} file */
function readMeta(file) {
  return fs.existsSync(file) ? parseFrontmatter(fs.readFileSync(file, "utf8"))?.meta ?? null : null;
}

/**
 * Asks for a guide, retries once with the list of problems, cleans it, and returns null if it is still weak.
 * @param {Complete} complete
 * @param {string} system
 * @param {string} prompt
 * @param {(m: string) => void} log
 * @param {string} slug
 */
async function writeGuide(complete, system, prompt, log, slug) {
  /** @param {string} text */
  const parse = (text) => parseAiHeader(text, ["TITLE", "DESC"]) ?? parseAiHeader(text, ["DESC"]);
  let out = parse(await complete(system, prompt));
  let issues = out ? guideIssues(out.body) : ["the first lines must be TITLE: and DESC:"];
  if (issues.length) {
    log(`page ${slug}: retrying (${issues.join("; ")})`);
    out = parse(await complete(system, `${prompt}\n\nYour previous draft was rejected. Fix these problems:\n- ${issues.join("\n- ")}`));
    issues = out ? guideIssues(out.body) : ["no TITLE/DESC lines"];
  }
  if (!out) return null;
  const body = cleanGuide(out.body);
  // Headings and filler are fixed by cleanGuide; length, table and FAQ cannot be fixed automatically.
  const hard = guideIssues(body).filter((i) => !i.includes("filler") && !i.includes("H1"));
  if (hard.length) { log(`page ${slug}: not published (${hard.join("; ")})`); return null; }
  return { fields: out.fields, body };
}

/** @param {Options} o */
async function guides({ cfg, contentDir, today, complete, log = console.log }) {
  if (!complete) return;
  const links = [...cfg.pages.map((/** @type {any} */ p) => `- [${p.keyword}](/${p.slug}/)`), "- [ai agents news](/ai-agents-news/)"].join("\n");
  for (const p of cfg.pages) {
    const file = path.join(contentDir, "pages", `${p.slug}.md`);
    const meta = readMeta(file);
    const current = meta && Number(meta.version ?? 1) >= CONTENT_VERSION;
    if (current && !isStale(meta.updated, REFRESH_DAYS, Date.parse(today))) continue;
    try {
      const out = await writeGuide(complete, systemPrompt(cfg), guidePrompt(p, today, links), log, p.slug);
      if (!out) continue;
      const aiTitle = (out.fields.TITLE ?? "").trim();
      const title = aiTitle && [...aiTitle].length <= 70 && titleHasKeyword(aiTitle, p.keyword) ? aiTitle : `${titleCase(p.keyword)}: A Practical Guide (${today.slice(0, 4)})`;
      fs.writeFileSync(file, toFrontmatter({ title, description: out.fields.DESC.slice(0, 160), keyword: p.keyword, updated: today, version: CONTENT_VERSION }) + out.body + "\n");
      log(`page ${p.slug}: written`);
    } catch (e) {
      // Free tiers rate-limit; leave this page for the next run.
      log(`page ${p.slug}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/** @param {Options} o */
async function news({ cfg, contentDir, today, complete, fetchFn, log = console.log }) {
  if (!complete) return;
  const out = path.join(contentDir, "news", `${today}.md`);
  if (fs.existsSync(out)) return log("news: today's digest exists");
  const seenFile = path.join(contentDir, "news", "seen.json");
  /** @type {Set<string>} */
  const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, "utf8")) : []);
  // A headline can appear in several feeds; keep it once but remember every topic it belongs to.
  /** @type {Map<string, import("./lib/content.mjs").RssItem & { topics: Set<string> }>} */
  const fresh = new Map();
  for (const f of cfg.news.feeds) {
    try {
      const res = await fetchFn(f.url, { headers: { "user-agent": "Mozilla/5.0 ai-agents-hub" }, signal: AbortSignal.timeout(30000) });
      for (const it of parseRss(await res.text()).slice(0, 25)) {
        if (seen.has(it.title)) continue;
        const known = fresh.get(it.title);
        if (known) known.topics.add(f.topic); else fresh.set(it.title, { ...it, topics: new Set([f.topic]) });
      }
    } catch (e) { log(`feed ${f.topic}: ${e instanceof Error ? e.message : e}`); }
  }
  const items = [...fresh.values()];
  if (items.length < 3) return log("news: not enough new headlines today");
  const list = items.slice(0, 40).map((it, i) => `${i + 1}. [${[...it.topics].join(", ")}] ${it.title} — ${it.source} — ${it.date} — ${it.link}`).join("\n");
  const parsed = parseAiHeader(await complete(systemPrompt(cfg), `Write today's (${today}) AI agents news digest using ONLY the headlines below. You only have headlines, not full articles, so never claim details beyond what a headline says.

Structure:
1. A 2-sentence opening that names the day's biggest story.
2. "## Top stories": the 3 most important stories, 2-3 sentences each, each ending with the source link as [Source name](link).
3. 2-4 themed H2 sections (for example "## Enterprise adoption", "## Commerce and Shopify", "## Research and breakthroughs", "## Safety and policy") covering the other notable stories in 1-2 sentences each, with source links. Skip duplicates and minor items.
4. "## What it means": 3-4 bullets of analysis for practitioners, clearly your interpretation.

Output format:
Line 1: "TITLE: " + a specific headline (at most 70 characters) that names the top 1-2 stories with companies or products, like a news site would. Never generic ("AI Agents in the News", "Daily AI Digest" are not allowed).
Line 2: "DESC: " + a meta description (at most 155 characters) that mentions the top stories.
Then a blank line and the digest.

Headlines:\n${list}`), ["TITLE", "DESC"]);
  if (!parsed) return log("news: AI output had no TITLE/DESC lines, skipped");
  // Generic titles get no clicks; fall back to the strongest real headline.
  const aiTitle = parsed.fields.TITLE.trim();
  const title = isGenericTitle(aiTitle) ? fallbackDigestTitle(items[0].title) : aiTitle.slice(0, 90);
  const topics = [...new Set(items.flatMap((i) => [...i.topics]))];
  for (const it of items) seen.add(it.title);
  fs.writeFileSync(out, toFrontmatter({ title, description: parsed.fields.DESC.slice(0, 160), date: today, topics }) + cleanGuide(parsed.body) + "\n");
  // Only remember headlines once they are published, so a failed day can retry them.
  fs.writeFileSync(seenFile, JSON.stringify([...seen].slice(-3000)));
  log(`news: digest written from ${items.length} headlines`);
}

/** @param {Options} o */
async function images({ cfg, contentDir, image, log = console.log }) {
  if (!image) return;
  /** @type {[string, string][]} */
  const wanted = [
    ...cfg.pages.map((/** @type {any} */ p) => /** @type {[string, string]} */ ([p.slug, p.keyword])),
    [cfg.news.hub.slug, "AI agents news headlines"],
    ...(cfg.news.topicPages ?? []).map((/** @type {any} */ t) => /** @type {[string, string]} */ ([t.slug, t.keyword])),
  ];
  for (const f of fs.readdirSync(path.join(contentDir, "news")).filter((f) => f.endsWith(".md"))) {
    const m = readMeta(path.join(contentDir, "news", f));
    if (m) wanted.push([`news-${m.date}`, m.title]);
  }
  let failures = 0;
  for (const [name, subject] of wanted) {
    const file = path.join(contentDir, "images", `${name}.jpg`);
    if (fs.existsSync(file)) continue;
    if (failures >= MAX_IMAGE_FAILURES) return log("images: too many failures, retrying tomorrow");
    try {
      fs.writeFileSync(file, await image(`editorial illustration about ${subject}, AI agents, modern flat vector, soft gradients, blue and violet palette, wide composition, no text, no letters, no logos`));
      log(`image ${name}: saved`);
    } catch (e) { failures++; log(`image ${name}: ${e instanceof Error ? e.message : e}`); }
  }
}

/**
 * Translates English content into other languages, a few items per run (free tier budget).
 * Output: content/i18n/<lang>/<pages|news>/<id>.md with source_updated pointing at the English version.
 * @param {Options} o
 */
async function translations({ cfg, contentDir, complete, log = console.log }) {
  if (!complete || !cfg.translation) return;
  /** @param {"pages" | "news"} kind */
  const sources = (kind) => {
    const dir = path.join(contentDir, kind);
    return (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter((f) => f.endsWith(".md")).map((f) => {
      const id = f.replace(/\.md$/, "");
      const parsed = parseFrontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
      return parsed ? { id, updated: String(parsed.meta.updated ?? parsed.meta.date), meta: parsed.meta, body: parsed.body } : null;
    }).filter((x) => x !== null);
  };
  const order = cfg.pages.map((/** @type {any} */ p) => p.slug);
  const guides = sources("pages").sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const digests = sources("news");
  /** @type {Map<string, string>} */
  const existing = new Map();
  const others = LANGUAGES.slice(1).map((l) => l.code);
  for (const lang of others) for (const kind of ["pages", "news"]) {
    const dir = path.join(contentDir, "i18n", lang, kind);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const m = readMeta(path.join(dir, f));
      if (m?.source_updated) existing.set(`${lang}/${kind}/${f.replace(/\.md$/, "")}`, String(m.source_updated));
    }
  }
  const jobs = planTranslations({ guides, digests, languages: others, newsLanguages: cfg.translation.newsLanguages ?? [], max: cfg.translation.maxPerRun ?? 10, existing });
  for (const job of jobs) {
    const src = (job.kind === "pages" ? guides : digests).find((s) => s.id === job.id);
    if (!src) continue;
    const name = language(job.lang).name;
    try {
      const out = parseAiHeader(await complete(`You are a professional translator. Translate from English into ${name} (${job.lang}). Keep the meaning, tone and Markdown structure exactly: same headings, lists, tables and order. Translate link text but never change link URLs. Keep product and company names as they are. Output only the result.`,
        `Translate this article into ${name}.
First line: "TITLE: " + the translated title. Second line: "DESC: " + the translated description. Then a blank line and the translated Markdown body.

Title: ${src.meta.title}
Description: ${src.meta.description}
<<<SOURCE
${src.body.trim()}
SOURCE>>>`), ["TITLE", "DESC"]);
      if (!out) { log(`translate ${job.lang}/${job.id}: no TITLE/DESC, skipped`); continue; }
      if (!sameLinks(src.body, out.body)) { log(`translate ${job.lang}/${job.id}: links changed, skipped`); continue; }
      const dir = path.join(contentDir, "i18n", job.lang, job.kind);
      fs.mkdirSync(dir, { recursive: true });
      const meta = job.kind === "pages"
        ? { title: out.fields.TITLE.slice(0, 120), description: out.fields.DESC.slice(0, 200), keyword: src.meta.keyword, updated: src.updated, source_updated: src.updated }
        : { title: out.fields.TITLE.slice(0, 120), description: out.fields.DESC.slice(0, 200), date: src.meta.date, topics: src.meta.topics ?? [], source_updated: src.updated };
      fs.writeFileSync(path.join(dir, `${job.id}.md`), toFrontmatter(meta) + out.body + "\n");
      log(`translate ${job.lang}/${job.kind}/${job.id}: written`);
    } catch (e) {
      log(`translate ${job.lang}/${job.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
}

/** @param {Options} o */
export async function generate(o) {
  for (const d of ["pages", "news", "images"]) fs.mkdirSync(path.join(o.contentDir, d), { recursive: true });
  await guides(o);
  try { await news(o); } catch (e) { (o.log ?? console.log)(`news: ${e instanceof Error ? e.message : e}`); }
  await translations(o);
  await images(o);
}
