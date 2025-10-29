---
title: Unified Implementation Roadmap - Cloud-First Migration with Testing & SQL Cleanup
created: 2025-10-29T16:15
status: Active - Ready for Implementation
prompt: |
  Create unified phased plan integrating three initiatives:
  1. Cloud-First Sync Architecture (2025-10-29T02:12)
  2. SQL Files Cleanup (2025-10-29T00:10)
  3. Comprehensive Testing Strategy (2025-10-27T18:41)

  Focus on sync overhaul first, with testing groundwork for TDD, and clean migrations for fresh testing.
dependencies:
  - .claude/artifacts/2025-10-29T02:12_cloud-first-sync-architecture.md
  - .claude/artifacts/2025-10-29T00:10_sql-files-cleanup-plan.md
  - .claude/artifacts/2025-10-27T18:41_comprehensive-testing-strategy.md
  - .claude/specifications/unified-database-schema.md
---

# 🚀 Unified Implementation Roadmap

## Executive Summary

This roadmap unifies three major initiatives into a cohesive implementation plan:

1. **Cloud-First Sync Architecture**: Migrate from local-first to cloud-first with real-time collaboration
2. **SQL Cleanup**: Clean up 10 redundant SQL files, fix outdated fresh_init.sql
3. **Comprehensive Testing**: TDD approach with integration and E2E tests

**Key Strategy**: Start with foundation (SQL cleanup + testing infrastructure), then implement cloud-first sync using TDD, validate continuously.

---

## 🎯 Implementation Philosophy

### Core Principles

1. **Validate Everything**: Never assume - always verify with tools (tests, chrome MCP, SQL queries)
2. **TDD Approach**: Write tests before implementing features
3. **Clean Foundation**: Fix SQL and schema issues before building on top
4. **Incremental Progress**: Small, validated steps with continuous validation
5. **Authoritative Source**: Always reference `.claude/specifications/unified-database-schema.md`

### Validation Requirements

**Before any code change:**
- ✅ Run existing tests: `npm test`
- ✅ Check TypeScript: `npm run type-check`
- ✅ Validate schema against spec

**After any code change:**
- ✅ Run affected tests
- ✅ Start app and verify UI: `npm run dev`
- ✅ Use Chrome MCP to test functionality
- ✅ Query database to verify data: SQL commands
- ✅ Run full test suite before commit

---

## 📊 Phase Overview

| Phase | Focus | Duration | Risk | Value | Status |
|-------|-------|----------|------|-------|--------|
| **0: Current State Validation** | Verify baseline | 1.5h | Low | High | ✅ **COMPLETE** |
| **1: Foundation** | SQL cleanup + Testing setup | 4-6h | Low | High | 🔄 Next |
| **2: Visual Sync Indicators** | UI for sync status | 5-7h | Low | High | ⏳ Pending |
| **3: Immediate Sync + Tests** | Cloud-first writes (TDD) | 8-10h | Med | High | ⏳ Pending |
| **4: Real-Time Sync + Tests** | WebSocket sync (TDD) | 10-12h | Med | High | ⏳ Pending |
| **5: Developer Dashboard** | Debug tools | 6-8h | Low | Med | ⏳ Pending |
| **6: Integration Tests** | Workflow coverage | 8-10h | Low | High | ⏳ Pending |
| **7: E2E Tests (Cypress)** | UI automation | 10-12h | Med | Med | ⏳ Pending |

**Total Estimated Effort**: 52-67 hours (6-8 working days)
**Completed**: 1.5 hours (Phase 0)
**Remaining**: 50.5-65.5 hours

---

## 🔍 Phase 0: Current State Validation ✅ **COMPLETE**

**Objective**: Establish baseline and identify issues before making changes

**Status:** ✅ COMPLETED (2025-10-29T16:26)
**Duration:** 1.5 hours
**Report:** `.claude/instructions/00-baseline-validation-report.md`

### Tasks Completed

#### 0.1: Validate Test Suite ✅
```bash
# Ran full test suite
npm test
```

**Results:**
- ✅ 489 tests passing
- ❌ 24 tests failing (integration test mocks + UUID fixtures)
- ✅ 513 total tests
- ✅ 95.3% pass rate
- ✅ All critical sync infrastructure tests passing

**Validation Criteria:**
- ✅ Know exact test count: 489 passing, 24 failing
- ✅ Identify test categories: Unit (mostly passing), Integration (needs mock setup)
- ✅ Document any blockers: None critical, all fixable in Phase 1

#### 0.2: Validate Application ✅
```bash
# Started dev server
npm run dev

# Used Chrome MCP to test
```

**Results:**
- ✅ App starts without errors on http://localhost:5173
- ✅ Auth page loads correctly
- ✅ Mock users feature works
- ⚠️ Login fails (expected - database not seeded)
- 📸 Screenshots captured: `/tmp/app-auth-page.png`, `/tmp/app-login-attempt.png`

**Validation Criteria:**
- ✅ App starts without errors
- ⚠️ Pages require authentication (need to seed DB first)
- ✅ Basic UI operations work
- ✅ Screenshots captured for comparison

#### 0.3: Validate Database Schema ✅
```bash
# Supabase already running
supabase status

# Validated schema with sub-agent
```

**Results:**
- ✅ Supabase running (DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres)
- ✅ Shows table exists and properly structured
- ✅ All field names match spec: `songs.tempo` (not bpm), `setlists.last_modified` ✅
- ✅ 98% schema compliance
- ✅ All migrations applied (latest: 20251028000000_create_shows_table.sql)

**Validation Criteria:**
- ✅ Supabase running
- ✅ Shows table exists (post-split confirmed)
- ✅ Field names match unified-database-schema.md exactly
- ✅ Minor discrepancies documented (dual FK paths, legacy fields)

#### 0.4: Validate SQL Files ✅
```bash
# Counted SQL files with Explore agent
find supabase/ scripts/ -name "*.sql" | wc -l
```

**Results:**
- ✅ 23 SQL files found (not 22 as predicted)
- ✅ 12 migrations (all valid)
- ✅ 1 primary seed file: `seed-local-dev.sql`
- ✅ 10 files identified for deletion
- ⚠️ `fresh_init.sql` confirmed outdated (missing shows table)

**Validation Criteria:**
- ✅ Confirmed SQL file count: 23 total
- ✅ Confirmed fresh_init.sql is outdated (Oct 27, before shows migration)
- ✅ Complete list of files to keep (13) vs delete (10) documented

