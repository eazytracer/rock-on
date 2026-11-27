# 08 · API conventions (web + Flutter)

How the operations in `design/OPERATIONS.md` are exposed so the web app and the iOS/Android apps call one contract.
Rule of thumb: **if Flutter would have to re-implement it, it belongs behind the API.**

## Transport — pick by what the operation does

| Operation shape                                                                                                                                                                                         | Transport                                                               | Why                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Read or write **one row of one table** whose only rule is "who may"                                                                                                                                     | PostgREST table call + RLS                                              | Both SDKs (supabase-js, supabase_flutter) speak it natively; RLS is the rule |
| Anything with **more than one write**, an **invariant** (exactly one owner, unique tuning), **derived data** (preview by code, Used in, search, coverage ranking), or input **validation beyond types** | Postgres function (RPC), `SECURITY DEFINER`, `SET search_path = public` | One implementation, transactional, tested in pgTAP                           |
| Third parties, secrets, email, file processing                                                                                                                                                          | Edge function                                                           | Spotify, email, image handling                                               |

Never: a multi-step write orchestrated from the client (create row → then insert membership → then …).

## Naming and shape

- Function name = the operation name in `OPERATIONS.md` (`transfer_ownership`, `attach_set_to_show`). snake_case, verb first.
- Parameters prefixed `p_` (`p_band_id`). Optional params have defaults, so adding one never breaks a client.
- Return the affected row(s) (`RETURNS public.<table>` / `SETOF`) or a `RETURNS TABLE(...)` for derived reads, so
  `supabase gen types` produces typed results. Return `void` only when there is genuinely nothing to show.
- `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated` (or `anon` when the operation is `anyone`).
- Every function checks access itself (`auth.uid()`, `is_band_member`, …) — `SECURITY DEFINER` bypasses RLS.

## Errors

Raise with a stable machine key and the user-facing copy:

```sql
RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_must_transfer',
  HINT = 'You own this band. Transfer it first.';
```

- `MESSAGE` = the key clients switch on (`snake_case`, listed per operation in pgTAP tests). Never change a key.
- `HINT` = default English copy from `OPERATIONS.md`; clients may show it as-is or localise by key.
- Access failures: key `forbidden`. Missing rows: `not_found`. Stale writes: `stale_version`.
- Web: `src/services/api/errors.ts` turns a PostgREST error into `ApiError { key, message }`.

## Concurrency

Writes that edit shared content take `p_expected_version INT DEFAULT NULL`; when given and not equal to the row's
`version`, raise `stale_version`. Clients show "Someone just changed this. Showing the latest." and refetch.

## Lists

Keyset pagination: `p_after` (the last item's sort key) + `p_limit` (default 50, max 200). No offsets.

## Client side

- **Web:** `src/services/api/<area>.ts` — one thin typed function per operation (`supabase.rpc(...)` or a table
  call), no logic. Hooks call these; pages never call Supabase directly. The existing repository keeps working
  and shrinks as areas move over phase by phase.
- **Flutter:** the same operations, called through `supabase_flutter`, with types from the same schema.
- **Display maths stays client-side** (totals, retune counts, "52 of 45 min", timeline times): pure functions in
  `src/domain/`, no I/O, unit-tested — small enough to port to Dart line for line.

## Tests

Every RPC gets a pgTAP file covering: the happy path, each error key, and access by a non-member. These are the
contract tests both clients rely on.

## Migrations

One migration per phase (`supabase/migrations/<ts>_redesign_phase_<n>.sql`), idempotent, with explicit GRANTs,
plus the phase's `release_notes` row.
