# SEO

What the site does for search engines, and where it is tested (`tests/integration/build.test.mjs`, `tests/unit/indexnow.test.mjs`).

## Technical
| Item | How |
|---|---|
| Fast static pages | Plain HTML, inline CSS, one small script, fixed image sizes (no layout shift), lazy images below the fold |
| HTTPS, security headers | Cloudflare + generated `_headers` |
| Canonical URLs | Every page, absolute, trailing slash |
| Robots meta | `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1`; `noindex, follow` for search, 404 and empty languages |
| robots.txt | Allows all; lists both sitemaps |
| Sitemap | `/sitemap.xml`: every indexable page, `lastmod`, **hreflang alternates** and **image** entries |
| News sitemap | `/news-sitemap.xml`: digests from the last 2 days in every language (Google News format) |
| IndexNow | Key file `/<key>.txt`; the daily run sends new and changed URLs to Bing, Yandex, Seznam and Naver after deploy |
| Languages | `/<lang>/` paths, reciprocal `hreflang` + `x-default`, `lang`/`dir` on `<html>`, `og:locale` + alternates |
| Icons | Real `/favicon.svg`, `/logo.svg`, `/site.webmanifest`, so Google can show the site icon in results |
| 404 | Real 404 status with a helpful page |

## On-page
| Item | How |
|---|---|
| Titles | ≤ 70 characters, cut at a word boundary; brand suffix only when it fits (≤ 60) |
| Descriptions | ≤ 160 characters |
| Headings | Exactly one H1; H2/H3 with ids; table of contents |
| Images | Descriptive alt on hero images, 1200×630, `og:image` width/height/alt |
| Internal links | Breadcrumbs, "Keep reading" guides, related guides on every news page, footer links, guide chips; links only to pages that exist |
| Freshness | Guides rewritten every 90 days; a dated digest every day |

## Structured data (JSON-LD)
| Page | Types |
|---|---|
| Home | `WebSite`, `Organization` (logo), `ItemList` of guides |
| Guide | `Article` (author and publisher with logo, image object, word count, keywords, language, dates), `BreadcrumbList`, `FAQPage` |
| Digest | `NewsArticle`, `BreadcrumbList` |
| News hub | `BreadcrumbList`, `ItemList` of digests |
| About | `AboutPage` with `Organization` |

## Trust (E-E-A-T)
- About page in every language: who runs the site, how AI content is made, the 90-day refresh, sources always linked, no paid coverage.
- AI disclosure on every article; translated pages say so and link the English original.

## Owner checklist
- Google Search Console: sitemap `sitemap.xml` (and `news-sitemap.xml`) submitted; request indexing for the home page.
- Bing Webmaster Tools: import from Search Console (IndexNow already pings Bing).
- `www.aiagentnewsfree.com` redirects (301) to `https://aiagentnewsfree.com`.
