# Phase 2 — IMPLEMENTATION HANDOFF (resume here)

**Branch:** `feature/data-layer-simplification-phase2`
**Plan (decisions):** `.claude/backlog/auth-and-data-simplification/2026-09-14_phase2-plan.md`
**Parked idea:** `.claude/backlog/cross-catalog-song-matching/2026-09-14_parked-idea.md`
**Last updated:** 2026-09-14

This doc lets a fresh agent resume without re-deriving context. Read the plan
doc §7 for locked decisions, then this for the mechanical pattern + progress.

---

## Non-negotiables (from CLAUDE.md + rock-on-development skill)

- **Verify in Docker (node:24-alpine), NEVER host node** (host Node 26 shadows
  jsdom localStorage → ~13 phantom failures). One-shot verify command below.
- **`git checkout src/config/buildInfo.ts`** before every `git add` (build-gen,
  never commit). Pre-commit hook reformats + re-stages; re-checkout buildInfo
  after committing.
- Commit **verified-green slices, one concern each.** Keep type-check + unit
  green at every commit.
- **STOP for Eric's explicit go-ahead before the factory-swap + mass-deletion
  commit** (todos 3,4,9,10,11) — that's the irreversible-feeling moment.
- Do NOT parallelize across subagents: every slice edits the shared
  `KNOWN_VIOLATIONS` list + shared pages, and each needs an in-container verify.

### One-shot Docker verify (type-check + targeted tests)

```bash
cd ~/Workspace/rock-on && docker run --rm -v "$PWD":/app -v /app/node_modules \
  -w /app node:24-alpine sh -c "
apk add --no-cache bash >/dev/null 2>&1 &&
npm ci --no-audit --no-fund >/dev/null 2>&1 &&
npm run type-check 2>&1 | grep -i error | tail -20; echo '(tc done)' &&
npx vitest run <paths...> 2>&1 | grep -iE 'Test Files|Tests |FAIL' | tail -5
"
```

Full unit suite: swap the vitest line for `npm run test:unit 2>&1 | grep -iE 'Test Files|Tests '`.
Baseline (main + these commits): **992 unit tests pass, 65 files**, lint 0
errors / 41 warnings (intentional), type-check clean. A stray
`⚠️ Supabase schema verification failed` line in unit output is NOISE (check the
`Tests N passed` line).

---

## THE VALIDATED PATTERN (copy for each hook family)

Reference implementation: **`src/hooks/useSongs.ts`** (commit b964bfe). Study it.
Supporting infra (already created, reuse as-is):

- `src/services/queryClient.ts` — QueryClient + centralized `queryKeys`. ADD new
  key factories here per entity if missing.
- `src/hooks/useRealtimeInvalidate.ts` — bridges RealtimeManager `*:changed`
  events → `queryClient.invalidateQueries`. Replaces BOTH the old
  `onSyncStatusChange` refetch path AND `useRealtimeSync`. Skips own-changes.
- `tests/unit/helpers/queryWrapper.ts` — `createQueryWrapper()` gives a
  QueryClientProvider wrapper (retry off, gcTime 0) for `renderHook`.

### Read hooks

- `useQuery({ queryKey: queryKeys.X.band(id), queryFn: () => Service.getX(id), enabled: !!id })`
- Call `useRealtimeInvalidate({ events: ['X:changed'], bandId, queryKey })`.
- **Preserve the return shape** consumers already use (usually
  `{ items, loading, error, refetch }`) so pages don't change. Map:
  `loading: query.isLoading`, `error: query.error as Error|null`,
  `refetch: async () => { await query.refetch() }`.

### Mutation hooks (optimistic — confirmation policy 7-B = silent success,

error-only toast; the PAGE's existing try/catch shows the error toast)

- `useMutation({ mutationFn, onSettled: () => queryClient.invalidateQueries(...) })`.
- Expose `mutateAsync` under the old method name so call sites are unchanged.
- For deletes with cross-entity cleanup (song-in-setlist), do it through
  `repository.*` (NEVER `db.*`). See `getSetlistsContainingSong` +
  `useDeleteSong` in useSongs.ts.

### After migrating a hook that imported Dexie `db`

