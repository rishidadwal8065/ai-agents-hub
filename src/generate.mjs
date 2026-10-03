// Content pipeline: writes guides, the daily news digest and pictures into the content folder.
// All network access is injected (complete / fetchFn / image) so it can be tested offline.
import fs from "node:fs";
import path from "node:path";
import { toFrontmatter, parseFrontmatter, parseRss, parseAiHeader, isStale, titleCase } from "./lib/content.mjs";
import { planTranslations, sameLinks } from "./lib/translate.mjs";
import { LANGUAGES, language } from "./lib/i18n.mjs";

export const REFRESH_DAYS = 90;
const MAX_IMAGE_FAILURES = 3;

/**
 * @typedef {(system: string, prompt: string) => Promise<string>} Complete
 * @typedef {(prompt: string) => Promise<Buffer>} ImageFn
 * @typedef {{ cfg: any, contentDir: string, today: string, complete: Complete | null, fetchFn: typeof fetch, image?: ImageFn | null, log?: (msg: string) => void }} Options
 */

/** @param {any} cfg */
const systemPrompt = (cfg) => `You write for ${cfg.site.name}, a site that explains AI agents to practitioners and business readers.
Rules: accurate, specific, no hype, no filler intros. Never invent statistics, quotes, product names, prices or dates.
If something is uncertain or fast-moving, say so. Output GitHub-flavoured Markdown only, no front matter, no H1.
Start with a 2-3 sentence direct answer paragraph. Use H2/H3 headings, short paragraphs, lists and one table where useful.`;
const FAQ_RULE = `\nEnd with an "## FAQ" section of 4-6 questions as "### Question" + short answer.`;

/** @param {string} file */
function readMeta(file) {
  return fs.existsSync(file) ? parseFrontmatter(fs.readFileSync(file, "utf8"))?.meta ?? null : null;
}

/** @param {Options} o */
async function guides({ cfg, contentDir, today, complete, log = console.log }) {
  if (!complete) return;
  const links = [...cfg.pages.map((/** @type {any} */ p) => `- [${p.keyword}](/${p.slug}/)`), "- [ai agents news](/ai-agents-news/)"].join("\n");
  for (const p of cfg.pages) {
    const file = path.join(contentDir, "pages", `${p.slug}.md`);
    const meta = readMeta(file);
    if (meta && !isStale(meta.updated, REFRESH_DAYS, Date.parse(today))) continue;
    try {
      const out = parseAiHeader(await complete(systemPrompt(cfg) + FAQ_RULE, `Write a 1500-2200 word article targeting the search query "${p.keyword}"${p.also.length ? ` (also covering: ${p.also.join(", ")})` : ""}.
Angle: ${p.angle}
Today is ${today}. Naturally link to 2-4 of these related pages using exactly these relative links:\n${links}
On the first line, output only a meta description (max 155 chars) prefixed with "DESC: ", then a blank line, then the article.`), ["DESC"]);
      if (!out) { log(`page ${p.slug}: AI output had no DESC line, skipped`); continue; }
      fs.writeFileSync(file, toFrontmatter({ title: `${titleCase(p.keyword)} (${today.slice(0, 4)} Guide)`, description: out.fields.DESC.slice(0, 160), keyword: p.keyword, updated: today }) + out.body + "\n");
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
  const parsed = parseAiHeader(await complete(systemPrompt(cfg), `Write today's (${today}) AI agents news digest using ONLY the headlines below. You only have headlines, not full articles, so do not claim details beyond what a headline says.
Group into 3-6 themed H2 sections (e.g. product launches, enterprise adoption, research and breakthroughs, commerce/Shopify, safety and policy). For each story write 1-2 sentences and link the source as [Source name](link).
Finish with "## What it means" (3-4 bullet takeaways, clearly labelled as analysis).
First line: "TITLE: " + a specific headline for the digest (max 70 chars). Second line: "DESC: " + meta description (max 155 chars). Then a blank line and the digest.

Headlines:\n${list}`), ["TITLE", "DESC"]);
  if (!parsed) return log("news: AI output had no TITLE/DESC lines, skipped");
  const topics = [...new Set(items.flatMap((i) => [...i.topics]))];
  for (const it of items) seen.add(it.title);
  fs.writeFileSync(out, toFrontmatter({ title: parsed.fields.TITLE.slice(0, 90), description: parsed.fields.DESC.slice(0, 160), date: today, topics }) + parsed.body + "\n");
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
