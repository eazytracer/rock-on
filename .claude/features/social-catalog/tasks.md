---
feature: Social Catalog (Personal Songs + Personal Setlists + Jam Sessions)
created: 2026-03-15T21:32
status: in-progress
based-on: 2026-03-15T21:32_plan.md
---

# Tasks: Social Catalog

## Legend

- `[P]` = Parallelizable with other [P] tasks in same phase
- `Depends: Txx` = Must complete listed task(s) first
- All tests written BEFORE or ALONGSIDE implementation (TDD)

---

## Phase 1: Personal Song Catalog

### 1A — Database Foundation

- [ ] T001: Install `qrcode.react` npm package
  - Command: `npm install qrcode.react`
  - Files: `package.json`, `package-lock.json`
  - Acceptance: Package appears in dependencies; `npm run type-check` passes

- [ ] T002: Add `normalize_text()` SQL function to baseline migration
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Add BEFORE the `CREATE TABLE public.songs` statement (generated columns depend on it)
  - Function: strips leading articles (the/a/an), punctuation, lowercases, collapses whitespace
  - Acceptance: `SELECT normalize_text('The Black Parade')` returns `'black parade'`

- [ ] T003: Add `normalized_title` and `normalized_artist` generated columns to `songs` table
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Add to `CREATE TABLE public.songs`: `normalized_title TEXT GENERATED ALWAYS AS (normalize_text(title)) STORED` and `normalized_artist TEXT GENERATED ALWAYS AS (normalize_text(COALESCE(artist, ''))) STORED`
  - Add index: `CREATE INDEX idx_songs_normalized ON public.songs(normalized_title, normalized_artist);`
  - Depends: T002
  - Acceptance: `supabase db reset` succeeds; columns exist with correct generated values

- [ ] T004: Add `account_tier` and `tier_updated_at` columns to `users` table
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Add to `CREATE TABLE public.users`: `account_tier TEXT NOT NULL DEFAULT 'free' CHECK (account_tier IN ('free', 'pro'))`, `tier_updated_at TIMESTAMPTZ DEFAULT NOW()`
  - Acceptance: `supabase db reset` succeeds; existing users get tier='free' by default; no behavior change

- [ ] T005: Update songs RLS policies for personal song support
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Replace single `songs_select_band_members_only` policy with two policies:
    - `songs_select_personal_own`: `context_type = 'personal' AND context_id = (select auth.uid())::text`
    - `songs_select_band_members`: `context_type = 'band' AND is_band_member(context_id::uuid, (select auth.uid()))`
  - Similarly split INSERT (`songs_insert_personal_own` + `songs_insert_band_members`), UPDATE, DELETE policies
  - Acceptance: `supabase db reset` succeeds; personal song owner can CRUD their songs; band member cannot see another user's personal songs

### 1B — Unit Tests (TDD — write before implementation)

- [ ] T006: [P] Write `songMatcher.test.ts` — normalization function tests
  - Files: `tests/unit/utils/songMatcher.test.ts`
  - Test `normalizeText()` with 50+ cases:
    - Leading articles: "The Black Parade" → "black parade", "A Day To Remember" → "day to remember", "An Honest Mistake" → "honest mistake"
    - Apostrophes: "Don't Stop Believin'" → "dont stop believin", "Nothin' But a Good Time" → "nothin but good time"
    - Punctuation: "AC/DC" → "acdc", "Bon Jovi!" → "bon jovi"
    - Whitespace collapse: "Sweet Home Alabama" → "sweet home alabama"
    - Identical after normalization: "The Black Parade" and "Black Parade" both → "black parade"
    - No false match: "Hurt" (Nine Inch Nails) vs "Hurt" (Johnny Cash) — same title, different artist
    - Fuzzy: "Bohemian Rhapsody" vs "Bohemian Rhap." (not exact, but close)
    - Suffix: "Sweet Home Alabama" vs "Sweet Home Alabama (Live)" (not exact)
  - Acceptance: All tests defined (can be failing — TDD); file exists with proper structure

- [ ] T007: [P] Write `useSongs.test.ts` additions — `usePersonalSongs` hook tests
  - Files: `tests/unit/hooks/useSongs.test.ts` (add to existing or create)
  - Test: hook fetches songs with contextType='personal', contextId=userId
  - Test: hook returns empty array when userId not provided
  - Test: hook re-fetches when userId changes
  - Acceptance: Tests defined; follow existing `useSongs` test patterns

