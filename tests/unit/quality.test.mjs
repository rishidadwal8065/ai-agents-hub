import { test } from "node:test";
import assert from "node:assert/strict";
import { isGenericTitle, guideIssues, cleanGuide, titleHasKeyword, fallbackDigestTitle } from "../../src/lib/quality.mjs";

test("generic digest titles are detected", () => {
  for (const t of ["AI Agents in the News", "AI Agents News", "Daily AI Agents Digest", "Latest AI agent updates", "AI Agents: News Roundup", "Today's news"]) assert.equal(isGenericTitle(t), true, t);
});

test("specific digest titles pass", () => {
  for (const t of ["Shopify tests AI checkout agents; OpenAI ships agent SDK", "Salesforce bets on agents as security flaws surface"]) assert.equal(isGenericTitle(t), false, t);
});

test("fallback digest title uses the top headline, trimmed to 70 characters", () => {
  const t = fallbackDigestTitle("Shopify launches agentic checkout for merchants in 40 countries - The Verge");
  assert.equal(t, "Shopify launches agentic checkout for merchants in 40 countries");
  assert.ok([...fallbackDigestTitle("x ".repeat(80))].length <= 70);
});

test("guide title must contain the keyword's words", () => {
  assert.equal(titleHasKeyword("Best AI Agents in 2026: How to Pick the Right One", "best ai agents"), true);
  assert.equal(titleHasKeyword("Picking an assistant", "best ai agents"), false);
});

const good = `AI agents are software that pursues a goal by choosing actions and using tools.

## How AI agents work
${"word ".repeat(700)}

| Type | Example |
|---|---|
| Coding | Fixes bugs |

## Common mistakes
- Too many permissions

## FAQ

### Are AI agents safe?

With limits.`;

test("a well-formed guide has no issues", () => {
  assert.deepEqual(guideIssues(good), []);
});

test("guide issues: no table, no FAQ, too short, filler, an H1", () => {
  const issues = guideIssues("# Title\n\nIn today's fast-paced world, agents matter.\n\n## Overview\n\nShort.");
  for (const want of ["table", "FAQ", "words", "filler", "H1"]) assert.ok(issues.some((i) => i.includes(want)), want);
});

test("cleanGuide removes Introduction/Overview headings and renames Conclusion", () => {
  const out = cleanGuide("## Introduction to AI Agents\nText.\n\n## Overview\nMore.\n\n## Conclusion\nEnd.\n\n## FAQ\n");
  assert.doesNotMatch(out, /## Introduction|## Overview/);
  assert.match(out, /## Key takeaways\nEnd\./);
  assert.match(out, /^Text\./);
});

test("cleanGuide drops filler opening phrases", () => {
  assert.equal(cleanGuide("In today's fast-paced world, AI agents act on goals."), "AI agents act on goals.");
  assert.equal(cleanGuide("In conclusion, start small."), "Start small.");
});
