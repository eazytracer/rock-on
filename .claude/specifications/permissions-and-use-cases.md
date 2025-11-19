---
title: Permissions & Use Cases Specification
created: 2025-10-26T15:45
status: Authoritative
type: Security & Access Control
---

# Permissions & Use Cases Specification

## Overview

This document defines all permission models and use cases for the RockOn application to ensure proper Row-Level Security (RLS) policies.

---

## Core Principles

1. **User-centric**: All data belongs to a user or is shared through band membership
2. **Band-based collaboration**: Band members share access to band-related data
3. **Privacy by default**: Personal data is private unless explicitly shared
4. **Role-based actions**: Admins have elevated permissions within bands
5. **No recursive policies**: Policies must not query their own table to avoid infinite recursion

---

## User Roles

### Global Roles
- **Authenticated User**: Any logged-in user with `auth.uid()`
- **Anonymous**: Not logged in (most tables block anonymous access)

### Band-Specific Roles
Stored in `band_memberships.role`:
- **owner** (legacy, treat as admin)
- **admin**: Can manage band, members, and all band data
- **member**: Can view and contribute to band data
- **viewer**: Read-only access to band data (not yet implemented)

---

## Data Ownership Models

### 1. User-Owned Data
**Tables**: `users`, `user_profiles`

**Rules**:
- Users can view and edit their own data
- Users cannot view other users' private data
- Public user info (name, email) can be viewed by band members

### 2. Band-Owned Data
**Tables**: `bands`, `setlists`, `practice_sessions`

**Rules**:
- Created by a user, associated with a band
- Accessible by all band members (active status)
- Admins can modify, members can view and contribute
- No access without band membership

### 3. Personal + Band Data
**Tables**: `songs`

**Rules**:
- `contextType='personal'`: Only creator can access
- `contextType='band'`: All band members can access
- Creator always has full access to their songs

### 4. Relationship Data
**Tables**: `band_memberships`

**Rules**:
- Users can view memberships for bands they belong to
- Admins can create/modify memberships in their bands
- Special handling to avoid recursion

---

## Use Cases by Entity

### Users & Profiles

**Use Cases**:
1. User views their own profile
2. User updates their own profile
3. Band member views basic info of another band member

**Permissions**:
- ✅ SELECT own profile
- ✅ UPDATE own profile
- ✅ SELECT basic info of users in same bands (via join)
- ❌ UPDATE other users
- ❌ DELETE users (handle via auth)

### Bands

**Use Cases**:
1. User creates a new band (becomes admin automatically)
2. Admin updates band details
3. Member views band info
4. Admin deletes band

**Permissions**:
- ✅ INSERT any authenticated user (becomes admin)
- ✅ SELECT band members only
- ✅ UPDATE admins only
- ✅ DELETE admins only (with cascade to memberships)

### Band Memberships

**Use Cases**:
1. Admin invites user to band (creates membership)
2. User accepts invite (updates status to active)
3. Admin changes member role
4. Admin removes member
5. User views members of their bands

**Permissions**:
- ✅ INSERT admins only (when adding members)
- ✅ INSERT creating user (when joining via invite)
- ✅ SELECT members of same band
- ✅ UPDATE admins only (role changes)
- ✅ UPDATE self only (status changes for accepts)
- ✅ DELETE admins only
- ❌ **AVOID RECURSION**: Don't check band_memberships within band_memberships policy

### Songs

**Use Cases**:
1. User creates personal song
2. User creates band song
3. User updates their song
4. Band member views band songs
5. Band member updates band song
6. Creator deletes their song

**Permissions**:
- ✅ INSERT by authenticated users (set created_by)
- ✅ SELECT personal songs by creator
- ✅ SELECT band songs by band members
- ✅ UPDATE by creator OR band admins (for band songs)
- ✅ DELETE by creator only

### Setlists

**Use Cases**:
1. Member creates setlist for band
2. Member updates setlist
3. Member views setlists for their bands
4. Member deletes setlist

**Permissions**:
- ✅ INSERT band members only
- ✅ SELECT band members only
- ✅ UPDATE band members only (or restrict to admins)
- ✅ DELETE band members only (or restrict to admins)

### Practice Sessions (Including Shows)

**Use Cases**:
1. Member schedules practice (type='rehearsal')
2. Member schedules show (type='gig')
3. Member views practice/show calendar
4. Member updates practice/show details
5. Member cancels practice/show

**Permissions**:
- ✅ INSERT band members only
- ✅ SELECT band members only
- ✅ UPDATE band members only
- ✅ DELETE band members only

