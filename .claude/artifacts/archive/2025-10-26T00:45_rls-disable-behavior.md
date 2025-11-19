---
timestamp: 2025-10-26T00:45
topic: How DISABLE ROW LEVEL SECURITY actually works
---

# CRITICAL: DISABLE ROW LEVEL SECURITY Does NOT Drop Policies!

## The Misunderstanding

I assumed that:
```sql
ALTER TABLE foo DISABLE ROW LEVEL SECURITY;
```
Would **remove all policies** from the table.

## The Reality

**IT DOES NOT DROP POLICIES!** It only:
1. Disables RLS **enforcement**
2. Policies still exist in pg_policies
3. When you re-ENABLE RLS, all the old policies are back!

## What It Actually Does

```sql
-- This disables RLS enforcement
ALTER TABLE foo DISABLE ROW LEVEL SECURITY;

-- Policies still exist! (can verify with SELECT FROM pg_policies)
-- RLS is just not checked

-- When you re-enable:
ALTER TABLE foo ENABLE ROW LEVEL SECURITY;

-- All the OLD policies are still there and active again!
```

## Why Our Scripts Failed

### Script 1: phase1-drop-all-policies.sql
- Used `DROP POLICY IF EXISTS` with guessed policy names
- If name didn't match exactly → Silent failure
- Policies still exist

### Script 2: brutal-force-rls-reset.sql
- Used `DISABLE ROW LEVEL SECURITY`
- **Assumed this would drop policies → WRONG!**
- Policies still exist after DISABLE
- When we re-ENABLE, old policies are back

## The ONLY Way to Remove Policies

You MUST use `DROP POLICY` with the **exact policy name**:

```sql
-- Get the exact name from pg_policies:
SELECT policyname FROM pg_policies WHERE tablename = 'foo';

-- Then drop using that EXACT name:
DROP POLICY "exact_name_from_query" ON public.foo;
```

## Why It's Hard

Policy names might have:
- Different capitalization
- Special characters
- Quotes
- Spaces
- Schema qualification differences

If ANY character is different → DROP POLICY does nothing (with IF EXISTS)

## The Solution

Run the diagnostic query (`diagnose-rls-complete.sql`) which:

1. **Shows EXACT policy names** from pg_policies
2. **Generates exact DROP statements** using format() and %I (proper quoting)
3. **You copy those exact DROP statements** and run them
4. **Then** run the CREATE statements from Phase 2

## Next Steps

1. Run `supabase/diagnose-rls-complete.sql`
2. Look at the "DROP STATEMENTS" section
3. Copy ALL of those DROP statements
4. Run them in a new query
5. Verify 0 policies remain
6. Run Phase 2 to create clean policies
