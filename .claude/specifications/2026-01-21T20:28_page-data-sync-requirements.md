---
timestamp: 2026-01-21T20:28
prompt: 'Create specification documenting all pages, their data requirements, and sync integration status'
type: specification
status: active
related-issue: practices-audit-sync
---

# Page Data & Sync Requirements Specification

## Overview

This specification documents all pages in the Rock-On application, what data they load, and whether they properly integrate with the real-time sync system (audit-log based sync via `RealtimeManager`).

## Sync Architecture Summary

The app uses an audit-log based sync system:

1. **Write Path**: Changes go through `SyncRepository` → Supabase → triggers `audit_log` INSERT
2. **Realtime Path**: `RealtimeManager` subscribes to `audit_log` via WebSocket → `mapAuditTo*()` → updates IndexedDB → emits events
3. **UI Update Path**: Hooks subscribe to `RealtimeManager` events → refetch from IndexedDB → UI updates

### Key Components

| Component         | Role                                              | File                                   |
| ----------------- | ------------------------------------------------- | -------------------------------------- |
| `RealtimeManager` | WebSocket subscription to audit_log, emits events | `src/services/data/RealtimeManager.ts` |
| `auditMappers.ts` | Converts Supabase JSONB to app models             | `src/services/data/auditMappers.ts`    |
| `useSongs`        | Song data with sync event subscription            | `src/hooks/useSongs.ts`                |
| `useSetlists`     | Setlist data with sync event subscription         | `src/hooks/useSetlists.ts`             |
| `usePractices`    | Practice data with sync event subscription        | `src/hooks/usePractices.ts`            |
| `useShows`        | Show data with sync event subscription            | `src/hooks/useShows.ts`                |

### Events Emitted by RealtimeManager

| Event               | Trigger                                     | Subscribers Should |
| ------------------- | ------------------------------------------- | ------------------ |
| `songs:changed`     | Song INSERT/UPDATE/DELETE via audit_log     | Refetch songs      |
| `setlists:changed`  | Setlist INSERT/UPDATE/DELETE via audit_log  | Refetch setlists   |
| `shows:changed`     | Show INSERT/UPDATE/DELETE via audit_log     | Refetch shows      |
| `practices:changed` | Practice INSERT/UPDATE/DELETE via audit_log | Refetch practices  |

---

## Page Inventory

### Legend

| Symbol | Meaning                                              |
| ------ | ---------------------------------------------------- |
| ✅     | Properly integrated with sync                        |
| ⚠️     | Partially integrated (uses hooks + direct db access) |
| ❌     | Not integrated - uses direct db access               |
| 🔧     | Needs fix                                            |

---

## 1. Songs Management

### SongsPage.tsx

**Path:** `/songs`
**File:** `src/pages/SongsPage.tsx`

| Aspect             | Status | Details                                                 |
| ------------------ | ------ | ------------------------------------------------------- |
| **Primary Data**   | ✅     | Songs via `useSongs(currentBandId)`                     |
| **Secondary Data** | ⚠️     | Setlists/shows for "next performance" via direct `db.*` |
| **Sync Events**    | ✅     | `useSongs` subscribes to `songs:changed`                |
| **Overall Status** | ✅     | Working (minor: secondary data not reactive)            |

**Data Loaded:**

- Songs (via `useSongs` hook) ✅
- Setlists (for determining next show - direct db) ⚠️
- Shows (for next performance date - direct db) ⚠️

**Required Hooks:** `useSongs`

---

## 2. Setlist Management

### SetlistsPage.tsx

**Path:** `/setlists`
**File:** `src/pages/SetlistsPage.tsx`

| Aspect             | Status | Details                                                        |
| ------------------ | ------ | -------------------------------------------------------------- |
| **Primary Data**   | ⚠️     | Uses `useSetlists` but also has direct `db.*` for initial load |
| **Secondary Data** | ❌     | Songs, shows, practices via direct `db.*`                      |
| **Sync Events**    | ⚠️     | `useSetlists` has subscription, but page duplicates loading    |
| **Overall Status** | ⚠️     | Mixed pattern - needs refactor                                 |

**Data Loaded:**

