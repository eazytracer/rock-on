---
title: Dashboard Table Name Mapping Fix
created: 2025-11-03T18:05
context: Fixed IndexedDB vs Supabase table name mismatches in Dev Dashboard
status: COMPLETE - Fixes Applied, Unit Tests Needed
priority: HIGH
---

# Dashboard Table Name Mapping Fix

**Issue Discovered:** 2025-11-03T17:25
**Fixed:** 2025-11-03T18:05
**Reporter:** User observation via Chrome DevTools

---

## 🐛 Problem Summary

The Developer Dashboard was showing errors for `practice_sessions` and `band_memberships` tables due to **table name convention mismatches** between IndexedDB (camelCase) and Supabase (snake_case).

### Root Cause

**IndexedDB Table Names (Dexie):**
- Uses camelCase: `practiceSessions`, `bandMemberships`
- Defined in: `src/services/database/index.ts`

**Supabase Table Names (PostgreSQL):**
- Uses snake_case: `practice_sessions`, `band_memberships`
- Defined in: Supabase migrations

**Dashboard Code:**
- Was using snake_case names for BOTH IndexedDB and Supabase queries
- IndexedDB queries: `db.table('practice_sessions')` ❌ (table doesn't exist)
- Supabase queries: `supabase.from('practice_sessions')` ✅ (correct)

---

## 🔧 Fixes Applied

### 1. DatabaseInspector.tsx - Table Name Mapping

**File:** `src/pages/DevDashboard/tabs/DatabaseInspector.tsx`

**Change:**
```typescript
// BEFORE (broken)
const tables = ['songs', 'setlists', 'shows', 'practice_sessions', 'bands', 'band_memberships']

for (const tableName of tables) {
  const localTable = db.table(tableName)  // ❌ Fails for practice_sessions/band_memberships
  const indexedDBCount = await localTable.count()
}

// AFTER (fixed)
const tableMapping: Record<string, string> = {
  'songs': 'songs',
  'setlists': 'setlists',
  'shows': 'shows',
  'practice_sessions': 'practiceSessions',  // ✅ Maps to camelCase
  'bands': 'bands',
  'band_memberships': 'bandMemberships'      // ✅ Maps to camelCase
}

const tables = Object.keys(tableMapping)

for (const tableName of tables) {
  const indexedDBTableName = tableMapping[tableName]
  const localTable = db.table(indexedDBTableName)  // ✅ Uses camelCase
  const indexedDBCount = await localTable.count()

  // Supabase still uses snake_case
  const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true })
}
```

**Why This Works:**
- IndexedDB queries use mapped camelCase names
- Supabase queries use original snake_case names
- Dashboard displays using snake_case labels (user-facing)

---

### 2. SyncQueueViewer.tsx - Supabase-Only Query

**File:** `src/pages/DevDashboard/tabs/SyncQueueViewer.tsx`

**Issue:**
```typescript
// BEFORE (broken)
const auditLog = await db.table('audit_log').toArray()  // ❌ audit_log doesn't exist in IndexedDB
```

**Architecture Decision:**
The `audit_log` table is **Supabase-only** by design:
- Created by database triggers on INSERT/UPDATE/DELETE
- Used for real-time sync notifications
- NOT replicated to IndexedDB (no offline use case)

**Fix:**
```typescript
// AFTER (fixed)
const { data: auditLog, error } = await supabase
  .from('audit_log')
  .select('*')
  .order('changed_at', { ascending: false })
  .limit(100)

const operations: QueuedOperation[] = (auditLog || []).map((entry: any) => ({
  id: entry.id,
  operation: entry.action,          // Supabase column name
  tableName: entry.table_name,
  recordId: entry.record_id,
  timestamp: new Date(entry.changed_at),  // Supabase column name
  changeData: entry.new_values || entry.old_values || {},
  retryCount: 0
}))
```

**Why Audit Log is Supabase-Only:**
1. **Server-side creation:** Triggers populate it, not client code
2. **No offline use case:** Audit history only meaningful when online
3. **Real-time sync:** RealtimeManager subscribes to audit_log channel
4. **Sync queue in IndexedDB:** Already have `syncQueue` table for pending operations

---

## 📊 Table Name Reference

### Complete Mapping

| Display Name (Dashboard) | Supabase (snake_case) | IndexedDB (camelCase) | Notes |
|--------------------------|----------------------|----------------------|-------|
| songs | `songs` | `songs` | Same name |
| setlists | `setlists` | `setlists` | Same name |
| shows | `shows` | `shows` | Same name |
| practice_sessions | `practice_sessions` | `practiceSessions` | ⚠️ Different |
| bands | `bands` | `bands` | Same name |
| band_memberships | `band_memberships` | `bandMemberships` | ⚠️ Different |

### Supabase-Only Tables

| Table | Purpose | Why Not in IndexedDB |
|-------|---------|---------------------|
| `audit_log` | Complete change history | Server-side triggers create it |
| `users` | Auth user records | Managed by Supabase Auth |
| `user_profiles` | User metadata | Synced via Auth context |

---

## 🧪 Unit Tests Required

### Test File: `tests/unit/pages/DevDashboard/DatabaseInspector.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { DatabaseInspector } from '../../../../src/pages/DevDashboard/tabs/DatabaseInspector'
import { db } from '../../../../src/services/database'
import { supabase } from '../../../../src/services/supabase/client'

// Mock modules
vi.mock('../../../../src/services/database')
vi.mock('../../../../src/services/supabase/client')
vi.mock('../../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}))

describe('DatabaseInspector - Table Name Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('IndexedDB Table Name Mapping', () => {
    it('should use camelCase names for IndexedDB queries', async () => {
      // Setup mocks
      const mockTable = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(10)
      })
      db.table = mockTable

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ count: 10, error: null })
        })
      }
      supabase = mockSupabase as any

      render(<DatabaseInspector />)

      await waitFor(() => {
        // Verify camelCase names used for IndexedDB
        expect(mockTable).toHaveBeenCalledWith('practiceSessions')  // NOT practice_sessions
        expect(mockTable).toHaveBeenCalledWith('bandMemberships')    // NOT band_memberships

        // Verify snake_case names used for Supabase
        expect(mockSupabase.from).toHaveBeenCalledWith('practice_sessions')
        expect(mockSupabase.from).toHaveBeenCalledWith('band_memberships')
      })
    })

    it('should handle tables with same names in both systems', async () => {
      const mockTable = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(5)
      })
      db.table = mockTable

      render(<DatabaseInspector />)

      await waitFor(() => {
        // These should use same name in both systems
        expect(mockTable).toHaveBeenCalledWith('songs')
        expect(mockTable).toHaveBeenCalledWith('setlists')
        expect(mockTable).toHaveBeenCalledWith('shows')
        expect(mockTable).toHaveBeenCalledWith('bands')
      })
    })

    it('should gracefully handle missing IndexedDB tables', async () => {
      const mockTable = vi.fn().mockImplementation((tableName) => {
        if (tableName === 'practiceSessions') {
          throw new Error('Table not found')
        }
        return { count: vi.fn().mockResolvedValue(10) }
      })
      db.table = mockTable

      render(<DatabaseInspector />)

      await waitFor(() => {
        // Should show error for practice_sessions, but not crash
        expect(mockTable).toHaveBeenCalledWith('practiceSessions')
        // Other tables should still work
        expect(mockTable).toHaveBeenCalledWith('songs')
      })
    })
  })

  describe('Table Mapping Completeness', () => {
    it('should map all 6 expected tables', async () => {
      const mockTable = vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(0)
      })
      db.table = mockTable

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ count: 0, error: null })
        })
      }
      supabase = mockSupabase as any

      render(<DatabaseInspector />)

      await waitFor(() => {
        // Verify all 6 tables queried
        expect(mockTable).toHaveBeenCalledTimes(6)
        expect(mockSupabase.from).toHaveBeenCalledTimes(6)
      })
    })
  })
})
```

---

### Test File: `tests/unit/pages/DevDashboard/SyncQueueViewer.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SyncQueueViewer } from '../../../../src/pages/DevDashboard/tabs/SyncQueueViewer'
import { supabase } from '../../../../src/services/supabase/client'

