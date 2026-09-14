# rock-on Development Guidelines

Coding rules and project policy for agents working in this repo. For the broader
"how we build" process (research → plan → implement → test → release), see
`docs/DEVELOPMENT.md`.

## Development Strategy

1. **Think before coding.** State assumptions explicitly; if uncertain, ask. If
   multiple interpretations exist, present them — don't pick silently. If a
   simpler approach exists, say so. If something is unclear, stop and name it.
2. **Simplicity first.** Minimum code that solves the problem, nothing
   speculative. No abstractions for single-use code, no unrequested
   "flexibility," no error handling for impossible scenarios. If 200 lines could
   be 50, rewrite it.
3. **Surgical changes.** Touch only what you must. Don't refactor or reformat
   adjacent code, don't fix unrelated things (mention them instead). Remove
   orphans your own changes create; leave pre-existing dead code alone unless
   asked. Every changed line should trace to the request.
4. **Goal-driven execution.** Turn tasks into verifiable goals ("add validation"
   → "write tests for invalid inputs, then make them pass"). Loop until verified.

## Versioning & Release Policy (REQUIRED)

**🚨 No PR that ships to production may merge without bumping the version.**

Releasing splits cleanly into two phases. This split resolves the tag
chicken-and-egg: a git tag must point at the **merge commit**, which does not
exist until the PR merges — so tagging is inherently post-merge, and never
requires an extra "release commit".

**Phase 1 — IN the PR (before merge), part of the reviewable diff:**

1. **Bump `package.json` `version`** per SemVer (pre-1.0: features may be a patch,
   but the number MUST change — never reuse a shipped version).
2. **Add a dated `## [x.y.z]` section to `CHANGELOG.md`** (move items out of
   `[Unreleased]`), grouped Added / Changed / Fixed / Database.
3. **Add a `release_notes` row** for the version (idempotent upsert, in the PR's
   migration) — this drives the in-app "what's new" notification (`release_notes`
   vs `users.last_seen_release_version`).

The merge commit therefore already carries the correct version, changelog, and
release-notes row.

**Phase 2 — AFTER merge, on `main` (no new commit):**

4. **Tag the merge commit** `vX.Y.Z` (annotated) and push the tag; create the
   GitHub release from the CHANGELOG section. A tag is a pointer to the existing
   merge commit — it adds no commit and changes no files.

`/finalize` performs Phase 1 (on the feature branch, before the PR). `/release`
performs Phase 2 only (on `main`, after merge) — it does **not** re-bump or
re-commit. A DB migration in the PR is a strong signal it is prod-bound — treat
it as release-gated.

**Enforcement (`.github/workflows/release-metadata.yml`):** Phase 1 is checked on
every `pull_request` → `main` (version bumped vs `origin/main` + a dated
`## [<version>]` CHANGELOG section present), bypassable only via a `skip-release`
label for non-prod chores. Phase 2 is audited on `push` → `main` (a `v<version>`
tag must exist for the merged `package.json` version, else the job fails loudly).

## Active Technologies

TypeScript 5.x, React 18+, TailwindCSS, Vite. Supabase (Postgres/Auth/Realtime/
Edge Functions). Offline-first: IndexedDB (Dexie) + sync queue. Testing: Vitest,
Playwright, pgTAP.

## Project Structure

```
src/
  ├── config/          # App configuration (mode detection)
  ├── services/
  │   ├── data/        # Repository pattern & sync engine
  │   ├── auth/        # Authentication services
  │   └── supabase/    # Supabase client
  ├── components/ pages/ hooks/ contexts/ models/ utils/
tests/
  ├── unit/            # mirror src/ structure
  ├── integration/ e2e/ (Playwright) contract/
supabase/
  ├── migrations/ functions/ tests/ (pgTAP)
```

## Commands

```bash
npm run start:dev   # ALWAYS use this to start dev — never start Supabase, the
                    # dev server, or edge functions manually. Handles the full
                    # sequence: local Supabase → dev .env → edge functions
                    # (supabase functions serve --no-verify-jwt, required for
                    # jam-view + Spotify search) → Vite. Edge logs: /tmp/edge-functions.log
npm run setup:local # First-time: start Supabase + generate .env.development/.env.test

npm run dev         # Dev server only
npm run build       # Production build
npm run lint        # Lint
npm run type-check  # tsc --noEmit
```

