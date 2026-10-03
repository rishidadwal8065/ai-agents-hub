// Entry point for the daily run: wires real services into the content pipeline.
import fs from "node:fs";
import path from "node:path";
import { generate } from "../src/generate.mjs";
import { loadConfig } from "../src/lib/config.mjs";
import { textModel, imageModel } from "../src/services/ai.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const cfg = loadConfig(fs.readFileSync(process.env.CONFIG || path.join(ROOT, "keywords.json"), "utf8"));
const complete = textModel(process.env);
// A bad image config must not stop the guides and news from being written.
let image = null;
try { image = imageModel(process.env); } catch (e) { console.warn(`Images disabled: ${e instanceof Error ? e.message : e}`); }
if (!complete) console.log("No GITHUB_TOKEN or ANTHROPIC_API_KEY: skipping text.");
if (!image) console.log("No CF_ACCOUNT_ID/CF_API_TOKEN: pages use generated covers.");

await generate({
  cfg,
  contentDir: path.resolve(ROOT, process.env.CONTENT_DIR || "content"),
  today: new Date().toISOString().slice(0, 10),
  complete,
  fetchFn: fetch,
  image,
});
