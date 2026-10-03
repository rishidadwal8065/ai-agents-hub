import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const wf = fs.readFileSync(new URL("../../.github/workflows/auto.yml", import.meta.url), "utf8");

test("workflow has no control characters (regression: a stray backspace made the YAML invalid)", () => {
  assert.doesNotMatch(wf, /[\u0000-\u0008\u000B-\u001F\u007F]/);
});

test("workflow keeps manual, scheduled and push triggers and deploys only after verify", () => {
  for (const t of ["workflow_dispatch:", "schedule:", "push:"]) assert.ok(wf.includes(t), t);
  assert.match(wf, /publish:\s*\n\s*needs: verify/);
  assert.match(wf, /pages deploy dist --project-name=aiagentnewsfree/);
});