### 1C — Implementation

- [ ] T008: Implement `normalizeText()` utility
  - Files: `src/utils/songMatcher.ts` (new file)
  - Export: `normalizeText(s: string): string`
  - Must match behavior of `normalize_text()` SQL function exactly
  - Depends: T006
  - Acceptance: All T006 normalization tests pass

- [ ] T009: [P] Update `SongService` to support personal songs
  - Files: `src/services/SongService.ts`
  - Add: `static async getPersonalSongs(userId: string): Promise<{ songs: Song[] }>`
  - Query with filter: `{ contextType: 'personal', contextId: userId }`
  - Acceptance: Returns personal songs for user; returns empty array if none

- [ ] T010: [P] Add `usePersonalSongs` hook
  - Files: `src/hooks/useSongs.ts`
  - Export: `usePersonalSongs(userId: string)` — mirrors `useSongs(bandId)` pattern
  - Include Realtime subscription for `context_type='personal'` changes
  - Depends: T009
  - Acceptance: All T007 hook tests pass

- [ ] T011: Add Personal/Band tab switcher to `SongsPage`
  - Files: `src/pages/SongsPage.tsx`
  - Add tab UI at top: "Band Songs" | "My Songs"
  - "Band Songs" tab: existing behavior, uses `useSongs(currentBandId)`
  - "My Songs" tab: uses `usePersonalSongs(currentUserId)`
  - Song creation in personal mode sets `contextType='personal'`, `contextId=currentUserId`
  - `data-testid="songs-band-tab"` and `data-testid="songs-personal-tab"`
  - Depends: T005, T010
  - Acceptance: Can create, view, edit, delete personal songs from My Songs tab; Band Songs tab unaffected

### 1D — E2E Tests

- [ ] T012: Write and run personal songs E2E tests
  - Files: `tests/e2e/songs/personal-songs.spec.ts`
  - Scenarios:
    - Create personal song: appears in "My Songs", NOT in "Band Songs"
    - Edit personal song: changes persist
    - Delete personal song: removed from list
    - User A's personal songs not visible to User B
  - All elements must have `data-testid` attributes; add to source if missing
  - Depends: T011
  - Acceptance: All E2E tests pass

### 1E — pgTAP Updates

- [ ] T013: [P] Update pgTAP schema tests for Phase 1 changes
  - Files: `supabase/tests/002-schema-columns.test.sql`
  - Add: `has_column('songs', 'normalized_title', ...)`, `has_column('songs', 'normalized_artist', ...)`, `has_column('users', 'account_tier', ...)`
  - Files: `supabase/tests/001-schema-tables.test.sql` — update plan count if needed
  - Acceptance: `npm run test:db` passes

---

## Phase 2: Personal Setlists

### 2A — Database Changes

- [ ] T014: Update `setlists` table in baseline migration for personal context
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Change `band_id UUID NOT NULL REFERENCES...` → `band_id UUID REFERENCES...` (remove NOT NULL)
  - Add columns to `CREATE TABLE public.setlists`:
    - `context_type TEXT NOT NULL DEFAULT 'band' CHECK (context_type IN ('band', 'personal'))`
    - `context_id TEXT`
    - `jam_session_id UUID` (FK constraint added later in Phase 3 after jam_sessions table exists)
    - `tags TEXT[] DEFAULT '{}'`
  - Add constraint: `CONSTRAINT setlist_context_check CHECK ((context_type = 'band' AND band_id IS NOT NULL) OR (context_type = 'personal' AND context_id IS NOT NULL))`
  - Acceptance: `supabase db reset` succeeds; existing band setlists work unchanged; personal setlist can be created without band_id

- [ ] T015: Update setlists RLS policies for personal context
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Add alongside existing band policies:
    - `setlists_select_personal_own`: `context_type = 'personal' AND context_id = (select auth.uid())::text`
    - `setlists_insert_personal_own`: same check
    - `setlists_update_personal_own`: same
    - `setlists_delete_personal_own`: same
  - Acceptance: Personal setlist owner can CRUD; band member cannot see another user's personal setlists

### 2B — Model + Repository Changes

- [ ] T016: Update `Setlist` model for personal context
  - Files: `src/models/Setlist.ts`
  - Make `bandId` optional: `bandId?: string`
  - Add: `contextType?: 'band' | 'personal'`, `contextId?: string`, `jamSessionId?: string`, `tags?: string[]`
  - Acceptance: TypeScript compiles; no breaking changes to existing setlist usage

