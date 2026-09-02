# Development Process

Rock On is built with an agent-assisted workflow. This is the short "how we
work" overview — the **intent**. The reusable process itself lives globally (in
Eric's Hermes skills), not in this repo, so it isn't duplicated across projects.

## Runtime chain

- **Hermes** orchestrates — plans, tracks progress, decides the next step.
- **Claude Code** (`claude` CLI, under Eric's own Anthropic account) writes the
  code. Hermes invokes and supervises it; Hermes is not itself the coding client.
- **herdr** is the multiplexer Hermes uses to launch, persist, and read the
  state of Claude Code sessions (currently local — server + `claude` on the Mac
  host; containers run only the app).

## The loop

research → plan → implement → test → review → finalize → release

- **Research** — explore the code, then stress-test the plan with an adversarial
  interview (`grill-me`) until nothing is silently assumed.
- **Plan** — a concrete markdown plan lands in `.hermes/plans/` before any code.
- **Implement** — drive Claude Code through the plan, tests first (TDD).
- **Test / Review** — full suite + a pre-commit review pass.
- **Finalize / Release** — see the release gate below.

## What's project-specific (lives here, not global)

These are Rock On's own rules — an agent working this repo must follow them.
Authoritative detail is in `CLAUDE.md`:

- **Offline-first repository guardrail** — never write directly to `db.*`
  (Dexie/IndexedDB) outside the storage layer; always go through the repository
  so the sync queue sees the change.
- **Supabase migration discipline** — one incremental migration per feature,
  idempotent, with explicit `GRANT`s for new tables (`npm run lint:migrations`
  enforces it). The baseline is frozen.
- **Edge-function policy** — every function's auth mode + role context is
  documented in `supabase/functions/FUNCTIONS.md`.
- **Release gate** — no prod-bound PR merges without a version bump, a dated
  `CHANGELOG.md` entry, a `release_notes` row, and a `vX.Y.Z` tag.
- **Pre-deploy checklist** — `.claude/process/pre-deploy-checklist.md`.

## See also

- `CLAUDE.md` — the authoritative coding rules an agent loads for this repo.
- `README.md` — setup and commands.
- Vault: **Agentic Development Workflow** (the full process) and **Rock On** (the
  product hub) — Eric's personal notes, not in this repo.
