// Runs the generator against a temp content folder with a fake AI model and fake feeds (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generate, CONTENT_VERSION } from "../../src/generate.mjs";
import { parseFrontmatter } from "../../src/lib/content.mjs";

const cfg = JSON.parse(fs.readFileSync(new URL("../../keywords.json", import.meta.url), "utf8"));
// Translation has its own tests below; the base tests run with it off.
delete cfg.translation;
delete cfg.maxGuidesPerRun;
const RSS = `<rss><channel>${[1, 2, 3, 4].map((i) => `<item><title>Headline ${i}</title><link>https://news.example/${i}</link><source>Wire</source><pubDate>Sat</pubDate></item>`).join("")}</channel></rss>`;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aah-gen-"));
  for (const d of ["pages", "news", "images"]) fs.mkdirSync(path.join(dir, d));
  return dir;
}
const fakeFetch = async () => new Response(RSS, { status: 200 });
/** @param {string[]} calls @returns {import("../../src/generate.mjs").Complete} */
const fakeAi = (calls) => async (_system, prompt) => {
  calls.push(prompt);
  return prompt.includes("news digest") ? "TITLE: Shopify tests checkout agents as OpenAI ships an SDK\nDESC: Digest summary\n\n## Launches\n\nStory." : `DESC: Guide summary\n\n${GOOD_BODY}`;
};

test("writes every guide and one digest, then is a no-op on the same day", async () => {
  const dir = setup();
  /** @type {string[]} */
  const calls = [];
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: fakeAi(calls), fetchFn: fakeFetch, log: () => {} });
  assert.equal(fs.readdirSync(path.join(dir, "pages")).length, cfg.pages.length);
  const digest = parseFrontmatter(fs.readFileSync(path.join(dir, "news/2026-10-04.md"), "utf8"));
  assert.equal(digest?.meta.title, "Shopify tests checkout agents as OpenAI ships an SDK");
  assert.deepEqual(digest?.meta.topics.sort(), cfg.news.feeds.map((/** @type {{ topic: string }} */ f) => f.topic).sort());
  const guide = parseFrontmatter(fs.readFileSync(path.join(dir, "pages/best-ai-agents.md"), "utf8"));
  assert.equal(guide?.meta.description, "Guide summary");
  assert.equal(guide?.meta.updated, "2026-10-04");

  const before = calls.length;
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: fakeAi(calls), fetchFn: fakeFetch, log: () => {} });
  assert.equal(calls.length, before, "second run the same day makes no AI calls");
});

test("headlines already used are not reused the next day", async () => {
  const dir = setup();
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: fakeAi([]), fetchFn: fakeFetch, log: () => {} });
  await generate({ cfg, contentDir: dir, today: "2026-10-05", complete: fakeAi([]), fetchFn: fakeFetch, log: () => {} });
  assert.ok(!fs.existsSync(path.join(dir, "news/2026-10-05.md")), "no digest from stale headlines");
});

test("bad AI output is skipped, not published", async () => {
  const dir = setup();
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: async () => "Sorry, I can't help with that.", fetchFn: fakeFetch, log: () => {} });
  assert.deepEqual(fs.readdirSync(path.join(dir, "pages")), []);
  assert.ok(!fs.existsSync(path.join(dir, "news/2026-10-04.md")));
});

test("an AI outage on one page does not stop the others", async () => {
  const dir = setup();
  let n = 0;
  /** @type {import("../../src/generate.mjs").Complete} */
  const flaky = async (s, p) => { if (!p.includes("news digest") && n++ === 0) throw new Error("429 rate limited"); return fakeAi([])(s, p); };
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: flaky, fetchFn: fakeFetch, log: () => {} });
  assert.equal(fs.readdirSync(path.join(dir, "pages")).length, cfg.pages.length - 1);
});

test("without an AI model only images are attempted, and nothing crashes", async () => {
  const dir = setup();
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: null, fetchFn: fakeFetch, log: () => {} });
  assert.deepEqual(fs.readdirSync(path.join(dir, "pages")), []);
});

test("images are saved from the image model and not re-requested", async () => {
  const dir = setup();
  let requests = 0;
  const image = async () => { requests++; return Buffer.from("jpeg-bytes"); };
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: null, fetchFn: fakeFetch, image, log: () => {} });
  const first = requests;
  assert.equal(fs.readdirSync(path.join(dir, "images")).length, first);
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: null, fetchFn: fakeFetch, image, log: () => {} });
  assert.equal(requests, first);
});

