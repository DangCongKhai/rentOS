<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# rentOS frontend

## Full CI Suite Requirements

**MANDATORY**: Complete the full CI suite before claiming work is done. Zero tolerance for ANY errors.

### Frontend Checks (MUST ALL PASS):

- `npm run lint` → exit code 0 (no ESLint errors)
- `npm run typecheck` → exit code 0 (no TypeScript errors)
- `npm test` → exit code 0 (all tests passing)
- `npm run build` → exit code 0 (successful production build)

### Backend Checks (MUST ALL PASS):

- `composer run lint` → no errors
- `composer run typecheck` → exit code 0 (no PHPStan errors)
- `composer run test` → all tests passing
- Backend builds successfully

### Rules:

- Do NOT say "done", "fixed", or "complete" until BOTH frontend AND backend pass ALL checks
- Run full CI suite before declaring work finished: `npm run lint && npm run typecheck && npm test && npm run build`
- React Compiler strict mode violations must be fixed, not ignored (except with explicit justification)
- Do NOT commit or push code with ANY linting/type/test errors in either frontend or backend

Common violations to avoid:

- Accessing refs during render (`formRef.current` in component body)
- Calling `setState` synchronously within effects
- Using `<a>` tags for internal navigation (use `<Link />` from `next/link`)
- Unused variables and imports

## Testing Philosophy

Test feature behavior: what the user can do and what the screen shows for success, empty, and error results.

Do not add tests just to prove the app shell, providers, or tooling are configured. Add a test when a feature has behavior worth protecting.

## Images

Raster photos use `<Image>` from `next/image`. A `fill` image includes a `sizes` value that matches its layout.

Use raw `<img>` only for small SVGs, and that line must have an explicit `eslint-disable-next-line @next/next/no-img-element` comment.

## Growing Lists Scroll Inside Their Container

A list, photo grid, table, or repeated row that can grow past a few items scrolls inside its own container (`max-height` and `overflow-y-auto`).

The primary action for that screen stays outside the scroller, in view, at the bottom of the card or in the section header. Do not let the growing content push that action below the fold.

## Client-Side Validation

Before submitting forms to the backend:

1. Validate all required fields client-side
2. Show specific, field-level error messages
3. Parse backend validation errors (422 responses) and display them clearly
4. Use toast notifications for validation feedback with appropriate duration (5-6 seconds for errors)

Example error format: `"Room 1 - Field Name: Error message"` (Vietnamese: `"Phòng 1 - Tên trường: Lỗi cụ thể"`)

## State Management Patterns

### Location Search Debouncing

Use the pattern from `src/features/discovery/listing-filters.tsx`:

- Keep `locationDraft` state separate from committed location
- Use `committedLocation` ref to track what's been submitted
- Debounce search updates (use `searchInputDebounceMs` constant)
- Clean up debounce on unmount

### Refs in React 19

- Do NOT access `ref.current` during render
- Do NOT update refs during render (no `myRef.current = value` in component body)
- Access refs only in:
  - Event handlers
  - Effects
  - Callbacks passed to child components
- If you must read a ref for display purposes, use `useMemo` with explicit `eslint-disable-next-line react-hooks/refs`

## API Error Handling

Use the `ApiError` class from `@/lib/auth-api`:

```typescript
try {
  await apiCall();
} catch (error) {
  if (error instanceof ApiError && error.status === 422) {
    // Parse validation errors from error.errors object
    // Show specific field-level messages
  } else if (error instanceof ApiError) {
    toast.error(error.message);
  } else {
    toast.error("Generic fallback message");
  }
}
```
