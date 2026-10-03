// Content pipeline: writes guides, the daily news digest and pictures into the content folder.
// All network access is injected (complete / fetchFn / image) so it can be tested offline.
import fs from "node:fs";
import path from "node:path";
import { toFrontmatter, parseFrontmatter, parseRss, parseAiHeader, isStale, titleCase } from "./lib/content.mjs";

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

/** @param {Options} o */
export async function generate(o) {
  for (const d of ["pages", "news", "images"]) fs.mkdirSync(path.join(o.contentDir, d), { recursive: true });
  await guides(o);
  try { await news(o); } catch (e) { (o.log ?? console.log)(`news: ${e instanceof Error ? e.message : e}`); }
  await images(o);
}
