# Design System

Approved design, 4 Oct 2026. Screens: `docs/design/`.

## Style
Modern, minimal, editorial. Calm and trustworthy, not hype. Content first.

## Typography
- System font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. No web fonts (speed).
- Body 17px / 1.7. Lead 17–20px.
- H1 `clamp(30px, 5vw, 46px)`, H2 `clamp(22px, 3vw, 28px)`, H3 19px. Tight letter-spacing on headings (-0.02em).
- Reading width: 720px max for articles.

## Colours (tokens in `public/style.css` `:root`)
| Token | Light | Dark |
|---|---|---|
| `--bg` | #fafaf9 | #0f1012 |
| `--fg` | #18181b | #ececee |
| `--muted` | #5f6068 | #a1a1aa |
| `--line` | #e7e5e4 | #26272b |
| `--card` | #ffffff | #17181b |
| `--soft` | #f1f0ee | #1d1e22 |
| `--accent` (indigo) | #4338ca | #a5b4fc |
| `--accent-soft` | #eef0ff | #1e2140 |

Never hard-code colours outside `:root`. Cover art uses generated gradients (derived from the page name).

## Components
| Component | Spec |
|---|---|
| Header | Sticky, blurred background, logo mark plus name, menu with `aria-current`. On mobile: one row you can swipe. |
| Buttons | `.btn` (secondary, bordered) and `.btn.primary` (accent fill). 10px radius, 11×18 padding. |
| Chips | Rounded pills linking to guides. |
| Cards | 14px radius, 1px border, soft shadow, 1200×630 image on top, label / title / description. Hover lifts 2px. |
| Feature card | Card with the picture beside the text on ≥760px. |
| News list | Thumbnail on the left, title and date on the right. |
| Article | Breadcrumbs → H1 → date and reading time → hero picture → prose → AI note → "Keep reading". Sticky "On this page" box on ≥1000px. |
| FAQ | H3 questions in soft boxes. Also output as FAQPage structured data. |
| Empty state | Dashed box with a friendly message. |

## Layout
- Container 1080px, 16px side gutter, no horizontal scroll at 375px.
- Breakpoints: 520px (news list), 720px (header), 760px (feature card), 1000px (table of contents).

## UX requirements
- Mobile first; tested at 375, 768 and 1280px.
- Dark mode follows the system setting.
- Every picture has fixed dimensions (no layout shift) and alt text; below-the-fold pictures load lazily.
- Skip link, visible focus ring, semantic landmarks.
- Empty states for "no guides yet" and "no news yet". (There are no loading states: the site is static.)
- Only link to pages that exist.
