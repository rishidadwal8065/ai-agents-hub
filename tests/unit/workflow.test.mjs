import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const wf = fs.readFileSync(new URL("../../.github/workflows/auto.yml", import.meta.url), "utf8");

test("workflow has no control characters (regression: a stray backspace made the YAML invalid)", () => {
  const bad = [...wf].filter((c) => { const n = c.charCodeAt(0); return (n < 32 && n !== 9 && n !== 10 && n !== 13) || n === 127; });
  assert.deepEqual(bad, []);
});

test("workflow keeps manual, scheduled and push triggers and deploys only after verify", () => {
  for (const t of ["workflow_dispatch:", "schedule:", "push:"]) assert.ok(wf.includes(t), t);
  assert.match(wf, /publish:\s*\n\s*needs: verify/);
});

test("Cloudflare builds and deploys from git: the workflow does not deploy itself", () => {
  assert.doesNotMatch(wf, /wrangler-action|pages deploy/, "a second deploy path would publish to the wrong project");
});

test("content commits are not marked [skip ci], so Cloudflare builds them", () => {
  // Pushes made with GITHUB_TOKEN never start new workflow runs, so [skip ci] is not needed to avoid loops.
  assert.doesNotMatch(wf, /\[skip ci\]/);
});

test("wrangler.jsonc publishes the built site from the ai-agents-hub Worker", () => {
  const raw = fs.readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8").replace(/^\s*\/\/.*$/gm, "");
  const w = JSON.parse(raw);
  assert.equal(w.name, "ai-agents-hub");
  assert.equal(w.assets.directory, "./dist");
  assert.equal(w.assets.not_found_handling, "404-page");
  assert.equal(w.build.command, "npm run build");
  assert.match(w.compatibility_date, /^\d{4}-\d{2}-\d{2}$/);
});

test("content runs notify IndexNow after pushing", () => {
  assert.ok(wf.indexOf("scripts/indexnow.mjs") > wf.indexOf("git push"), "IndexNow runs after the push");
});
