# Test Harness — Multi-User Scripts

Scripts for provisioning test users and driving them through real
Supabase flows (personas, catalog seeding, etc.)
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

## Example flow — exercise the full jam session happy path

```bash
# One-time prep
npm run harness -- ensure
npm run harness -- seed-songs alice --preset=default
npm run harness -- seed-songs bob --preset=default

# Bob checks his catalog
npm run harness -- list-songs bob
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