- [ ] T017: Audit and update setlist queries for nullable `band_id`
  - Files: `src/services/data/RemoteRepository.ts`, `src/services/data/LocalRepository.ts`
  - Search for any code that assumes `bandId` is always set when querying setlists
  - Update `mapSetlistToSupabase` / `mapSetlistFromSupabase` to include new fields
  - Update `getSetlists(bandId)` signature — may need to become `getSetlists(filter: SetlistFilter)` to support personal setlists
  - Acceptance: All existing setlist tests still pass; personal setlists can be queried

- [ ] T018: Add `usePersonalSetlists` hook
  - Files: `src/hooks/useSetlists.ts`
  - Export: `usePersonalSetlists(userId: string)` — mirrors existing pattern
  - Acceptance: Hook fetches personal setlists correctly

### 2C — UI Changes

- [ ] T019: Add Personal/Band tab switcher to `SetlistsPage`
  - Files: `src/pages/SetlistsPage.tsx`
  - Mirror the Songs page tab pattern from T011
  - "Band Setlists" | "My Setlists" tabs
  - Personal setlist creation sets `contextType='personal'`, `contextId=currentUserId`
  - `data-testid="setlists-band-tab"` and `data-testid="setlists-personal-tab"`
  - Depends: T015, T016, T017, T018
  - Acceptance: Can create/view/edit/delete personal setlists; band setlists unaffected

### 2D — E2E Tests

- [ ] T020: Write and run personal setlists E2E tests
  - Files: `tests/e2e/setlists/personal-setlists.spec.ts`
  - Scenarios:
    - Create personal setlist: appears in "My Setlists", NOT in "Band Setlists"
    - Add songs to personal setlist (from personal song catalog)
    - Edit and delete personal setlist
    - Saved jam setlists appear with 'jam' tag badge
  - Depends: T019
  - Acceptance: All E2E tests pass

---

## Phase 3: Jam Session Core

### 3A — Database: New Tables

- [ ] T021: Add `jam_sessions`, `jam_participants`, `jam_song_matches` tables to baseline migration
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Add all three tables (Section 2 of migration, after `practice_sessions`)
  - Add `jam_session_id` FK constraint to `setlists` (after jam_sessions table is defined)
  - Add `is_jam_participant(p_session_id UUID, p_user_id UUID)` SECURITY DEFINER function
  - Add RLS policies for all three jam tables (see plan for policy details)
  - Add Realtime publication: `ALTER PUBLICATION supabase_realtime ADD TABLE jam_sessions, jam_participants, jam_song_matches`
  - Add `REPLICA IDENTITY FULL` for all three tables
  - Add all jam-related indexes
  - Acceptance: `supabase db reset` succeeds; 3 new tables in schema; `npm run test:db` passes

### 3B — Unit Tests (TDD)

- [ ] T022: [P] Complete `songMatcher.test.ts` — matching algorithm tests
  - Files: `tests/unit/utils/songMatcher.test.ts`
  - Add tests for `computeExactMatches()`, `computeFuzzyMatches()`, `mergeMatches()`:
    - Two users with same song (exact): returns 1 match, confidence='exact'
    - Two users with different songs: returns 0 matches
    - Article variation: "The Black Parade" + "Black Parade" → 1 exact match
    - Different artist same title: "Hurt" (NIN) + "Hurt" (Cash) → 0 matches
    - Fuzzy: "Bohemian Rhapsody" + "Bohemian Rhap." → 1 match, confidence='fuzzy', isConfirmed=false
    - Three participants: all have same song → participantCount=3
    - Three participants: only 2 share a song → participantCount=2
  - Depends: T008
  - Acceptance: All tests defined and passing for T008 functions

- [ ] T023: [P] Write `JamSessionService.test.ts`
  - Files: `tests/unit/services/JamSessionService.test.ts`
  - Tests:
    - `createSession()` generates valid short_code (6 alphanumeric chars)
    - `createSession()` sets expires_at to NOW + 24h (free tier stub)
    - `createSession()` generates view_token as hashed UUID
    - `canCreateJamSession()` returns `{ allowed: true }` (stub)
    - `generateShareUrl()` returns correct URL format
    - `saveAsSetlist()` creates setlist with correct context + tags
  - Acceptance: Tests defined; service interface clear

