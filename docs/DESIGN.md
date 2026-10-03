# Design System

Approved design, 4 Oct 2026; upgraded the same day with languages, a theme switch and search. Screens: `docs/design/`.

## Style
Modern, minimal, editorial. Calm and trustworthy, not hype. Content first.

## Typography
- System font stack plus Noto/Hiragino/PingFang/Malgun fallbacks for Hindi, Arabic, Japanese, Chinese and Korean. No web fonts (speed).
- Body 17px / 1.7. Lead 17–20px.
- H1 `clamp(32px, 5.4vw, 54px)`, weight 800, gradient text in heroes, H2 `clamp(22px, 3vw, 28px)`, H3 19px. Tight letter-spacing on headings (-0.02em).
- Reading width: 720px max for articles.

## Colours (tokens in `public/style.css` `:root`)
| Token | Light | Dark |
|---|---|---|
| `--bg` | #f8f9fc | #0b0c10 |
| `--bg-2` (header, inputs, footer) | #ffffff | #111318 |
| `--fg` | #0f172a | #eceef3 |
| `--muted` | #5b6475 | #9aa1b2 |
| `--line` | #e5e7ef | #23262f |
| `--card` | #ffffff | #14161c |
| `--soft` | #f1f3f9 | #1a1d25 |
| `--accent` (indigo) | #4f46e5 | #a5b4fc |
| `--accent-2` (violet, gradients) | #9333ea | #d8b4fe |
| `--accent-soft` | #eef0ff | #1d2142 |

Never hard-code colours outside `:root`. Cover art uses generated gradients (derived from the page name).

## Components
| Component | Spec |
|---|---|
| Header | Sticky, blurred background, logo, menu with `aria-current`, then actions: search (icon), light/dark switch (sun/moon), language menu (globe + name + chevron, 16 languages, current one highlighted). On ≤860px the menu becomes a swipeable second row and the language name hides. |
| Theme | Follows the system until the visitor picks one; the choice is remembered. Dark tokens apply via `:root[data-theme=dark]` or the system preference. |
| Hero | Soft indigo/violet glow, gradient headline, live dot in the eyebrow, primary gradient button, stats row (guides · daily · languages), topic chips. |
| Search | Big rounded input with icon; results filter as you type; full list without JS. |
| Progress bar | 3px gradient bar at the top that fills as you scroll (CSS scroll timeline, where supported). |
| Footer | Brand + tagline, Guides, News, Site columns, back to top. |
| Buttons | `.btn` (secondary, bordered) and `.btn.primary` (indigo→violet gradient). 12px radius, 12×20 padding. Icon buttons 40×40, 12px radius. |
| Chips | Rounded pills linking to guides. |
| Cards | 16px radius, 1px border, soft shadow, 1200×630 image on top (zooms slightly on hover), label / title / 3-line description. Hover lifts 3px. |
| Feature card | Card with the picture beside the text on ≥760px. |
| News list | Thumbnail on the left, title and date on the right. |
| Article | Breadcrumbs → H1 → date and reading time → (translated note + link to English) → hero picture → prose → AI note → "Keep reading". Sticky "On this page" box on ≥1040px. |
| FAQ | H3 questions in soft boxes. Also output as FAQPage structured data. |
| Empty state | Dashed box with a friendly message. |

## Layout
- Container 1140px, 16px side gutter, no horizontal scroll at 375px (checked in LTR and RTL).
- Breakpoints: 520px (news list), 760px (feature card), 860px (header), 1040px (table of contents).

## Languages
- 16 languages; Arabic is right-to-left (`dir="rtl"`). Layout uses logical properties (`inset-inline`, `padding-inline-start`, `border-inline-start`) so it mirrors correctly.
- UI text only from `src/lib/i18n.mjs`; never hard-code strings in templates.
- Untranslated guides appear on language pages with an **EN** badge and `hreflang="en"`.

## UX requirements
- Mobile first; tested at 375, 768 and 1280px.
- Light and dark: follows the system until the visitor uses the switch; the choice is remembered.
- Every picture has fixed dimensions (no layout shift) and alt text; below-the-fold pictures load lazily.
- Skip link, visible focus ring, semantic landmarks.
- Empty states for "no guides yet" and "no news yet". (There are no loading states: the site is static.)
- Only link to pages that exist.