- Setlists (via `useSetlists` + direct db) ⚠️
- Songs (for setlist items - direct db) ❌
- Shows (for associating setlists - direct db) ❌
- Practice sessions (for usage - direct db) ❌

**Required Hooks:** `useSetlists`, `useSongs`, `useShows`, `usePractices`

**🔧 Fix Needed:** Refactor to use hooks consistently

---

### SetlistViewPage.tsx

**Path:** `/setlists/:setlistId`
**File:** `src/pages/SetlistViewPage.tsx`

| Aspect             | Status | Details                           |
| ------------------ | ------ | --------------------------------- |
| **Primary Data**   | ❌     | Direct `db.setlists.get()`        |
| **Secondary Data** | ❌     | Songs, shows via direct `db.*`    |
| **Sync Events**    | ❌     | None                              |
| **Overall Status** | ❌     | **BROKEN** - no real-time updates |

**Data Loaded:**

- Setlist (direct `db.setlists.get`) ❌
- Songs (for items - direct `db.songs`) ❌
- Shows (for association - direct `db.shows`) ❌

**Required Hooks:** `useSetlists` (or single `useSetlist(id)`), `useSongs`, `useShows`

**🔧 Fix Needed:** Add RealtimeManager event subscription

---

## 3. Practice Management

### PracticesPage.tsx

**Path:** `/practices`
**File:** `src/pages/PracticesPage.tsx`

| Aspect             | Status | Details                       |
| ------------------ | ------ | ----------------------------- |
| **Primary Data**   | ✅     | Via `useUpcomingPractices`    |
| **Secondary Data** | ✅     | Songs via `useSongs`          |
| **Sync Events**    | ✅     | Both hooks have subscriptions |
| **Overall Status** | ✅     | Working                       |

**Data Loaded:**

- Practice sessions (via `useUpcomingPractices`) ✅
- Songs (via `useSongs`) ✅

**Required Hooks:** `usePractices`/`useUpcomingPractices`, `useSongs`

---

### PracticeViewPage.tsx

**Path:** `/practices/:practiceId`
**File:** `src/pages/PracticeViewPage.tsx`

| Aspect             | Status | Details                            |
| ------------------ | ------ | ---------------------------------- |
| **Primary Data**   | ❌     | Direct `db.practiceSessions.get()` |
| **Secondary Data** | ❌     | Songs, setlists via direct `db.*`  |
| **Sync Events**    | ❌     | None                               |
| **Overall Status** | ❌     | **BROKEN** - no real-time updates  |

**Data Loaded:**

- Practice session (direct `db.practiceSessions.get`) ❌
- Songs (direct `db.songs.where()`) ❌
- Setlists (direct `db.setlists.where()`) ❌

**Required Hooks:** `usePractices` (or single `usePractice(id)`), `useSongs`, `useSetlists`

**🔧 Fix Needed:** Add RealtimeManager event subscription for `songs:changed` and `practices:changed`

**Additional Issue:** Song edits use `db.songs.update()` directly instead of `SyncRepository`

---

### PracticeSessionPage.tsx

**Path:** `/practices/:practiceId/session`
**File:** `src/pages/PracticeSessionPage.tsx`

| Aspect             | Status | Details                            |
| ------------------ | ------ | ---------------------------------- |
| **Primary Data**   | ❌     | Direct `db.practiceSessions.get()` |
| **Secondary Data** | ❌     | Songs via direct `db.songs.get()`  |
| **Sync Events**    | ❌     | None                               |
| **Overall Status** | ❌     | **BROKEN** - no real-time updates  |

**Data Loaded:**

- Practice session (direct `db.practiceSessions.get`) ❌
- Songs (direct `db.songs.get` per song) ❌

**Required Hooks:** `usePractices`, `useSongs`

**🔧 Fix Needed:** Add RealtimeManager event subscription

---

### PracticeBuilderPage.tsx

**Path:** `/practices/new` or `/practices/:practiceId/edit`
**File:** `src/pages/PracticeBuilderPage.tsx`

| Aspect             | Status | Details                            |
| ------------------ | ------ | ---------------------------------- |
| **Primary Data**   | ❌     | Direct `db.practiceSessions.get()` |
| **Secondary Data** | ❌     | Songs, setlists via direct `db.*`  |
| **Sync Events**    | ❌     | None                               |
| **Overall Status** | ❌     | **BROKEN** - no real-time updates  |

