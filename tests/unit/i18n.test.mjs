import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGUAGES, STRINGS, t, langPath, langOf, formatDate } from "../../src/lib/i18n.mjs";

test("16 languages, English first, codes unique", () => {
  assert.equal(LANGUAGES.length, 16);
  assert.equal(LANGUAGES[0].code, "en");
  assert.equal(new Set(LANGUAGES.map((l) => l.code)).size, 16);
  assert.deepEqual(LANGUAGES.map((l) => l.code).sort(), ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt", "ru", "tr", "vi", "zh"]);
});

test("only Arabic is right-to-left", () => {
  assert.deepEqual(LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.code), ["ar"]);
});

test("every language translates every UI string, with the same {placeholders}", () => {
  const keys = Object.keys(STRINGS.en);
  /** @param {string} s */
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const { code } of LANGUAGES) {
    const s = STRINGS[code];
    assert.ok(s, `missing strings for ${code}`);
    assert.deepEqual(Object.keys(s).sort(), [...keys].sort(), `keys differ for ${code}`);
    for (const k of keys) {
      assert.ok(s[k].trim(), `${code}.${k} is empty`);
      assert.equal(vars(s[k]), vars(STRINGS.en[k]), `${code}.${k} placeholders`);
    }
  }
});

test("non-English strings are actually translated, not copied", () => {
  for (const { code } of LANGUAGES.slice(1)) {
    const same = ["hero_title", "hero_lead", "cta_start", "ai_note"].filter((k) => STRINGS[code][k] === STRINGS.en[k]);
    assert.deepEqual(same, [], code);
  }
});

test("t() fills placeholders and falls back to English", () => {
  assert.equal(t("en", "min_read", { n: 4 }), "4 min read");
  assert.equal(t("xx", "nav_home"), "Home");
});

test("langPath prefixes non-English paths only", () => {
  assert.equal(langPath("en", "/news/"), "/news/");
  assert.equal(langPath("es", "/news/"), "/es/news/");
  assert.equal(langPath("es", "/"), "/es/");
});

test("langOf reads the language from a route", () => {
  assert.equal(langOf("/es/what-are-ai-agents/"), "es");
  assert.equal(langOf("/what-are-ai-agents/"), "en");
  assert.equal(langOf("/news/2026-10-03/"), "en");
});

test("dates are formatted in the page's language", () => {
  assert.equal(formatDate("en", "2026-10-03"), "3 Oct 2026");
  assert.match(formatDate("de", "2026-10-03"), /3\. Okt\. 2026/);
});