- [ ] T024: [P] Write `useJamSession.test.ts`
  - Files: `tests/unit/hooks/useJamSession.test.ts`
  - Tests: loading state, session data structure, error handling
  - Acceptance: Tests defined following existing hook test patterns

### 3C — New Model + Utility

- [ ] T025: Create `JamSession` model
  - Files: `src/models/JamSession.ts`
  - Export: `JamSession`, `JamParticipant`, `JamSongMatch`, `JamSessionSettings` interfaces
  - See plan for full interface definitions
  - Acceptance: TypeScript compiles with zero errors

- [ ] T026: Implement complete `songMatcher.ts` utility
  - Files: `src/utils/songMatcher.ts`
  - Exports: `normalizeText()`, `computeExactMatches()`, `computeFuzzyMatches()`, `mergeMatches()`
  - `computeFuzzyMatches()` uses Levenshtein distance ≤ 2 on normalized titles (same artist required)
  - Depends: T022
  - Acceptance: All T022 + T006 tests pass

### 3D — Repository + Interface Updates

- [ ] T027: Update `IDataRepository` with jam session method signatures
  - Files: `src/services/data/IDataRepository.ts`
  - Add section `// ========== JAM SESSIONS ==========`
  - Methods: `getJamSession(id)`, `getJamSessionByCode(shortCode)`, `createJamSession(session)`, `updateJamSession(id, updates)`, `getJamParticipants(sessionId)`, `addJamParticipant(participant)`, `updateJamParticipant(id, updates)`, `getJamSongMatches(sessionId)`, `upsertJamSongMatches(sessionId, matches)`
  - Acceptance: Interface compiles; implementing classes will show type errors until they implement the methods

- [ ] T028: Implement jam session methods in `RemoteRepository`
  - Files: `src/services/data/RemoteRepository.ts`
  - Implement all methods from T027
  - Include `mapJamSessionFromSupabase()`, `mapJamSessionToSupabase()` (camelCase ↔ snake_case)
  - `upsertJamSongMatches()`: DELETE old + INSERT new in a transaction
  - Depends: T021, T027
  - Acceptance: TypeScript compiles; methods query correct tables

- [ ] T029: Stub jam session methods in `LocalRepository` (no local cache)
  - Files: `src/services/data/LocalRepository.ts`
  - Jam sessions are Supabase-only; local methods throw `new Error('Jam sessions require remote repository')`
  - Depends: T027
  - Acceptance: TypeScript compiles; local repository fulfills interface

### 3E — Service + Hooks

- [ ] T030: Implement `JamSessionService`
  - Files: `src/services/JamSessionService.ts`
  - Implement all methods from plan: `createSession`, `joinSession`, `recomputeMatches`, `confirmMatch`, `dismissMatch`, `addManualMatch`, `saveAsSetlist`, `expireSession`, `canCreateJamSession`, `generateShareUrl`
  - `recomputeMatches()` uses `songMatcher.ts` for algorithm
  - `canCreateJamSession()` is a stub returning `{ allowed: true }`
  - Depends: T026, T028, T025
  - Acceptance: All T023 tests pass

- [ ] T031: Implement `useJamSession` hook
  - Files: `src/hooks/useJamSession.ts`
  - Returns: `{ session, participants, matches, loading, error }`
  - Actions: `joinSession`, `leaveSession`, `confirmMatch`, `dismissMatch`, `saveAsSetlist`
  - Depends: T030
  - Acceptance: All T024 tests pass

- [ ] T032: Implement `useJamSessionMatches` hook (Realtime)
  - Files: `src/hooks/useJamSessionMatches.ts`
  - Subscribe to `jam:session:{sessionId}` Supabase Realtime channel
  - Trigger `JamSessionService.recomputeMatches()` when participants table changes
  - Return: `{ matches, unconfirmedCount, isComputing }`
  - Depends: T031
  - Acceptance: Matches update in real-time when a new participant joins

### 3F — UI Components

- [ ] T033: [P] Implement `JamInviteQR` component
  - Files: `src/components/jam/JamInviteQR.tsx`
  - Uses `qrcode.react` `<QRCodeSVG>` (lazy-loaded)
  - Props: `url: string`, `size?: number`, `className?: string`
  - `data-testid="jam-invite-qr"`
  - Depends: T001
  - Acceptance: Renders QR code for a given URL; matches dark theme

