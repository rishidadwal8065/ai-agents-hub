import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("production site url is the custom domain on https", () => {
  const cfg = JSON.parse(fs.readFileSync(new URL("../../keywords.json", import.meta.url), "utf8"));
  assert.equal(cfg.site.url, "https://aiagentnewsfree.com");
});
