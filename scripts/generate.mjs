// Writes new content with an AI model (free GitHub Models by default). Safe to run every day:
// - evergreen pages are written once, then refreshed when older than REFRESH_DAYS
// - one news digest per day, built only from that day's RSS headlines
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "keywords.json"), "utf8"));
// Free by default: GitHub Models, using the GITHUB_TOKEN every Actions run already has.
// Set ANTHROPIC_API_KEY instead to use Claude (paid).
const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
const GH = process.env.GITHUB_TOKEN;
const MODEL = process.env.AI_MODEL || (ANTHROPIC ? "claude-sonnet-5-5" : "openai/gpt-4.1-mini");
const REFRESH_DAYS = 90;
const today = new Date().toISOString().slice(0, 10);

if (!ANTHROPIC && !GH) {
  console.log("No GITHUB_TOKEN or ANTHROPIC_API_KEY - skipping text, fetching images only.");
}
const AI = Boolean(ANTHROPIC || GH);

async function claude(system, prompt) {
  if (ANTHROPIC) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  }
  const res = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${GH}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`GitHub Models ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content.trim();
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

// Free images from Pollinations (no key). Saved into the repo so they never change or vanish;
// a failed download is retried next run, and the build uses an SVG cover meanwhile.
// The free tier throttles anonymous use, so space requests out and stop for the day once it pushes back.
const IMAGE_GAP_MS = 25000;
let imageFailures = 0;
async function image(name, subject) {
  const file = path.join(ROOT, "content/images", `${name}.jpg`);
  if (fs.existsSync(file) || imageFailures >= 3) return;
  await new Promise((r) => setTimeout(r, IMAGE_GAP_MS));
  const prompt = `editorial illustration about ${subject}, AI agents, modern flat vector, soft gradients, blue and violet palette, no text, no letters`;
  try {
    const res = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=630&nologo=true&seed=${name.length * 97}`, { signal: AbortSignal.timeout(120000) });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok && res.headers.get("content-type")?.startsWith("image/") && buf.length > 5000) fs.writeFileSync(file, buf);
    else { imageFailures++; console.warn(`image ${name}: bad response ${res.status}`); }
  } catch (e) { imageFailures++; console.warn(`image ${name}: ${e.message}`); }
}

async function images() {
  fs.mkdirSync(path.join(ROOT, "content/images"), { recursive: true });
  for (const p of cfg.pages) await image(p.slug, p.keyword);
  await image(cfg.news.hub.slug, "AI agents news headlines");
  for (const t of cfg.news.topicPages) await image(t.slug, t.keyword);
  for (const f of fs.readdirSync(path.join(ROOT, "content/news")).filter((f) => f.endsWith(".md"))) {
    const m = readMeta(path.join(ROOT, "content/news", f));
    await image(`news-${m.date}`, m.title);
  }
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

// Free tier has daily request limits, so a failed page is retried on the next run instead of failing the deploy.
if (AI) try { await evergreen(); } catch (e) { console.warn(`pages: ${e.message}`); }
if (AI) try { await news(); } catch (e) { console.warn(`news: ${e.message}`); }
await images();
