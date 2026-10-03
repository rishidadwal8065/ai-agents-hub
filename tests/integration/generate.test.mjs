// Runs the generator against a temp content folder with a fake AI model and fake feeds (no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generate } from "../../src/generate.mjs";
import { parseFrontmatter } from "../../src/lib/content.mjs";

const cfg = JSON.parse(fs.readFileSync(new URL("../../keywords.json", import.meta.url), "utf8"));
// Translation has its own tests below; the base tests run with it off.
delete cfg.translation;
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
  return prompt.includes("news digest") ? "TITLE: Agents everywhere\nDESC: Digest summary\n\n## Launches\n\nStory." : "DESC: Guide summary\n\n## Intro\n\nText.\n\n## FAQ\n\n### Q?\n\nA.";
};

test("writes every guide and one digest, then is a no-op on the same day", async () => {
  const dir = setup();
  /** @type {string[]} */
  const calls = [];
  await generate({ cfg, contentDir: dir, today: "2026-10-04", complete: fakeAi(calls), fetchFn: fakeFetch, log: () => {} });
  assert.equal(fs.readdirSync(path.join(dir, "pages")).length, cfg.pages.length);
  const digest = parseFrontmatter(fs.readFileSync(path.join(dir, "news/2026-10-04.md"), "utf8"));
  assert.equal(digest?.meta.title, "Agents everywhere");
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
  const flaky = async (s, p) => { if (n++ === 0) throw new Error("429 rate limited"); return fakeAi([])(s, p); };
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
