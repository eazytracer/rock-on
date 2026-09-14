#!/usr/bin/env bash
# Apply / inspect PRODUCTION Supabase migrations from a machine that can't use
# `supabase link` (e.g. this Mac mini: the direct DB host is IPv6-only and the
# access token lacks the org-level privilege `link` wants). This connects over
# the IPv4 Supavisor pooler using an explicit --db-url instead.
#
# The DB password is read from SUPABASE_DB_PASSWORD and URL-encoded here, so it
# never appears in argv or shell history.
#
# Setup (one-time): put these in .env.supabase.local (gitignored, one `export`
# line each — never append, rewrite):
#   export SUPABASE_ACCESS_TOKEN=sbp_...        # (used by other supabase cmds)
#   export SUPABASE_DB_PASSWORD=...             # Project Settings -> Database
#
# Usage:
#   source .env.supabase.local
#   scripts/prod-db.sh list          # READ-ONLY: local-vs-remote migration delta
#   scripts/prod-db.sh push          # apply unapplied migrations to prod
#
# The pooler host/ref default to this project but can be overridden via env
# (SUPABASE_PROJECT_REF, SUPABASE_POOLER_HOST, SUPABASE_POOLER_PORT) — get the
# exact pooler host from:
#   GET https://api.supabase.com/v1/projects/<ref>/config/database/pooler
set -euo pipefail

: "${SUPABASE_DB_PASSWORD:?set SUPABASE_DB_PASSWORD (source .env.supabase.local)}"

REF="${SUPABASE_PROJECT_REF:-khzeuxxhigqcmrytsfux}"
HOST="${SUPABASE_POOLER_HOST:-aws-1-us-east-1.pooler.supabase.com}"
PORT="${SUPABASE_POOLER_PORT:-6543}"
DBUSER="postgres.${REF}"

# URL-encode the password (RFC 3986 unreserved set) without spawning python.
enc=""
i=0
while [ "$i" -lt "${#SUPABASE_DB_PASSWORD}" ]; do
  c="${SUPABASE_DB_PASSWORD:$i:1}"
  case "$c" in
    [a-zA-Z0-9.~_-]) enc="${enc}${c}" ;;
    *) enc="${enc}$(printf '%%%02X' "'$c")" ;;
  esac
  i=$((i + 1))
done

DBURL="postgresql://${DBUSER}:${enc}@${HOST}:${PORT}/postgres"

# Dispatch:
#   list / up / repair / squash / fetch  -> supabase migration <sub> --db-url ...
#   push                                 -> supabase db push --db-url ...
cmd="${1:-list}"
shift || true
case "$cmd" in
  push)
    exec supabase db push --db-url "$DBURL" "$@"
    ;;
  *)
    exec supabase migration "$cmd" --db-url "$DBURL" "$@"
    ;;
esac