### Deliverables Created ✅

**Primary Report:** `.claude/instructions/00-baseline-validation-report.md`

**Contents:**
- ✅ Test status: 489 passing, 24 failing (detailed breakdown)
- ✅ App functionality baseline (working, needs seeding)
- ✅ Database schema validation (98% compliant)
- ✅ SQL files audit (23 files, 10 to delete)
- ✅ Issues identified (none critical)
- ✅ Phase 1 readiness: APPROVED

**Sub-Agent Reports:**
- ✅ SQL Files Comprehensive Audit (100% accurate)
- ✅ Database Schema Validation Report (98% compliant)

**Screenshots:**
- ✅ `/tmp/app-auth-page.png` (33KB)
- ✅ `/tmp/app-login-attempt.png` (30KB)

### Key Findings Summary

| Area | Status | Details |
|------|--------|---------|
| **Tests** | ✅ 95.3% passing | 24 failures are mock/fixture issues, non-blocking |
| **Application** | ✅ Working | Auth functional, needs DB seeding for full test |
| **Database** | ✅ 98% compliant | Shows table separated, field naming correct |
| **SQL Files** | ✅ Audited | 10 redundant files ready for cleanup |
| **Blockers** | ✅ None | System ready for Phase 1 |

### Next Action

✅ **Ready to proceed to Phase 1: Foundation (SQL Cleanup & Testing Setup)**

---

## 🧹 Phase 1: Foundation - SQL Cleanup & Testing Setup (4-6 hours)

**Objective**: Clean up SQL files and establish testing infrastructure for TDD

### 1.1: SQL Cleanup (2-3 hours)

#### Step 1.1.1: Backup Current State (15 min)
```bash
# Create backup branch
git checkout -b backup/pre-sql-cleanup
git add -A
git commit -m "Backup before SQL cleanup"
git checkout user-mgmt

# Backup SQL files
mkdir -p .backups/sql-$(date +%Y%m%d)
cp -r supabase/ scripts/ .backups/sql-$(date +%Y%m%d)/
```

#### Step 1.1.2: Delete Redundant Files (30 min)
```bash
# Delete empty/redundant root level seeds
rm supabase/seed.sql
rm supabase/seed-dev-users.sql
rm supabase/seed-full-catalog.sql
rm supabase/seed-full-catalog-random-ids.sql

# Delete old seeds directory
rm -rf supabase/seeds/

# Delete redundant scripts
rm scripts/seed_test_data.sql

# Verify deletions
git status
```

**Validation:**
- [ ] Run `npm test` - should still pass
- [ ] Check `supabase/seed-local-dev.sql` still exists
- [ ] Verify migrations directory intact

#### Step 1.1.3: Fix fresh_init.sql (1-2 hours)

**Option A - Update It (Recommended):**
```bash
# Regenerate from current migrations
cat supabase/migrations/*.sql > scripts/fresh_init.sql.new

# Manual review and cleanup
# - Remove migration metadata
# - Ensure proper order
# - Verify shows table included

# Replace old file
mv scripts/fresh_init.sql scripts/fresh_init.sql.old
mv scripts/fresh_init.sql.new scripts/fresh_init.sql
```

**Option B - Delete It (Simpler):**
```bash
# Just delete and rely on migrations
rm scripts/fresh_init.sql

# Update QUICK-START.md to use migrations
```

**Validation:**
- [ ] Test fresh database setup:
  ```bash
  supabase db reset
  psql $DATABASE_URL -f supabase/seed-local-dev.sql
  psql $DATABASE_URL -c "SELECT COUNT(*) FROM shows;"  # Should work
  ```

#### Step 1.1.4: Update Documentation (30 min)

Update `QUICK-START.md`:
```markdown
# Quick Start

## Setup Development Database

```bash
# Start Supabase (applies all migrations automatically)
supabase start

# Seed test data
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -f supabase/seed-local-dev.sql

# Verify
supabase status
psql $DATABASE_URL -c "SELECT COUNT(*) FROM songs;"
```

## Reset Database

```bash
# Clean reset
supabase db reset

# Re-seed
psql $DATABASE_URL -f supabase/seed-local-dev.sql
```
```

**Validation:**
- [ ] Follow QUICK-START.md on fresh machine
- [ ] Verify database has test data
- [ ] Run app and login with test user

### 1.2: Testing Infrastructure Setup (2-3 hours)

#### Step 1.2.1: Create Test Utilities (1 hour)

**File**: `tests/helpers/testDatabase.ts`
```typescript
import { db } from '../../src/services/database'
import { seedMvpData } from '../../src/database/seedMvpData'

export async function resetTestDatabase() {
  // Clear all tables
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map(table => table.clear()))
  })

  // Reseed with MVP data
  await seedMvpData()
}

export async function getTableCounts() {
  return {
    songs: await db.songs.count(),
    setlists: await db.setlists.count(),
    shows: await db.shows.count(),
    practices: await db.practiceSessions.count()
  }
}
```

**File**: `tests/helpers/testSupabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js'

export async function resetSupabaseTestData() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY! // Service role for testing
  )

  // Delete test data (preserve auth users)
  await supabase.from('shows').delete().eq('band_id', 'test-band-id')
  await supabase.from('setlists').delete().eq('band_id', 'test-band-id')
  await supabase.from('songs').delete().eq('context_id', 'test-band-id')
}

export async function verifySupabaseSchema() {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  // Verify shows table exists
  const { data, error } = await supabase.from('shows').select('count')
  if (error) throw new Error(`Shows table error: ${error.message}`)

  // Verify field names match spec
  const { data: song } = await supabase.from('songs').select('*').limit(1).single()
  if (song && 'bpm' in song) {
    throw new Error('Songs table still has "bpm" field - should be "tempo"')
  }
}
```

**Validation:**
- [ ] Run test helpers:
  ```bash
  npm test -- tests/helpers/testDatabase.test.ts
  npm test -- tests/helpers/testSupabase.test.ts
  ```

#### Step 1.2.2: Update Test Setup (30 min)

**File**: `tests/setup.ts`
```typescript
import { beforeAll, afterAll } from 'vitest'
import { db } from '../src/services/database'
import { resetTestDatabase } from './helpers/testDatabase'
import { verifySupabaseSchema } from './helpers/testSupabase'

beforeAll(async () => {
  // Verify schema on startup
  if (process.env.VITE_SUPABASE_URL) {
    await verifySupabaseSchema()
  }

  // Initialize test database
  await db.open()
  await resetTestDatabase()
})

afterAll(async () => {
  await db.delete()
})
```

