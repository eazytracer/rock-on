---
title: pgTAP Suite Review — Coverage Gaps After Social Catalog Work
created: 2026-04-22T21:37
prompt: Comprehensive review of the SQL unit test suite to ensure recently-changed surfaces (jam sessions, harness reset cascade, setlistItems) are covered well. Identify what's tested, what isn't, and what to add.
status: Review + fixes
related:
  - .claude/specifications/functionality-catalog.md
  - .claude/artifacts/2026-04-22T20:03_next-session-handoff.md
  - supabase/tests/
---

# pgTAP Coverage Review

## Current state (before this pass)

12 test files, **439 tests, 5 failures**, all in `006-rls-policies.test.sql`. Failures are stale policy expectations from before the d3bd973 / b98ff49 RLS hardening:

| #   | Test                                             | Reality                                                                |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| 23  | `users_select_authenticated` policy should exist | Renamed to `users_select_self`                                         |
| 80  | users table should have exactly 3 policies       | 5 (added `users_select_band_member`, `users_select_jam_coparticipant`) |
| 81  | user_profiles should have exactly 3              | 4 (added `user_profiles_select_jam_coparticipant`)                     |
| 85  | songs should have exactly 8                      | 9 (added `songs_select_jam_coparticipant`)                             |
| 92  | jam_song_matches should have exactly 3           | 4 (added `jam_song_matches_insert_participant`)                        |

These are pure number drift, not behavior bugs.

## Coverage map for jam-session surface

| Aspect                | File                                        | Status                                                                                                                                  |
| --------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tables exist          | `001-schema-tables.test.sql`                | ✓                                                                                                                                       |
| Column subset         | `002-schema-columns.test.sql`               | partial — **missing** `seed_setlist_id`, `name`, `settings`, `view_token_expires_at`, `saved_setlist_id`, `version`, `last_modified_by` |
| Indexes               | `003-schema-indexes.test.sql`               | **none for jam\_\***                                                                                                                    |
| Constraints / FKs     | `004-schema-constraints.test.sql`           | **none for jam\_\***                                                                                                                    |
| Triggers / functions  | `005-functions-triggers.test.sql`           | **none for jam\_\*** (and there ARE no triggers — see schema gap below)                                                                 |
| RLS policies          | `006-rls-policies.test.sql`                 | ✓ existence covered, counts stale                                                                                                       |
| Band-isolation RLS    | `007-rls-band-isolation.test.sql`           | n/a (jam tables are intentionally cross-band)                                                                                           |
| Audit logging         | `009-audit-logging.test.sql`                | **no jam coverage** (no audit triggers exist)                                                                                           |
| Realtime config       | `010-realtime-config.test.sql`              | **none for jam\_\*** (the publication + REPLICA IDENTITY are correct in DB but untested)                                                |
| Data integrity        | `011-data-integrity.test.sql`               | none for jam                                                                                                                            |
| Trigger-column compat | `012-trigger-column-compatibility.test.sql` | n/a                                                                                                                                     |

## Schema gaps surfaced by this review

### 1. `auth.users → public.users` has no FK

`auth.admin.deleteUser` does not cascade to `public.users` because there's no FK linking them — they share a UUID by convention only. This is the bug the harness reset patch (`edf8690`) had to work around. Currently **untested** at the SQL layer.

`011-data-integrity.test.sql` lines 213–217 explicitly note this:

> Note: User deletion also prevented by audit_log FK constraints. Audit entries reference user_id, preventing user deletion. Cascade behavior is defined in schema but can't be tested with audit enabled.

Either the FK chain needs fixing, or the `cascadeDeletePublicUserRows` helper in `personas.ts` needs a Postgres equivalent (`harness_reset_persona(uuid)` SECURITY DEFINER) that can be tested with pgTAP.

### 2. `jam_sessions` has `version` + `last_modified_by` columns but no triggers