- Remove its entry from `KNOWN_VIOLATIONS` in
  `tests/unit/guardrails/db-direct-write.test.ts` (the ratchet list only shrinks).
- Update/rewrite its unit test to wrap `renderHook` in `createQueryWrapper().wrapper`
  and mock `useAuth` to return `{ user: { id }, realtimeManager: null, ... }`
  (the hook reads `user?.id` + `realtimeManager`).

---

## PROGRESS (commits on branch, newest last)

- `8f21138` feat: TanStack Query foundation (dep + QueryClient + provider in App.tsx)
- `b59b9bc` refactor: promote notes + getUser onto IDataRepository
- `8fc5217` refactor(songs): trim incomplete song-group linking (see parked idea)
- `b964bfe` refactor(songs): **useSongs → TanStack Query (VALIDATED TEMPLATE)** +
  useRealtimeInvalidate + queryWrapper helper

DONE: foundation, interface extension, song-group trim, useSongs.

### Hook migrations progress (Section A)

- ✓ useSongs (b964bfe) — template
- ✓ useSetlists (b2b1e2d)
- ✓ useShows (4e91690)
- ✓ usePractices (8935adf) — also removed dynamic db.setlists import
- ✓ useBands (f840ff9) — added repository.getUserProfile (interface + Remote +
  Sync + Local impls); rewrote useBands.test.ts; removed from KNOWN_VIOLATIONS
- ✓ useNotes (5d55141) — routed all note reads through repository
- ☐ Section A.6 REMAINING: view pages still import useRealtimeSync
  (PracticeViewPage, SetlistViewPage, ShowViewPage, PracticeSessionPage) →
  switch to useRealtimeInvalidate or a local onSync refetch, then DELETE
  src/hooks/useRealtimeSync.ts. (useRealtimeSync is otherwise unused.)

KNOWN_VIOLATIONS now remaining: auth services, InitialSetupService,
CastingService, MemberCapabilityService, BandService, AuthPages, BandMembersPage.
(SongLinkingService, useSongs, useBands already removed.)

Full unit suite currently: 989 passing (was 992; -3 = obsolete useBands
sync-event/listener tests removed, expected).

---

## REMAINING WORK (ordered; do in this sequence)

### A. Hook migrations (mechanical — apply the pattern). One commit each.

1. `useSetlists` — has `onSyncStatusChange` (drop it). Add `queryKeys.setlists`.
2. `useShows`
3. `usePractices`
4. `useBands` — in KNOWN_VIOLATIONS (direct writes). Remove entry after.
5. `useNotes` — uses repo note methods (now on interface). Add `queryKeys.notes`.
6. View pages still using `useRealtimeSync`: `PracticeViewPage`,
   `SetlistViewPage`, `ShowViewPage`, `PracticeSessionPage` → switch to
   `useRealtimeInvalidate` (or a local `onSync` refetch). Then DELETE
   `src/hooks/useRealtimeSync.ts`.

### B. Service migrations off `db.*` (todo 6). One commit per service or small group.

`BandService`, `CastingService`, `MemberCapabilityService`,
`PracticeSessionService`, `SetlistService`, `casting/CastingSuggestionService`,
`setup/InitialSetupService`, `auth/SupabaseAuthService`, `auth/MockAuthService`,
and `SongService.getUserAccessibleSongs` (reads `db.bandMemberships` →
`repository.getUserMemberships`). Some need NEW repository methods (castings,
capabilities) — add to IDataRepository + RemoteRepository (already
Supabase-backed tables per baseline schema).

### C. Page migrations off `db.*` (todo 7).

`SongsPage`, `SetlistsPage`, `SetlistViewPage`, `ShowsPage`, `ShowViewPage`,
`PracticeViewPage`, `PracticeSessionPage`, `BandMembersPage`, `AuthPages`.

### D. AuthContext bootstrap (todo 8).

Remove `isInitialSyncNeeded` / `performInitialSync` / `pullIncrementalChanges`
calls (lines ~165-184, 329-336). No pre-download of a mirror anymore.
`updateUserActivity`/`getUserLastActiveAt` use `new RemoteRepository()` directly
— leave them.