#### Step 1.2.3: Create Integration Test Template (30 min)

**File**: `tests/integration/template.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { resetTestDatabase } from '../helpers/testDatabase'

describe('Integration Test Template', () => {
  beforeEach(async () => {
    await resetTestDatabase()
  })

  it('should have clean test data', async () => {
    // Verify starting state
    const counts = await getTableCounts()
    expect(counts.songs).toBeGreaterThan(0)
    expect(counts.setlists).toBeGreaterThan(0)
  })
})
```

**Validation:**
- [ ] Run integration test template:
  ```bash
  npm test -- tests/integration/template.test.ts
  ```

### Deliverables

**Create instruction file**: `.claude/instructions/01-foundation-completion-report.md`

Contents:
- SQL files deleted (list)
- fresh_init.sql status (updated or deleted)
- Test utilities created
- Validation results
- Next steps for Phase 2

---

## 🎨 Phase 2: Visual Sync Indicators (5-7 hours)

**Objective**: Add visual sync status to UI (no sync logic changes yet)

**Reference**: Cloud-First Sync Architecture - Phase 1

### 2.1: Create SyncIcon Component (1 hour)

**TDD Approach**: Write tests first

**File**: `tests/unit/components/sync/SyncIcon.test.tsx`
```typescript
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SyncIcon } from '../../../../src/components/sync/SyncIcon'

describe('SyncIcon', () => {
  it('should render synced status', () => {
    const { container } = render(<SyncIcon status="synced" />)
    expect(container.querySelector('.text-green-500')).toBeTruthy()
  })

  it('should render syncing status with animation', () => {
    const { container } = render(<SyncIcon status="syncing" />)
    expect(container.querySelector('.animate-pulse')).toBeTruthy()
  })

  it('should render pending status', () => {
    const { container } = render(<SyncIcon status="pending" />)
    expect(container.querySelector('.text-yellow-500')).toBeTruthy()
  })

  it('should render error status', () => {
    const { container } = render(<SyncIcon status="error" />)
    expect(container.querySelector('.text-red-500')).toBeTruthy()
  })

  it('should render unread badge', () => {
    const { container } = render(<SyncIcon status="unread" />)
    expect(container.querySelector('.bg-blue-500')).toBeTruthy()
  })
})
```

**File**: `src/components/sync/SyncIcon.tsx`
```typescript
import { CloudCheck, CloudArrowUp, CloudX, Clock } from 'phosphor-react'

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'unread'

interface SyncIconProps {
  status: SyncStatus
  size?: 'sm' | 'md'
}

export function SyncIcon({ status, size = 'sm' }: SyncIconProps) {
  const iconSize = size === 'sm' ? 16 : 20

  switch (status) {
    case 'synced':
      return <CloudCheck size={iconSize} className="text-green-500" />

    case 'syncing':
      return <CloudArrowUp size={iconSize} className="text-blue-500 animate-pulse" />

    case 'pending':
      return <Clock size={iconSize} className="text-yellow-500" />

    case 'error':
      return <CloudX size={iconSize} className="text-red-500" />

    case 'unread':
      return (
        <div className="relative">
          <CloudCheck size={iconSize} className="text-green-500" />
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
        </div>
      )
  }
}
```

**Validation:**
- [ ] Run component tests: `npm test -- SyncIcon.test.tsx`
- [ ] Visual test in Storybook or isolated page
- [ ] Screenshot all 5 states

### 2.2: Add Sync Status Tracking (2 hours)

**TDD: Write hook tests first**

**File**: `tests/unit/hooks/useSyncStatus.test.ts`
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSyncStatus } from '../../../src/hooks/useSyncStatus'

describe('useSyncStatus', () => {
  beforeEach(() => {
    // Clear status store
  })

  it('should initialize with empty status', () => {
    const { result } = renderHook(() => useSyncStatus())
    expect(result.current.getStatus('item-1')).toBeUndefined()
  })

  it('should set item status', () => {
    const { result } = renderHook(() => useSyncStatus())

    act(() => {
      result.current.setStatus('item-1', 'syncing')
    })

    expect(result.current.getStatus('item-1')).toBe('syncing')
  })

  it('should update to synced after delay', async () => {
    const { result } = renderHook(() => useSyncStatus())

    act(() => {
      result.current.setStatus('item-1', 'syncing')
    })

    // Simulate sync complete
    await new Promise(resolve => setTimeout(resolve, 100))

    act(() => {
      result.current.setStatus('item-1', 'synced')
    })

    expect(result.current.getStatus('item-1')).toBe('synced')
  })
})
```

**File**: `src/hooks/useSyncStatus.ts` (enhance existing)
```typescript
import { create } from 'zustand'
import { SyncStatus } from '../components/sync/SyncIcon'

interface SyncStatusState {
  statuses: Map<string, SyncStatus>
  setStatus: (itemId: string, status: SyncStatus) => void
  getStatus: (itemId: string) => SyncStatus | undefined
  clearStatus: (itemId: string) => void
  clearAll: () => void
}

export const useSyncStatusStore = create<SyncStatusState>((set, get) => ({
  statuses: new Map(),

  setStatus: (itemId, status) => set((state) => {
    const newStatuses = new Map(state.statuses)
    newStatuses.set(itemId, status)
    return { statuses: newStatuses }
  }),

  getStatus: (itemId) => get().statuses.get(itemId),

  clearStatus: (itemId) => set((state) => {
    const newStatuses = new Map(state.statuses)
    newStatuses.delete(itemId)
    return { statuses: newStatuses }
  }),

  clearAll: () => set({ statuses: new Map() })
}))

export function useSyncStatus() {
  return useSyncStatusStore()
}
```

**Validation:**
- [ ] Run hook tests: `npm test -- useSyncStatus.test.ts`
- [ ] Integration test with component

### 2.3: Update List Components (2 hours)

Update each page to show sync icons:

**File**: `src/pages/NewLayout/SongsPage.tsx` (example)
```tsx
import { SyncIcon } from '../../components/sync/SyncIcon'
import { useSyncStatus } from '../../hooks/useSyncStatus'

