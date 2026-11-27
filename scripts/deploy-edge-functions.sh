#!/usr/bin/env bash
# Deploy Supabase edge functions with the correct auth mode. The AUTH_MODE
# map below is the record of each function's two decisions (CLAUDE.md, Edge
# Function Policy): auth mode (the flag) and role context (the comment).
# Prevents the "forgot --no-verify-jwt" class of bug (the v0.3.1 cascade).
#
# Usage:
#   ./scripts/deploy-edge-functions.sh           # deploy all
#   ./scripts/deploy-edge-functions.sh spotify-search  # deploy one
#
# Requires: SUPABASE_ACCESS_TOKEN in env (source .env.supabase.local first).

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-khzeuxxhigqcmrytsfux}"

# Auth mode per function, with its role context. A new function needs an
# entry here and in smoke-edge-functions.sh. Role "service_role" means every
# public table it touches needs GRANT ... TO service_role.
declare -A AUTH_MODE=(
  [spotify-search]=""          # verify JWT; external HTTP only, no DB
  [delete-account]=""          # verify JWT; caller runs delete_account RPC, service_role only for auth.admin.deleteUser
)

# List of functions in deploy order
ALL_FUNCTIONS=(spotify-search delete-account)

require_token() {
  if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    echo "Error: SUPABASE_ACCESS_TOKEN not set. Run: source .env.supabase.local" >&2
    exit 1
  fi
}

deploy_one() {
  local fn="$1"
  if [[ -z "${AUTH_MODE[$fn]+x}" ]]; then
    echo "Error: function '$fn' not in AUTH_MODE map. Add it to this script's map and to smoke-edge-functions.sh." >&2
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
