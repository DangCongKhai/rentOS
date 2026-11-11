# rentOS — Brand Guidelines

rentOS is a long-term rental management platform for Da Nang, Vietnam. One account, two roles: **Người thuê (Tenant)** and **Chủ nhà (Owner)**.

Source of truth: Figma file *rentOS Design (AWDesign)* — page **Components** (Logo, Colour Palette, Type Hierarchy sections).

## Brand essence
- Promise: *A better way to find and manage your home.*
- Personality: simple, transparent, connected, trustworthy, approachable.
- Feeling: calm and clear — never loud, never salesy.

## Logo
| File | Use on |
|---|---|
| `design/assets/logo-rentos-dark.png` | dark backgrounds (Black Steel header, navy sidebar, dark footer) |
| `design/assets/logo-rentos-light.png` | white / light backgrounds |

- Minimum size **130 × 37 px**.
- Keep clear space ≥ the height of the "r" on all sides.
- Never recolor, stretch, rotate, add shadows/outlines, or place on busy photos without a solid backing.
- Don't recreate the logo in type or SVG — always use the supplied files.

## Colour palette
| Name | Hex | Role |
|---|---|---|
| Philadelphia | `#3368A0` | Primary actions, logo, key highlights |
| Placid | `#66A3BF` | Secondary buttons/highlights |
| Cherub | `#8FBCD0` | Soft backgrounds, info panels, cards |
| Black Steel | `#091216` | Main text, dark nav bar, footer |
| Full White | `#FFFFFF` | Surfaces, text on dark |

Supporting product colours: Blue 600 `rgb(27,107,198)` (links, active nav), Navy 850 `rgb(18,33,41)` (tenant sidebar), Navy 900 `rgb(16,35,55)` (headings), Success `rgb(19,164,122)`. Full list in `design/tokens/rentos-tokens.css`.

**Rules:** blue-led and calm; one primary (Philadelphia) action per view; no gradients; no extra accent hues without design review.

## Typography
**Inter** for all product UI (Vietnamese diacritics supported).

| Style | Size / line | Weight | Tracking |
|---|---|---|---|
| H1 | 56 / 64 | 800 ExtraBold | −4% |
| H2 | 40 / 48 | 700 Bold | −4% |
| H3 | 36 / 42 | 700 Bold | −4% |
| H4 | 28 / 36 | 600 Semibold Italic | −2% |
| Subheadline | 24 / 32 | 400 | −4% |
| Body | 14 / 20 | 400 | 0 |
| Small / meta | 12 / 16 | 400 | 0 |
| Eyebrow | 10 | 600, UPPERCASE | +10% |

Secondary faces (limited use): Plus Jakarta Sans (dense card UI), Playfair Display (editorial titles), Reddit Sans 500 (large figures), Liberation Mono (codes/IDs).

## Voice & tone
- Write in **Vietnamese** with full diacritics; address the user as **"bạn"**. Greeting: "Chào, {Tên}!"
- Sentence case for headings and buttons. UPPERCASE only for small eyebrow labels (e.g. "TRANG CỦA BẠN").
- CTAs: short imperatives — "Tìm nhà ngay!", "Đăng nhập lại", "Thêm bất động sản". Secondary links end with "→".
- Be concrete about status: "2 yêu cầu thuê cần xét duyệt", "Chờ duyệt".
- Money: `3.500.000 VNĐ` (dot thousands separator), per month "/ tháng".
- No emoji. Use "·" as a meta separator (`2 PN · 1 WC · 45 m²`).

## Imagery
Bright, natural-light photos of real interiors/exteriors, slightly warm. Cropped `object-fit: cover` inside rounded cards (8–12px). Avatars are circles with a 2px white ring. No stock illustrations, patterns or textures.