// In song list rendering:
{songs.map(song => (
  <div key={song.id} className="flex items-center gap-2">
    <SyncIcon status={getSyncStatus(song.id) || 'synced'} />
    <h3>{song.title}</h3>
  </div>
))}
```

**Apply to all pages:**
- [ ] SongsPage.tsx
- [ ] SetlistsPage.tsx
- [ ] ShowsPage.tsx
- [ ] PracticesPage.tsx

**Validation:**
- [ ] Start app: `npm run dev`
- [ ] Use Chrome MCP to navigate each page
- [ ] Verify sync icons appear (all show 'synced' for now)
- [ ] Screenshot each page

### 2.4: Move Connection Indicator to Nav (1 hour)

**File**: `src/components/layout/Sidebar.tsx`
```tsx
<div className="flex items-center gap-3 p-4 border-b border-gray-800">
  {/* Connection Status */}
  <div className="flex items-center gap-2">
    <div className={`h-2.5 w-2.5 rounded-full ${
      isOnline ? 'bg-green-500' : 'bg-red-500'
    }`} />
    <span className="text-xs text-gray-400">
      {isOnline ? 'Connected' : 'Offline'}
    </span>
  </div>

  {/* Last Synced */}
  {lastSyncTime && (
    <div className="text-xs text-gray-500">
      {formatRelativeTime(lastSyncTime)}
    </div>
  )}

  {/* Pending Count */}
  {pendingCount > 0 && (
    <span className="px-2 py-0.5 text-xs bg-yellow-900/30 text-yellow-400 rounded-full">
      {pendingCount} pending
    </span>
  )}
</div>
```

**Validation:**
- [ ] Chrome MCP: Verify connection indicator in nav
- [ ] Test offline mode (DevTools Network → Offline)
- [ ] Verify indicator changes to red

### Deliverables

**Create instruction file**: `.claude/instructions/02-visual-indicators-completion-report.md`

Contents:
- Components created
- Tests written and passing
- UI screenshots (all 5 states)
- Validation results
- Next steps

---

## ⚡ Phase 3: Immediate Sync + Cloud-First Reads (TDD) (8-10 hours)

**Objective**: Implement immediate sync with full test coverage

**Reference**: Cloud-First Sync Architecture - Phase 2

### 3.1: Add Version Control Fields (2 hours)

#### Step 3.1.1: Write Migration Tests First

**File**: `tests/integration/migrations/version-tracking.test.ts`
```typescript
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

describe('Version Tracking Migration', () => {
  it('should have version column on songs', async () => {
    const supabase = createClient(...)
    const { data } = await supabase.from('songs').select('version').limit(1)
    expect(data).toBeDefined()
  })

  it('should auto-increment version on update', async () => {
    const supabase = createClient(...)

    // Create song
    const { data: song } = await supabase.from('songs')
      .insert({ title: 'Test', context_id: 'test-band' })
      .select()
      .single()

    expect(song.version).toBe(1)

    // Update song
    const { data: updated } = await supabase.from('songs')
      .update({ title: 'Test Updated' })
      .eq('id', song.id)
      .select()
      .single()

    expect(updated.version).toBe(2)
  })
})
```

#### Step 3.1.2: Create Migration

**File**: `supabase/migrations/20251029000001_add_version_tracking.sql`
```sql
-- Add version control fields to all synced tables

-- Songs
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Setlists
ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Shows
ALTER TABLE shows
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Practice Sessions
ALTER TABLE practice_sessions
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_modified_by UUID REFERENCES auth.users(id);

-- Create function to auto-increment version
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE(OLD.version, 0) + 1;
  NEW.updated_date = NOW();
  NEW.last_modified_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER songs_version_trigger
  BEFORE UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER setlists_version_trigger
  BEFORE UPDATE ON setlists
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER shows_version_trigger
  BEFORE UPDATE ON shows
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

CREATE TRIGGER practice_sessions_version_trigger
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW
  EXECUTE FUNCTION increment_version();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_songs_version ON songs(version);
CREATE INDEX IF NOT EXISTS idx_setlists_version ON setlists(version);
CREATE INDEX IF NOT EXISTS idx_shows_version ON shows(version);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_version ON practice_sessions(version);
```

**Validation:**
- [ ] Apply migration: `supabase db reset`
- [ ] Run migration tests
- [ ] SQL validation:
  ```bash
  psql $DATABASE_URL -c "\d songs" | grep version
  psql $DATABASE_URL -c "INSERT INTO songs (title, context_id) VALUES ('Test', 'test') RETURNING version;"
  ```

#### Step 3.1.3: Update TypeScript Models

Add to all models:
```typescript
interface Versioned {
  version: number
  lastModifiedBy?: string
  lastModified: Date
}

interface Song extends Versioned {
  // ... existing fields
}
```

**Validation:**
- [ ] TypeScript compiles: `npm run type-check`

### 3.2: Implement Immediate Sync (TDD) (3-4 hours)

#### Step 3.2.1: Write SyncEngine Tests

**File**: `tests/unit/services/data/SyncEngine.immediate.test.ts`
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncEngine } from '../../../../src/services/data/SyncEngine'

describe('SyncEngine - Immediate Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should trigger sync immediately on queue add', async () => {
    const engine = new SyncEngine()
    const syncSpy = vi.spyOn(engine, 'processQueue')

    await engine.queueCreate('songs', mockSong)

    // Should call processQueue immediately
    expect(syncSpy).toHaveBeenCalled()
  })

  it('should sync within 1 second', async () => {
    const engine = new SyncEngine()
    const start = Date.now()

    await engine.queueCreate('songs', mockSong)
    await engine.waitForSync() // Helper to wait for queue empty

    const duration = Date.now() - start
    expect(duration).toBeLessThan(1000)
  })

  it('should update status from syncing to synced', async () => {
    const engine = new SyncEngine()
    const statusChanges: SyncStatus[] = []

    engine.onStatusChange((id, status) => {
      statusChanges.push(status)
    })

    await engine.queueCreate('songs', mockSong)
    await engine.waitForSync()

    expect(statusChanges).toEqual(['syncing', 'synced'])
  })

  it('should retry on error with exponential backoff', async () => {
    const engine = new SyncEngine()

    // Mock remote repo to fail twice, then succeed
    let attempts = 0
    vi.mocked(remoteRepo.addSong).mockImplementation(() => {
      attempts++
      if (attempts < 3) throw new Error('Network error')
      return Promise.resolve(mockSong)
    })

    await engine.queueCreate('songs', mockSong)
    await engine.waitForSync()

    expect(attempts).toBe(3)
  })
})
```

