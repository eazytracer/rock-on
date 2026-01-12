# Dev Dashboard Audit

**Created:** 2026-01-10T17:47
**Location:** `/dev/dashboard` (http://localhost:5173/dev/dashboard)
**Source:** `src/pages/DevDashboard/`

## Overview

The Developer Dashboard is a dev-only tooling page with 5 tabs for debugging sync operations, inspecting databases, and viewing documentation. It's conditionally hidden in production builds.

## Current State Summary

| Tab                | Status                | Notes                                     |
| ------------------ | --------------------- | ----------------------------------------- |
| Database Inspector | **Working**           | Compares IndexedDB vs Supabase counts     |
| Sync Queue Viewer  | **Working**           | Shows audit_log entries from Supabase     |
| Network Inspector  | **Partially Working** | Shows sync status, but controls are TODOs |
| Dev Tools          | **Partially Working** | Clear DB works, Force Sync/Seed are stubs |
| Documentation      | **Outdated**          | ER diagram and test data need updates     |

---

## Tab-by-Tab Analysis

### 1. Database Inspector (`tabs/DatabaseInspector.tsx`)

**Status: Working**

Shows record counts comparison between IndexedDB and Supabase for:

- `songs`
- `setlists`
- `shows`
- `practice_sessions`
- `bands`
- `band_memberships`

**What works:**

- Real-time count comparison
- Mismatch/error indicators
- Refresh functionality
- Auth-gated (requires login)

**Issues:**

- Missing tables: `song_personal_notes`, `song_note_entries`, `audit_log`, `invite_codes`, etc.
- Only shows 6 of the 19 actual tables

---

### 2. Sync Queue Viewer (`tabs/SyncQueueViewer.tsx`)

**Status: Working**

Displays recent entries from `audit_log` table in Supabase.

**What works:**

- Shows INSERT/UPDATE/DELETE operations
- Expandable details with JSON payload
- Operation counts by type
- Timestamp display

**Issues:**

- Shows last 100 entries, not actually "pending" operations
- Description says "sync queue" but audit_log is historical, not a queue

---

### 3. Network Inspector (`tabs/NetworkInspector.tsx`)

**Status: Partially Working**

Monitors connection and sync status.

**What works:**

- Online/offline detection via `navigator.onLine`
- Sync status from `useSyncStatus` hook
- Last sync time display

**Not implemented (TODOs):**

- `simulateOffline()` - shows alert "not yet implemented"
- `forceReconnect()` - shows alert "not yet implemented"
- "Simulate Slow Network" - disabled
- WebSocket Events Log - placeholder

---

### 4. Dev Tools (`tabs/DevTools.tsx`)

**Status: Partially Working**

Utility functions for database management.

**What works:**

- Clear Local Database (IndexedDB) - **functional**
- Clear Supabase Data - **functional** (with confirmation)
- Export Database to JSON - **functional**

**Not implemented:**

- Force Sync Now - stub that just sleeps 1s
- Seed Test Data - stub that does nothing

**Code quality issues:**

- Uses native `confirm()` and `alert()` dialogs (violates CLAUDE.md guidelines)
- Should use `useConfirm()` and `useToast()` instead

---

### 5. Documentation (`tabs/Documentation.tsx`)

**Status: Outdated**

Renders Mermaid diagrams for schema, flows, and test status.

#### Database Schema (`diagrams/databaseSchema.ts`)

**ER Diagram - OUTDATED**

Shows 17 tables, but actual schema has 19:

| In Diagram             | In Schema               | Status      |
| ---------------------- | ----------------------- | ----------- |
| users                  | users                   |             |
| user_profiles          | user_profiles           |             |
| bands                  | bands                   |             |
| band_memberships       | band_memberships        |             |
| invite_codes           | invite_codes            |             |
| songs                  | songs                   |             |
| song_groups            | song_groups             |             |
| song_group_memberships | song_group_memberships  |             |
| setlists               | setlists                |             |
| shows                  | shows                   |             |
| practice_sessions      | practice_sessions       |             |
| song_castings          | song_castings           |             |
| song_assignments       | song_assignments        |             |
| assignment_roles       | assignment_roles        |             |
| casting_templates      | casting_templates       |             |
| member_capabilities    | member_capabilities     |             |
| audit_log              | audit_log               |             |
| -                      | **song_personal_notes** | **MISSING** |
| -                      | **song_note_entries**   | **MISSING** |

**Sync Architecture Diagram - OK**

- Accurately shows camelCase ↔ snake_case mapping
- Shows version conflict resolution flow

#### User Flows (`diagrams/authFlows.ts`)

**Authentication flows - Mostly accurate but incomplete:**

- Sign Up Email/Password
- Sign Up Google OAuth
- Sign In Email/Password
- Band Creation
- Band Joining

**Missing flows:**

- Practice session workflow (new feature)
- Setlist builder workflow
- Settings page workflow
- Song notes workflow (new feature)

#### Test Cases (`data/testCases.ts`)

**SEVERELY OUTDATED**

| Metric      | Dashboard Shows | Actual |
| ----------- | --------------- | ------ |
| Total Tests | 46              | 442    |
| Passing     | 2               | 426    |
| Failing     | 0               | 16     |
| Test Files  | -               | 40     |
| Coverage    | 4.3%            | ~96%   |

The dashboard only tracks 46 authentication-focused test cases from an early spec. The codebase now has:

- **Unit tests:** 23 files (services, hooks, config)
- **Integration tests:** 1 file
- **Journey tests:** 4 files
- **Contract tests:** 3 files
- **E2E tests:** 11 files (Playwright)
- **Database tests:** 11 files (pgTAP)
- **Performance tests:** 1 file

---

## Footer Information

The dashboard footer correctly displays:

- Environment mode (development/production)
- Database connection type (Local Supabase / Production / Mock)
- Development warning

---

## Files Structure

```
src/pages/DevDashboard/
├── DevDashboard.tsx           # Main component with tab navigation
├── tabs/
│   ├── DatabaseInspector.tsx  # IndexedDB vs Supabase comparison
│   ├── SyncQueueViewer.tsx    # Audit log viewer
│   ├── NetworkInspector.tsx   # Connection status & controls
│   ├── DevTools.tsx           # Utility functions
│   └── Documentation.tsx      # Mermaid diagram renderer
├── diagrams/
│   ├── databaseSchema.ts      # ER diagram & sync architecture
│   └── authFlows.ts           # Sequence diagrams for auth flows
└── data/
    └── testCases.ts           # Test status tracking (outdated)
```

---

## Recommendations

### High Priority (Data Accuracy)

1. **Update `testCases.ts`** - Remove or dynamically generate from actual test results
2. **Update ER diagram** - Add `song_personal_notes` and `song_note_entries` tables
3. **Expand Database Inspector** - Include all 19 tables, not just 6

### Medium Priority (Functionality)

4. **Implement Force Sync** - Connect to `SyncRepository.syncAll()`
5. **Implement Seed Test Data** - Use existing seed SQL or create test fixtures
6. **Replace native dialogs** - Use `useConfirm()` and `useToast()` per CLAUDE.md

### Low Priority (Nice to Have)

7. **Add user flow diagrams** for new features (practices, settings, notes)
8. **Implement WebSocket event logging** in Network Inspector
9. **Add offline simulation** for testing sync behavior

---

## Access

- **Route:** `/dev/dashboard`
- **Protected:** Yes (only in development mode)
- **Requires Auth:** No (but some features require login)
