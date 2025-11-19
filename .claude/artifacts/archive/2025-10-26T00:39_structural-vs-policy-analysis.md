---
timestamp: 2025-10-26T00:39
prompt: Analyze whether RLS recursion is a table structure issue vs policy issue
status: Critical Analysis
---

# RLS Recursion: Structural vs Policy Issue Analysis

## Your Question

> "If we have a recursion issue, is it more to do with how the tables are structured rather than the policies?"

## Answer: It's the Policies, NOT the Structure

**The table structure is fine.** The recursion is 100% caused by poorly written RLS policies, not the table relationships.

## Why Table Structure is NOT the Problem

### The Relationships Are Normal

```
users ←──┐
         │
band_memberships (junction table)
         │
         └──→ bands

songs ───→ bands (via context_id when context_type = 'band')
```

This is a **standard many-to-many relationship** with a junction table. There's nothing inherently recursive about it.

### What WOULD Cause Structural Recursion

If you had:
```sql
-- BAD: Self-referencing foreign key
CREATE TABLE categories (
  id UUID,
  parent_category_id UUID REFERENCES categories(id)  -- Self-reference
);
```

Then RLS policies checking the parent would create recursion. **But you don't have this.**

### Your Structure is Standard

```sql
-- band_memberships: Links users to bands
user_id → users(id)
band_id → bands(id)

-- songs: References bands indirectly via context pattern
context_id (TEXT) contains band.id when context_type = 'band'
```

**This is perfectly normal and safe.**

## Why It's the POLICIES

### How Recursion Actually Happens

**Scenario: Inserting a Song**

1. User tries: `INSERT INTO songs VALUES (..., context_type='band', context_id='band-uuid-123', ...)`

2. Postgres evaluates songs INSERT policy:
   ```sql
   WITH CHECK (
     created_by = auth.uid()  -- ✓ Direct check
     AND context_id IN (
       SELECT band_id::text FROM band_memberships  -- ← Queries band_memberships
       WHERE user_id = auth.uid()
     )
   )
   ```

3. To execute that SELECT, Postgres must check RLS on `band_memberships`

4. **IF** band_memberships policy says:
   ```sql
   -- ❌ RECURSIVE POLICY (OLD)
   USING (
     EXISTS (
       SELECT 1 FROM band_memberships bm  -- ← Queries ITSELF!
       WHERE bm.user_id = auth.uid()
     )
   )
   ```
   **→ INFINITE RECURSION**

5. **IF** band_memberships policy says:
   ```sql
   -- ✅ NON-RECURSIVE POLICY (NEW)
   USING (user_id = auth.uid())  -- ← Direct check only
   ```
   **→ NO RECURSION**

### The Call Stack

```
INSERT INTO songs
 └─ Check songs INSERT policy
     └─ SELECT FROM band_memberships (to validate context_id)
         └─ Check band_memberships SELECT policy
             └─ IF policy queries band_memberships again → RECURSION!
             └─ IF policy only checks auth.uid() → SUCCESS!
```

## Why You're STILL Seeing Errors

Based on the policy list you provided, you have **DUPLICATE POLICIES**:

```json
// OLD policies (from original migration):
"Band members can view their bands" (SELECT on bands)
"Band members can manage sessions" (ALL on practice_sessions)

// NEW policies (from fix scripts):
"Users can view their bands" (SELECT on bands)
"Users can view band practices" (SELECT on practice_sessions)
```

**This means Phase 1 DID NOT drop all policies.** Some old recursive policies are still active.

## Root Cause

### The Scripts Failed Because...

1. **Phase 1 DROP script** uses `pg_policies` system catalog to find policies
2. It queries: `SELECT policyname, tablename FROM pg_policies WHERE schemaname='public'...`
3. It then executes: `DROP POLICY IF EXISTS "policyname" ON public.tablename`

4. **BUT** if there's ANY mismatch in:
   - Schema name (public vs not specified)
   - Policy name (quotes, spaces, capitalization)
   - Table name qualification

   Then the DROP silently fails (because of `IF EXISTS`)

### What's Happening Now

Even after running Phase 1 + Phase 2 + manual deletions:

1. Some OLD policies still exist (ones with names we didn't guess)
2. Some NEW policies exist (from Phase 2)
3. When both evaluate, if ANY policy has recursion → ERROR

## Verification Needed

Run this in Supabase SQL Editor to see EXACTLY what policies exist:

```sql
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN qual LIKE '%band_memberships%' AND tablename = 'band_memberships'
    THEN '⚠️ POSSIBLE RECURSION'
    ELSE 'OK'
  END as recursion_risk
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'band_memberships',
    'songs',
    'bands',
    'setlists',
    'practice_sessions',
    'users',
    'user_profiles'
  )
ORDER BY tablename, cmd, policyname;
```

This will show:
- All current policies
- Which ones might have recursion
- Exact policy names

## The Real Solution

We need to **FORCE DROP** using a different approach:

```sql
-- Disable RLS temporarily
ALTER TABLE public.band_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bands DISABLE ROW LEVEL SECURITY;
-- (etc for all tables)

-- Now re-enable and add ONLY correct policies
ALTER TABLE public.band_memberships ENABLE ROW LEVEL SECURITY;
-- (then create policies from Phase 2)
```

This bypasses the DROP entirely - just turns RLS off and back on.

## Recommendations

### Option 1: Brutal Force Reset (RECOMMENDED)

1. **Disable RLS on all tables** (turns off ALL policies at once)
2. **Re-enable RLS**
3. **Run Phase 2** to create clean policies
4. **Verify with diagnostic query**

### Option 2: Targeted Drop

1. **Get full policy list** (run diagnostic query above)
2. **I'll generate DROP statements** for every policy that exists
3. **You run them**
4. **Run Phase 2**

### Option 3: Nuclear Option

1. **Drop and recreate all tables** (if no production data)
2. **Run migration files in order**
3. **Use CORRECTED migration** (20251026000000_rls_policies_corrected.sql)

## Key Insight

The error message says:
```
"infinite recursion detected in policy for relation band_memberships"
```

This is **SPECIFIC**. It's not about table structure. Postgres is literally detecting that evaluating a policy on `band_memberships` causes another evaluation of a policy on `band_memberships`, which causes another...

**This can ONLY happen if:**
- A policy on `band_memberships` queries `band_memberships` itself
- OR two policies create a mutual loop (A queries B, B queries A)

**It CANNOT happen from:**
- Foreign key relationships
- Normal joins between tables
- A policy on `songs` querying `band_memberships` (one-way, no loop)

## Conclusion

**Table structure: ✅ Fine**
**Policies: ❌ Some old recursive ones still exist**

**Next step:** Run the diagnostic query above and share the results. I'll create the exact DROP commands needed.

---

## Diagnostic Query to Run Now

```sql
-- Copy this ENTIRE query
-- Paste into Supabase SQL Editor
-- Click RUN
-- Share the results

SELECT
  tablename,
  policyname,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'band_memberships',
    'songs',
    'bands',
    'setlists',
    'practice_sessions',
    'users',
    'user_profiles'
  )
ORDER BY tablename, cmd, policyname;
```

**This will show the ACTUAL policies** in your database right now.