test("image generation stops for the day after 3 failures", async () => {
  const dir = setup();
  let requests = 0;
  const image = async () => { requests++; throw new Error("quota"); };
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: null, fetchFn: fakeFetch, image, log: () => {} });
  assert.equal(requests, 3);
});

// --- Translations -------------------------------------------------------------

/** Fake translator: echoes the English body back so links are preserved. @type {import("../../src/generate.mjs").Complete} */
const fakeTranslator = async (_s, prompt) => {
  if (!prompt.includes("<<<SOURCE")) return fakeAi([])(_s, prompt);
  const src = prompt.split("<<<SOURCE\n")[1].split("\nSOURCE>>>")[0];
  return `TITLE: Traducido\nDESC: Resumen\n\n${src}`;
};
const i18nCfg = { ...cfg, translation: { maxPerRun: 4, newsLanguages: ["es"] } };

test("translations: newest digest first, then guides, capped per run, with source date", async () => {
  const dir = setup();
  await generate({ cfg: i18nCfg, contentDir: dir, today: "2026-10-04", complete: fakeTranslator, fetchFn: fakeFetch, log: () => {} });
  const news = parseFrontmatter(fs.readFileSync(path.join(dir, "i18n/es/news/2026-10-04.md"), "utf8"));
  assert.equal(news?.meta.title, "Traducido");
  assert.equal(news?.meta.date, "2026-10-04");
  assert.deepEqual(news?.meta.topics.sort(), cfg.news.feeds.map((/** @type {{ topic: string }} */ f) => f.topic).sort());
  const esPages = fs.readdirSync(path.join(dir, "i18n/es/pages"));
  assert.equal(esPages.length, 3, "cap of 4 = 1 digest + 3 guides");
  const guide = parseFrontmatter(fs.readFileSync(path.join(dir, "i18n/es/pages", esPages[0]), "utf8"));
  assert.equal(guide?.meta.source_updated, "2026-10-04");
  assert.ok(guide?.meta.keyword);
});

test("translations that change links are rejected", async () => {
  const dir = setup();
  /** @type {import("../../src/generate.mjs").Complete} */
  const sneaky = async (s, p) => p.includes("<<<SOURCE") ? "TITLE: T\nDESC: D\n\n[spam](https://spam.example)" : fakeAi([])(s, p);
  await generate({ cfg: i18nCfg, contentDir: dir, today: "2026-10-04", complete: sneaky, fetchFn: fakeFetch, log: () => {} });
  assert.ok(!fs.existsSync(path.join(dir, "i18n/es/pages")) || fs.readdirSync(path.join(dir, "i18n/es/pages")).length === 0);
});

test("translation is off when the config has no translation section", async () => {
  const dir = setup();
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: fakeTranslator, fetchFn: fakeFetch, log: () => {} });
  assert.ok(!fs.existsSync(path.join(dir, "i18n")));
});

// --- Content quality -------------------------------------------------------------------

const GOOD_BODY = `Agents act on goals.\n\n## How they work\n${"word ".repeat(700)}\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n## FAQ\n\n### Q?\n\nA.`;

test("guides get an SEO title from the AI when it contains the keyword, and a content version", async () => {
  const dir = setup();
  /** @type {import("../../src/generate.mjs").Complete} */
  const ai = async (_s, p) => p.includes("news digest") ? "TITLE: Shopify tests checkout agents\nDESC: d\n\n## A\n\nB" : `TITLE: ${p.match(/Google search "([^"]+)"/)?.[1]} explained: a practical 2026 guide\nDESC: Guide summary\n\n${GOOD_BODY}`;
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: ai, fetchFn: fakeFetch, log: () => {} });
  const g = parseFrontmatter(fs.readFileSync(path.join(dir, "pages/best-ai-agents.md"), "utf8"));
  assert.equal(g?.meta.title, "best ai agents explained: a practical 2026 guide");
  assert.equal(g?.meta.version, CONTENT_VERSION);
});