#### Step 3.2.2: Implement Immediate Sync

**File**: `src/services/data/SyncEngine.ts` (update)
```typescript
export class SyncEngine {
  private syncTimer: NodeJS.Timeout | null = null
  private readonly IMMEDIATE_SYNC_DELAY = 100 // 100ms debounce

  async queueCreate(table: string, record: any) {
    // Add to queue
    await this.queue.add({
      operation: 'create',
      table,
      record,
      timestamp: new Date()
    })

    // Update status
    this.emitStatusChange(record.id, 'syncing')

    // Trigger immediate sync (debounced)
    this.scheduleImmediateSync()
  }

  private scheduleImmediateSync() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
    }

    this.syncTimer = setTimeout(() => {
      this.processQueue()
    }, this.IMMEDIATE_SYNC_DELAY)
  }

  async processQueue() {
    const items = await this.queue.getAll()

    for (const item of items) {
      try {
        await this.syncItem(item)
        await this.queue.remove(item.id)
        this.emitStatusChange(item.record.id, 'synced')
      } catch (error) {
        console.error('Sync error:', error)
        this.emitStatusChange(item.record.id, 'error')

        // Retry logic
        await this.scheduleRetry(item)
      }
    }
  }

  private async scheduleRetry(item: QueueItem) {
    const retries = item.retries || 0
    const delay = Math.min(1000 * Math.pow(2, retries), 30000) // Max 30s

    setTimeout(() => {
      this.queue.update(item.id, { retries: retries + 1 })
      this.processQueue()
    }, delay)
  }
}
```

**Validation:**
- [ ] Run SyncEngine tests
- [ ] Integration test with UI

### 3.3: Implement Optimistic Updates (TDD) (2 hours)

**Write tests first** for optimistic update behavior:

**File**: `tests/integration/optimistic-updates.test.ts`
```typescript
describe('Optimistic Updates', () => {
  it('should update UI immediately', async () => {
    const song = { title: 'New Song', artist: 'Test Artist' }

    // Create song
    await repository.addSong(song)

    // Should appear in local store immediately (< 50ms)
    const localSong = await localRepo.getSong(song.id)
    expect(localSong).toBeDefined()
    expect(localSong.title).toBe('New Song')
  })

  it('should sync to cloud in background', async () => {
    const song = { title: 'New Song' }
    await repository.addSong(song)

    // Wait for cloud sync
    await waitFor(async () => {
      const remoteSong = await remoteRepo.getSong(song.id)
      expect(remoteSong).toBeDefined()
    }, { timeout: 2000 })
  })

  it('should rollback on sync error', async () => {
    // Mock network error
    vi.mocked(remoteRepo.addSong).mockRejectedValue(new Error('Network error'))

    const song = { title: 'New Song' }

    try {
      await repository.addSong(song)
    } catch (error) {
      // Should rollback local change
      const localSong = await localRepo.getSong(song.id)
      expect(localSong).toBeNull()
    }
  })
})
```

**Implement** optimistic updates in SyncRepository.

**Validation:**
- [ ] Run optimistic update tests
- [ ] UI test: Create song, verify appears immediately
- [ ] Network test: Disconnect, verify rollback

### 3.4: Cloud-First Read Strategy (2 hours)

**Write tests first**:

**File**: `tests/integration/cloud-first-reads.test.ts`
```typescript
describe('Cloud-First Reads', () => {
  it('should read from cache first', async () => {
    const start = Date.now()
    const songs = await repository.getSongs(bandId)
    const duration = Date.now() - start

    expect(duration).toBeLessThan(100) // Cache read should be fast
    expect(songs.length).toBeGreaterThan(0)
  })

  it('should refresh from cloud in background', async () => {
    // Add song to cloud only
    await remoteRepo.addSong({ title: 'Cloud Song' })

    // First read from cache (won't have new song)
    const cachedSongs = await repository.getSongs(bandId)
    expect(cachedSongs.find(s => s.title === 'Cloud Song')).toBeUndefined()

    // Wait for background refresh
    await waitFor(async () => {
      const refreshedSongs = await repository.getSongs(bandId)
      expect(refreshedSongs.find(s => s.title === 'Cloud Song')).toBeDefined()
    }, { timeout: 5000 })
  })
})
```

**Implement** cache-first with background refresh.

**Validation:**
- [ ] Run read strategy tests
- [ ] Chrome MCP: Open songs page, verify fast load
- [ ] Add song in Supabase directly, verify appears in UI within 5s

### Deliverables

**Create instruction file**: `.claude/instructions/03-immediate-sync-completion-report.md`

Contents:
- Version control migration applied
- Immediate sync implemented and tested
- Optimistic updates working
- Cloud-first reads implemented
- Test coverage report
- Performance metrics
- Next steps

---

## 🔄 Phase 4: Real-Time WebSocket Sync (TDD) (10-12 hours)

**Objective**: Replace polling with real-time subscriptions

**Reference**: Cloud-First Sync Architecture - Phase 3

### 4.1: Create RealtimeManager (TDD) (4-5 hours)

**File**: `tests/unit/services/data/RealtimeManager.test.ts`
```typescript
describe('RealtimeManager', () => {
  it('should subscribe to band channels on init', async () => {
    const manager = new RealtimeManager()
    const subscribeSpy = vi.spyOn(supabase, 'channel')

    await manager.subscribeToUserBands('user-1', ['band-1'])

    expect(subscribeSpy).toHaveBeenCalledWith('songs-band-1')
    expect(subscribeSpy).toHaveBeenCalledWith('setlists-band-1')
  })

  it('should handle INSERT events', async () => {
    const manager = new RealtimeManager()
    await manager.subscribeToUserBands('user-1', ['band-1'])

    // Simulate INSERT from Supabase
    const newSong = { id: 'song-1', title: 'New Song', context_id: 'band-1' }
    await simulateRealtimeEvent('INSERT', 'songs', newSong)

    // Should update local store
    const localSong = await localRepo.getSong('song-1')
    expect(localSong).toBeDefined()
  })

  it('should show toast for remote changes', async () => {
    const toastSpy = vi.fn()
    const manager = new RealtimeManager({ onToast: toastSpy })

    await manager.subscribeToUserBands('user-2', ['band-1'])

    // User 1 creates song
    const song = { created_by: 'user-1', title: 'Test' }
    await simulateRealtimeEvent('INSERT', 'songs', song)

    // User 2 should see toast
    expect(toastSpy).toHaveBeenCalledWith({
      type: 'info',
      message: expect.stringContaining('added')
    })
  })

  it('should reconnect on disconnect', async () => {
    const manager = new RealtimeManager()
    await manager.subscribeToUserBands('user-1', ['band-1'])

    // Simulate disconnect
    await manager.handleDisconnect()

    // Should attempt reconnect
    await waitFor(() => {
      expect(manager.isConnected()).toBe(true)
    }, { timeout: 5000 })
  })
})
```

