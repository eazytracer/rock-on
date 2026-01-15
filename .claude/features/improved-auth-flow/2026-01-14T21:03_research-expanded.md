---
timestamp: 2026-01-14T21:03
feature: Improved Authentication Flow + Enhanced Sync
type: research
status: complete
scope: browser-only (mobile deferred to separate feature)
supersedes: 2025-12-11T15:15_research.md
---

# Improved Auth Flow + Enhanced Sync - Expanded Research

## Executive Summary

This research document **expands** the original improved-auth-flow research to include:

1. **Sync-on-load** - Guaranteed data refresh when app loads (multi-device support)
2. **"New" item indicators** - Visual highlighting of items changed since last session
3. **Session summary** - Toast/modal showing what changed while user was away
4. **Release notes system** - In-app notifications for new features and updates

**Original Problem (from 2025-12-11 research):**

- Users see "Not logged in" on protected pages due to race condition between ProtectedRoute and AuthContext

**Additional Problems (new findings):**

- No automatic data pull on app load - changes from other devices/users not visible until WebSocket event
- No way to know what changed since last session
- No system for communicating app updates to users

---

## Part 1: Auth Flow Issues (Existing Research - Validated)

### 1.1 Root Cause (Still Valid)

The original research identified a race condition:

- `ProtectedRoute` checks only localStorage keys (`currentUserId`, `currentBandId`)
- `AuthContext` state loads asynchronously
- Result: Page renders with empty auth state showing "Not logged in"

**Solution from Original Plan (Still Valid):**

- Create `useAuthCheck` hook for unified session validation
- Update `ProtectedRoute` to use hook + show loading state
- Clear localStorage on session expiry
- Implement 1.5-hour grace period for brief offline access

### 1.2 Validation Against Current Code

**AuthContext.tsx (Line 176-277):**

- Confirmed: `loadInitialSession()` runs async
- Confirmed: Sets `currentUser` from IndexedDB after async operations
- Issue: No pull from Supabase if `isInitialSyncNeeded()` returns false

**ProtectedRoute.tsx:**

- Confirmed: Only checks localStorage keys synchronously
- No awareness of session validity or auth loading state

**Original plan remains valid - proceed with Option B implementation.**

---

## Part 2: Sync-on-Load Gap (NEW)

### 2.1 Current Architecture Analysis

**Sync Engine Configuration (SyncEngine.ts:22-35):**

```typescript
// REMOVED - Periodic sync disabled in favor of real-time WebSocket sync
// this.startPeriodicSync()
```

The periodic sync was intentionally disabled because:

- Caused UI "blinking" every 30 seconds
- Redundant with RealtimeManager WebSocket subscriptions
- Battery drain from constant polling

**Initial Sync Logic (SyncEngine.ts:643-662):**

```typescript
async isInitialSyncNeeded(): Promise<boolean> {
  // Check localStorage first (fastest)
  const lastFullSync = localStorage.getItem('last_full_sync')
  if (!lastFullSync) return true

  // Check if it's been more than 30 days (force re-sync)
  const daysSinceSync = ...
  if (daysSinceSync > 30) return true

  // Check if any local tables are empty (data was cleared)
  ...
  return false
}
```

**The Problem:**

- After initial sync, no automatic data refresh on app load
- Changes from other devices/users only appear via WebSocket
- If user closes app and reopens 5 minutes later, stale data is shown
- WebSocket only triggers when real-time events occur (someone makes a change)

### 2.2 When Sync Currently Happens

| Event                     | Pull from Supabase? | Push to Supabase? |
| ------------------------- | ------------------- | ----------------- |
| First login / 30+ days    | Yes (full sync)     | N/A               |
| App load (normal)         | **No**              | N/A               |
| User makes a change       | No                  | Yes (immediate)   |
| Another user changes data | Via WebSocket       | N/A               |
| Coming back online        | Yes (syncNow)       | Yes (push queue)  |

**Critical Gap:** Normal app load does NOT pull fresh data from Supabase.

### 2.3 Multi-Device Scenario

