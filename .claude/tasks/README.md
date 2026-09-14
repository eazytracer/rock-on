# Agent Task Files

Self-contained work items an autonomous agent (or a future session) can pick up
and execute without needing the originating conversation. Think of these as
durable, detailed tickets — the overnight-churn queue.

## Convention

- One markdown file per task, named `<verb>-<subject>.md`
  (e.g. `rework-practice-e2e-specs.md`).
- Each task is **self-contained**: an agent with only the repo + the task file
  should be able to do it. Include context, exact files/line pointers, steps,
  acceptance criteria, and how to verify (which `just` recipes to run).
- Frontmatter-ish header fields at top: **Status** (ready / in-progress /
  blocked / done), **Type**, **Risk**, **Surface**, **Branch**.

## Rules for an agent working a task here

1. Read `CLAUDE.md` and `docs/LOCAL_DEV.md` first — repo rules and how to run
   things (app/tests run in Docker via `just`).
2. Verify against reality — run the relevant `just` recipe; don't trust the task
   file's line numbers blindly (code drifts). Re-locate before editing.
3. Stay in scope. If the task reveals a deeper issue, STOP and write findings
   into the task file (or a new one) rather than expanding silently.
4. Finish green: `just check` must pass; stack-dependent tests (`test-db`,
   `test-e2e`) need the stack up.
5. Update the task's **Status** and leave a short completion summary at the
   bottom when done.

## Relationship to `.claude/backlog/`

- `backlog/` = features/ideas at research/planning depth (may need a grill-me
  first).
- `tasks/` = concrete, ready-to-execute work with clear acceptance criteria.
  A backlog item becomes one or more task files once it's been planned/grilled.

## Current tasks

- `rework-practice-e2e-specs.md` — repoint/skip practice e2e specs after the
  `/practices` list page was retired (test-only).
