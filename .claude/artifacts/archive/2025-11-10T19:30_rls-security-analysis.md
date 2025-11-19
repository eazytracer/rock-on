---
title: RLS Security Analysis - Band Creation Trigger
created: 2025-11-10T19:30
status: Analysis
---

# RLS Security Analysis: Band Creation Trigger

## The Problem

When a user creates a band:
1. INSERT into `bands` succeeds (RLS policy `bands_insert_any_authenticated` allows it)
2. AFTER INSERT trigger `auto_add_band_creator()` fires
3. Trigger tries to INSERT into `band_memberships`
4. **RLS policies block it** → Transaction rolls back → Band creation fails

## Why RLS Policies Block the Trigger

Even though the RLS policy `memberships_insert_self` should allow it:
```sql
CREATE POLICY "memberships_insert_self"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
```

And the trigger does exactly this:
```sql
INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date)
VALUES (auth.uid(), NEW.id, 'admin', 'active', now())
```

**The issue:** When a function has `SECURITY DEFINER` but is NOT owned by a BYPASSRLS user (like postgres), RLS policies still apply to queries within the function. Supabase's RLS engine checks if the **authenticated user** has permission, not the **function owner**.

## Solution Options

### Option 1: Postgres Ownership (Current Fix) ✅

**Implementation:**
```sql
ALTER FUNCTION auto_add_band_creator() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION auto_add_band_creator() TO authenticated;
```

**How it works:**
- `SECURITY DEFINER` + postgres ownership = function runs as postgres (superuser)
- Postgres has BYPASSRLS privilege, so RLS policies don't apply
- The function can still read `auth.uid()` from the session context

**Security Analysis:**
- ✅ Function only inserts `auth.uid()` - can't be exploited to add other users
- ✅ Function is triggered automatically, not directly callable by users
- ✅ Function follows least privilege (only adds creator as admin)
- ✅ This is the standard Supabase pattern for system operations
- ⚠️ Function owner is postgres (superuser), so bugs could be security issues
- ✅ Function is simple (12 lines), easy to audit

**Pros:**
- Works reliably
- Atomic (single transaction)
- No application code changes needed
- Standard Supabase pattern

**Cons:**
- Requires postgres ownership (superuser privilege)
- Function bugs could bypass security

**Risk Level:** LOW (function is simple and well-contained)

---

### Option 2: Application-Level Membership Creation

**Implementation:**
Remove trigger, handle in application code:
```typescript
async function createBand(bandData: CreateBandRequest) {
  const band = await supabase
    .from('bands')
    .insert({ name: bandData.name, description: bandData.description })
    .select()
    .single()

  if (band.error) throw band.error

  // Explicitly create membership
  const membership = await supabase
    .from('band_memberships')
    .insert({
      user_id: user.id,
      band_id: band.data.id,
      role: 'admin',
      status: 'active'
    })

  if (membership.error) {
    // Clean up band if membership fails
    await supabase.from('bands').delete().eq('id', band.data.id)
    throw membership.error
  }

  return band.data
}
```

**Security Analysis:**
- ✅ No superuser privileges needed
- ✅ All operations use standard RLS policies
- ⚠️ Two round trips to database (latency)
- ⚠️ Not atomic - race conditions possible
- ⚠️ Cleanup logic needed for partial failures
- ⚠️ More code = more opportunities for bugs

**Pros:**
- No postgres ownership needed
- Explicit and clear logic
- Each operation protected by RLS

**Cons:**
- Not atomic (band can exist without membership)
- Two database round trips (slower)
- Cleanup logic complex (what if cleanup fails?)
- More application code to maintain
- Race conditions possible

**Risk Level:** MEDIUM (complexity + non-atomic operations)

---

### Option 3: Permissive RLS Policy

**Implementation:**
Add a policy that allows membership creation immediately after band creation:
```sql
CREATE POLICY "memberships_insert_for_new_band"
  ON public.band_memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM public.bands
      WHERE id = band_memberships.band_id
        AND created_by = (select auth.uid())
        AND created_date > now() - interval '1 second'
    )
  );
```

**Security Analysis:**
- ⚠️ Time-based check is a race condition risk
- ⚠️ 1-second window could be exploited
- ⚠️ Clock skew issues possible
- ✅ No postgres ownership needed
- ⚠️ Complex logic in RLS policy

**Pros:**
- No postgres ownership
- Trigger works as-is
- Atomic operation

**Cons:**
- Time-based security is unreliable
- Race conditions
- Clock skew issues
- Complex policy logic

**Risk Level:** HIGH (time-based security checks are dangerous)

---

## Recommendation: Option 1 (Postgres Ownership)

**Why:**
1. **Standard Pattern:** This is how Supabase handles system operations (see their docs)
2. **Reliable:** No race conditions or timing issues
3. **Atomic:** Single transaction, no partial failures
4. **Simple:** Function is easy to audit (12 lines)
5. **Safe:** Function only uses `auth.uid()`, can't be exploited

**Audit of `auto_add_band_creator()` function:**
```sql
CREATE OR REPLACE FUNCTION auto_add_band_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the authenticated user ID
  v_user_id := auth.uid();  -- ✓ Uses session context, can't be spoofed

  -- Only proceed if there's an authenticated user
  IF v_user_id IS NOT NULL THEN  -- ✓ Guards against NULL
    -- Add the creator as band admin
    INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date)
    VALUES (v_user_id, NEW.id, 'admin', 'active', now())  -- ✓ Only inserts current user
    ON CONFLICT (user_id, band_id) DO NOTHING;  -- ✓ Prevents duplicates
  END IF;

  RETURN NEW;
END;
$$;
```

**Security checklist:**
- ✅ Only uses `auth.uid()` (from JWT, can't be spoofed)
- ✅ No user input used directly
- ✅ Can't add other users as admin
- ✅ Has NULL guard
- ✅ Has conflict handling
- ✅ Simple, auditable code

**Alternative if still concerned:**
We could add application-level verification that the membership was created:
```typescript
const band = await createBand(data)
const membership = await supabase
  .from('band_memberships')
  .select()
  .eq('band_id', band.id)
  .eq('user_id', user.id)
  .single()

if (!membership.data) {
  // Trigger failed - log and alert
  console.error('Membership not created by trigger!')
}
```

## Conclusion

Postgres ownership with `SECURITY DEFINER` is the right choice for this trigger because:
1. It's the standard Supabase pattern for system operations
2. The function is simple and can't be exploited
3. It's atomic and reliable
4. The alternatives have worse tradeoffs (complexity, race conditions, or time-based security)

The security concern is valid but well-mitigated by the function's simplicity and guards.