```
Scenario: User has app open on phone and laptop

1. User adds song on laptop → Pushed to Supabase ✅
2. User closes laptop
3. User opens phone (app was closed) → Shows OLD data ❌
4. Phone relies on WebSocket, but no real-time event happened
5. User sees stale data until they refresh or trigger a sync

Expected: Phone should pull fresh data on app load
```

### 2.4 Proposed Solution: Sync-on-Load

Add a new sync behavior: **Always pull from Supabase on app load**

**Implementation Location:** `AuthContext.tsx` in `loadInitialSession()`

```typescript
// Current flow:
// 1. Load session
// 2. Check isInitialSyncNeeded() → Usually false
// 3. Load from IndexedDB → Shows potentially stale data
// 4. Start realtime sync

// Proposed flow:
// 1. Load session
// 2. Check isInitialSyncNeeded() → Full sync if needed
// 3. ALWAYS: Pull incremental changes from Supabase (new!)
// 4. Load from IndexedDB → Fresh data
// 5. Start realtime sync
```

**New Method Needed:** `pullIncrementalChanges(userId, lastSyncTime)`

- Query Supabase for records modified since `lastSyncTime`
- Use `updated_date` / `last_modified` columns for filtering
- Faster than full sync (only gets changes)
- Store `lastSyncTime` in localStorage per user

---

## Part 3: "New" Item Indicators (NEW)

### 3.1 Requirement

Users want to see which items have been added or changed since their last session.

**Examples:**

- Songs list shows star/badge on newly added songs
- Setlists show indicator for items modified by others
- Practice sessions show "New" label for scheduled sessions

### 3.2 Design Options

**Option A: Client-Side Tracking**

- Store `lastSessionTimestamp` in localStorage
- Compare item's `createdDate` / `updatedDate` to timestamp
- Mark as "new" if newer than last session

**Pros:** Simple, no schema changes
**Cons:** Per-device only, not per-user

**Option B: Server-Side User Activity Tracking** (Recommended)

- New table: `user_activity` with `last_active_at` per user
- On app load: Compare item timestamps to user's `last_active_at`
- Update `last_active_at` on session end or periodic ping

**Pros:** Works across devices, accurate "last seen"
**Cons:** Schema change required

**Option C: Per-Item Read Tracking**

- Track which items each user has "seen"
- Mark unseen items as new
- Very granular but complex

**Recommendation:** Option B - Server-side activity tracking with client-side comparison

### 3.3 UI Design

```
Songs List:
┌─────────────────────────────────────┐
│ ★ New Song Title         Rock  3:42 │  ← New badge
│   Existing Song          Pop   4:12 │
│ ★ Another New One        Jazz  5:00 │  ← New badge
└─────────────────────────────────────┘
```

**Badge Types:**

- `new` - Item created since last session
- `updated` - Item modified by someone else since last session
- Clear badge after user views the item (optional)

### 3.4 Implementation Approach

1. Add `last_active_at` column to `users` table (or new `user_sessions` table)
2. Update `last_active_at` on login and periodically
3. On data load, compare item timestamps to `last_active_at`
4. Add `isNew` / `isUpdated` computed property to UI components
5. Style with badge/star/highlight

---

## Part 4: Session Summary Notifications (NEW)

### 4.1 Requirement

When user opens the app after being away, show a summary of what changed:

- "Since your last session: 12 new songs have been added, 2 practices scheduled, 1 show created"

### 4.2 Design Options

**Option A: Summary Toast**

- Single toast notification on app load
- Brief, dismissable
- Less intrusive

**Option B: Welcome-Back Modal**

- Modal dialog with detailed summary
- Links to view new items
- More prominent, good for significant changes

**Option C: Hybrid (Recommended)**

- Toast for small changes (< 5 items)
- Modal for significant changes (5+ items)
- User preference to disable

### 4.3 Data Aggregation

On sync-on-load, count changes by type:

```typescript
interface SessionSummary {
  newSongs: number
  updatedSongs: number
  newSetlists: number
  updatedSetlists: number
  newPractices: number
  newShows: number
  newBandMembers: number // Someone joined
  lastSessionTime: Date
}
```

### 4.4 UI Design

**Toast Example:**