- [ ] T034: [P] Implement `JamParticipantList` component
  - Files: `src/components/jam/JamParticipantList.tsx`
  - Props: `participants: JamParticipant[]`, `hostUserId: string`
  - Shows display name + "Host" badge for host + status indicator
  - `data-testid="jam-participant-list"`
  - Depends: T025
  - Acceptance: Renders participant list; host badge visible

- [ ] T035: [P] Implement `JamMatchList` component
  - Files: `src/components/jam/JamMatchList.tsx`
  - Props: `matches: JamSongMatch[]`, `isHost: boolean`, `onConfirm?: (id)=>void`, `onDismiss?: (id)=>void`, `readOnly?: boolean`
  - Groups: confirmed matches first, then unconfirmed fuzzy matches
  - Fuzzy matches show warning badge + confirm/dismiss buttons (host only)
  - `data-testid="jam-match-list"`, each item: `data-testid="jam-match-item-{id}"`
  - `data-testid="jam-match-confirm-{id}"`, `data-testid="jam-match-dismiss-{id}"`
  - Depends: T025
  - Acceptance: Renders all match types; confirm/dismiss only visible when `isHost=true`

- [ ] T036: [P] Implement `JamSessionCard` component
  - Files: `src/components/jam/JamSessionCard.tsx`
  - Props: `session: JamSession`, `shareUrl: string`, `onCopyLink?: ()=>void`, `onShowQR?: ()=>void`
  - Shows: session name, short_code, expiry countdown, copy link button, QR toggle
  - `data-testid="jam-session-card"`
  - Depends: T025, T033
  - Acceptance: Renders with correct session info; QR toggle shows JamInviteQR

- [ ] T037: Implement `JamSessionPage` (authenticated)
  - Files: `src/pages/JamSessionPage.tsx`
  - Sections: Create session form | Join via code input | Active session view | Past sessions list
  - Active session view: JamSessionCard + JamParticipantList + JamMatchList + "Save as Setlist" button
  - Tier check: `canCreateJamSession()` before create (shows upgrade prompt if false — stub always allows)
  - `data-testid="jam-session-page"`
  - Depends: T031, T032, T033, T034, T035, T036
  - Acceptance: Full create/join/view/save flow works end-to-end

### 3G — Navigation + Routing

- [ ] T038: Add Jam nav item to Sidebar
  - Files: `src/components/layout/Sidebar.tsx`
  - Add: `{ label: 'Jam', path: '/jam', icon: <Radio size={20} /> }` to navItems array
  - Import `Radio` from `lucide-react`
  - `data-testid="sidebar-jam-link"`
  - Acceptance: "Jam" appears in sidebar navigation; active state works

- [ ] T039: Register jam routes in App.tsx
  - Files: `src/App.tsx`
  - Add inside `ProtectedLayoutRoute`: `<Route path="/jam" element={<JamSessionPage />} />`
  - Add inside `ProtectedLayoutRoute`: `<Route path="/jam/:sessionId" element={<JamSessionPage />} />`
  - Lazy-load `JamSessionPage`
  - Depends: T037
  - Acceptance: `/jam` route renders JamSessionPage; TypeScript compiles

### 3H — E2E Tests

- [ ] T040: Write and run core jam session E2E tests
  - Files: `tests/e2e/jam/jam-session-core.spec.ts`
  - Scenarios:
    - User A creates jam session → sees short_code and QR code
    - User B joins via short_code → both users see each other in participant list
    - Both users have "Wonderwall" in personal catalog → appears in match list
    - Match count updates in real-time when User B joins
    - "Save as Setlist" creates personal setlist with 'jam' tag
  - All interactive elements must have data-testid
  - Depends: T037, T038, T039
  - Acceptance: All scenarios pass across Chrome + Firefox

---

## Phase 4: Unauthenticated View + Save

### 4A — Edge Function

- [ ] T041: Implement `jam-view` Supabase Edge Function
  - Files: `supabase/functions/jam-view/index.ts`
  - Endpoint: `GET /functions/v1/jam-view?code={shortCode}&t={rawToken}`
  - Logic:
    1. Hash `t` parameter with SHA-256
    2. SELECT jam_sessions WHERE short_code + view_token match + status='active' + not expired
    3. SELECT confirmed jam_song_matches for session
    4. SELECT host display_name from user_profiles
    5. Return safe payload (no user IDs/emails/raw catalog data)
    6. Return 404 for invalid/expired sessions
  - Rate limit awareness in response headers
  - Depends: T021
  - Acceptance: Valid token + code returns match list; invalid token returns 404; expired session returns 410 Gone