**Note**: Shows are `practice_sessions` with `type IN ('gig', 'performance')`

---

## RLS Policy Design Patterns

### Pattern 1: Simple Owner Check
For user-owned data:
```sql
USING (auth.uid() = user_id)
```

### Pattern 2: Band Membership Check (Non-Recursive)
For band-owned data:
```sql
USING (
  EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_id = <table>.band_id
    AND user_id = auth.uid()
    AND status = 'active'
  )
)
```

### Pattern 3: Admin-Only Actions
For restricted operations:
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM band_memberships
    WHERE band_id = <table>.band_id
    AND user_id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  )
)
```

### Pattern 4: Creator OR Band Member
For songs and shared content:
```sql
USING (
  created_by = auth.uid()
  OR (
    context_type = 'band' AND EXISTS (
      SELECT 1 FROM band_memberships
      WHERE band_id::text = context_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  )
)
```

### Pattern 5: Avoid Recursion in band_memberships
**DO NOT DO THIS** (causes recursion):
```sql
-- ❌ WRONG - queries band_memberships within band_memberships policy
CREATE POLICY ON band_memberships USING (
  EXISTS (SELECT 1 FROM band_memberships WHERE ...)
);
```

**DO THIS INSTEAD**:
```sql
-- ✅ CORRECT - use direct checks or security definer functions
CREATE POLICY ON band_memberships FOR SELECT USING (
  user_id = auth.uid()  -- Users can see their own memberships
  OR
  band_id IN (  -- Users can see memberships of their bands
    SELECT band_id FROM band_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  )
);
```

---

## Security Considerations

### 1. Prevent Recursion
- Never query a table within its own RLS policy
- Use helper functions with SECURITY DEFINER if needed
- For band_memberships, use subqueries that don't trigger recursion

### 2. Status Checks
- Always check `status = 'active'` for band memberships
- Ignore pending/inactive memberships in permission checks

### 3. Context Handling
- `context_id` is TEXT in Supabase, use `::text` cast when comparing UUIDs
- Support both `context_type='personal'` and `context_type='band'`

### 4. Cascade Deletes
- Deleting a band should cascade to band_memberships
- Deleting a user should remove their memberships
- Handle via database CASCADE constraints

### 5. Invite Codes
- Separate table for invite codes
- Codes can be used by anyone to join band
- Expires after use or timeout

---

## Implementation Checklist

### Phase 1: Drop All Existing Policies ✅
Remove all current policies to start fresh

### Phase 2: Core Tables (No Dependencies)
- [ ] users (simple self-access)
- [ ] user_profiles (simple self-access)
- [ ] bands (simple creation + membership check for view)

### Phase 3: Relationship Table (Careful!)
- [ ] band_memberships (NO RECURSION)

### Phase 4: Dependent Tables
- [ ] songs (depends on band_memberships)
- [ ] setlists (depends on band_memberships)
- [ ] practice_sessions (depends on band_memberships)

### Phase 5: Advanced Tables (Future)
- [ ] song_groups
- [ ] song_castings
- [ ] invite_codes

---

## Testing Scenarios

### Test 1: User Isolation
1. User A creates personal song
2. User B cannot see User A's personal song
3. ✅ PASS if User B gets empty result

### Test 2: Band Sharing
1. User A creates band
2. User A adds User B as member
3. User A creates band song
4. User B can see band song
5. ✅ PASS if User B sees the song

### Test 3: Admin Permissions
1. User A (admin) creates band
2. User A adds User B (member)
3. User B tries to add User C
4. ❌ FAIL - only admins can add members

### Test 4: No Recursion
1. Query any band_memberships table
2. Monitor for recursion errors
3. ✅ PASS if no error code 42P17

### Test 5: Setlist Access
1. User A creates setlist for band
2. User B (band member) sees setlist
3. User C (not in band) does NOT see setlist
4. ✅ PASS if access control correct

---

## Reference: Current Schema Tables

| Table | Owner Type | Access Pattern |
|-------|-----------|----------------|
| users | Self | Self-access only |
| user_profiles | Self | Self-access only |
| bands | Band | Members view, admins edit |
| band_memberships | Relationship | **NO RECURSION** |
| songs | Personal/Band | Context-based |
| setlists | Band | Members access |
| practice_sessions | Band | Members access (includes shows) |
| song_groups | Band | Members access |
| song_castings | Band | Members access |

---

**Last Updated**: 2025-10-26T15:45
**Status**: Ready for Implementation
**Next Step**: Generate non-recursive SQL policies