test("guides written with an older content version are rewritten even if recent", async () => {
  const dir = setup();
  fs.writeFileSync(path.join(dir, "pages/best-ai-agents.md"), `---\ntitle: "Old"\ndescription: "Old"\nkeyword: "best ai agents"\nupdated: "2026-10-03"\n---\n\nOld body.\n`);
  /** @type {string[]} */
  const calls = [];
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: fakeAi(calls), fetchFn: fakeFetch, log: () => {} });
  assert.notEqual(parseFrontmatter(fs.readFileSync(path.join(dir, "pages/best-ai-agents.md"), "utf8"))?.meta.title, "Old");
});

test("a guide with quality issues is retried once with the issues listed", async () => {
  const dir = setup();
  /** @type {string[]} */
  const prompts = [];
  /** @type {import("../../src/generate.mjs").Complete} */
  const ai = async (_s, p) => {
    prompts.push(p);
    if (p.includes("news digest")) return "TITLE: Shopify tests checkout agents\nDESC: d\n\n## A\n\nB";
    return p.includes("Fix these problems") ? `DESC: Better\n\n${GOOD_BODY}` : "DESC: Weak\n\nToo short.";
  };
  await generate({ cfg: { ...cfg, pages: cfg.pages.slice(0, 1) }, contentDir: dir, today: "2026-10-04", complete: ai, fetchFn: fakeFetch, log: () => {} });
  assert.ok(prompts.some((p) => p.includes("Fix these problems") && p.includes("words")));
  const g = parseFrontmatter(fs.readFileSync(path.join(dir, `pages/${cfg.pages[0].slug}.md`), "utf8"));
  assert.equal(g?.meta.description, "Better");
});

test("a guide still too weak after the retry is not published", async () => {
  const dir = setup();
  /** @type {import("../../src/generate.mjs").Complete} */
  const ai = async (_s, p) => p.includes("news digest") ? "TITLE: Shopify tests checkout agents\nDESC: d\n\n## A\n\nB" : "DESC: Weak\n\nToo short.";
  await generate({ cfg: { ...cfg, pages: cfg.pages.slice(0, 1) }, contentDir: dir, today: "2026-10-04", complete: ai, fetchFn: fakeFetch, log: () => {} });
  assert.ok(!fs.existsSync(path.join(dir, `pages/${cfg.pages[0].slug}.md`)));
});

test("a generic digest title is replaced by the top headline", async () => {
  const dir = setup();
  /** @type {import("../../src/generate.mjs").Complete} */
  const ai = async (_s, p) => p.includes("news digest") ? "TITLE: AI Agents in the News\nDESC: d\n\n## A\n\nB" : fakeAi([])(_s, p);
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: ai, fetchFn: fakeFetch, log: () => {} });
  const d = parseFrontmatter(fs.readFileSync(path.join(dir, "news/2026-10-04.md"), "utf8"));
  assert.equal(d?.meta.title, "Headline 1");
});

// --- Daily AI budget --------------------------------------------------------------------

test("the daily digest is written before guides, so a tight budget never skips the news", async () => {
  const dir = setup();
  /** @type {string[]} */
  const order = [];
  /** @type {import("../../src/generate.mjs").Complete} */
  const ai = async (s, p) => { order.push(p.includes("news digest") ? "news" : "guide"); return fakeAi([])(s, p); };
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: ai, fetchFn: fakeFetch, log: () => {} });
  assert.equal(order[0], "news");
});

test("guide rewrites are capped per run", async () => {
  const dir = setup();
  await generate({ cfg: { ...cfg, maxGuidesPerRun: 3 }, contentDir: dir, today: "2026-10-04", complete: fakeAi([]), fetchFn: fakeFetch, log: () => {} });
  assert.equal(fs.readdirSync(path.join(dir, "pages")).length, 3);
});

test("once the daily AI allowance is used up, no more AI calls are made this run", async () => {
  const dir = setup();
  let calls = 0;
  /** @type {import("../../src/generate.mjs").Complete} */
  const ai = async () => { calls++; throw new Error('Cloudflare AI 429: {"errors":[{"message":"you have used up your daily free allocation of 10,000 neurons","code":4006}]}'); };
  /** @type {string[]} */
  const logs = [];
  await generate({ cfg: { ...cfg, translation: { maxPerRun: 5, newsLanguages: ["es"] } }, contentDir: dir, today: "2026-10-04", complete: ai, fetchFn: fakeFetch, log: (m) => logs.push(m) });
  assert.equal(calls, 1);
  assert.equal(logs.filter((l) => /allowance/i.test(l)).length, 1, "explained once");
});
