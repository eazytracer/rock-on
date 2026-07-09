# Cluster B — bands member management: suspected PRODUCT bug (Category B)

Agent: agent-B. **Do not change source or test until user signs off.**

## Test

`tests/e2e/bands/manage-members.spec.ts` — "admin can remove member from band"
(the `.toBe` failure the parent flagged; in the current file the only `.toBe`
in this test is the removal assertion).

What the test does:

1. Admin creates a band; a second user joins via invite code.
2. Admin opens `/band-members`, clicks the member row, then clicks a
   Remove-flow button (`button:has-text("Remove"|"Remove from Band")` /
   `[data-testid="remove-member"]`) and confirms.
3. Waits 2s, then asserts the removed member row is gone:

```
const memberStillVisible = await memberRow.isVisible().catch(() => false)
expect(memberStillVisible).toBe(false)   // <-- FAILS: received true
```

Expected `false` (row gone), received `true` (member still listed).

## Why removal does not persist (root cause)

The remove handler calls the `useRemoveBandMember` hook, which writes
**directly to local IndexedDB and never enqueues a sync**:

`src/hooks/useBands.ts:448-459`

```ts
const removeMember = async (membershipId: string) => {
  ...
  // "the service doesn't expose this"
  await db.bandMemberships.update(membershipId, { status: 'inactive' })
  return true
}
```

This is a Repository-Layer-Guardrail violation (see CLAUDE.md): direct `db.*`
writes bypass the sync queue, so **Supabase never sees the status change**.
`src/hooks/useBands.ts` is in fact listed in `KNOWN_VIOLATIONS`
(`tests/unit/guardrails/db-direct-write.test.ts:87`) and the eslint override
(`.eslintrc.cjs:82`) — recognized tech debt.

The members list is read **cloud-first**, so it re-materializes the member as
active from Supabase and even overwrites the local `inactive` flag:

- `BandMembersPage` uses `useBandMembers` (`src/pages/BandMembersPage.tsx:83`).
- `useBandMembers` → `BandMembershipService.getBandMembers`
  (`src/hooks/useBands.ts:251`), which filters `status === 'active'`
  (`src/services/BandMembershipService.ts:208-211`) — correct filter, but…
- `getBandMembers` → `repository.getBandMemberships` →
  `SyncRepository.getBandMemberships` (`src/services/data/SyncRepository.ts:405-424`)
  which is cloud-first: it fetches from Supabase (`this.remote.getBandMemberships`,
  line 410) where the membership is **still `status='active'`** (the local
  edit never synced), and re-caches that remote copy back into local
  (`this.local.addBandMembership`, line 413) — clobbering the `inactive`
  write.
- `useBandMembers` refetches on every repo `'changed'` event
  (`src/hooks/useBands.ts:287`).

Net effect: the page's optimistic local `setMembers(filter …)`
(`BandMembersPage.tsx:325`) may briefly hide the row, but the next cloud-first
refetch brings the member back as active. The member is never actually removed
from the band (still active in Supabase, retains band access). This is exactly
the symptom the assertion catches: `memberStillVisible === true`.

## Classification

**Category B — genuine product bug.** Removal is not durable: it writes only to
local IndexedDB, bypasses sync, and is overwritten by the cloud-first read.
The correct fix is to route removal through the repository/service layer (e.g.
`BandMembershipService` already has a `status:'inactive'` update path at
`src/services/BandMembershipService.ts:240` via `repository.updateBandMembership`)
so the change syncs to Supabase — not a test/selector change. Left for user
sign-off per triage rules.
