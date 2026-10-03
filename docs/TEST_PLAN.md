# Test Plan

`npm run verify` runs lint → typecheck → tests with coverage → build. CI runs it on every push and pull request, and before every deploy.

Coverage thresholds (on `src/`): lines ≥ 85%, branches ≥ 70%.

## Automated

### Unit: `tests/unit/`
| Area | Checks |
|---|---|
| Front matter | Round trip; malformed headers return null |
| RSS | Items, CDATA, entities; non-http links dropped |
| AI output | Labelled header lines parsed; missing labels or empty body rejected |
| Helpers | slugify, esc, strip, titleCase, isStale, readingMinutes |
| SEO | FAQPage from the FAQ section, table of contents, breadcrumbs, deterministic escaped SVG covers |
| Config | The real `keywords.json` is valid; duplicate or bad slugs, non-https feeds and missing sections are reported |
| AI services | Provider choice, model override, HTTP errors, Cloudflare decode, JPEG check, account-id validation |

### Integration: `tests/integration/`
| Area | Checks |
|---|---|
| Generator (fake AI and fake feeds) | Writes all guides and one digest; same-day rerun makes no AI calls; used headlines are never reused; bad AI output is not published; one failure does not stop the others; images are saved once; image attempts stop after 3 failures; a headline in several feeds keeps all its topics |
| Build (fixture content) | All routes exist; **no broken internal links or images**; base path applied; one H1, title, description, canonical and og:image per page; JSON-LD parses; FAQ and breadcrumbs present; no `undefined`/`NaN` leaks; viewport, lang, skip link, alt text; sitemap complete and absolute, without the 404; topic filtering; SVG cover fallback; invalid config fails the build |

## Manual QA (before launch, and after design changes)
- [ ] 375px, 768px, 1280px: no horizontal scroll, the menu swipes on mobile
- [ ] Light and dark mode
- [ ] Keyboard only: skip link, focus ring visible, every link reachable
- [ ] Lighthouse mobile: SEO ≥ 95, Accessibility ≥ 95, Performance ≥ 90
- [ ] Google Rich Results Test on one guide (FAQ, Breadcrumb, Article)
- [ ] Share a page link in a chat app: the preview shows the picture and title

## Production QA (after the first deploy)
- [ ] https://aiagentnewsfree.com loads; www redirects to the bare domain; http redirects to https
- [ ] A direct URL to a guide works; an unknown URL shows the 404 page
- [ ] `/sitemap.xml`, `/robots.txt` and `/feed.xml` are reachable
- [ ] The Actions run log shows guides and a digest written (or a clear reason why not)
- [ ] Response headers include the CSP and `nosniff` (`curl -I https://aiagentnewsfree.com`)

## Not yet automated
- Browser end-to-end tests (Playwright) at the three widths. See TASKS.md, Phase 3.
