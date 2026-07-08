# Account deletion (+ band ownership transfer) — design

**Status:** DESIGN / pre-implementation. This folder is the source of truth for the
account-deletion feature. **No code has been written** — this is scaffolding for review.
Branch: `feature/account-deletion` (off `main`).

> **Base:** v0.4.0 is **already merged into `main`** (PR #17), so this branch includes all
> the tables the deletion cascade touches (`event_hands`, `event_participants`,
> `friend_requests`, `friendships`, `notifications`, `song_hidden`, `tunings`, casting…).
> No sequencing dependency — build directly on this branch.

---

## 1. Problem

Settings → **Delete Account** deletes nothing on the server. `handleDeleteAccount`
(`src/pages/SettingsPage.tsx`, ~L54) only clears local IndexedDB (`db.delete()`) and signs
out — it toasts _"Account deletion coming soon"_ and carries a `TODO: Implement proper
account deletion via Supabase RPC`. The `auth.users` login and all server data survive; the
user can log back in and everything is intact. We need a real, irreversible delete.

## 2. Why it's not a one-liner (schema findings)

- **No FK `public.users` → `auth.users`.** They're linked only by the `handle_new_user`
  trigger, so deleting one side orphans the other — **both** must be deleted.
- **`DELETE FROM public.users` is blocked today** by `NO ACTION` + `NOT NULL` `created_by`
  on `songs`, `setlists`, `shows`, `song_groups`, `casting_templates`,
  `casting_assignments`, `invite_codes`. A naive delete fails with FK violations.
- **Context content isn't FK'd.** Personal songs/setlists key off `context_id = <userId>`
  (TEXT); band content off `context_id = <bandId>`. Neither cascades — both must be deleted
  explicitly by matching `context_id`.
- **Most user data already cascades** (`ON DELETE CASCADE`): `band_memberships`, `events`
  (host) + `event_participants`/`event_hands`/`event_lineup_requests`, `friendships`,
  `friend_requests`, `notifications`, `jam_sessions`/`jam_participants`,
  `song_personal_notes`, `song_note_entries`, `song_hidden`, `user_profiles`,
  `member_capabilities`.
- **Only `service_role` can call `auth.admin.deleteUser()`** → an **Edge Function** is
  required. A SECURITY DEFINER RPC alone cannot remove the login row.

## 3. The hard question — band ownership transfer

"Ownership" of a band ≈ the **admin** role (`band_memberships.role ∈ {admin, member}`;
`bands.created_by` is just provenance, already `SET NULL`). When a user deletes their
account, for each band they belong to:

| Case | Situation                                 | What should happen                                          |
| ---- | ----------------------------------------- | ----------------------------------------------------------- |
| A    | User is the **sole member**               | Delete the band + its content (nothing to transfer)         |
| B    | Others remain, **another admin exists**   | Nothing special — their membership cascades away            |
| C    | Others remain, user is the **only admin** | **Must not leave the band admin-less** — transfer ownership |

Case **C** is the crux. Options:

- **(a) Auto-promote** the earliest-joined remaining member to admin during deletion; warn
  in the confirm dialog ("You're the last admin of N band(s); ownership passes to …").
  Simplest, no new UI.
- **(b) Explicit chooser** — the delete flow lists each sole-admin band and makes the user
  pick a successor (or "delete this band"). Better UX, more work.

**Related capability worth designing alongside:** a standalone **Transfer ownership / Make
admin** control on the Band Members page — useful independent of deletion, and it lets a
user hand off _before_ deleting, so deletion only ever needs the sole-member / last-admin
fallbacks.

**Recommendation (confirm at review):** ship the standalone **Make admin / Transfer
ownership** action first (small, independently useful), and have deletion **auto-promote**
(option a) as the safety net.

### Open decisions

1. Last-admin handling: **auto-promote (a)** vs **explicit chooser (b)**?
2. Also build the standalone **Transfer ownership / Make admin** action, or only the
   deletion-time fallback?
3. Shared band content: confirm **preserve** (creator → `NULL`) vs hard-delete everything
   the user authored. _(Recommended: preserve — co-members rely on it.)_

## 4. Proposed implementation (once decisions are locked)

### 4a. Migration `<ts>_account_deletion.sql`

- Loosen the blocking provenance columns to **nullable** + FK **`ON DELETE SET NULL`** so
  shared band content survives its creator: `created_by` on `songs`, `setlists`, `shows`,
  `song_groups`, `casting_templates`, `casting_assignments`, `invite_codes`; the
  already-nullable `last_modified_by`/`added_by`, `tunings.*`, `audit_log.user_id`. Use the
  idempotent `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL … $$` guard. Non-destructive
  (loosens NOT NULL, changes cascade rule — no rows dropped).
- **`delete_my_account()`** SECURITY DEFINER RPC, scoped to `auth.uid()` (a caller can only
  delete _themselves_):
  1. `me := auth.uid()`; abort if NULL.
  2. Resolve sole-admin bands → promote a successor (per decision 1) so no band is left
     admin-less.
  3. Delete `context_id`-owned content with no cascade: `songs`/`setlists` where
     `context_id IN (me::text, <sole-member band ids>)`; delete sole-member bands (cascades
     their memberships/invite_codes/shows/practices).
  4. `DELETE FROM public.users WHERE id = me` — now succeeds; CASCADE tables clean up and
     shared provenance becomes `NULL`.
  - `GRANT EXECUTE … TO authenticated`.
- **Requires a dedicated security review** (SECURITY DEFINER + broad deletes) + **negative
  pgTAP** proving user A cannot delete user B's data. Update `002-schema-columns` /
  `004-schema-constraints` pgTAP to the new nullability/FK expectations.
- (If decision 2 = standalone transfer) an admin-gated `band_memberships.role` update (RLS)
  or a small `set_band_admin(band, user)` RPC.

### 4b. Edge Function `supabase/functions/delete-account`

- `verify-JWT` + `service_role`; model on `supabase/functions/jam-recompute`.
- Flow: read caller JWT → `uid`; call `delete_my_account()`; `await
admin.auth.admin.deleteUser(uid)`; return 200 / structured error.
- Add a row to `supabase/functions/FUNCTIONS.md`; deploy via
  `./scripts/deploy-edge-functions.sh delete-account` + smoke test.

### 4c. Frontend

- Rewrite `handleDeleteAccount` to `supabase.functions.invoke('delete-account')` → on
  success clear IndexedDB (`db.delete()`) + `signOut()` → `/auth`; on failure toast, keep
  the account. Keep the "type DELETE" modal gate + testids
  (`delete-account-{button,modal,confirm-button,cancel-button}`). Consider an
  `AccountService.deleteAccount()`. Add the last-admin warning to the confirm dialog.
- (If decision 2) a Band Members "Make admin / Transfer ownership" control.

## 5. Verification plan (when implemented)

`supabase db reset` → `npm run test:db` (updated pgTAP + negative cross-user deletion) →
`npm run lint:migrations`. Serve functions locally; delete a throwaway user who has a
personal song, a solo band, a shared-band membership, and a sole-admin band, then assert:
their `auth.users` + `public.users` rows gone, personal + solo-band content gone, **shared
band song still present with `created_by IS NULL`**, sole-admin band now owned by the
promoted member, and login no longer works. Then `type-check`/`lint`/`test:unit`; deploy
migration + function to prod; smoke-test with a disposable prod account. Make the currently
skipped `tests/e2e/settings/settings-page.spec.ts` "Delete Account Workflow" specs real.

## 6. Files this will touch (later)

- `supabase/migrations/<ts>_account_deletion.sql`
- `supabase/functions/delete-account/index.ts` + `supabase/functions/FUNCTIONS.md`
- `src/pages/SettingsPage.tsx` (+ maybe `src/services/AccountService.ts`; Band Members
  transfer UI)
- `supabase/tests/002-*`, `004-*` (+ new deletion pgTAP); `tests/e2e/settings/settings-page.spec.ts`
