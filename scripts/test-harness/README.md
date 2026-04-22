# Test Harness — Multi-User Scripts

Scripts for provisioning test users and driving them through real
Supabase flows (jam sessions, catalog seeding, realtime watching, etc.)
**from the command line**. Complements Playwright E2E tests, which
can't easily drive more than one authenticated user at a time.

**Quick orientation:**

- Fixed personas: `alice`, `bob`, `carol` (add more in `config.ts`).
- Personas are stored in Supabase Auth with known passwords; the
  harness reuses them across runs. Pass `--fresh` to wipe + recreate.
- All data operations go through real Supabase clients — admin
  (service role) for provisioning and inspection, authenticated
  (user JWT) for anything that should exercise RLS.

## Prerequisites

- Local Supabase running: `npm run start:dev` (or `supabase start`)
- `.env.test` populated: `npm run setup:local` if missing
- Env var the harness reads: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Commands

All commands run via `npm run harness -- <command> [args]` (or
`tsx scripts/test-harness/cli.ts <command>` directly).

| Command                                                                   | What it does                                                                                                                                                                       |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ensure [--fresh]`                                                        | Provision all fixed personas (auth user + users row + user_profiles row). `--fresh` deletes + recreates. Orphaned `public.users` rows from a prior aborted reset are auto-cleaned. |
| `reset [<persona>...]`                                                    | Delete one, many, or all personas and their data. No args = all. Cleans both `auth.users` and any orphaned `public.users` row sharing the email.                                   |
| `sign-in <persona>`                                                       | Print access + refresh tokens (JSON) for the persona. Use the access token as `Authorization: Bearer ...` or paste into browser localStorage via the dev snippet.                  |
| `seed-songs <persona> [--count=N] [--file=songs.json] [--preset=default]` | Insert songs into the persona's **personal** catalog. Uses the persona's JWT (respects RLS).                                                                                       |
| `seed-setlist <persona> [--name=<n>] [--count=N] [--json]`                | Create a **personal** setlist from songs already in the persona's catalog. Returns the setlist id.                                                                                 |
| `list-songs <persona>`                                                    | Print the persona's personal catalog.                                                                                                                                              |
| `create-jam <persona> [--name=<n>] [--seed-from=<setlistId>] [--json]`    | Persona creates a jam session. With `--seed-from`, projects that personal setlist's songs into the jam's broadcast `setlistItems`.                                                 |
| `join-jam <persona> <joinCode>`                                           | Persona joins an existing jam session via join code.                                                                                                                               |
| `recompute <sessionId> [--as=<persona>]`                                  | Invoke the `jam-recompute` Edge Function (default acts as alice). Mirrors the auto-recompute the app does on participant changes.                                                  |
| `dump-session <sessionId>`                                                | Full snapshot — session row, participants (with display names), matches, host queue, working setlist.                                                                              |
| `watch <sessionId>`                                                       | Stream realtime changes for the session. One event per stdout line. Ctrl-C to stop.                                                                                                |

## Example flow — exercise the full jam session happy path

```bash
# One-time prep
npm run harness -- ensure
npm run harness -- seed-songs alice --preset=default
npm run harness -- seed-songs bob --preset=default

# Alice starts a jam
OUT=$(npm run harness -- create-jam alice --name="Friday Practice" --json)
SESSION_ID=$(echo "$OUT" | jq -r .id)
JOIN_CODE=$(echo "$OUT" | jq -r .joinCode)

# In another terminal: watch realtime
npm run harness -- watch "$SESSION_ID"

# Bob joins
npm run harness -- join-jam bob "$JOIN_CODE"

# Inspect
npm run harness -- dump-session "$SESSION_ID"
```

## Example flow — seed jam from a personal setlist

```bash
npm run harness -- ensure
npm run harness -- seed-songs alice --preset=default
npm run harness -- seed-songs bob --preset=default

# Alice creates a personal setlist from her catalog
SETLIST=$(npm run harness -- seed-setlist alice --name="Friday Set" --json)
SETLIST_ID=$(echo "$SETLIST" | jq -r .id)

# Alice starts a jam pre-seeded with that setlist; bob joins.
JAM=$(npm run harness -- create-jam alice --seed-from="$SETLIST_ID" --json)
SESSION_ID=$(echo "$JAM" | jq -r .id)
JOIN_CODE=$(echo "$JAM" | jq -r .joinCode)
npm run harness -- join-jam bob "$JOIN_CODE"

# Confirm the broadcast setlist is populated. dump-session will show
# `seedSetlist:` and N entries under `setlistItems:`.
npm run harness -- dump-session "$SESSION_ID"
```

## Browser session injection

`sign-in` prints an access token and refresh token. To act as a persona
in the browser, paste this snippet into the devtools console (replace
`<ACCESS_TOKEN>` and `<REFRESH_TOKEN>` with the values from `sign-in`):

```js
// Paste into the app's devtools console
const { createClient } = await import('@supabase/supabase-js')
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
await supabase.auth.setSession({
  access_token: '<ACCESS_TOKEN>',
  refresh_token: '<REFRESH_TOKEN>',
})
location.reload()
```

(A dev-panel button that wraps this is tracked as a follow-up.)

## Safety

- The harness only targets the local Supabase instance
  (`VITE_SUPABASE_URL=http://127.0.0.1:54321`). It refuses to run if
  the URL points anywhere else.
- Service role key is required for admin operations; user flows use
  real JWTs so RLS is exercised.
