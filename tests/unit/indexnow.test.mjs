import { test } from "node:test";
import assert from "node:assert/strict";
import { INDEXNOW_KEY, changedUrls, indexNowPayload } from "../../src/lib/indexnow.mjs";

const sitemap = `<urlset><url><loc>https://s.example/a/</loc><lastmod>2026-10-04</lastmod></url><url><loc>https://s.example/b/</loc><lastmod>2026-10-01</lastmod></url><url><loc>https://s.example/c/</loc></url></urlset>`;

test("the key is a 32-character hex string", () => {
  assert.match(INDEXNOW_KEY, /^[a-f0-9]{32}$/);
});

test("changedUrls picks URLs modified on or after a date", () => {
  assert.deepEqual(changedUrls(sitemap, "2026-10-03"), ["https://s.example/a/"]);
});

test("payload follows the IndexNow protocol", () => {
  const p = indexNowPayload("https://s.example", ["https://s.example/a/"]);
  assert.deepEqual(p, { host: "s.example", key: INDEXNOW_KEY, keyLocation: `https://s.example/${INDEXNOW_KEY}.txt`, urlList: ["https://s.example/a/"] });
});

test("payload is capped at 10,000 URLs", () => {
  const urls = Array.from({ length: 10050 }, (_, i) => `https://s.example/${i}/`);
  assert.equal(indexNowPayload("https://s.example", urls).urlList.length, 10000);
});