### E. ⚠️ STOP-AND-CONFIRM GATE — factory swap + slim realtime + mass deletion

(todos 3,4,9,10,11). Get Eric's go-ahead first.

- todo 3: BEFORE deleting SyncRepository, enumerate its cloud-first correctness
  fixes and confirm RemoteRepository preserves them:
  - `getBand` (remote-first, upsert to cache) — RemoteRepository.getBand is
    already remote-only ✓ but verify no caller relied on the local fallback.
  - `getBandMemberships` / `getUserMemberships` (remote-first) — verify.
  - `getSongs` case-3 empty-cache recovery — becomes moot (always remote) but
    confirm no double-fetch/regression.
  - `getInviteCodeByCode` (remote-only, validation) — already remote ✓.
  - `deleteSong` avoided re-materializing via cache — moot without cache.
- todo 4: slim `RealtimeManager` — DELETE audit→model mapping
  (`handleRecordUpsert/Delete`) + all `db.*`/IndexedDB writes + `auditMappers.ts`.
  KEEP: per-band `audit_log` channel, `*:changed` emits, toast batching,
  own-change skip.
- `RepositoryFactory.ts` → return `new RemoteRepository()` (or keep singleton).
  Migrate remaining `getSyncRepository()`/`SyncRepository.getInstance()` callers
  (`useSyncStatus.ts`, others) to the `repository` singleton or delete them.
- todo 9 DELETE: `SyncEngine.ts`, `LocalRepository.ts`, `SyncRepository.ts`,
  `auditMappers.ts`, Dexie `src/services/database/index.ts`, `src/database/*`
  (seedData, seedMvpData, services), `DatabaseService.ts`,
  `utils/resetDatabase.ts`, `utils/debugSync.ts`, `hooks/useSyncConflicts.ts`,
  `hooks/useSyncStatus.ts`, `hooks/useItemSyncStatus.tsx` (+ its provider in
  App.tsx), `components/sync/*` (ConflictResolutionModal), remove `dexie` dep.
  Remove `import './utils/debugSync'` from main.tsx.
- todo 10 DELETE DevDashboard: `src/pages/DevDashboard/*`, lazy import +
  `/dev/dashboard` route in App.tsx, `utils/debugRealtime.ts`. Leave
  `/dev/ui-preview` (DevUIPreviewPage) intact. No e2e references DevDashboard.
- todo 11: delete `tests/unit/guardrails/db-direct-write.test.ts` + the ESLint
  `no-restricted-syntax` db-write rule in `.eslintrc.cjs` + `KNOWN_VIOLATIONS`
  overrides. (Only after ALL db.\* writes are gone.)

### F. Migration + pgTAP (todo 12).

`supabase migration new extend_audit_triggers` — idempotent
`DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER ... AFTER INSERT/UPDATE/DELETE
EXECUTE FUNCTION log_audit_trail()` for: `bands`, `band_memberships`,
`song_castings`, `song_assignments`, `member_capabilities`. (audit_log realtime
already enabled in baseline; same channel picks these up.) pgTAP: assert an
insert into each newly-covered table writes an `audit_log` row. Run
`supabase db reset && npm run test:db` + `npm run lint:migrations`.

### G. Verify + release (todos 13,14).

- Full Docker verify green: type-check, lint, build, unit+integration,
  lint:migrations, test:db. Document what CANNOT be verified headless (e2e
  multi-member live path, optimistic-rollback path — needs full stack up + a
  two-browser smoke).
