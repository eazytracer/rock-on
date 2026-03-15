---
created: 2026-03-15T16:00
prompt: 'Review all .claude directory contents, spin up local environment, run all tests, and produce a comprehensive understanding of the application, its workflow, test status, and upcoming work.'
---

# Rock-On: Comprehensive Application Understanding

## What Is Rock-On?

Rock-On is a **band management web application** built for working musicians. It helps bands manage their song catalog, build and edit setlists, schedule shows, and run practice sessions. It is designed to be used collaboratively — multiple band members can be online simultaneously and see each other's changes in near real-time.

The application is **offline-first**: all writes go to local IndexedDB storage immediately, then sync to Supabase in the background. This means the app functions during gigs or rehearsals even if the internet goes out.

**Live at:** `rockon.band`  
**Current Version:** `0.2.2`  
**Stack:** TypeScript 5.x · React 18 · TailwindCSS · Vite · Supabase (PostgreSQL + Realtime + Auth) · IndexedDB (Dexie.js)

---

## User-Facing Pages and Features

### Auth Flow (`/auth`, `/get-started`)

- Email/password signup and login via Supabase Auth
- After signup, users land on `/get-started` to either create a band or join one via invite code
- Session management includes a **1.5-hour grace period** for expired tokens to support gig scenarios where connectivity lapses
- Sign-out triggers immediate redirect via custom `auth-logout` event (fixed 2026-03-15)

### Songs Page (`/songs`)

- Full song catalog for the band
- Add/edit/delete songs with: title, artist, key (circle of fifths picker), BPM/tempo, guitar tuning, structured notes (markdown), and reference links
- Reference links: YouTube, Spotify, tabs (Ultimate Guitar), lyrics, or custom URLs — all auto-detected and stored as JSONB
- Spotify API integration: search and auto-fill song metadata via a Supabase Edge Function
- Search by title or artist; filter by tuning
- Per-song sync status icon (green/yellow/red cloud) reflecting real IndexedDB syncQueue state
- Real-time: song changes from other band members appear instantly via WebSocket audit_log subscription

### Setlists Page (`/setlists`)

- Create and manage named setlists
- Setlist view (`/setlists/:id`): drag-and-drop song ordering, add/remove songs, add section breaks
- Duplicate setlists; shows linked to setlists

### Shows Page (`/shows`)

- Schedule shows with venue, date, time, location
- Shows can be linked to a setlist
- Show detail view (`/shows/:id`): manage show info inline

### Practices Page (`/practices`)

- List of scheduled practice sessions
- Create/edit practices: date, time, location, objectives, songs, notes
- **Practice Builder** (`/practices/new`): full-page builder with song selection via browse drawer
- **Practice Session Mode** (`/practices/:id/session`): full-screen display for active practice
  - Shows current song with key, BPM, tuning, and markdown-rendered notes
  - Progress dots, keyboard navigation (← →), live timer
  - Retuning warnings between songs if tuning changes
- **Practice View** (`/practices/:id`): review a completed/scheduled session, inline editing

### Band Members Page (`/band-members`)

- View all band members with their roles
- Admin: invite new members (generates invite codes), remove members, change roles
- Roles: owner → admin → member (viewer role defined in spec but not yet active in UI)

### Settings Page (`/settings`)

- Account info display (email, name, user ID — read-only in v1)
- Delete Account flow (with confirmation modal)
- Dev-mode section (only visible in development): sync logs, IndexedDB clear, version info

---

## Technical Architecture

### Data Flow (Writes)

```
User action
  → useSongs/usePractices/etc hook
    → SyncRepository (src/services/data/SyncRepository.ts)
      → writes to IndexedDB (Dexie.js)
      → queues operation in db.syncQueue
      → triggers SyncEngine
        → SyncEngine pushes to Supabase (RemoteRepository)
          → Supabase writes to table
          → audit_log trigger fires
```

### Data Flow (Real-time Updates from Other Users)

```
Supabase audit_log INSERT
  → RealtimeManager WebSocket subscription
    → handleAuditChange()
      → auditMappers.ts (maps JSONB → typed model)
        → db.[table].put() (updates IndexedDB)
          → emits event: 'songs:changed' / 'practices:changed' / etc
            → hooks (useSongs, usePractices) catch event → refetch → UI updates
```

### Key Services

