---
created: 2025-12-05T15:50
severity: critical
status: diagnosed
affected_features:
  - setlist-sync
  - show-sync
  - show-date-display
error_codes:
  - PGRST204
---

# Bug Report: Sync Schema Mismatches and Date Display Issues

## Summary

Three related issues preventing proper sync and display functionality:

1. **Setlist sync fails:** Missing `source_setlist_id` column in Supabase
2. **Show sync fails:** Missing `location` column in Supabase
3. **Date off-by-one:** Show dates display one day earlier than selected

## Console Output (User Provided)

```
POST https://khzeuxxhigqcmrytsfux.supabase.co/rest/v1/setlists?select=* 400 (Bad Request)
[SyncEngine] Failed to sync setlists: {code: 'PGRST204', details: null, hint: null, message: "Could not find the 'source_setlist_id' column of 'setlists' in the schema cache"}

POST https://khzeuxxhigqcmrytsfux.supabase.co/rest/v1/shows?select=* 400 (Bad Request)
[SyncEngine] Failed to sync shows: {code: 'PGRST204', details: null, hint: null, message: "Could not find the 'location' column of 'shows' in the schema cache"}
```

---

## Issue 1: Setlist Sync - Missing `source_setlist_id`

### Root Cause

The TypeScript `Setlist` interface includes `sourceSetlistId` (used when duplicating setlists), but this column was never added to the Supabase `setlists` table.

**TypeScript (src/types/domain.ts or src/models/Setlist.ts):**
```typescript
export interface Setlist {
  // ... other fields
  sourceSetlistId?: string;  // EXISTS in TypeScript
}
```

**Supabase Schema (missing):**
```sql
-- setlists table does NOT have source_setlist_id column
```

### Files Using sourceSetlistId

- `src/hooks/useSetlist.ts:130` - Sets when duplicating
- `src/services/setlistService.ts:24,56,75` - Template relationships

---

## Issue 2: Show Sync - Missing `location` Column

### Root Cause

The TypeScript `Show` interface includes `location` (full address), but this column was never added to the Supabase `shows` table.

**TypeScript (src/models/Show.ts):**
```typescript
export interface Show {
  // ... other fields
  location?: string; // Full address - EXISTS in TypeScript
}
```

**Supabase Schema (shows table):**
```sql
CREATE TABLE public.shows (
  -- ... other columns
  venue TEXT,              -- EXISTS
  -- location TEXT,        -- MISSING!
);
```

**RemoteRepository mapping (src/services/data/RemoteRepository.ts:628):**
```typescript
location: show.location ?? null,  // Tries to sync to non-existent column
```

---

## Issue 3: Date Off-by-One Display

### Root Cause

When selecting a date like "2025-12-08" in the date picker:
1. JavaScript's `new Date("2025-12-08")` parses as **UTC midnight**
2. For US timezone users (west of UTC), this displays as December **7th**

**Problem code (ShowsPage.tsx:943):**
```typescript
const baseDate = new Date(formData.date)  // Parses "2025-12-08" as UTC!
```

---

## Fix Actions

### Schema Fix: Add Missing Columns

**File:** `supabase/migrations/20251106000000_baseline_schema.sql`

**Add to setlists table (around line 272):**
```sql
source_setlist_id UUID REFERENCES setlists(id) ON DELETE SET NULL
```

**Add to shows table (around line 256):**
```sql
location TEXT,
```

**Add indexes:**
```sql
CREATE INDEX idx_setlists_source_setlist_id ON setlists(source_setlist_id);
```

### Date Fix: Parse as Local Time

**File:** `src/utils/dateHelpers.ts`

Add helper:
```typescript
export function parseDateAsLocal(dateString: string): Date {
  if (!dateString) return new Date()
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}
```

**File:** `src/pages/ShowsPage.tsx`

Update line 943:
```typescript
// Before: const baseDate = new Date(formData.date)
// After:
const baseDate = parseDateAsLocal(formData.date)
```

---

## Test Gaps

1. No schema validation tests for `source_setlist_id` column
2. No schema validation tests for `location` column in shows
3. No unit tests for local date parsing
4. No E2E tests verifying date display matches input

---

## Verification Steps

```bash
# 1. Apply schema fix
supabase db reset

# 2. Verify columns exist
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'setlists' AND column_name = 'source_setlist_id';"

psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT column_name FROM information_schema.columns WHERE table_name = 'shows' AND column_name = 'location';"

# 3. Test in browser
npm run dev
# Create a show, verify no sync errors
# Verify date displays correctly
```
