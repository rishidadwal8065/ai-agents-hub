import { test } from "node:test";
import assert from "node:assert/strict";
import { planTranslations, linksOf, sameLinks } from "../../src/lib/translate.mjs";

const guides = [{ id: "a", updated: "2026-10-01" }, { id: "b", updated: "2026-10-01" }];
const base = { guides, digests: [{ id: "2026-10-03", updated: "2026-10-03" }], languages: ["es", "pt", "hi"], newsLanguages: ["es", "pt"], max: 100, existing: new Map() };

test("today's digest comes first, then guides language by language", () => {
  const jobs = planTranslations(base).map((j) => `${j.lang}/${j.kind}/${j.id}`);
  assert.deepEqual(jobs, ["es/news/2026-10-03", "pt/news/2026-10-03", "es/pages/a", "es/pages/b", "pt/pages/a", "pt/pages/b", "hi/pages/a", "hi/pages/b"]);
});

test("the plan is capped per run", () => {
  assert.equal(planTranslations({ ...base, max: 3 }).length, 3);
});

test("up-to-date translations are skipped; outdated ones are redone", () => {
  const existing = new Map([["es/pages/a", "2026-10-01"], ["es/pages/b", "2026-09-01"]]);
  const jobs = planTranslations({ ...base, existing, newsLanguages: [], languages: ["es"] }).map((j) => j.id);
  assert.deepEqual(jobs, ["b"]);
});

test("only the newest digest is translated (older days are not back-filled)", () => {
  const digests = [{ id: "2026-10-03", updated: "2026-10-03" }, { id: "2026-10-02", updated: "2026-10-02" }];
  const jobs = planTranslations({ ...base, digests, languages: [], newsLanguages: ["es"] });
  assert.deepEqual(jobs.map((j) => j.id), ["2026-10-03"]);
});

test("linksOf lists markdown link targets, sorted", () => {
  assert.deepEqual(linksOf("See [b](https://b.example) and [a](/a/). ![img](/x.png)"), ["/a/", "/x.png", "https://b.example"]);
});

test("sameLinks rejects translations that drop, add or change links", () => {
  const src = "[x](/a/) [y](https://s.example/1)";
  assert.equal(sameLinks(src, "[equis](/a/) [ye](https://s.example/1)"), true);
  assert.equal(sameLinks(src, "[equis](/a/)"), false);
  assert.equal(sameLinks(src, "[equis](/a/) [ye](https://evil.example)"), false);
});