Test commands and layout live in `tests/README.md` (the single source). Quick
reference: `npm test` (unit+integration), `npm run test:quick` (~2s), `npm run
test:e2e` (Playwright — needs `supabase start` + `npm run env:dev`), `npm run
test:db` (pgTAP), `npm run test:all`.

Environment management: `ENVIRONMENTS.md`.

## Supabase — Remote (production) access

**🚨 Secret handling (non-negotiable):**

- **Never** `echo`/`cat`/`printf`/`od`/`xxd` the contents of
  `.env.supabase.local` or `$SUPABASE_ACCESS_TOKEN`. To check a token is set
  without printing it:
  ```bash
  source .env.supabase.local
  echo "token length: ${#SUPABASE_ACCESS_TOKEN}, prefix: ${SUPABASE_ACCESS_TOKEN:0:4}"
  # Valid tokens are prefixed `sbp_` and ~50-60 chars.
  ```
- If a token is ever printed in full, **revoke it immediately** (Supabase Studio →
  Account → Access Tokens) and generate a new one.
- `.env.supabase.local` must be in `.gitignore`. Exactly one
  `export SUPABASE_ACCESS_TOKEN=...` line; rewrite the whole file when rotating
  (appending silently concatenates into an invalid token).

**Remote workflow (always list before you push):**

```bash
source .env.supabase.local
supabase link --project-ref khzeuxxhigqcmrytsfux   # one-time per workspace
supabase migration list --linked                    # read-only — always run first
supabase db push --linked                           # applies unapplied migrations
supabase migration list --linked                    # re-verify
```

Before any destructive remote command, confirm: token valid; you've just run
`migration list --linked` and understand the delta; migration tested locally via
`supabase db reset` + pgTAP; reviewed for `DROP POLICY`/`DROP TABLE`/non-idempotent
statements; (non-emergency) a human reviewed it.

## Code Style

### Date/Time Handling (CRITICAL)

Two timezone bugs to avoid — use the `utils/dateHelpers` helpers, never raw
`Date` string methods:

- **Displaying:** never `new Date(date).toISOString().split('T')[0]` (converts to
  UTC first → off-by-one). Use `formatDateForInput(date)`.
- **Parsing:** never `new Date("YYYY-MM-DD")` (parses as UTC midnight → previous
  day west of UTC). Use `parseDateInputAsLocal(dateStr)`.

Helpers: `formatDateForInput` (`<input type="date">`), `parseDateInputAsLocal`
(parse YYYY-MM-DD as local), `formatDateTimeForInput` (`datetime-local`),
`formatShowDate` ("Dec 8, 2025"), `formatTime12Hour` ("8:00 PM"),
`parseTime12Hour(timeStr, baseDate)`.

### Testability Attributes (REQUIRED)

All form inputs and interactive elements need testability attributes:

- Inputs: `name` (camelCase), `id` (kebab-case, for `<label htmlFor>`),
  `data-testid` (`{context}-{field}-{type}`, e.g. `login-email-input`).
- Buttons/interactive: `data-testid`.
- Page roots: `data-testid="<page-name>-page"`.

When an e2e test needs an element without an id, **add the id** — don't work
around it with brittle selectors. If that causes significant changes, draft an
artifact and hand it off.

### System Dialogs & Scrollbars (PROHIBITED)

- **Never** `alert()` / `confirm()` / `prompt()`. Use `useToast()` for messages
  and `useConfirm()` + `<ConfirmDialog>` for confirmations.
- **Never** native scrollbars — use `custom-scrollbar` / `custom-scrollbar-thin`
  on `overflow-y-auto` elements.

Why: native dialogs/scrollbars can't be themed, block the whole browser, test
poorly, and hurt mobile UX.

### Logging

Use the environment-aware logger, never `console.*`:

```typescript
import { createLogger } from '../utils/logger'
const log = createLogger('MyComponent')
log.debug(...) // dev only    log.info/warn(...) // dev+test    log.error(...) // always
```

## Database & Migrations

**🚨 Production exists. The baseline is frozen — never edit it.** Schema changes
land as **incremental migrations**.