**Data Loaded:**

- Practice session (direct `db.practiceSessions.get`) ❌
- Songs (direct `db.songs.where()`) ❌
- Setlists (direct `db.setlists.where()`) ❌

**Required Hooks:** `usePractices`, `useSongs`, `useSetlists`

**🔧 Fix Needed:** Add RealtimeManager event subscription

---

## 4. Show Management

### ShowsPage.tsx

**Path:** `/shows`
**File:** `src/pages/ShowsPage.tsx`

| Aspect             | Status | Details                                                |
| ------------------ | ------ | ------------------------------------------------------ |
| **Primary Data**   | ✅     | Via `useShows`                                         |
| **Secondary Data** | ⚠️     | Setlists via direct `db.setlists`, songs via direct db |
| **Sync Events**    | ✅     | `useShows` has subscription                            |
| **Overall Status** | ⚠️     | Primary working, secondary data not reactive           |

**Data Loaded:**

- Shows (via `useShows`) ✅
- Setlists (for show details - direct db) ⚠️
- Songs (for setlist display - direct db) ⚠️

**Required Hooks:** `useShows`, `useSetlists`, `useSongs`

**🔧 Minor Fix:** Use hooks for setlists/songs

---

### ShowViewPage.tsx

**Path:** `/shows/:showId`
**File:** `src/pages/ShowViewPage.tsx`

| Aspect             | Status | Details                           |
| ------------------ | ------ | --------------------------------- |
| **Primary Data**   | ❌     | Direct `db.shows.get()`           |
| **Secondary Data** | ❌     | Setlists, songs via direct `db.*` |
| **Sync Events**    | ❌     | None                              |
| **Overall Status** | ❌     | **BROKEN** - no real-time updates |

**Data Loaded:**

- Show (direct `db.shows.get`) ❌
- Setlists (direct `db.setlists`) ❌
- Songs (direct `db.songs.get`) ❌

**Required Hooks:** `useShows` (or single `useShow(id)`), `useSetlists`, `useSongs`

**🔧 Fix Needed:** Add RealtimeManager event subscription

---

## 5. Band Management

### BandMembersPage.tsx

**Path:** `/band-members`
**File:** `src/pages/BandMembersPage.tsx`

| Aspect             | Status | Details              |
| ------------------ | ------ | -------------------- |
| **Primary Data**   | ✅     | Via `useBandMembers` |
| **Sync Events**    | ⚠️     | Needs verification   |
| **Overall Status** | ⚠️     | Needs audit          |

**Data Loaded:**

- Band members (via `useBandMembers`) ✅
- Band info (via `useBand`) ✅

**Required Hooks:** `useBandMembers`, `useBand`

---

## 6. Settings & Auth

### SettingsPage.tsx

**Path:** `/settings`
**File:** `src/pages/SettingsPage.tsx`

| Aspect             | Status | Details                      |
| ------------------ | ------ | ---------------------------- |
| **Primary Data**   | N/A    | User settings, not band data |
| **Sync Events**    | N/A    | Not applicable               |
| **Overall Status** | ✅     | No sync needed               |

---

### AuthPages.tsx

**Path:** `/auth`
**File:** `src/pages/AuthPages.tsx`

| Aspect             | Status | Details             |
| ------------------ | ------ | ------------------- |
| **Primary Data**   | N/A    | Authentication flow |
| **Sync Events**    | N/A    | Not applicable      |
| **Overall Status** | ✅     | No sync needed      |

**Note:** Has one direct `db.bands.get()` call during auth flow - acceptable for one-time read.

---

## 7. Dev Dashboard

### DevDashboard.tsx

**Path:** `/dev`
**File:** `src/pages/DevDashboard/DevDashboard.tsx`

| Aspect             | Status | Details                     |
| ------------------ | ------ | --------------------------- |
| **Overall Status** | ✅     | Dev-only, sync not critical |

---

## Summary: Pages Requiring Fix

### Critical (User-Facing, Multi-User Collaboration)