```
┌────────────────────────────────────────┐
│ Welcome back! Since yesterday:          │
│ 3 new songs • 1 practice scheduled     │
└────────────────────────────────────────┘
```

**Modal Example (for significant changes):**

```
┌─────────────────────────────────────────────┐
│          Welcome Back, John!                 │
├─────────────────────────────────────────────┤
│ Since Jan 12, 2026:                         │
│                                             │
│ 🎵 Songs: 12 new, 3 updated                 │
│ 📋 Setlists: 2 new, 1 updated               │
│ 🎸 Practices: 2 scheduled                   │
│ 🎤 Shows: 1 created                         │
│ 👥 Band: Mike joined!                       │
│                                             │
│         [View Changes]  [Dismiss]           │
└─────────────────────────────────────────────┘
```

---

## Part 5: Release Notes System (NEW)

### 5.1 Requirement

Display release notes and app updates to users:

- What's new in the latest version
- Important announcements
- Feature tips

### 5.2 Schema Design

**New Table: `app_announcements`**

```sql
CREATE TABLE app_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,  -- Markdown supported
  announcement_type TEXT NOT NULL CHECK (announcement_type IN ('release', 'feature', 'tip', 'maintenance')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  target_audience TEXT NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'admins', 'members')),
  app_version TEXT,  -- Optional: Show only for specific versions
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Optional: Auto-hide after date
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),  -- Admin who created it
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Track which users have dismissed announcements
CREATE TABLE user_announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  announcement_id UUID NOT NULL REFERENCES app_announcements(id),
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, announcement_id)
);
```

### 5.3 Display Logic

1. On app load, query active announcements not dismissed by user
2. Filter by `target_audience` and `app_version` (if specified)
3. Sort by priority and `starts_at`
4. Display in appropriate UI:
   - Critical: Modal (blocking)
   - High: Prominent banner
   - Normal: Notification bell / dropdown
   - Low: "What's New" section

### 5.4 Admin Interface (Future)

Eventually need admin UI to:

- Create announcements
- Set targeting (all users, admins only, etc.)
- Schedule announcements
- View dismissal stats

For MVP: Seed announcements via migrations or Supabase Studio.

---

## Part 6: Combined Implementation Strategy

### 6.1 Feature Dependencies

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 1: Auth Flow Fix                    │
│  - useAuthCheck hook                                         │
│  - ProtectedRoute update                                     │
│  - Session expiry handling                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Phase 2: Sync-on-Load                     │
│  - pullIncrementalChanges() method                          │
│  - lastSyncTime tracking                                     │
│  - AuthContext integration                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Phase 3: Activity Tracking                    │
│  - user_sessions table (or last_active_at column)           │
│  - Update on login/activity                                  │
│  - Expose via API/context                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────┬─────────────────────────────────┐
│   Phase 4a: New Badges    │    Phase 4b: Session Summary    │
│  - Compare timestamps     │    - Aggregate changes          │
│  - UI components          │    - Toast/Modal logic          │
└───────────────────────────┴─────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Phase 5: Release Notes System                 │
│  - app_announcements table                                   │
│  - user_announcement_dismissals table                        │
│  - Display UI                                                │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Risk Assessment

| Feature           | Complexity | Risk   | Notes                                                   |
| ----------------- | ---------- | ------ | ------------------------------------------------------- |
| Auth Flow Fix     | Medium     | Low    | Well-researched, clear plan                             |
| Sync-on-Load      | Medium     | Medium | Need to ensure no duplicates, handle offline gracefully |
| Activity Tracking | Low        | Low    | Simple schema addition                                  |
| New Badges        | Low        | Low    | Client-side logic, minimal changes                      |
| Session Summary   | Medium     | Low    | Depends on sync-on-load                                 |
| Release Notes     | Medium     | Low    | New feature, no dependencies                            |

### 6.3 Schema Changes Summary

**users table (modify):**

```sql
ALTER TABLE users ADD COLUMN last_active_at TIMESTAMPTZ;
```

**New Tables:**

```sql
-- app_announcements (see Part 5.2)
-- user_announcement_dismissals (see Part 5.2)
```

**sync_metadata table (modify - if needed):**

```sql
-- May need per-user last_sync_time tracking
-- Currently global in localStorage
```