| File                                             | Purpose                                                         |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `src/services/data/SyncRepository.ts`            | Central write path; all CRUD routes through here                |
| `src/services/data/SyncEngine.ts`                | Queue management, retry logic, online/offline handling          |
| `src/services/data/RemoteRepository.ts`          | Supabase read/write, field mapping (camelCase ↔ snake_case)    |
| `src/services/data/RealtimeManager.ts`           | WebSocket subscription to audit_log, event emission             |
| `src/services/data/auditMappers.ts`              | Converts Supabase audit_log JSONB → typed IndexedDB models      |
| `src/services/data/featureFlags.ts`              | Feature flags (SYNC_USE_AUDIT_LOG: default true)                |
| `src/contexts/AuthContext.tsx`                   | Global auth state, signOut, switchBand, band membership         |
| `src/hooks/useAuthCheck.ts`                      | Auth validation hook; runs on route change AND on signOut event |
| `src/components/layout/ProtectedLayoutRoute.tsx` | Auth check + persistent layout wrapper                          |

### Auth Architecture

- `useAuthCheck` validates localStorage keys + SessionManager session on every route change and on `auth-logout` event
- `ProtectedLayoutRoute` wraps all protected routes with `ModernLayout` via React Router's `<Outlet>` — sidebar and navbar stay mounted during navigation (no white screen flicker)
- Session grace period: 1.5 hours after token expiry (for gig offline scenarios)
- Redirect mapping: `no-user` → `/auth` · `no-band` → `/auth?view=get-started` · `session-expired` → `/auth?reason=session-expired`

### Database Schema Overview

17 tables in Supabase (see `.claude/specifications/unified-database-schema.md`):

- `users`, `user_profiles` — user identity
- `bands`, `band_memberships` — band and membership
- `songs` — song catalog (`context_id` TEXT, not `band_id`; `bpm` in app = `tempo` in Supabase)
- `setlists`, `setlist_songs` — setlist management (uses `last_modified` not `updated_date`)
- `shows` — show scheduling
- `practice_sessions` — practice sessions (table name: `practice_sessions` not `practices`)
- `song_personal_notes`, `song_note_entries` — per-song note layers
- `invite_codes`, `audit_log` — invitations and change history
- RLS on all tables, band isolation enforced at DB level
- Realtime enabled on 5 tables

---

## Development Workflow

### Command Flow

```
/research <feature>   → research-agent → .claude/backlog/<feature>/research.md
/plan <feature>       → plan-agent    → .claude/features/<feature>/{plan,tasks}.md
/implement <feature>  → execute-agent → code changes + tests
                      → test-agent    → run full suite → success or failure report
/diagnose <issue>     → diagnose-agent → .claude/active-work/issues/<slug>/diagnosis.md
/finalize <feature>   → finalize-agent → quality checks → commit → PR
                      → moves to .claude/completed/<feature>/SUMMARY.md
/release [patch|minor|major] → version bump → CHANGELOG → tag → push
```

### Directory Structure

```
.claude/
  backlog/      ← Researched features awaiting /plan
  features/     ← Active feature in progress (currently empty)
  active-work/  ← Active bug diagnoses (currently empty — all issues resolved)
  completed/    ← Finished features (SUMMARY.md only)
  artifacts/    ← Design docs, specs, reports
  agents/       ← Agent instruction files
  commands/     ← Slash command definitions
  specifications/ ← Authoritative specs (DB schema, design system, etc.)
```

### Test Commands

```bash
npm test                 # 678 unit/integration tests (Vitest)
npm run test:quick       # ~2s fast subset (components, hooks, contexts)
npm run test:unit        # All unit tests
npm run test:db          # 384 pgTAP database tests (schema/RLS/triggers)
npm run test:e2e         # Playwright E2E (chromium/firefox/webkit/mobile)
npx playwright test tests/e2e/<suite>/ --project=chromium  # Single suite
```

**Important:** Run E2E suites individually with `--project=chromium` — running all suites at once can cause timeouts/hangs.

---

## Test Status (as of 2026-03-15)

### Unit Tests (Vitest): 678/678 passing ✅

39 test files, 678 tests — all green.

### Database Tests (pgTAP): 384/384 passing ✅

11 test files (000 is setup-only, no plan = harmless exit 1 from harness).  
Note: `008` gap in numbering is intentional (file removed).

### E2E Tests (Playwright): All chromium passing ✅

