---
title: Pre-deploy Checklist
created: 2026-04-24
purpose: Required steps before pushing DB migrations, edge functions, or frontend to production. Born from the v0.3.1 post-deploy cascade.
---

# Pre-deploy Checklist

Every release that touches production must pass every item below. Not a
guideline — a gate. Build the habit of running these before claiming
"ready to merge."

## Why this document exists

v0.3.0 shipped on 2026-04-23 and took 10 minutes to start failing in
production. Root causes across the cascade:

- Missing `GRANT ... TO authenticated` on new tables (403 on every REST call)
- Missing `GRANT ... TO service_role` on new tables (404 on edge function reads)
- Edge function deployed without `--no-verify-jwt` (401 for anon users)
- Edge function + frontend reading `user_profiles.display_name` only, ignoring `users.name` fallback ("User abc123" everywhere)
- Share URL state reset on page remount, handing out broken `?t=` URLs

None of these were caught by the existing 780 unit tests + 488 pgTAP
tests + finalize-agent review. All of them are caught by the items below.

## Pre-merge gates (block PR merge)

Run these locally before requesting review; CI should run them too.

### 1. Schema + grants

```bash
npm run lint:migrations   # static analysis of migration SQL text
npm run test:db           # pgTAP suite (488+ tests)
```

- `lint:migrations` catches: new tables without `GRANT` statements for
  `authenticated` or `service_role`. Exits 1 on violations with file + table + role identified.
- `test:db` catches: RLS misconfigurations, schema drift, missing indexes, trigger regressions.

### 2. App tests

```bash
npm run type-check
npm run lint
npm test              # full unit + integration (~780 tests)
npm run build         # verifies production build compiles
```

### 3. Edge function manifest

If the PR touches `supabase/functions/`:

- Every function has a row in `supabase/functions/FUNCTIONS.md` listing its auth mode, role context, and public tables accessed
- New functions have deploy command in `scripts/deploy-edge-functions.sh` and smoke assertion in `scripts/smoke-edge-functions.sh`

### 4. Capability coverage

If the PR adds a new user-facing capability:

- Entry added to `.claude/specifications/functionality-catalog.md` in the appropriate domain using the template (Who can / Who cannot / Tests)
- Both positive AND negative tests exist for any RLS-scoped or role-scoped capability

## Pre-deploy gates (block `supabase db push` / Vercel deploy)

Run these against a staging-like environment (or production in a
dry-run) before actual deployment.

### 5. Migration readiness

```bash
source .env.supabase.local
supabase migration list --linked         # verify prod state; read-only
```

Confirm:

- Delta between local and remote migrations is exactly what this release intends
- No stale / unexpected migration rows on remote
- All new incremental migrations exist locally

### 6. Edge function auth mode + smoke

Before deploying:

- FUNCTIONS.md is accurate (did anyone add a function without updating it?)
- `./scripts/deploy-edge-functions.sh` reads the manifest to pick the right auth flag — never ad-hoc `supabase functions deploy <name>`

After deploying:

```bash
./scripts/smoke-edge-functions.sh    # hits each fn URL, verifies expected status
```

Must pass `3 passed, 0 failed` (or whatever the manifest total is). Any failure = rollback and investigate.

### 7. Real URL end-to-end

Edge-function 200 status ≠ app works end-to-end. Before declaring
deployment complete:

- Create a fresh anonymous browser (incognito / no logged-in state)
- Hit a representative URL for each new capability:
  - Authenticated flow (signup + log in + create/join) — verify happy path
  - Anonymous flow (jam-view, any other public endpoint) — verify page renders, no console errors
- Check browser devtools console for any 4xx / 5xx responses, unhandled promise rejections, or missing-data fallbacks (e.g. "User abc123", "Host" as placeholders)

## Post-deploy smoke

Within 15 minutes of deploying:

- Trigger the primary workflow from a real production account
- Invite a second account to any multi-user flow (jam, band join)
- Confirm realtime subscriptions deliver updates
- Confirm no error-rate spike in Supabase logs

## When the checklist catches something

- Fix on a branch, get it reviewed, and re-run the gates
- Do NOT push fixes directly to prod without the code landing in main
- Every in-flight hotfix should update this checklist if it reveals a new gap

## History

- **2026-04-24** — Created after v0.3.1 hotfix cycle. Items 1 (schema + grants), 3 (edge function manifest), 6 (smoke), and 7 (real URL E2E) each directly correspond to a specific v0.3.1 production failure.