---

## Part 7: Open Questions

### 7.1 Technical Questions

**Q1: Incremental Sync Query Strategy**

- Should we use `updated_date > lastSyncTime` for all tables?
- How to handle deletes? (Deleted records won't show up)
- Options:
  a) Soft deletes with `deleted_at` column
  b) Audit log query for deletes since last sync
  c) Full sync for deletes, incremental for creates/updates

**Q2: New Badge Persistence**

- Should "new" status persist until user clicks item?
- Or clear after viewing the list?
- Or clear after X hours?

**Q3: Session Summary Threshold**

- How many changes warrant a modal vs toast?
- Should user be able to disable summaries?

### 7.2 Product Questions

**Q4: Release Notes Scope**

- Should release notes be dismissable?
- Should they persist (view again later)?
- Who manages announcements (admin only)?

**Q5: Multi-Band Considerations**

- New badges per band or global?
- Summary per band or aggregate?

---

## Part 8: Recommendations

### 8.1 Implementation Order

1. **Phase 1: Auth Flow Fix** (4-6 hours) - Original plan
2. **Phase 2: Sync-on-Load** (4-6 hours) - Critical for multi-device
3. **Phase 3: Activity Tracking** (2-3 hours) - Enables new badges
4. **Phase 4a: New Badges** (2-3 hours) - High-value UX feature
5. **Phase 4b: Session Summary** (2-3 hours) - Depends on sync-on-load
6. **Phase 5: Release Notes** (4-6 hours) - Independent, can parallelize

**Total Estimate:** 18-27 hours across all phases

### 8.2 MVP vs Future

**MVP (This Sprint):**

- Auth flow fix
- Sync-on-load
- Basic new badges (client-side timestamp comparison)
- Simple toast summary

**Future:**

- Server-side activity tracking
- Detailed modal summary with links
- Release notes system with admin UI
- Per-item read tracking

### 8.3 Next Steps

1. **User Decision:** Confirm scope - MVP only or full implementation?
2. **Pass to Planning Agent:** Create detailed implementation plan
3. **Begin Phase 1:** Auth flow fix (well-researched, ready to go)

---

## Appendix A: Files to Modify

### Auth Flow (Phase 1)

- `src/hooks/useAuthCheck.ts` (create)
- `src/components/ProtectedRoute.tsx` (modify)
- `src/contexts/AuthContext.tsx` (modify)
- `src/components/auth/SessionExpiredModal.tsx` (simplify)

### Sync-on-Load (Phase 2)

- `src/services/data/SyncEngine.ts` (add incremental pull)
- `src/services/data/RemoteRepository.ts` (add filtered queries)
- `src/contexts/AuthContext.tsx` (call sync on load)

### Activity Tracking (Phase 3)

- `supabase/migrations/XXXXX_add_user_activity.sql` (new)
- `src/services/data/RemoteRepository.ts` (update activity)

### New Badges (Phase 4a)

- `src/hooks/useSongs.ts` (add isNew logic)
- `src/pages/SongsPage.tsx` (render badges)
- Similar for setlists, shows, practices

### Session Summary (Phase 4b)

- `src/components/SessionSummaryToast.tsx` (create)
- `src/components/SessionSummaryModal.tsx` (create)
- `src/contexts/AuthContext.tsx` (trigger summary)

### Release Notes (Phase 5)

- `supabase/migrations/XXXXX_add_announcements.sql` (new)
- `src/services/data/AnnouncementService.ts` (create)
- `src/components/AnnouncementBanner.tsx` (create)
- `src/components/WhatsNewModal.tsx` (create)

---

## Appendix B: Related Documents

- **Original Auth Research:** `.claude/features/improved-auth-flow/2025-12-11T15:15_research.md`
- **Original Auth Plan:** `.claude/features/improved-auth-flow/2025-12-11T17:12_plan.md`
- **Sync Architecture Analysis:** `.claude/artifacts/2025-11-20T17:00_database-sync-architecture-analysis.md`
- **Bidirectional Sync Spec:** `.claude/specifications/2025-10-30T13:25_bidirectional-sync-specification.md`

---

**End of Expanded Research Document**
