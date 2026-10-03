// Structured data, table of contents and cover art. Pure functions.
import { esc, strip } from "./content.mjs";

/**
 * FAQ section (h2#faq followed by h3 + p pairs) -> FAQPage rich result.
 * @param {string} html
 */
export function faqLd(html) {
  const faq = html.split(/<h2 id="faq">/)[1];
  if (!faq) return [];
  const qa = [...faq.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)]
    .map(([, q, a]) => ({ "@type": "Question", name: strip(q), acceptedAnswer: { "@type": "Answer", text: strip(a) } }));
  return qa.length ? [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa }] : [];
}

/**
 * "On this page" box. Only worth showing with 3+ sections.
 * @param {string} html
 */
export function tocHtml(html) {
  const hs = [...html.matchAll(/<h2 id="([^"]+)">([\s\S]*?)<\/h2>/g)];
  if (hs.length < 3) return "";
  return `<aside class="toc" aria-label="On this page"><b>On this page</b><ol>${hs.map(([, id, t]) => `<li><a href="#${id}">${t}</a></li>`).join("")}</ol></aside>`;
}

/**
 * @param {string} site absolute site url without trailing slash
 * @param {[string, string][]} items [name, path]
 */
export function crumbsLd(site, items) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${site}${p}` })) };
}

/**
 * Branded 1200x630 cover used when no AI picture exists. Colour is derived from the name, so it is stable.
 * @param {string} name
 * @param {string} label
 * @param {string} siteName
 */
export function coverSvg(name, label, siteName) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  /** @type {string[]} */
  const lines = [""];
  for (const w of String(label).split(" ")) {
    const next = `${lines[lines.length - 1]} ${w}`.trim();
    if (next.length > 22 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = next;
  }
  const nodes = [[860, 160], [1020, 250], [900, 380], [1080, 450], [760, 300]];
  const graph = nodes.map(([x, y], i) => `<line x1="${x}" y1="${y}" x2="${nodes[(i + 1) % 5][0]}" y2="${nodes[(i + 1) % 5][1]}" stroke="#fff" stroke-opacity=".25" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${18 + (i % 3) * 8}" fill="#fff" fill-opacity="${0.15 + (i % 3) * 0.1}"/>`).join("");
  const text = lines.slice(0, 3).map((l, i) => `<text x="72" y="${240 + i * 84}" font-family="system-ui,sans-serif" font-size="72" font-weight="800" fill="#fff">${esc(l).replace(/>/g, "&gt;")}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},70%,50%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},70%,28%)"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/>${graph}${text}<text x="72" y="560" font-family="system-ui,sans-serif" font-size="30" font-weight="600" fill="#fff" fill-opacity=".85">${esc(siteName)}</text></svg>`;
}
