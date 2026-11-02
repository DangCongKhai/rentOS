<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# rentOS frontend

Test feature behavior: what the user can do and what the screen shows for success, empty, and error results.

Do not add tests just to prove the app shell, providers, or tooling are configured. Add a test when a feature has behavior worth protecting.

Raster photos use `next/image` from `next/image`. A `fill` image includes a `sizes` value that matches its layout. A raw `<img>` is only for a small SVG, and that line keeps an explicit `eslint-disable-next-line @next/next/no-img-element`.