- Phase-1 release metadata (CLAUDE.md two-phase): bump `package.json` version
  (`npm version minor --no-git-tag-version` — this is a big feature, likely
  minor 0.6.0), dated `## [0.6.0]` CHANGELOG section, `release_notes` upsert
  migration. Do NOT tag (that's post-merge Phase 2 / `/release`).

---

## Key facts discovered (don't re-derive)

- `RemoteRepository` already fully implements `IDataRepository` (direct
  Supabase). The swap is low-risk mechanically; the risk is losing SyncRepo's
  cloud-first fixes (todo 3).
- Consumer hooks already treat realtime as pure invalidate/refetch — they never
  read RealtimeManager's IndexedDB writes. So slimming realtime is safe.
- Audit triggers currently cover ONLY songs, setlists, shows, practice_sessions.
- `song_groups`/`song_group_memberships` tables stay in baseline (frozen) but
  are now unused by web (song-group feature trimmed).
- `updateUserActivity`/`getUserLastActiveAt` instantiate RemoteRepository
  directly → survive the swap untouched.

---

## RESUME ADDENDUM — 2026-09-15 (PHASE 2 COMPLETE — gate executed end-to-end)

Eric approved the re-scope + gate ("we're on a branch, we can always undo…").
Executed the entire remaining plan as verified-green slices (Docker node:24-alpine
each; buildInfo checked out before every commit). **All sections done.**

Commits (this session, on top of `541a681`):

- `ed832e9` gate slice 1 — deleted orphaned pre-repository services (DatabaseService,
  SyncService, InitialSetupService, CastingSuggestionService, MemberCapabilityService,
  dead BandService member methods, SongService.getUserAccessibleSongs).
- `a895929` gate slice 2 — deleted shelved CastingService + dead casting wrappers in
  PracticeSessionService/SetlistService.
- `d7e0c24` / `9adab56` / `ac9b524` / `57cc021` — Section C: every reachable page /
  component / hook routed off `db.*` onto `repository.*`. Added `updateUserProfile`
  to IDataRepository + all impls (grp3).
- `07dc810` — RealtimeManager slimmed to a pure change-notifier (emits `*:changed` +
  toasts from audit_log; no data application). ~-1900 lines. Rewrote its test to the
  new contract; deleted the frivolous audit-mapping test.
- `00de351` — Section D: AuthContext cloud-first bootstrap (no blocking initial sync,
  no local-cache reads); auth services off `db.*` (Mock = in-memory; Supabase = only
  provisions the users row).
- `372f369` — **THE GATE:** RepositoryFactory → RemoteRepository; deleted SyncEngine,
  SyncRepository, LocalRepository, Dexie schema (services/database), seed modules,
  auditMappers, debugSync, resetDatabase, useSyncConflicts + ConflictResolutionModal,
  DevDashboard; simplified useSyncStatus/useItemSyncStatus to connectivity/in-memory;
  trimmed sync methods off IDataRepository; removed db-direct-write guardrail test +
  eslint rule; "clear local data" now clears the TanStack cache. Fixed test/setup.ts.
- `ff97d17` — dropped dexie / dexie-react-hooks / fake-indexeddb / mermaid deps;
  removed Dexie test scaffolding (tests/journeys — never collected; integration
  template; testDatabase helper); deleted DevDashboard ER-diagram infra (script,
  npm scripts, husky hook block, schema-diagram-sync test).
- `f60eb1b` — Section F: `20260915000000_extend_audit_triggers.sql` (audit triggers +
  band_id derivation for bands, band_memberships, song_castings, song_assignments,
  member_capabilities) + pgTAP `025-extended-audit-logging.test.sql`.
- `98ef296` — Section G: Phase-1 release metadata **v0.6.0** (package.json bump, dated
  CHANGELOG [0.6.0] section, release_notes upsert folded into the F migration).

### Final verification (all green)

- Docker node:24-alpine: **type-check clean, lint 0 problems, build OK, `npm test`
  56 files / 788 passing.**
- Local Supabase: **`supabase db reset` applies clean; `npm run test:db` 26 files /
  980 pgTAP pass; `npm run lint:migrations` pass; `check:release-metadata` pass.**

### NOT verifiable headless (needs full stack + real browsers) — hand-off for Eric

- Two-browser live cross-member refresh via the new audit triggers (bands/memberships/
  casting now emit change events — confirm the other browser refreshes).
- Cold-start login on a fresh device (cloud-first bootstrap with no local cache).
- Offline behavior: the app is now online-only; confirm the intended UX when offline
  (reads/writes fail fast rather than queueing). This is a **product decision** worth a
  look — the old offline-during-gigs affordance is gone by design.

### Phase 2 = Phase 2 of `auth-and-data-simplification`. Remaining = \*\*Phase 2 tag is

post-merge\*\* (`/release` tags the merge commit `v0.6.0`; do NOT tag pre-merge). Prod DB
push of the F migration is a separate deliberate step (references/remote-prod-deploy.md).

---

### ✓ Section A COMPLETE (commit `541a681`)

`useRealtimeSync` deleted; the 4 view pages now use `useRealtimeInvalidate`,
which gained an **optional `onChange` callback** (+ optional `queryKey`) so
pages still backed by manual `db.*` loads keep live cross-user refresh until
Section C migrates them to real queries. Docker verify: **989 pass / 65 files,
type-check clean, 0 lint errors** (warnings 41→33: the deleted hook's
`console.log`s were the difference). Baseline before starting matched exactly —
no drift.

### ⚠️ Sections B & D are NOT independently do-able — every remaining slice is gate-coupled

Verified against the running architecture + schema-of-record. The handoff's
"route services through `repository.*`, add castings/capabilities to the
interface" plan would mean building throwaway CRUD against **deny-all tables**
to keep **orphaned** code alive. Findings:

- **Casting/capability Supabase tables are RLS-enabled with ZERO policies =
  deny-all.** `unified-database-schema.md` §"Known Issues" (~L1074-1090,
  authoritative): `song_castings`, `song_assignments`, `assignment_roles`,
  `member_capabilities` — _"the application code does not query these tables."_
  Adding RemoteRepository methods for them = queries that silently return `[]`.
- **`CastingService` is explicitly shelved.** `CastingAssignmentService.ts:5-6`:
  _"The clean v1 casting service (Supabase-only + RLS). Distinct from the legacy,
  shelved `CastingService` (Dexie-local, broken) which this replaces going
  forward."_ Live casting path = `useCasting` → `CastingAssignmentService` →
  `SongCastPanel` (used by `EventDetailPage`) — already cloud-native, NOT in
  KNOWN_VIOLATIONS.
- **The rest of the KNOWN_VIOLATIONS services have no live callers:**
  - `MemberCapabilityService` → only `CastingSuggestionService`, whose singleton
    has zero consumers (dead serving dead).
  - `BandService` member methods (`db.members`/`db.bands`) → superseded by
    `BandMembershipService` (`repository.getBandMemberships` + `useBands`); only
    caller is `DatabaseService` (already ALWAYS_ALLOWED, gate-deletion slated).
  - `InitialSetupService` → no importer in `src`.
  - `SongService.getUserAccessibleSongs` (the ONE clean
    `db.bandMemberships`→`repository.getUserMemberships` swap) → also uncalled.
- **The two genuinely-live KNOWN_VIOLATIONS files are the auth services**
  (`SupabaseAuthService`, `MockAuthService`): their `db.*` writes populate the
  local cache DURING login — coupled to cache-removal (the gate), not
  independently migratable.
- **Section D (todo 8) is also gate-coupled.** `AuthContext.loadUserData`
  (AuthContext.tsx:443-517) reads `db.users`/`db.userProfiles`/
  `db.bandMemberships`/`db.bands` **local-cache-first**; `currentUser` via
  `db.users.get(userId)` has NO cloud fallback. Removing the initial-sync calls
  before the factory swap leaves those reads unfed → cold-start break.

### RECOMMENDED re-scope (pending Eric's go-ahead — this is still the STOP gate)

- **Skip Section B's "add repository methods" work entirely.** Do NOT build CRUD
  against deny-all tables for dead code.
- Fold the orphaned services into the **gate mass-deletion** (Section E): delete
  `CastingService`, `MemberCapabilityService`, `casting/CastingSuggestionService`,
  `BandService` member-methods (or the whole file if `DatabaseService` also
  goes), `setup/InitialSetupService`, and `SongService.getUserAccessibleSongs`.
  Grep each for importers again at delete time.
- **Section D moves INTO the gate**, sequenced WITH the factory swap so
  `loadUserData` reads resolve cloud-first (RemoteRepository) the moment the
  local cache stops being populated.
- Auth-service `db.*` writes: remove as part of the gate's cache teardown.

Net: after A.6, there is **no safe pre-gate mechanical work left**. Next action
is Eric's go-ahead on the (now larger) deletion gate.
