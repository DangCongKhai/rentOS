# rentOS — UI/UX Guidelines

## Principles
1. **Clarity over decoration.** Flat white cards on a pale canvas; colour is reserved for actions and status.
2. **One account, two roles.** Role (Tenant / Owner) is always visible and switchable; each role has its own workspace.
3. **Transparent money.** Prices, due dates and payment status are always explicit — never hidden behind clicks.
4. **Status first.** Lead dashboards with what needs attention ("2 yêu cầu thuê cần xét duyệt").

## Layout
- Desktop design width **1440px**; content max-width ~1200px, side padding 32px+. Must reflow down to 360px mobile.
- Public/owner: fixed dark top bar (94px). Tenant: 240px dark sidebar + light canvas; collapse to drawer < 1024px.
- Use CSS grid/flex with `gap`; spacing from the 4/8/12/16/24/32 scale.
- Card grids: 3–4 columns desktop, 2 tablet, 1 mobile.

## Interaction states
(Not specified in Figma — team standard.)
- Hover: buttons darken ~8%; links → `--blue-700`; cards may raise to `--shadow-card`.
- Press: darker fill, no scale. Focus: 2px `--blue-600` outline, 2px offset — always visible for keyboard users.
- Disabled: 40% opacity, `cursor: not-allowed`.
- Motion: 150–200ms `ease-out` on colour/opacity only. Respect `prefers-reduced-motion`.

## Forms
- Label above field, 12px; placeholder is an example, never the label.
- Validate on blur; error text under the field in plain Vietnamese ("Số điện thoại không hợp lệ").
- Multi-step flows (New Property S1–S3) show step indicator and keep "Quay lại" / "Tiếp tục" in the same place every step.
- Rental type choices use radio cards (one selection).

## Key flows
- **Find a home:** Homepage search → List or Map view → Detail → Request tour / Request to rent → (Sign in if needed).
- **Tenant:** Dashboard (next payment, current apartment, activity) → Pay rent → File repair request → Track status in Notifications.
- **Owner:** Dashboard (requests, tours, revenue) → Review rent request → Add property (3 steps).

## Feedback & empty states
- Confirm actions inline (toast/banner): "Đã gửi yêu cầu."
- Empty states: one sentence + one action ("Bạn chưa lưu căn nào. Tìm nhà ngay!").
- Loading: skeleton blocks in `--surface-2`, not spinners, for lists/cards.

## Accessibility
- Text contrast ≥ 4.5:1 (Black Steel / Navy on white; white on Philadelphia passes; don't put white text on Cherub or Placid at body size).
- Hit targets ≥ 44px on touch.
- Every icon-only button has `aria-label` in Vietnamese.
- Don't rely on colour alone for status — pair with text ("Chờ duyệt", "Đã thanh toán").

## Copy checklist
Vietnamese with diacritics · "bạn" · sentence case · VNĐ with dot separators · dates `dd/mm/yyyy` · no emoji.

## Definition of done (UI PRs)
- [ ] Uses tokens — no raw hex in components
- [ ] Matches Figma frame (spacing/radius/type values copied, not rounded)
- [ ] Hover, focus, disabled and error states implemented
- [ ] Works at 360px, 768px, 1440px
- [ ] Copy reviewed against brand voice
- [ ] Screenshot attached to the PR