- **Schema of record:** `.claude/specifications/unified-database-schema.md`
  (documents IndexedDB camelCase ↔ Supabase snake_case side by side). Never guess
  a table/column name — check it.
- **Baseline:** `supabase/migrations/20251106000000_baseline_schema.sql` (17
  tables, RLS, audit log, realtime, triggers). Fresh installs = baseline + all
  incremental migrations in order (`supabase db reset`).

### One migration per release/feature

Not one-per-commit. While a feature is in development, amend its single migration
file in place; only start a new file when the release ships or a logically
distinct feature begins. Once a migration is deployed to prod it's frozen forever
(prod records applied versions and never re-applies).

```bash
supabase migration new <feature_name>   # first time only, at feature kickoff
# then edit that same file as the schema evolves
supabase db reset && npm run test:db     # test locally
```

**Every incremental migration must be idempotent:** `CREATE TABLE/INDEX IF NOT
EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF
EXISTS` before `CREATE POLICY`, and `DO $$ ... EXCEPTION WHEN duplicate_object`
guards for constraint/publication adds.

**🚨 Every new table MUST include explicit `GRANT`s** for `authenticated` AND
`service_role` — the baseline's blanket grant is a snapshot that does NOT cover
later tables. Without them PostgREST/edge functions get 403/empty-result (this
caused the v0.3.1 jam-view cascade).

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<new_table> TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<new_table> TO service_role;
-- SERIAL/BIGSERIAL columns also need: GRANT USAGE ON SEQUENCE ... TO authenticated;
```

**Enforcement:** `npm run lint:migrations` (pre-merge gate — verifies every
`CREATE TABLE` has grants) and `npm run test:db` (pgTAP). Local Supabase has
permissive defaults that mask missing grants — they only fail on prod, which is
why the linter checks SQL text.

Reference migration (template for new feature migrations):
`supabase/migrations/20260422220000_social_catalog_and_jam_sessions.sql`.

## Edge Function Policy

Every edge function needs two documented decisions, both recorded as a row in
`supabase/functions/FUNCTIONS.md` (a PR adding a function without updating the
manifest is incomplete):

1. **Auth mode** — JWT-verified at the gateway, or intentionally anonymous?
2. **Role context** — queries via `service_role` (needs table grants — see above;
   `rolbypassrls` disables RLS but does NOT confer table privileges) or via the
   caller's JWT (relies on RLS)?

Deploy via the versioned script, never ad-hoc (the `--no-verify-jwt` flag is easy
to forget): `./scripts/deploy-edge-functions.sh <name|all>`. Smoke-test after:
`./scripts/smoke-edge-functions.sh` (failure = rollback).

## Repository Layer Guardrails (CRITICAL)

**Never write directly to `db.*` (Dexie/IndexedDB) outside the storage layer.**
Direct writes bypass the sync queue — Supabase never sees the change. Use
`repository.addSong()` / `updateSong()` etc. (see `IDataRepository.ts`).

Enforced by ESLint (`npm run lint`) and a ratchet test
(`tests/unit/guardrails/db-direct-write.test.ts`). Allowed files (storage layer):
`LocalRepository.ts`, `SyncEngine.ts`, `RealtimeManager.ts`, seed files,
`DatabaseService.ts`, `src/services/database/index.ts`. The `KNOWN_VIOLATIONS`
list (tech debt) must only ever shrink — when migrating a file, remove it from
both the test and the `.eslintrc.cjs` overrides.

## Testing discipline

- Run tests before AND after changes; run the full suite before committing.
- **Don't skip or defer failing tests.** Fix the source code after confirming the
  test is correct and necessary. If a test is truly frivolous, delete it — don't
  leave it skipped.

## Auth flow (quick reference)

Multi-layer auth with a persistent layout. `useAuthCheck` validates the session
on every route change (with a **1.5-hour grace period** for brief offline
stretches during gigs); `ProtectedLayoutRoute` combines the check with the
persistent `ModernLayout` and redirects unauthenticated users before rendering.
Pages don't wrap themselves in `ModernLayout`; they use `ContentLoadingSpinner`
for content-area loading. Key files: `hooks/useAuthCheck.ts`,
`components/layout/ProtectedLayoutRoute.tsx`, `contexts/AuthContext.tsx`,
`services/auth/SessionManager.ts`.