- [ ] T042: Write Edge Function unit tests
  - Files: `supabase/functions/jam-view/index.test.ts`
  - Test: valid request returns correct payload shape
  - Test: invalid token returns 404
  - Test: expired session returns appropriate error
  - Test: response never contains user IDs or emails
  - Depends: T041
  - Acceptance: Edge Function tests pass

### 4B — Public Page

- [ ] T043: Implement `JamViewPage` (public, no auth)
  - Files: `src/pages/JamViewPage.tsx`
  - NO auth check — this page is fully public
  - Parse `:shortCode` from URL params, `?t=` from query string
  - Fetch from Edge Function URL (not Supabase client directly)
  - States: loading (branded spinner, no sidebar), error ("Session not found or expired"), success
  - Success: session name, host display name, JamMatchList (readOnly=true), participant count, CTA button
  - CTA: "Sign up free to join this jam" → `/auth?view=signup&redirect=/jam/{shortCode}`
  - `data-testid="jam-view-page"`
  - Depends: T041, T035
  - Acceptance: Page loads without auth; shows correct data; CTA navigates to signup

- [ ] T044: Register public `/jam/view/:shortCode` route in App.tsx
  - Files: `src/App.tsx`
  - Add OUTSIDE `<Route element={<ProtectedLayoutRoute />}>`:
    ```tsx
    <Route path="/jam/view/:shortCode" element={<JamViewPage />} />
    ```
  - Lazy-load `JamViewPage`
  - Depends: T043
  - Acceptance: Route accessible without auth; ProtectedLayoutRoute not triggered

### 4C — Save as Setlist

- [ ] T045: Implement `saveAsSetlist` in `JamSessionService`
  - Files: `src/services/JamSessionService.ts`
  - Already stubbed in T030; implement fully here
  - Creates personal setlist from confirmed `jam_song_matches`
  - Sets: `contextType='personal'`, `contextId=hostUserId`, `tags=['jam']`, `jamSessionId=sessionId`
  - Sets `items` from matches where host's songId is available; falls back to title-only entry
  - Updates `jam_sessions.status='saved'` and `saved_setlist_id=newSetlistId`
  - Shows toast: "Jam saved as personal setlist!"
  - Navigates to `/setlists` (personal tab)
  - Depends: T030, T014
  - Acceptance: Setlist created with correct fields; session marked saved; toast shown

### 4D — E2E Tests

- [ ] T046: Write and run anon view E2E tests
  - Files: `tests/e2e/jam/jam-view-anon.spec.ts`
  - Scenarios:
    - Navigate to `/jam/view/{code}?t={token}` without auth cookies → page loads
    - Match list shows confirmed songs
    - CTA button navigates to signup page
    - Invalid token → shows error state
    - Expired session → shows "Session expired" message
  - Depends: T043, T044
  - Acceptance: All scenarios pass; no auth required

- [ ] T047: Write and run save setlist E2E tests
  - Files: `tests/e2e/jam/jam-save-setlist.spec.ts`
  - Scenarios:
    - Host clicks "Save as Setlist" → toast shown → redirected to My Setlists
    - New setlist appears in personal setlists tab with 'jam' tag badge
    - Setlist contains songs from jam matches
    - Saving again (already saved) shows appropriate message
  - Depends: T045, T020
  - Acceptance: All scenarios pass

---

## Phase 5: Polish

### 5A — Session Expiry

- [ ] T048: Implement session expiry check on load
  - Files: `src/services/JamSessionService.ts`, `src/hooks/useJamSession.ts`
  - On `useJamSession` load: if `session.expiresAt < Date.now()` and `status='active'`, call `expireSession(sessionId)` and show "Session expired" message
  - On `JamSessionPage`: expired sessions show in "Past sessions" section with expired badge
  - Acceptance: Expired sessions show correct UI state; host notified

- [ ] T049: [P] Add pg_cron expiry job to baseline migration (optional)
  - Files: `supabase/migrations/20251106000000_baseline_schema.sql`
  - Only if `pg_cron` extension is available in local Supabase
  - Add: `SELECT cron.schedule('expire-jam-sessions', '*/30 * * * *', $$UPDATE jam_sessions SET status = 'expired' WHERE status = 'active' AND expires_at < NOW()$$)`
  - Note: Skip if pg_cron is not available; client-side expiry (T048) is the primary mechanism
  - Acceptance: Cron runs without errors; or skip with note in migration

