// Writes new content with the Claude API. Safe to run every day:
// - evergreen pages are written once, then refreshed when older than REFRESH_DAYS
// - one news digest per day, built only from that day's RSS headlines
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "keywords.json"), "utf8"));
const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
const REFRESH_DAYS = 90;
const today = new Date().toISOString().slice(0, 10);

if (!KEY) {
  console.log("ANTHROPIC_API_KEY not set - skipping generation, building existing content only.");
  process.exit(0);
}

async function claude(system, prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

const SYSTEM = `You write for ${cfg.site.name}, a site that explains AI agents to practitioners and business readers.
Rules: accurate, specific, no hype, no filler intros. Never invent statistics, quotes, product names, prices or dates.
If something is uncertain or fast-moving, say so. Output GitHub-flavoured Markdown only, no front matter, no H1.
Start with a 2-3 sentence direct answer paragraph. Use H2/H3 headings, short paragraphs, lists and one table where useful.
End with an "## FAQ" section of 4-6 questions as "### Question" + short answer.`;

function frontmatter(obj) {
  return "---\n" + Object.entries(obj).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("\n") + "\n---\n\n";
}

function readMeta(file) {
  if (!fs.existsSync(file)) return null;
  const m = fs.readFileSync(file, "utf8").match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  return Object.fromEntries(m[1].split("\n").map((l) => { const i = l.indexOf(":"); return [l.slice(0, i), JSON.parse(l.slice(i + 1))]; }));
}

async function evergreen() {
  const links = cfg.pages.map((p) => `- [${p.keyword}](/${p.slug}/)`).join("\n");
  for (const p of cfg.pages) {
    const file = path.join(ROOT, "content/pages", `${p.slug}.md`);
    const meta = readMeta(file);
    if (meta && (Date.now() - Date.parse(meta.updated)) / 864e5 < REFRESH_DAYS) continue;
    console.log(`writing page: ${p.slug}`);
    const body = await claude(SYSTEM, `Write a 1500-2200 word article targeting the search query "${p.keyword}"${p.also.length ? ` (also covering: ${p.also.join(", ")})` : ""}.
Angle: ${p.angle}
Today is ${today}. Naturally link to 2-4 of these related pages using exactly these relative links:\n${links}\n- [ai agents news](/ai-agents-news/)
On the first line, output only a meta description (max 155 chars) prefixed with "DESC: ", then a blank line, then the article.`);
    const [first, ...rest] = body.split("\n");
    const description = first.replace(/^DESC:\s*/, "").slice(0, 160);
    const title = p.keyword.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAi\b/g, "AI");
    fs.writeFileSync(file, frontmatter({ title: `${title} (${today.slice(0, 4)} Guide)`, description, keyword: p.keyword, updated: today }) + rest.join("\n").trim() + "\n");
  }
}

function parseRss(xml) {
  const tag = (s, t) => (s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
    title: tag(m[1], "title").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"'),
    link: tag(m[1], "link"),
    source: tag(m[1], "source"),
    date: tag(m[1], "pubDate"),
  }));
}

async function news() {
  const out = path.join(ROOT, "content/news", `${today}.md`);
  if (fs.existsSync(out)) return console.log("news digest for today exists");
  const seenFile = path.join(ROOT, "content/news/seen.json");
  const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, "utf8")) : []);
  const items = [];
  for (const f of cfg.news.feeds) {
    try {
      const xml = await (await fetch(f.url, { headers: { "user-agent": "Mozilla/5.0 ai-agents-hub" } })).text();
      for (const it of parseRss(xml).slice(0, 25)) if (!seen.has(it.title)) { items.push({ ...it, topic: f.topic }); seen.add(it.title); }
    } catch (e) { console.warn(`feed failed ${f.topic}: ${e.message}`); }
  }
  if (items.length < 3) return console.log("not enough new headlines today");
  const list = items.slice(0, 40).map((it, i) => `${i + 1}. [${it.topic}] ${it.title} — ${it.source} — ${it.date} — ${it.link}`).join("\n");
  console.log(`writing news digest from ${items.length} headlines`);
  const body = await claude(SYSTEM.replace(/End with[\s\S]*$/, ""), `Write today's (${today}) AI agents news digest using ONLY the headlines below. You only have headlines, not full articles, so do not claim details beyond what a headline says.
Group into 3-6 themed H2 sections (e.g. product launches, enterprise adoption, research and breakthroughs, commerce/Shopify, safety and policy). For each story write 1-2 sentences and link the source as [Source name](link).
Finish with "## What it means" (3-4 bullet takeaways, clearly labelled as analysis).
First line: "TITLE: " + a specific headline for the digest (max 70 chars). Second line: "DESC: " + meta description (max 155 chars). Then a blank line and the digest.

Headlines:\n${list}`);
  const lines = body.split("\n");
  const title = lines[0].replace(/^TITLE:\s*/, "");
  const description = lines[1].replace(/^DESC:\s*/, "").slice(0, 160);
  const topics = [...new Set(items.map((i) => i.topic))];
  fs.writeFileSync(out, frontmatter({ title, description, date: today, topics }) + lines.slice(2).join("\n").trim() + "\n");
  fs.writeFileSync(seenFile, JSON.stringify([...seen].slice(-3000)));
}

await evergreen();
await news();
