# Development Process

Rock On is built with an agent-assisted workflow. This page is the short "how we
build" overview. The code is the source of truth; nothing here restates it.

## Runtime chain

- **Hermes** orchestrates: plans, tracks progress, decides the next step.
- **Claude Code** writes the code, invoked and supervised by Hermes.
- **herdr** is the multiplexer Hermes uses to run Claude Code sessions on the
  Mac host; containers run only the app.

## The loop

research → plan → implement → test → release

- **Research**: read the code (start at `docs/INDEX.md`), check the hard rules
  in `docs/DECISIONS.md`, then stress-test the plan (`grill-me`) until nothing
  is silently assumed.
- **Plan**: a concrete markdown plan (in `.hermes/plans/`) before any code.
- **Implement**: tests first (TDD). Schema changes go in the feature's one
  incremental, idempotent migration (amended in place while in development;
  new tables get explicit `GRANT`s; the baseline is frozen), with pgTAP tests.
- **Test**: `just check`, `just test-db`, and `just test-e2e` (Playwright on
  the host, against the running stack). Layout and commands: `tests/README.md`.
- **Release**: `/finalize` on the branch (version bump, dated CHANGELOG
  section, `release_notes` row); `/release` on `main` after merge (tag the
  merge commit). Before deploying: `.claude/process/pre-deploy-checklist.md`.

When work decides a hard rule (what the app must or must not do), add one dated
bullet to `docs/DECISIONS.md`. When an area is added, moved or removed, update
`docs/INDEX.md`. Don't write docs that restate how the code works.

## See also

- `CLAUDE.md`: the authoritative coding rules, migration and release policy.
- `docs/LOCAL_DEV.md`: running the stack (host vs devcontainer, `just`).
- `tests/README.md`: test layout and commands.
- `docs/INDEX.md`: map of the app. `docs/DECISIONS.md`: hard rules.