### 5B — Fuzzy Match UI

- [ ] T050: [P] Polish fuzzy match confirmation UX
  - Files: `src/components/jam/JamMatchList.tsx`
  - Already implemented in T035; add visual polish:
    - Warning icon (⚠️) on fuzzy matches
    - Clear "Possible match" label
    - Accessible confirm/dismiss buttons with keyboard support
    - Smooth animation when match is confirmed/dismissed
  - Acceptance: Fuzzy matches clearly distinguished; keyboard accessible; no layout shift

### 5C — pgTAP Test Updates

- [ ] T051: [P] Update pgTAP tests for all Phase 3-4 changes
  - Files: `supabase/tests/001-schema-tables.test.sql`, `supabase/tests/002-schema-columns.test.sql`
  - Add table existence tests for `jam_sessions`, `jam_participants`, `jam_song_matches`
  - Add column tests for all new jam table columns
  - Add column tests for `setlists.context_type`, `setlists.jam_session_id`, `setlists.tags`
  - Update plan count in `select plan(N)` to match new test count
  - Acceptance: `npm run test:db` passes with all new assertions

### 5D — Final Integration Tests

- [ ] T052: Run full test suite and fix any failures
  - Commands: `npm test`, `npm run test:db`, `npm run test:e2e`
  - Fix any test failures introduced by schema changes or new code
  - Ensure 0 TypeScript errors: `npm run type-check`
  - Ensure 0 lint errors: `npm run lint`
  - Acceptance: All tests pass; zero type errors; zero lint errors

- [ ] T053: Mobile/accessibility review
  - Review `JamSessionPage`, `JamViewPage`, `JamMatchList`, `JamSessionCard` on mobile viewport
  - Check QR code renders at appropriate size on small screens
  - Verify all interactive elements have ARIA labels
  - Test with keyboard navigation
  - Acceptance: No layout breaks on 375px viewport; keyboard navigable

---

## Task Dependency Graph

```
T001 (qrcode.react)
  └─ T033 (JamInviteQR)
       └─ T036 (JamSessionCard)

T002 (normalize_text SQL)
  └─ T003 (normalized cols)
       └─ [songs schema ready]

T004 (account_tier col) ─ independent

T005 (songs RLS split)
  └─ T011 (SongsPage tabs)
       └─ T012 (personal songs E2E)

T006 (normalizeText tests TDD)
  └─ T008 (normalizeText impl)
       └─ T022 (matching tests)
            └─ T026 (full matcher)
                 └─ T030 (JamSessionService)

T014 (setlists schema)
  └─ T015 (setlists RLS)
       └─ T016 (Setlist model)
            └─ T017 (repo audit)
                 └─ T018 (usePersonalSetlists)
                      └─ T019 (SetlistsPage tabs)
                           └─ T020 (personal setlists E2E)

T021 (jam tables)
  ├─ T027 (IDataRepository interface)
  │    ├─ T028 (RemoteRepository impl)
  │    └─ T029 (LocalRepository stub)
  └─ T041 (Edge Function)
       └─ T042 (Edge Function tests)

T023, T024 (TDD stubs) ─ parallel with T021

T025 (JamSession model)
  ├─ T030 (JamSessionService)  ←depends T026, T028
  │    └─ T031 (useJamSession)
  │         └─ T032 (useJamSessionMatches)
  │              └─ T037 (JamSessionPage)
  ├─ T034 (JamParticipantList)
  └─ T035 (JamMatchList)
       └─ T043 (JamViewPage) ←depends T041

T037, T038, T039 (page + nav + routing)
  └─ T040 (core E2E)

T043, T044 (public page + route)
  └─ T046 (anon view E2E)

T045 (saveAsSetlist impl) ←depends T030, T014
  └─ T047 (save E2E)

T048-T053 (polish) ←depends all above
```

---

## Estimated Hours by Phase

| Phase                      | Tasks        | Est. Hours |
| -------------------------- | ------------ | ---------- |
| Phase 1: Personal Songs    | T001–T013    | ~8h        |
| Phase 2: Personal Setlists | T014–T020    | ~6h        |
| Phase 3: Jam Core          | T021–T040    | ~14h       |
| Phase 4: Anon View + Save  | T041–T047    | ~8h        |
| Phase 5: Polish            | T048–T053    | ~4h        |
| **Total**                  | **53 tasks** | **~40h**   |
