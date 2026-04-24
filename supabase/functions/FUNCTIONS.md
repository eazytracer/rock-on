# Edge Functions Manifest

Every edge function has a row here. A PR that adds or modifies an edge
function without updating this manifest is incomplete. See CLAUDE.md
§ "Edge Function Policy" for the full policy.

## Manifest

| Name             | Auth mode         | Role context                           | Anonymous? | Calls public tables?                                                             | Expected unauthenticated GET status                                      |
| ---------------- | ----------------- | -------------------------------------- | ---------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `jam-view`       | `--no-verify-jwt` | service_role                           | Yes        | `jam_sessions`, `jam_participants`, `jam_song_matches`, `user_profiles`, `users` | 200 (with valid code+token) / 400 (missing params) / 404 (invalid token) |
| `jam-recompute`  | verify JWT        | service_role (writes) + caller (reads) | No         | `jam_participants`, `jam_song_matches`, `songs`; calls `replace_jam_matches` RPC | 401                                                                      |
| `spotify-search` | verify JWT        | external HTTP only (no DB)             | No         | None                                                                             | 401                                                                      |

## Field reference

- **Auth mode** — the `--verify-jwt` / `--no-verify-jwt` flag passed to
  `supabase functions deploy`. `--no-verify-jwt` allows anonymous callers
  (Supabase gateway does not enforce JWT presence); `--verify-jwt`
  (default) rejects requests with missing/invalid JWT at the gateway.
- **Role context** — which Postgres role(s) the function's supabase-js
  client uses. If "service_role" appears here, every public table the
  function reads/writes MUST have explicit `GRANT ... TO service_role`
  per `CLAUDE.md` § "Migration Policy". If "caller" appears, the function
  relies on RLS and the caller's `authenticated` JWT.
- **Calls public tables?** — enumerate the tables. Used by the smoke
  script to verify grants are present after any migration.
- **Expected unauthenticated GET status** — baseline health-check result
  when hitting the function URL with no `Authorization` header and no
  query parameters (or documented minimal params). The
  `scripts/smoke-edge-functions.sh` smoke test expects this status.

## Historical bugs tied to misses here

- **v0.3.1 `jam-view` 401 cascade** — function was deployed with default
  verify-jwt behavior on first deploy, rejecting every anonymous caller.
  Manifest enforcement prevents this on redeploys.
- **v0.3.1 `jam-view` 404 cascade** — function's service_role client
  couldn't read the jam tables because the migration didn't grant to
  service_role. The "Calls public tables?" column is now a signal to
  `npm run lint:migrations` that those tables must have service_role
  grants.

## Adding a new function

1. Create `supabase/functions/<name>/index.ts`
2. Add a row to the manifest table above
3. If the function uses service_role to read/write any public table, make
   sure those tables are granted to service_role (or add them to the
   current release's migration)
4. Add a smoke assertion to `scripts/smoke-edge-functions.sh`
5. Deploy via `./scripts/deploy-edge-functions.sh <name>` (reads this
   manifest to pick the right `--verify-jwt` / `--no-verify-jwt` flag)
