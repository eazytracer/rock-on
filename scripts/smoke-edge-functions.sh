#!/usr/bin/env bash
# Smoke-test deployed Supabase edge functions against their expected
# unauthenticated GET status per supabase/functions/FUNCTIONS.md.
#
# Purpose: catch deploy-time regressions where a function lost its
# --no-verify-jwt flag (→ unexpected 401) or got it accidentally (→
# unexpected 200 on an endpoint that should require auth).
#
# Usage: ./scripts/smoke-edge-functions.sh [project-url]
#   project-url defaults to the hosted prod URL.
#
# Exit 0 = all functions responded as expected. Exit 1 = one or more
# drifted from the manifest.

set -euo pipefail

PROJECT_URL="${1:-https://khzeuxxhigqcmrytsfux.supabase.co}"
BASE="$PROJECT_URL/functions/v1"

# Expected HTTP status for an unauthenticated GET (or GET with documented
# minimal params). Mirror of FUNCTIONS.md column "Expected unauthenticated
# GET status" — if this changes, update both in the same commit.
#
# - jam-view: anonymous is OK, but without `code` + `t` params the
#   function returns 400 "Missing code or token". That's the marker that
#   the JWT gate is properly disabled.
# - jam-recompute: requires JWT — anonymous GET is 401 at the gateway.
# - spotify-search: requires JWT — same.
declare -A EXPECTED_STATUS=(
  [jam-view]="400"
  [jam-recompute]="401"
  [spotify-search]="401"
)

ALL_FUNCTIONS=(jam-view jam-recompute spotify-search)

pass=0
fail=0
failed_names=()

check_one() {
  local fn="$1"
  local expected="${EXPECTED_STATUS[$fn]}"
  local url="$BASE/$fn"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" "$url")

  if [[ "$actual" == "$expected" ]]; then
    echo "  ✓ $fn → $actual (expected $expected)"
    pass=$((pass + 1))
  else
    echo "  ✗ $fn → $actual (expected $expected)"
    fail=$((fail + 1))
    failed_names+=("$fn")
  fi
}

echo "Smoke-testing edge functions at $BASE"
echo "──────────────────────────────────────────────"
for fn in "${ALL_FUNCTIONS[@]}"; do
  check_one "$fn"
done
echo "──────────────────────────────────────────────"
echo "$pass passed, $fail failed"

if [[ $fail -gt 0 ]]; then
  echo ""
  echo "Failures: ${failed_names[*]}"
  echo ""
  echo "Interpretation:"
  echo "  - 401 when 400/200 expected → function needs redeploying with --no-verify-jwt"
  echo "  - 200/400 when 401 expected → function deployed without JWT verification (security risk)"
  echo "  - 404 → function is not deployed to this project"
  echo "  - 500 → function crashed on the request; check logs"
  echo ""
  echo "See supabase/functions/FUNCTIONS.md for the expected matrix."
  exit 1
fi