| Page                    | File                                | Issue                                       |
| ----------------------- | ----------------------------------- | ------------------------------------------- |
| **PracticeViewPage**    | `src/pages/PracticeViewPage.tsx`    | No sync events - stale data during practice |
| **PracticeSessionPage** | `src/pages/PracticeSessionPage.tsx` | No sync events - stale data during session  |
| **SetlistViewPage**     | `src/pages/SetlistViewPage.tsx`     | No sync events - stale setlist data         |
| **ShowViewPage**        | `src/pages/ShowViewPage.tsx`        | No sync events - stale show data            |

### Important (Builder/Editor Pages)

| Page                    | File                                | Issue                          |
| ----------------------- | ----------------------------------- | ------------------------------ |
| **PracticeBuilderPage** | `src/pages/PracticeBuilderPage.tsx` | No sync events during editing  |
| **SetlistsPage**        | `src/pages/SetlistsPage.tsx`        | Mixed hook + direct db pattern |

### Minor (Secondary Data)

| Page          | File                      | Issue                                       |
| ------------- | ------------------------- | ------------------------------------------- |
| **SongsPage** | `src/pages/SongsPage.tsx` | Secondary data (next show) not reactive     |
| **ShowsPage** | `src/pages/ShowsPage.tsx` | Secondary data (setlist songs) not reactive |

---

## Fix Priority Order

1. **mapAuditToPractice** - Add missing `wrapupNotes`, `sessionRating` fields (data loss bug)
2. **PracticeViewPage** - Critical for practice sessions
3. **PracticeSessionPage** - Critical for live practice sessions
4. **SetlistViewPage** - Important for performance prep
5. **ShowViewPage** - Important for show prep
6. **PracticeBuilderPage** - Important for editing
7. **SetlistsPage** - Refactor for consistency
8. **ShowsPage/SongsPage** - Minor improvements

---

## Implementation Pattern

### Option A: Add RealtimeManager Subscription (Quick Fix)

```typescript
import { useAuth } from '../contexts/AuthContext'

function MyPage() {
  const { realtimeManager } = useAuth()
  const [data, setData] = useState(...)

  // Existing load function
  const loadData = async () => {
    const result = await db.myTable.get(id)
    setData(result)
  }

  // Add sync subscription
  useEffect(() => {
    if (!realtimeManager) return

    const handleChange = (event: any) => {
      // Refetch when relevant data changes
      loadData()
    }

    realtimeManager.on('songs:changed', handleChange)
    realtimeManager.on('practices:changed', handleChange)

    return () => {
      realtimeManager.off('songs:changed', handleChange)
      realtimeManager.off('practices:changed', handleChange)
    }
  }, [realtimeManager])

  // ... rest of component
}
```

### Option B: Use Existing Hooks (Better Architecture)

```typescript
import { useSongs } from '../hooks/useSongs'
import { usePractices } from '../hooks/usePractices'

function MyPage() {
  const { songs, loading: songsLoading } = useSongs(bandId)
  const { practices, loading: practicesLoading } = usePractices(bandId)

  // Data is automatically reactive to sync events
  // No need for manual subscription
}
```

**Recommendation:** Use Option B where possible, fall back to Option A for single-item pages.

---

## Audit Checklist

Use this checklist when building new pages or auditing existing ones:

- [ ] Does the page display band-scoped data (songs, setlists, shows, practices)?
- [ ] Is all data loaded via sync-aware hooks (`useSongs`, `useSetlists`, etc.)?
- [ ] If using direct `db.*` access, is there a RealtimeManager subscription?
- [ ] Are all relevant events subscribed to (`songs:changed`, `practices:changed`, etc.)?
- [ ] Are writes going through `SyncRepository` (not direct `db.*.update()`)?
- [ ] Is the `auditMappers.ts` mapper complete for this entity type?

---

## Related Files

| File                                   | Purpose                         |
| -------------------------------------- | ------------------------------- |
| `src/services/data/auditMappers.ts`    | JSONB → Model mappers           |
| `src/services/data/RealtimeManager.ts` | WebSocket sync + event emission |
| `src/hooks/useSongs.ts`                | Song hook with sync             |
| `src/hooks/useSetlists.ts`             | Setlist hook with sync          |
| `src/hooks/usePractices.ts`            | Practice hook with sync         |
| `src/hooks/useShows.ts`                | Show hook with sync             |
