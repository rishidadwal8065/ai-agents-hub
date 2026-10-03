// Entry point: reads settings and files, then builds the site with src/site/build.mjs.
import fs from "node:fs";
import path from "node:path";
import { buildSite } from "../src/site/build.mjs";
import { loadConfig } from "../src/lib/config.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const cfg = loadConfig(fs.readFileSync(process.env.CONFIG || path.join(ROOT, "keywords.json"), "utf8"));
const outDir = path.resolve(ROOT, process.env.OUT_DIR || "dist");

const count = buildSite({
  root: ROOT,
  contentDir: path.resolve(ROOT, process.env.CONTENT_DIR || "content"),
  outDir,
  cfg,
  site: process.env.SITE_URL || cfg.site.url,
  css: fs.readFileSync(path.join(ROOT, "public/style.css"), "utf8"),
  js: fs.readFileSync(path.join(ROOT, "public/site.js"), "utf8"),
});
console.log(`built ${count} indexable pages -> ${path.relative(ROOT, outDir) || "."}`);
