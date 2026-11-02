#!/usr/bin/env bash
set -uo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

run_suite() {
  local name="$1"
  local dir="$2"
  local command="$3"

  (
    cd "$dir" || exit 1
    bash -c "$command"
    exit_code=$?
    printf '%s' "$exit_code" > "$tmp/$name.status"
    exit "$exit_code"
  ) 2>&1 | sed "s/^/[$name] /" &
  printf '%s' "$!" > "$tmp/$name.pid"
}

echo "Running frontend and backend checks together."
run_suite frontend "$root/frontend" "npm run lint && npm run typecheck && npm test && npm run build"
run_suite backend "$root/backend" "composer run lint && composer run typecheck && php artisan test"

wait "$(cat "$tmp/frontend.pid")" || true
wait "$(cat "$tmp/backend.pid")" || true

# Turbopack's workspace root is the repository, so a local build can leave .next here.
rm -rf "$root/.next"

frontend_status="$(cat "$tmp/frontend.status" 2>/dev/null || echo 1)"
backend_status="$(cat "$tmp/backend.status" 2>/dev/null || echo 1)"

printf '\nfrontend: %s\nbackend: %s\n' \
  "$([[ "$frontend_status" == 0 ]] && echo passed || echo failed)" \
  "$([[ "$backend_status" == 0 ]] && echo passed || echo failed)"

[[ "$frontend_status" == 0 && "$backend_status" == 0 ]]
