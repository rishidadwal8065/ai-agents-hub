// After a content push: wait until Cloudflare has deployed the new pages, then notify IndexNow.
// Never fails the workflow; search engines will still find the pages through the sitemap.
import { changedUrls, indexNowPayload } from "../src/lib/indexnow.mjs";

const SITE = (process.env.SITE_URL || "https://aiagentnewsfree.com").replace(/\/$/, "");
const since = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

try {
  /** @type {string[]} */
  let urls = [];
  // Cloudflare usually deploys within a minute; poll for up to 6 minutes until today's URLs are live.
  for (let i = 0; i < 36; i++) {
    const xml = await (await fetch(`${SITE}/sitemap.xml?ts=${Date.now()}`, { signal: AbortSignal.timeout(20000) })).text();
    urls = changedUrls(xml, since);
    const probe = urls.find((u) => u.includes("/news/")) ?? urls[0];
    if (probe && (await fetch(probe, { method: "HEAD", signal: AbortSignal.timeout(20000) })).ok) break;
    await new Promise((r) => setTimeout(r, 10000));
  }
  if (!urls.length) {
    console.log("IndexNow: nothing changed since", since);
  } else {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowPayload(SITE, urls)),
      signal: AbortSignal.timeout(30000),
    });
    console.log(`IndexNow: sent ${urls.length} URLs, HTTP ${res.status}`);
  }
} catch (e) {
  console.warn(`IndexNow skipped: ${e instanceof Error ? e.message : e}`);
}