**File**: `src/services/data/RealtimeManager.ts`
```typescript
import { createClient, RealtimeChannel } from '@supabase/supabase-js'
import { localRepo } from './RepositoryFactory'
import { mapSongFromSupabase } from './RemoteRepository'
import { showToast } from '../../contexts/ToastContext'

export class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map()
  private supabase = createClient(...)

  async subscribeToUserBands(userId: string, bandIds: string[]) {
    for (const bandId of bandIds) {
      await this.subscribeToBand(userId, bandId)
    }
  }

  private async subscribeToBand(userId: string, bandId: string) {
    // Subscribe to songs
    const songsChannel = this.supabase
      .channel(`songs-${bandId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'songs',
        filter: `context_id=eq.${bandId}`
      }, (payload) => {
        this.handleSongChange(payload, userId)
      })
      .subscribe()

    this.channels.set(`songs-${bandId}`, songsChannel)

    // Repeat for other tables...
  }

  private async handleSongChange(payload: any, currentUserId: string) {
    const { eventType, new: newRow, old: oldRow } = payload

    // Skip if current user made the change
    if (newRow?.created_by === currentUserId) return

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const song = mapSongFromSupabase(newRow)
      await localRepo.updateSong(song.id, { ...song, unread: true })

      showToast({
        type: 'info',
        message: `${await getUserName(newRow.created_by)} ${
          eventType === 'INSERT' ? 'added' : 'updated'
        } "${newRow.title}"`,
        duration: 5000
      })
    }

    if (eventType === 'DELETE') {
      await localRepo.deleteSong(oldRow.id)
      showToast({
        type: 'info',
        message: `Song deleted`,
        duration: 5000
      })
    }
  }

  async unsubscribeAll() {
    for (const [key, channel] of this.channels) {
      await channel.unsubscribe()
      this.channels.delete(key)
    }
  }
}
```

**Validation:**
- [ ] Run RealtimeManager tests
- [ ] Integration test with 2 browser tabs
- [ ] Verify < 1 second latency

### 4.2: Implement Unread Tracking (TDD) (2-3 hours)

**File**: `tests/integration/unread-tracking.test.ts`
```typescript
describe('Unread Tracking', () => {
  it('should mark items as unread from remote changes', async () => {
    // Device A creates song
    const song = await deviceA.repository.addSong({ title: 'Test' })

    // Device B should see as unread
    await waitFor(async () => {
      const deviceBSong = await deviceB.localRepo.getSong(song.id)
      expect(deviceBSong.unread).toBe(true)
    })
  })

  it('should mark as read when user views', async () => {
    // Device B marks as read
    await deviceB.markAsRead(song.id)

    const updatedSong = await deviceB.localRepo.getSong(song.id)
    expect(updatedSong.unread).toBe(false)
  })
})
```

Add `readStatus` table to IndexedDB:
```typescript
// src/services/database/index.ts
this.version(5).stores({
  // ... existing tables
  readStatus: '++[itemId+userId], readAt'
})
```

**Validation:**
- [ ] Run unread tracking tests
- [ ] UI test: Verify unread badges appear
- [ ] UI test: Verify badges clear on interaction

### 4.3: Add Change Notifications (2 hours)

**File**: `tests/integration/change-notifications.test.ts`
```typescript
describe('Change Notifications', () => {
  it('should show toast with user info', async () => {
    const toastSpy = vi.fn()
    deviceB.onToast(toastSpy)

    await deviceA.repository.addSong({ title: 'Test Song' })

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith({
        type: 'info',
        message: expect.stringContaining('Test Song')
      })
    })
  })

  it('should batch multiple rapid changes', async () => {
    const toastSpy = vi.fn()
    deviceB.onToast(toastSpy)

    // Create 5 songs rapidly
    for (let i = 0; i < 5; i++) {
      await deviceA.repository.addSong({ title: `Song ${i}` })
    }

    // Should batch into single toast
    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledTimes(1)
      expect(toastSpy).toHaveBeenCalledWith({
        message: expect.stringContaining('5 changes')
      })
    })
  })
})
```

**Implement** toast batching and user info fetching.

**Validation:**
- [ ] Two-device test
- [ ] Chrome MCP: Verify toasts appear
- [ ] Screenshot toasts

### Deliverables

**Create instruction file**: `.claude/instructions/04-realtime-sync-completion-report.md`

Contents:
- RealtimeManager implemented and tested
- Unread tracking working
- Toast notifications functional
- Two-device test results
- Performance metrics (< 1s latency)
- Next steps

---

## 🛠️ Phase 5: Developer Dashboard (6-8 hours)

**Objective**: Build comprehensive debugging tools

**Reference**: Cloud-First Sync Architecture - Phase 4

### 5.1: Create Dashboard Route (2 hours)

**File**: `src/pages/DevDashboard.tsx`
```tsx
import { Tabs } from '../components/ui/Tabs'