Suites verified:
| Suite | Tests | Status |
|-------|-------|--------|
| auth/login-smoke | 3 (×5 browsers) | ✅ |
| auth/signup | 3 | ✅ |
| auth/session-expiry | 11 | ✅ |
| auth/join-band | 3 | ✅ |
| auth/protected-routes | 13 | ✅ (fixed logout redirect 2026-03-15) |
| auth/signup-debug | 1 | ✅ |
| songs/crud | 7 | ✅ |
| songs/search-filter | 6 | ✅ |
| songs/reference-links | 6 | ✅ (fixed selectors 2026-03-15) |
| bands/band-isolation | 7 | ✅ |
| bands/manage-members | 13 | ✅ |
| permissions/rbac | 7 | ✅ |
| practices/crud | 6 | ✅ |
| practices/session | 6 | ✅ (fixed button selector 2026-03-15) |
| settings/settings-page | 19 pass / 3 skip | ✅ |
| layout/persistent-layout | 10 | ✅ |
| sync/setlist-show-sync | 4 | ✅ |

**Empty E2E directories** (no test files): `errors/`, `realtime/`, `setlists/`, `shows/`

### Fixes Applied 2026-03-15

1. **Logout redirect bug** (`src/hooks/useAuthCheck.ts`): After signOut, `useAuthCheck` only re-ran on pathname change. Added `auth-logout` custom event dispatch in `AuthContext.logout()` and listener in `useAuthCheck` to trigger immediate re-validation.
2. **reference-links.spec.ts**: Updated all `input[type="url"]` selectors → `[data-testid="link-url-input"]`; removed link type `<select>` references (UI changed to icon-based auto-detection); fixed CSS selector comma parsing errors; fixed strict mode violations.
3. **session.spec.ts**: Updated `button:has-text("Create Song")` → `[data-testid="song-submit-button"]` (button always says "Save Changes").

---

## Backlog (9 Features)

| Priority | Feature                       | Status                           | Est.                |
| -------- | ----------------------------- | -------------------------------- | ------------------- |
| High     | **ci-cd-pipeline**            | Research + plan complete         | 20+ hrs             |
| High     | **multi-band-support**        | Plan complete (95% infra exists) | 14 hrs              |
| High     | **account-tiers-and-access**  | Research complete                | 30+ hrs             |
| Medium   | **unified-kebab-menu**        | Research complete                | 8-12 hrs            |
| Medium   | **email-invitations**         | Research + spec complete         | 15-20 hrs           |
| Medium   | **enhanced-security-testing** | Research complete                | 15-20 hrs           |
| Medium   | **guitar-tuning-system**      | Research complete                | 8-12 days           |
| Low      | **no-console-eslint-rule**    | Research complete                | 2-4 hrs             |
| Low      | **react-native-app**          | Research complete                | 100+ hrs (post-1.0) |

### Recommended Next Steps

1. **ci-cd-pipeline** — highest infrastructure value, unblocks everything
2. **no-console-eslint-rule** — can run in parallel with CI, quick win (456 violations → createLogger)
3. **multi-band-support** — most infrastructure already exists, mostly UI work
4. **unified-kebab-menu** — clean up before more UI features
5. **email-invitations** — growth feature

### Known Fringe Sync Issues (not yet tracked as formal issues)

- Occasionally a newly created item doesn't reflect immediately on the creator's own device
- Occasionally a band member has to refresh to see another member's change
- These are likely timing/race conditions in the IndexedDB → event → hook re-render pipeline; not yet diagnosed

---

## Key Conventions and Gotchas

### Database

- **Never** use `practices` table name → it's `practice_sessions`
- **Never** use `updated_date` for setlists → it's `last_modified`
- `songs.bpm` in app = `songs.tempo` in Supabase
- Pre-1.0: modify baseline migration directly (`supabase/migrations/20251106000000_baseline_schema.sql`), do not create new migration files
- Test seed users: `eric@testband.demo`, `mike@testband.demo`, `sarah@testband.demo` / password: `test123`

### Date/Time

- Never `new Date("YYYY-MM-DD")` → parses as UTC midnight (off-by-one in local TZ)
- Never `.toISOString().split('T')[0]` → converts to UTC first
- Use `parseDateInputAsLocal()` and `formatDateForInput()` from `src/utils/dateHelpers`

### UI/UX Rules

- Never `alert()`, `confirm()`, `prompt()` → use `useToast()` / `useConfirm()` + `<ConfirmDialog>`
- Always `overflow-y-auto custom-scrollbar` (never bare `overflow-y-auto`)
- All form inputs need `name`, `id`, and `data-testid` attributes
- Buttons need `data-testid`
- `data-testid` naming: `{context}-{field}-{type}` (e.g. `login-email-input`)

### Logging

- Never `console.log/warn/info` → use `createLogger('ComponentName')` from `src/utils/logger`
- `log.debug` = dev only · `log.info/warn` = dev + test · `log.error` = always