// Mock modules
vi.mock('../../../../src/services/supabase/client')
vi.mock('../../../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}))

describe('SyncQueueViewer - Audit Log Fetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should query audit_log from Supabase only (not IndexedDB)', async () => {
    const mockAuditLog = [
      {
        id: 'audit-1',
        action: 'INSERT',
        table_name: 'songs',
        record_id: 'song-1',
        changed_at: new Date().toISOString(),
        new_values: { title: 'Test Song' }
      }
    ]

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockAuditLog, error: null })
          })
        })
      })
    }
    supabase = mockSupabase as any

    render(<SyncQueueViewer />)

    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('audit_log')
      expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    })
  })

  it('should use correct Supabase column names', async () => {
    const mockAuditLog = [{
      id: 'audit-1',
      action: 'UPDATE',         // Supabase column
      table_name: 'setlists',
      record_id: 'setlist-1',
      changed_at: '2025-11-03T18:00:00Z',  // Supabase column
      new_values: { name: 'Updated' },
      old_values: { name: 'Original' }
    }]

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: mockAuditLog, error: null })
          })
        })
      })
    }
    supabase = mockSupabase as any

    render(<SyncQueueViewer />)

    await waitFor(() => {
      // Verify order by changed_at (Supabase column name)
      const orderCall = mockSupabase.from().select().order
      expect(orderCall).toHaveBeenCalledWith('changed_at', { ascending: false })
    })
  })

  it('should handle empty audit log gracefully', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })
    }
    supabase = mockSupabase as any

    const { getByText } = render(<SyncQueueViewer />)

    await waitFor(() => {
      expect(getByText(/queue is empty/i)).toBeInTheDocument()
    })
  })

  it('should limit results to 100 entries', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })
    }
    supabase = mockSupabase as any

    render(<SyncQueueViewer />)

    await waitFor(() => {
      const limitCall = mockSupabase.from().select().order().limit
      expect(limitCall).toHaveBeenCalledWith(100)
    })
  })
})
```

---

## ✅ Validation Checklist

### Manual Testing

- [ ] **Database Inspector Tab**
  - [ ] Navigate to `/dev/dashboard`
  - [ ] Log in
  - [ ] Click "Refresh Stats"
  - [ ] Verify all 6 tables show counts (no errors for practice_sessions/band_memberships)
  - [ ] Verify counts match between IndexedDB and Supabase

- [ ] **Sync Queue Viewer Tab**
  - [ ] Navigate to Sync Queue tab
  - [ ] Click "Refresh Queue"
  - [ ] Verify audit_log entries display (if any exist)
  - [ ] Verify no console errors about missing tables

### Automated Testing

- [ ] **Run unit tests:**
  ```bash
  npm test -- tests/unit/pages/DevDashboard/DatabaseInspector.test.ts
  npm test -- tests/unit/pages/DevDashboard/SyncQueueViewer.test.ts
  ```

- [ ] **Type checking:**
  ```bash
  npm run type-check
  # Should show no errors for DevDashboard files
  ```

- [ ] **Build verification:**
  ```bash
  npm run build
  # Should complete without errors
  ```

---

## 🎯 Prevention Strategy

### 1. Schema Documentation

**Create:** `.claude/specifications/table-name-conventions.md`

```markdown
# Table Name Conventions