export function DevDashboard() {
  // Only render in dev mode
  if (import.meta.env.PROD) {
    return <Navigate to="/" />
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Developer Dashboard</h1>

      <Tabs>
        <Tab label="Database Status">
          <DatabaseStatus />
        </Tab>

        <Tab label="Sync Queue">
          <SyncQueueViewer />
        </Tab>

        <Tab label="Raw Data">
          <DataViewer />
        </Tab>

        <Tab label="Sync Log">
          <SyncLogViewer />
        </Tab>

        <Tab label="Network">
          <NetworkInspector />
        </Tab>

        <Tab label="Tools">
          <DevTools />
        </Tab>
      </Tabs>
    </div>
  )
}
```

**Validation:**
- [ ] Visit `/dev/dashboard` in dev mode
- [ ] Verify not accessible in production build
- [ ] Screenshot all tabs

### 5.2: Implement Database Inspector (2 hours)

**File**: `src/components/dev/DatabaseStatus.tsx`
```tsx
export function DatabaseStatus() {
  const [counts, setCounts] = useState<TableCounts>()
  const [remoteCounts, setRemoteCounts] = useState<TableCounts>()

  useEffect(() => {
    loadCounts()
  }, [])

  async function loadCounts() {
    // IndexedDB counts
    const local = {
      songs: await db.songs.count(),
      setlists: await db.setlists.count(),
      shows: await db.shows.count(),
      practices: await db.practiceSessions.count()
    }
    setCounts(local)

    // Supabase counts
    const { count: songsCount } = await supabase.from('songs').select('*', { count: 'exact', head: true })
    // ... repeat for other tables
    setRemoteCounts({ songs: songsCount, ... })
  }

  return (
    <div className="space-y-6">
      <Section title="Connection">
        <KeyValue label="Mode" value={config.mode} />
        <KeyValue label="Supabase" value={config.supabaseUrl} />
        <KeyValue label="Status" value={isConnected ? "✅ Connected" : "❌ Disconnected"} />
      </Section>

      <Section title="IndexedDB (Local)">
        <KeyValue label="Songs" value={counts?.songs || 0} />
        <KeyValue label="Setlists" value={counts?.setlists || 0} />
        {/* ... */}
      </Section>

      <Section title="Supabase (Cloud)">
        <KeyValue label="Songs" value={remoteCounts?.songs || 0} />
        {/* ... */}
      </Section>
    </div>
  )
}
```

**Validation:**
- [ ] Verify counts match between IndexedDB and Supabase
- [ ] Test with different data states

### 5.3: Build Developer Tools (2 hours)

**File**: `src/components/dev/DevTools.tsx`
```tsx
export function DevTools() {
  async function purgeIndexedDB() {
    if (!confirm('⚠️ Delete all local data?')) return

    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map(t => t.clear()))
    })

    alert('✅ IndexedDB purged')
  }

  async function loadMockData() {
    await seedMvpData()
    alert('✅ Mock data loaded')
  }

  async function forceFullSync() {
    await syncEngine.performInitialSync()
    alert('✅ Full sync complete')
  }

  return (
    <div className="space-y-4">
      <Button onClick={purgeIndexedDB} variant="danger">
        🗑️ Purge IndexedDB
      </Button>

      <Button onClick={loadMockData} variant="primary">
        🎭 Load Mock Data
      </Button>

      <Button onClick={forceFullSync} variant="secondary">
        🔄 Force Full Sync
      </Button>

      <Button onClick={exportData} variant="secondary">
        💾 Export All Data
      </Button>
    </div>
  )
}
```

**Validation:**
- [ ] Test each button
- [ ] Verify warnings/confirmations work
- [ ] Export data and verify JSON format

### Deliverables

**Create instruction file**: `.claude/instructions/05-dev-dashboard-completion-report.md`

---

## 🧪 Phase 6: Integration Tests (8-10 hours)

**Objective**: Comprehensive integration test coverage

**Reference**: Comprehensive Testing Strategy - Phase 3

### 6.1: Song Management Workflow (2 hours)

**File**: `tests/integration/workflows/song-management.test.ts`
```typescript
describe('Song Management Workflow', () => {
  beforeEach(async () => {
    await resetTestDatabase()
  })

  it('should complete full CRUD lifecycle', async () => {
    // CREATE
    const song = await SongService.createSong({
      title: 'Wonderwall',
      artist: 'Oasis',
      bandId: 'test-band'
    })
    expect(song.id).toBeDefined()
    expect(song.version).toBe(1)

    // READ
    const fetched = await repository.getSong(song.id)
    expect(fetched.title).toBe('Wonderwall')

    // UPDATE
    const updated = await SongService.updateSong(song.id, { bpm: 120 })
    expect(updated.bpm).toBe(120)
    expect(updated.version).toBe(2)

    // DELETE
    await SongService.deleteSong(song.id)
    const deleted = await repository.getSong(song.id)
    expect(deleted).toBeNull()
  })

  it('should sync to cloud', async () => {
    const song = await SongService.createSong({ title: 'Test' })

    // Wait for sync
    await waitFor(async () => {
      const remoteSong = await remoteRepo.getSong(song.id)
      expect(remoteSong).toBeDefined()
    }, { timeout: 2000 })
  })
})
```

Write similar tests for:
- Setlist creation & forking
- Show scheduling
- Practice tracking

**Validation:**
- [ ] Run all integration tests: `npm test -- tests/integration/`
- [ ] All workflows pass

### 6.2: Offline/Online Scenarios (2 hours)

**File**: `tests/integration/edge-cases/offline-mode.test.ts`
```typescript
describe('Offline Mode', () => {
  it('should queue changes when offline', async () => {
    goOffline()

    const song = await repository.addSong({ title: 'Offline Song' })

    expect(getSyncStatus(song.id)).toBe('pending')
    expect(getQueueSize()).toBe(1)
  })

  it('should sync when back online', async () => {
    goOffline()
    await repository.addSong({ title: 'Offline Song' })

    goOnline()

    await waitFor(() => {
      expect(getQueueSize()).toBe(0)
      expect(getSyncStatus(song.id)).toBe('synced')
    }, { timeout: 5000 })
  })
})
```

**Validation:**
- [ ] Run offline tests
- [ ] Manual test with DevTools Network tab

### Deliverables

**Create instruction file**: `.claude/instructions/06-integration-tests-completion-report.md`

---

## 🎭 Phase 7: End-to-End Tests (Cypress) (10-12 hours)

**Objective**: Automated UI testing

**Reference**: Comprehensive Testing Strategy - Phase 4

### 7.1: Setup Cypress (2 hours)

```bash
npm install --save-dev cypress @testing-library/cypress start-server-and-test
npx cypress open
```

**File**: `cypress.config.ts`
```typescript
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    video: true,
    screenshotOnRunFailure: true
  }
})
```

**Validation:**
- [ ] Cypress opens successfully
- [ ] Example spec runs

### 7.2: Critical User Journeys (6-8 hours)

Write E2E tests for:
- Login & navigation
- Song CRUD
- Setlist builder
- Show scheduling
- Two-device sync (if possible)

**File**: `cypress/e2e/songs/song-crud.cy.ts`
```typescript
describe('Song Management', () => {
  beforeEach(() => {
    cy.login('eric@ipodshuffle.com')
    cy.visit('/songs')
  })

  it('should create a new song', () => {
    cy.contains('Add Song').click()

    cy.get('input[name="title"]').type('Test Song')
    cy.get('input[name="artist"]').type('Test Artist')

    cy.contains('Save').click()

    cy.contains('Test Song')
  })
})
```

**Validation:**
- [ ] All E2E tests pass
- [ ] Video recordings captured
- [ ] Screenshots on failures

### Deliverables

**Create instruction file**: `.claude/instructions/07-e2e-tests-completion-report.md`

---

## 📋 Success Criteria & Validation Checklist

### Phase 0: Baseline ✅ **COMPLETE**
- ✅ Test suite status documented (489 passing, 24 failing)
- ✅ App runs without errors (auth working, needs seeding)
- ✅ Database schema validated (98% compliant)
- ✅ SQL files audited (23 files, 10 to delete)

### Phase 1: Foundation
- [ ] 10 SQL files deleted
- [ ] fresh_init.sql updated or deleted
- [ ] Test utilities created
- [ ] Fresh database setup works
- [ ] Tests still pass

### Phase 2: Visual Indicators
- [ ] SyncIcon component with 5 states
- [ ] Sync status tracking working
- [ ] All pages show sync icons
- [ ] Connection indicator in nav
- [ ] UI screenshots captured

### Phase 3: Immediate Sync
- [ ] Version control migration applied
- [ ] Immediate sync (< 1 second)
- [ ] Optimistic updates work
- [ ] Rollback on error works
- [ ] Cloud-first reads implemented
- [ ] All tests passing

### Phase 4: Real-Time Sync
- [ ] RealtimeManager working
- [ ] Two-device sync (< 1 second)
- [ ] Toast notifications appear
- [ ] Unread tracking works
- [ ] WebSocket reconnection works
- [ ] All tests passing

### Phase 5: Dev Dashboard
- [ ] Dashboard accessible in dev mode
- [ ] Database stats accurate
- [ ] Sync queue viewer works
- [ ] All dev tools functional
- [ ] Not in production build

### Phase 6: Integration Tests
- [ ] 20+ integration tests written
- [ ] All workflows covered
- [ ] Offline scenarios tested
- [ ] 90%+ code coverage

### Phase 7: E2E Tests
- [ ] Cypress configured
- [ ] 15+ E2E tests written
- [ ] All user journeys covered
- [ ] CI/CD integration ready

---

## 🚦 Risk Mitigation

### High-Risk Areas

1. **Real-Time Sync Complexity**
   - **Risk**: WebSocket connection issues
   - **Mitigation**: Fallback to polling, comprehensive reconnection logic
   - **Validation**: Two-device testing in various network conditions

2. **Data Loss in Optimistic Updates**
   - **Risk**: Failed sync doesn't rollback
   - **Mitigation**: Robust error handling, retry logic, rollback tests
   - **Validation**: Forced error scenarios, offline testing

3. **Schema Drift**
   - **Risk**: IndexedDB and Supabase schemas diverge
   - **Mitigation**: Automated schema validation tests
   - **Validation**: Run schema validation before every test run

4. **Migration Issues**
   - **Risk**: Version control migration breaks existing data
   - **Mitigation**: Test on backup, rollback plan ready
   - **Validation**: Test migration on copy of production data

### Rollback Plans

**If Phase 3 fails:**
- Revert to polling-based sync
- Keep visual indicators
- No data loss (only sync mechanism changes)

**If Phase 4 fails:**
- Fall back to immediate sync (Phase 3)
- Disable WebSocket subscriptions
- Use polling as fallback

**If migration fails:**
- Have rollback migration ready
- Backup data before applying
- Test on staging first

---

## 📚 Documentation Updates Needed

After completion:

1. **QUICK-START.md**
   - Updated database setup instructions
   - Single-path setup process

2. **CLAUDE.md**
   - Update sync architecture section
   - Add developer dashboard docs
   - Update testing policy

3. **README.md**
   - Add real-time collaboration features
   - Update tech stack (WebSockets)
   - Add screenshots

4. **.claude/specifications/**
   - Create sync-architecture.md
   - Update unified-database-schema.md if needed

---

## 🎯 Next Steps

### Immediate Actions

1. **Review this roadmap** with team
2. **Create GitHub project** with phases as milestones
3. **Set up branch strategy** (feature branches per phase)
4. **Begin Phase 0** validation with sub-agents

### Sub-Agent Assignments (Initial)

**Agent 1: Validation Agent (Phase 0)**
- Task: Run all validation checks
- Duration: 1-2 hours
- Deliverable: Baseline validation report

**Agent 2: SQL Cleanup Agent (Phase 1.1)**
- Task: Delete redundant SQL files, fix fresh_init.sql
- Duration: 2-3 hours
- Deliverable: Clean SQL structure

**Agent 3: Test Infrastructure Agent (Phase 1.2)**
- Task: Create test helpers and utilities
- Duration: 2-3 hours
- Deliverable: Working test infrastructure

---

**Status**: Ready for Implementation
**Created**: 2025-10-29T16:15
**Total Effort**: 52-67 hours (6-8 working days)
**Risk Level**: Medium (well-planned, incremental approach)
**Business Value**: Very High (collaboration, reliability, developer productivity)

---

## Appendix: Tool Usage Requirements

### Always Use Tools to Validate

**Never assume code works - always verify:**

1. **After code changes:**
   ```bash
   npm test
   npm run type-check
   npm run dev  # Then use Chrome MCP
   ```

2. **Database validation:**
   ```bash
   psql $DATABASE_URL -c "SELECT ..."
   supabase db reset  # For fresh state
   ```

3. **Chrome MCP for UI:**
   - Navigate all pages
   - Test CRUD operations
   - Take screenshots
   - Verify sync indicators

4. **Multi-device testing:**
   - Two browser tabs
   - Different browsers
   - Incognito mode
   - Verify sync latency

### Continuous Validation Loop

```
1. Write test (TDD) → 2. Run test (fails) → 3. Write code →
4. Run test (passes) → 5. Manual validation (Chrome MCP) →
6. SQL validation → 7. Full test suite → 8. Commit
```

**Never skip validation steps!**
