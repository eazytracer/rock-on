# Local Development Guide

How to run Rock On locally, run the tests, and manage the local Supabase stack.

Day-to-day tasks are wrapped as [`just`](https://github.com/casey/just) recipes.
Run `just` with no arguments to see the full list. The recipes are the source of
truth for exact commands; this doc explains the workflow around them.

## Golden rule: run app + tests in Docker

Anything that runs the app or the test suite goes through Docker, on the
project's pinned **Node 24** (`.nvmrc`, `Dockerfile`, `package.json` engines).

Why this matters: the host machine's Node may not match, and a _newer_ host Node
(24+) ships a native `localStorage` global that shadows jsdom's in tests —
producing failures that don't exist in CI or the container. Containerizing gives
one honest, reproducible environment. The `just` quality-gate recipes
(`lint`, `type-check`, `test`, `build`) already run inside `node:24-alpine`, so
prefer them over bare `npm run …` on the host.

## Prerequisites

- **Docker** (Desktop or engine) — runs the app, Supabase, and the test tooling.
- **[just](https://github.com/casey/just)** — the recipe runner
  (`brew install just`).
- **Supabase CLI** — manages the local database stack
  (`brew install supabase/tap/supabase`). It runs its services in Docker.
- Node on the host is **not** required for the `just` recipes (they containerize
  it), but is handy for ad-hoc scripts. Match `.nvmrc` (Node 24) if you do.

## First-time setup

```bash
just setup      # start Supabase + generate .env.development / .env.test
just install    # install deps into the shared container volume
```

`just setup` wraps `npm run setup:local`. It starts the local Supabase stack and
writes the local env files. Run it once per clone (or after a `just reset` that
wipes env).

## Running the app

Two ways, both backed by a local Supabase in Docker:

```bash
just dev        # full containerized stack (app + Supabase) — recommended default
just dev-host   # hybrid: Supabase in Docker, Vite + edge functions on the host
```

- `just dev` runs `./start-docker.sh`: initializes Supabase (DB, roles,
  migrations, seed) then starts the app container. Use this for a clean,
  reproducible run, and for phone testing (`HOST_IP=<your-ip> ./start-docker.sh`).
- `just dev-host` runs `npm run start:dev`: Supabase in Docker but Vite and the
  edge-function runtime on the host — a faster inner loop while coding. Edge
  logs go to `/tmp/edge-functions.log`.

Once up, the local URLs (from `just status`):

| Service         | URL                    |
| --------------- | ---------------------- |
| App (Vite)      | http://localhost:5173  |
| Supabase API    | http://127.0.0.1:54321 |
| Supabase Studio | http://127.0.0.1:54323 |
| Inbucket/Mail   | http://127.0.0.1:54324 |

## Supabase lifecycle

```bash
just up        # start local Supabase
just down      # stop it
just status    # status + local URLs
just reset     # reset DB: re-run baseline + migrations + seed
just studio    # open Supabase Studio
```

`just reset` is the quickest way back to a known-good database (it re-applies the
frozen baseline, every incremental migration, and the seed). Do it whenever your
local data drifts or after pulling new migrations.

## Quality gates (containerized)

```bash
just lint         # ESLint
just type-check   # tsc --noEmit
just test         # unit + integration
just test-unit    # unit only
just test-quick   # fast subset (components, hooks, contexts) — ~seconds
just build        # production build
just check        # lint + type-check + test-unit (the pre-commit gate)
```

Run `just check` before committing — it mirrors what CI enforces. All of these
run in `node:24-alpine` against a shared `node_modules` volume, so the first run
does an `npm ci` and later runs are fast.

## Tests that need the stack running

Some suites need a live database or a running app, so they are **not**
containerized behind the shared volume — bring the stack up first:

```bash
just up          # ensure Supabase is running
just test-db     # pgTAP database tests
just test-e2e    # Playwright end-to-end (needs the app + dev env too)
```

For e2e specifically: `just dev` (or `just dev-host`) in one terminal, then
`just test-e2e` in another. See `tests/README.md` for the full test-layer
breakdown.

## Applying migrations to production

Prod is remote Supabase. The documented flow is `supabase link` + `supabase db
push --linked` (see `CLAUDE.md` → "Supabase — Remote (production) access").

On a machine where `supabase link` won't work — e.g. this Mac mini, where the
direct DB host is IPv6-only and the access token lacks the org-level privilege
`link` requires — use the pooler helper, which connects over the IPv4 Supavisor
pooler with an explicit `--db-url`:

```bash
# one-time: .env.supabase.local (gitignored) needs, each on its own export line:
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   export SUPABASE_DB_PASSWORD=...          # Project Settings -> Database

source .env.supabase.local
scripts/prod-db.sh list      # READ-ONLY — always run first; shows the local-vs-remote delta
# review the delta, then:
scripts/prod-db.sh push      # applies unapplied migrations to prod
scripts/prod-db.sh list      # re-verify (every migration local == remote)
```

The password is read from `SUPABASE_DB_PASSWORD` and URL-encoded inside the
script, so it never lands in argv or shell history. Host/ref default to this
project; override with `SUPABASE_PROJECT_REF` / `SUPABASE_POOLER_HOST` /
`SUPABASE_POOLER_PORT` for another project (get the exact pooler host from
`GET /v1/projects/<ref>/config/database/pooler`). Always `list` before you
`push` — same discipline as the `--linked` flow.

## Troubleshooting

- **Tests fail locally but pass in CI** — you're almost certainly running on the
  host with a mismatched Node. Use the `just` recipes (they containerize Node
  24). The classic symptom is `localStorage`-related failures.
- **`docker build` fails in the prebuild step** — the build needs `bash` (the
  prebuild script is bash-only); the `just build` recipe and the Dockerfile
  install it. A bare `npm run build` on `node:*-alpine` without bash will fail.
- **Ports already in use (5173 / 5432 / 54321-54324)** — another stack is
  running. `just down` to stop Supabase; stop any stray app container.
- **Stale data / weird state** — `just reset` for a clean database.

## See also

- `justfile` — the recipes themselves (authoritative commands).
- `README.md` — project overview and setup.
- `docs/DEVELOPMENT.md` — how we build (research → release process).
- `tests/README.md` — test layers and layout.
- `ENVIRONMENTS.md` — environment/`.env` management.
- `CLAUDE.md` — the authoritative coding rules for this repo.
