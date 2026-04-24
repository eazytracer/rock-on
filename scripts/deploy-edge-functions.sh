#!/usr/bin/env bash
# Deploy Supabase edge functions with the correct auth mode per
# supabase/functions/FUNCTIONS.md. Prevents the "forgot --no-verify-jwt"
# class of bug (v0.3.1 jam-view cascade).
#
# Usage:
#   ./scripts/deploy-edge-functions.sh           # deploy all
#   ./scripts/deploy-edge-functions.sh jam-view  # deploy one
#
# Requires: SUPABASE_ACCESS_TOKEN in env (source .env.supabase.local first).

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-khzeuxxhigqcmrytsfux}"

# Auth mode per function — mirror of FUNCTIONS.md. If you change this
# table, update the manifest in the same commit.
declare -A AUTH_MODE=(
  [jam-view]="--no-verify-jwt"
  [jam-recompute]=""  # verify JWT (default)
  [spotify-search]="" # verify JWT (default)
)

# List of functions in deploy order
ALL_FUNCTIONS=(jam-view jam-recompute spotify-search)

require_token() {
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    echo "Error: SUPABASE_ACCESS_TOKEN not set. Run: source .env.supabase.local" >&2
    exit 1
  fi
}

deploy_one() {
  local fn="$1"
  if [[ -z "${AUTH_MODE[$fn]+x}" ]]; then
    echo "Error: function '$fn' not in AUTH_MODE map. Update this script and supabase/functions/FUNCTIONS.md." >&2
    exit 1
  fi
  local flag="${AUTH_MODE[$fn]}"
  echo ""
  echo "──────────────────────────────────────────────"
  echo "Deploying: $fn"
  echo "Auth mode: ${flag:-verify JWT (default)}"
  echo "──────────────────────────────────────────────"
  # shellcheck disable=SC2086
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" $flag
}

main() {
  require_token

  if [[ $# -gt 0 ]]; then
    for fn in "$@"; do
      deploy_one "$fn"
    done
  else
    echo "Deploying all edge functions…"
    for fn in "${ALL_FUNCTIONS[@]}"; do
      deploy_one "$fn"
    done
  fi

  echo ""
  echo "✓ Deploy complete. Run ./scripts/smoke-edge-functions.sh to verify."
}

main "$@"
