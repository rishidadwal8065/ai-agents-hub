import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateConfig } from "../../src/lib/config.mjs";

const real = JSON.parse(fs.readFileSync(new URL("../../keywords.json", import.meta.url), "utf8"));

test("the real keywords.json is valid", () => {
  assert.deepEqual(validateConfig(real), []);
});

test("duplicate slugs, bad slugs and non-https feeds are reported", () => {
  const bad = structuredClone(real);
  bad.pages.push({ ...bad.pages[0] });
  bad.pages[1].slug = "Bad Slug";
  bad.news.feeds[0].url = "http://insecure.example/rss";
  const errors = validateConfig(bad).join("\n");
  assert.match(errors, /duplicate slug/);
  assert.match(errors, /invalid slug "Bad Slug"/);
  assert.match(errors, /must use https/);
});

test("missing sections are reported instead of crashing", () => {
  assert.ok(validateConfig({}).length > 0);
  assert.ok(validateConfig(null).length > 0);
});