## IndexedDB (Dexie)
- Uses camelCase for all table names
- Defined in: src/services/database/index.ts
- Examples: practiceSessions, bandMemberships

## Supabase (PostgreSQL)
- Uses snake_case for all table names
- Defined in: supabase/migrations/*.sql
- Examples: practice_sessions, band_memberships

## Mapping Rules
- Repository layers handle conversion automatically
- UI code should use IndexedDB names for local queries
- UI code should use Supabase names for remote queries
- Dev tools must map between conventions
```

### 2. Type-Safe Table Access

**Create helper:**
```typescript
// src/utils/tableNames.ts
export const TABLE_NAMES = {
  // Format: { display: 'name', indexedDB: 'name', supabase: 'name' }
  SONGS: { display: 'songs', indexedDB: 'songs', supabase: 'songs' },
  SETLISTS: { display: 'setlists', indexedDB: 'setlists', supabase: 'setlists' },
  SHOWS: { display: 'shows', indexedDB: 'shows', supabase: 'shows' },
  PRACTICES: { display: 'practice_sessions', indexedDB: 'practiceSessions', supabase: 'practice_sessions' },
  BANDS: { display: 'bands', indexedDB: 'bands', supabase: 'bands' },
  MEMBERSHIPS: { display: 'band_memberships', indexedDB: 'bandMemberships', supabase: 'band_memberships' },
} as const

// Usage in Dashboard:
import { TABLE_NAMES } from '../../../utils/tableNames'

const tables = Object.values(TABLE_NAMES)
for (const table of tables) {
  const indexedDBCount = await db.table(table.indexedDB).count()
  const { count } = await supabase.from(table.supabase).select('*', { count: 'exact' })
}
```

### 3. Integration Test

**Add to journey tests:**
```typescript
// tests/journeys/dashboard-validation.test.ts
it('JOURNEY: Dev Dashboard shows accurate table counts', async () => {
  const device = scenario.getDevice('device1')

  // Create test data
  await device.createSong({ title: 'Test Song' })
  await device.createPractice({ scheduledDate: new Date() })

  // Query both systems
  const indexedDBCounts = {
    songs: await db.table('songs').count(),
    practices: await db.table('practiceSessions').count()  // camelCase
  }

  const { data: songs } = await supabase.from('songs').select('*')
  const { data: practices } = await supabase.from('practice_sessions').select('*')  // snake_case

  // Dashboard should show these matching
  expect(indexedDBCounts.songs).toBe(songs.length)
  expect(indexedDBCounts.practices).toBe(practices.length)
})
```

---

## 📝 Summary

### What Was Fixed
1. ✅ DatabaseInspector now maps table names correctly (camelCase for IndexedDB)
2. ✅ SyncQueueViewer now queries Supabase-only (no IndexedDB audit_log)
3. ✅ TypeScript compilation passes
4. ✅ Architecture clarified (audit_log is Supabase-only by design)

### What's Still Needed
1. ⏳ Write unit tests (DatabaseInspector.test.ts, SyncQueueViewer.test.ts)
2. ⏳ Manual validation testing
3. ⏳ Create table name conventions doc
4. ⏳ Add type-safe table name helper
5. ⏳ Add journey test for dashboard validation

### Files Modified
- `src/pages/DevDashboard/tabs/DatabaseInspector.tsx` (table mapping added)
- `src/pages/DevDashboard/tabs/SyncQueueViewer.tsx` (switched to Supabase query)

---

**Status:** FIXES APPLIED ✅ | TESTS PENDING ⏳
**Next:** Write and run unit tests to prevent regression
**Priority:** HIGH - Dashboard is critical for MVP validation
