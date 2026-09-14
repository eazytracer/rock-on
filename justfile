# Rock-On developer recipes — run `just` (no args) to list them.
#
# Anything that runs the app or the test suite goes through Docker: the host's
# Node can differ from the project's pinned Node 24, and a newer host Node
# shadows jsdom's localStorage, producing phantom test failures. Containerizing
# gives one honest, reproducible environment.
#
# Full guide: docs/LOCAL_DEV.md

set shell := ["bash", "-uc"]

# Pinned Node image for all containerized JS tooling (matches .nvmrc / Dockerfile)
node_image := "node:24-alpine"

# Containerized tooling runner. A named volume keeps node_modules between runs
# so `npm ci` only happens once (via `just install` / the _deps guard).
run := 'docker run --rm -v "$PWD":/app -v rockon_node_modules:/app/node_modules -w /app ' + node_image

# Show all recipes
default:
    @just --list

# ─── Local dev stack ─────────────────────────────────────────────────────────

# Full containerized stack (app + Supabase in Docker) — the default way to run
dev:
    ./start-docker.sh

# Faster hybrid loop: Supabase in Docker, Vite + edge functions on host
dev-host:
    npm run start:dev

# First-time local setup: start Supabase + generate .env.development / .env.test
setup:
    npm run setup:local

# ─── Supabase lifecycle ──────────────────────────────────────────────────────

# Start local Supabase (Postgres / Auth / Studio / edge) in Docker
up:
    supabase start

# Stop local Supabase
down:
    supabase stop

# Supabase status + local URLs
status:
    supabase status

# Reset the local DB: re-run baseline + migrations + seed
reset:
    supabase db reset

# Open Supabase Studio in the browser
studio:
    npm run supabase:studio

# ─── Quality gates (containerized, Node 24) ──────────────────────────────────

# Install deps into the shared container volume (after a clone or lockfile change)
install:
    {{run}} npm ci --no-audit --no-fund

# Internal: ensure deps exist in the volume before a tooling recipe (fast if present)
_deps:
    {{run}} sh -c '[ -e node_modules/.package-lock.json ] || npm ci --no-audit --no-fund'

# Lint
lint: _deps
    {{run}} npm run lint

# Type-check (tsc --noEmit)
type-check: _deps
    {{run}} npm run type-check

# Unit + integration tests
test: _deps
    {{run}} npm run test

# Unit tests only
test-unit: _deps
    {{run}} npm run test:unit

# Fast unit subset (~seconds): components, hooks, contexts
test-quick: _deps
    {{run}} npm run test:quick

# Production build (bash is needed by the prebuild script)
build: _deps
    {{run}} sh -c "apk add --no-cache bash >/dev/null 2>&1 && npm run build"

# The pre-commit gate: lint + type-check + unit tests
check: lint type-check test-unit

# ─── Tests that need the stack running ───────────────────────────────────────

# pgTAP database tests (needs Supabase up: `just up`)
test-db:
    supabase test db

# End-to-end (Playwright) — needs the stack up + dev env
test-e2e:
    npm run test:e2e
