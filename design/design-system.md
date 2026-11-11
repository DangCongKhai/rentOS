# rentOS — Design System

Implementation reference for `backend/frontend` (React 19 + TypeScript + Vite). Tokens live in `design/tokens/rentos-tokens.css`.

## Setup
```css
/* backend/frontend/src/index.css */
@import '../../../design/tokens/rentos-tokens.css';
body { margin:0; font-family: var(--font-sans); color: var(--text-primary); background: var(--surface-app); }
a { color: var(--text-link); } a:hover { color: var(--blue-700); }
```
Remove the Vite starter styles in `App.css` / `index.css` (purple accent, dark-mode media query) — they conflict with the brand.

## Tokens
Always reference semantic aliases in components; base tokens only when no alias fits.

| Purpose | Token |
|---|---|
| Body text / headings / secondary / muted | `--text-primary` / `--text-heading` / `--text-secondary` / `--text-muted` |
| Text on dark | `--text-on-dark`, `--text-on-dark-muted` |
| Links | `--text-link` |
| App canvas / card | `--surface-app` / `--surface-card` |
| Dark top nav / tenant sidebar | `--surface-nav-dark` / `--surface-sidebar` |
| Borders | `--border-default`, `--border-strong` |
| Actions | `--action-primary`, `--action-secondary`, `--action-soft` |
| Success | `--success`, `--success-soft` |
| Radii | `--radius-xs` 4 · `--radius-sm` 6 · `--radius-md` 8 · `--radius-lg` 10 · `--radius-xl` 12 · `--radius-pill` 50 |
| Shadow | `--shadow-card` (0 1px 3px rgba(0,0,0,.05)) |

**Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 px. Copy exact values from Figma; don't round.

## Components
Build these in `backend/frontend/src/components/`, one folder each, typed props. Figma names in brackets.

### Button
| Variant | Fill | Label | Use |
|---|---|---|---|
| primary | `--action-primary` | white | main action per view |
| secondary | `--action-secondary` | white | alternative action |
| soft | `--action-soft` (#A3C6D9) | Black Steel | low-emphasis |
| text | none | `--text-link` | inline / "Xem tất cả →" |
Radius 8–12px, Inter 500–600 14–16px, optional trailing ↗ / → icon. Disabled: 40% opacity, no pointer.

### Input [`input`]
`type`: text | dropdown. `state`: active · selected · filled · error · inactive. Label above (12px), value 14px, trailing status glyph [`state`: clear / alert / error] and [`chevron`] for dropdowns. Error state uses red border + message under field.

### Radio [`Radio buttons`]
States enabled · hovered · focused · pressed · disabled, selected true/false. Hover/press shows a circular state layer at 8–10% of the primary colour; focus shows a ring [`Focus indicator`].

### Social sign-in [`Social Buttons`, `Social Icons`]
Providers: Google, Facebook, Apple (+ GitHub, Twitter, Slack, Figma, Dribbble in Figma). Style colour or white; with or without label; idle / active / disabled. Use on Sign in / Create account only.

### Cards
- **Property card:** cover photo (radius 10–12), title 16/600, location 12px muted, amenity row with icons (bed, shower, area), price in Philadelphia, heart (like) toggle top-right. Light and dark variants exist; liked/bookmarked state fills the heart.
- **Metric card (tenant dashboard):** white, hairline border, icon + label 12px + value 20–24px bold.
- **Rent request / tour booking / tenant message:** compact white card, avatar circle, name, status chip ("Chờ duyệt"), primary + text actions.

### Navigation
- **Top bar (public + owner):** height 94px, `--surface-nav-dark`, logo-dark left, links 14px white/`--text-on-dark-muted`, language pill (radius 50) and auth buttons right.
- **Tenant sidebar:** width 240px, `--surface-sidebar`, eyebrow "TRANG CỦA BẠN", items 14px; active item on `--navy-800` pill radius 6.
- **Role switch:** segmented "Người thuê / Chủ nhà" control, radius 6.

### Footer
Light and dark variants; dark uses Black Steel with `--text-on-dark-muted` links, logo-dark.

### Modal
White, radius 12, max-width ~560px, title 20/600, close [`ci:close-md`] top-right, actions bottom-right (text + primary). Backdrop Black Steel at ~50%.

## Icons
Iconify line icons (akar, basil, bi, clarity, energy-icons, fluent, hugeicons…), single colour `currentColor`, 16–24px. Recommended: `@iconify/react` with the exact names from Figma (e.g. `clarity:home-line`, `fluent:bed-20-regular`, `energy-icons:map-pin-20`, `basil:search-outline`, `weui:like-outlined`). No emoji, no icon fonts.

## Screens (Figma → routes)
| Area | Figma frame | Suggested route |
|---|---|---|
| Public | homepage, homepageWhenActive | `/` |
| Public | List Property, Map View, Detail card | `/nha`, `/ban-do`, `/nha/:id` |
| Auth | Sign in, Create account, Signed out | `/login`, `/register`, `/logout` |
| Tenant | Dashboard, Căn hộ đang thuê, Thanh toán, Yêu cầu sửa chữa, Yêu thích, Thông báo, Trang cá nhân | `/tenant/*` |
| Owner | Owner dashboard, New Property S1–S3 | `/owner`, `/owner/bat-dong-san/moi` |