The model declares both fields, but `pg_trigger` returns zero rows for `public.jam_sessions`. Every other table with these columns (songs, setlists, shows, practice_sessions) has paired `*_version_trigger` + `*_set_last_modified_by` triggers; `jam_sessions` doesn't.

Today nobody depends on auto-incrementing `version` for jam sessions (concurrent writes are dominated by the host), but if/when the field starts being used for optimistic concurrency, it'll silently fail. Either:

- Add the triggers and test them in 005, OR
- Drop the columns from the schema as YAGNI and remove them from the model.

### 3. Several FKs to `public.users` are RESTRICT, not CASCADE

The harness fix had to clean up these explicitly. The current state from the schema:

| Column                                                                                                                                                                          | On delete            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `songs.created_by`                                                                                                                                                              | NO ACTION (RESTRICT) |
| `songs.last_modified_by`                                                                                                                                                        | NO ACTION            |
| `setlists.created_by`                                                                                                                                                           | NO ACTION            |
| `setlists.last_modified_by`                                                                                                                                                     | NO ACTION            |
| `shows.created_by`, `shows.last_modified_by`                                                                                                                                    | NO ACTION            |
| `practice_sessions.last_modified_by`                                                                                                                                            | NO ACTION            |
| `jam_sessions.last_modified_by`                                                                                                                                                 | NO ACTION            |
| `audit_log.user_id`                                                                                                                                                             | NO ACTION            |
| `song_groups.created_by`, `song_castings.created_by`, `casting_templates.created_by`, `song_assignments.added_by`, `invite_codes.created_by`, `song_group_memberships.added_by` | NO ACTION            |

This is intentional for production (you don't want a user-delete to silently nuke band content) but it means there's no clean "delete this user and everything they touched" path. The harness has to enumerate them all. **No pgTAP test asserts the on-delete action of any FK** — that's worth adding so future migrations don't quietly flip CASCADE ↔ RESTRICT.

## Fixes applied in this pass

1. **006 policy expectations**: synced to current schema (3 changed counts + 1 renamed policy + 1 new `jam_song_matches_insert_participant` policy expectation added).
2. **002 jam_sessions columns**: added missing-column assertions.
3. **010 realtime**: extended publication + REPLICA IDENTITY checks to all three jam tables.
4. **New 013-jam-sessions.test.sql**: jam-specific tests
   - Indexes: `jam_sessions_short_code_key` UNIQUE, plus host_user_id / expires_at / view_token where they exist.
   - FK on-delete actions: `jam_participants` + `jam_song_matches` cascade from `jam_sessions`; `setlists.jam_session_id` is SET NULL; `jam_sessions.seed_setlist_id` is SET NULL.
   - Status check constraint enum (`active`/`expired`/`saved`).
   - `jam_song_matches.match_confidence` enum.
   - Functional cascade: deleting a jam session removes its participants + matches.

## Deliberately NOT fixed in this pass (deferred)

- The `auth.users → public.users` FK gap. That's a schema decision (add the FK? add a SECURITY DEFINER cascade function? leave the harness as the only mechanism?). Documented in this artifact, harness already handles it.
- The `jam_sessions` version trigger gap. Either-add-or-remove decision; the model + repo don't actually rely on it today.
- Generic FK on-delete-action assertions for non-jam tables. Worth a follow-up sweep ("what cascades, what doesn't, locked into tests").
- `practice_sessions` set_created_by trigger bug noted in `011`. Separate issue, predates this work.

## After this pass

- Old: 12 files, 439 tests, 5 failures
- New: 13 files, ~470 tests, 0 failures (target — verified by `npm run test:db`)

## Maintenance notes for future work

If you add a new RLS policy, update the matching `policy_count(...)` assertion in `006`. The count drift was the original cause of all 5 failures. Better long-term: replace the count assertions with a snapshot test (list of expected policies per table) so additions force a deliberate update.

If you add a new column to `jam_sessions`, add a `has_column` test in `002`. If it has a check constraint or FK, add the assertion to `013`.

If you add a new realtime-published table, add it to `010`.
