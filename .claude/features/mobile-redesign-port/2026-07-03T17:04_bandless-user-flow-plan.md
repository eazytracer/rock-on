---
feature: mobile-redesign-port / band-less (personal & guest) user flow
created: 2026-07-03T17:04
status: DESIGN — provisional decisions adopted (user away on the 3 forks); HOLD Phase-1 build until confirmed
---

# Band-less User Flow — design + phased plan

## The insight (user)

Users should be able to join the app **without a band**. On signup we ask: do you have a
**band code**, an **event code**, want to **start a new band**, or just want a **personal account**?

## The core problem (verified in code)

The app is **band-mandatory today**. `useAuthCheck` (src/hooks/useAuthCheck.ts:122) treats _no band_
as an auth failure:

```ts
if (!bandId) {
  setResult({
    isAuthenticated: false,
    hasBand: false,
    failureReason: 'no-band',
  })
}
```

→ `ProtectedLayoutRoute` redirects `no-band` → `/auth?view=get-started`, forcing band creation.
**That single assumption is the whole blocker.**

## The core flip

"Has a band" becomes a **capability flag, not an auth gate.** A user with a valid session is
authenticated whether or not they have a `currentBandId`.

- `useAuthCheck`: drop the `!bandId → isAuthenticated:false` branch; return `isAuthenticated: true,
hasBand: !!bandId`. Keep session validation exactly as-is.
- `ProtectedLayoutRoute`: stop redirecting on `no-band`. Render the app; pass `hasBand` down (or read
  `currentBandId` from AuthContext, which already exists).
- **Existing band users: zero change** (they have a bandId → same path as today).

## Signup: "How do you want to start?" (post account-creation chooser)

After `SignupForm` creates the account (AuthContext.signUp already works), route to a **StartChooser**
instead of forcing `BandCreationForm`. Four cards:
| Choice | Action | Lands on | Reuses |
|---|---|---|---|
| I have a **band code** | join band by code | band Home | `JoinBandForm` + `BandMembershipService` |
| I have an **event code** | join event as participant | that event | **NEW** `EventJoinForm` + `EventService.joinByCode` |
| **Start a new band** | create band | new band Home | `BandCreationForm` |
| **Just me** (personal) | set no band | personal Home | — (just set no `currentBandId`) |

## Band-less mode, per surface (provisional decisions)

- **Sidebar / More band header** → "Create or join a band" CTA (not a band name).
- **Home** → personal dashboard: your events, friends, personal songs (skip band-only cards).
- **Songs** → **personal catalog** (`contextType:'personal'` — already supported; DECISION Q2 = yes).
- **Events · Friends · Jam** → work band-less (Events just un-biased to participants; Friends standalone).
- **Setlists · Shows · Practices** → band features. DECISION Q1 = **show in nav with a "Join or create a
  band to use this" empty state** (discoverable). (Alt: hide, or disable-with-lock.)

## Reconciling "event code at signup" vs "no unlisted guests for events"

Every guest still has a **real (minimal) account** — an event code lets an _invited_ person create an
account and join as a participant. It is NOT anonymous view-by-link (that stays **jam-only**, per the
social-events plan). So the two are consistent.

## Security / RLS notes (must review before build)

- **Joining an event by code** needs a server-side path: an event `short_code` lookup → insert an
  `event_participants` row for the caller. `event_participants_insert_self` already allows
  `user_id = auth.uid()`. But the caller must be able to _find_ the event by code first — events RLS
  (`events_select`) currently requires host/participant, so a **non-participant cannot read an event by
  code yet.** → Need a `resolve_event_code(code)` SECURITY DEFINER RPC (mirror `resolve_friend_code`)
  that returns the event id (+ minimal preview) and/or performs the join. **This is the sharp edge.**
- Personal (band-less) users: personal songs already have RLS (personal catalog from the jam work).
- No anonymous access anywhere — every path requires an authenticated account.

## Phased plan (DECISION Q3 = core first; each phase LOCAL + validated + held for review)

**Phase 1 — the gate + the working set** (unblocks everything):

1. `useAuthCheck` + `ProtectedLayoutRoute`: flip the no-band gate (authenticated + `hasBand`).
2. Post-signup `StartChooser` (4 cards) + route wiring; "personal account" path sets no band.
3. Layout band-less handling: Sidebar/More header → "Create or join a band"; guard band-scoped hooks
   against empty `bandId` (most already accept `''`).
4. Personal Home + Songs personal catalog empty/populated states.
5. Validate: type-check, eslint, quick, e2e — **critically: confirm existing band-user login is
   unaffected**, then sign up a fresh personal account through the chooser and exercise band-less mode.

**Phase 2 — event-code join + band-only empty states:** 6. `resolve_event_code` RPC (migration, security-reviewed) + `EventService.joinByCode` + `EventJoinForm`. 7. Band-only pages (Setlists/Shows/Practices) "join or create a band" empty states. 8. "Create/join a band" entry from band-less mode (upgrade path) — reuse BandCreationForm/JoinBandForm.

**Phase 3 — polish:** invite→event-code end-to-end (ties into social-events piece C), edge cases,
persistent E2E specs.

## Risks / things to look at

- **Auth gate flip is high-stakes** — it changes the authentication result for the whole app. Validate
  band-user login + session-expiry paths still behave (they should: only the `!bandId` branch changes).
- `localStorage 'currentBandId'` is read in many places (useAuthCheck, useSongs, BandMembersPage via
  `localStorage.getItem`) — audit for code that _assumes_ it's non-null.
- The `event-code` RPC is the security-sensitive new surface (non-participant reads an event by code).
- Band-less → band **upgrade path** (personal user later creates/joins a band) must switch context cleanly
  (AuthContext.switchBand exists).

## Provisional decisions (my best judgment — user was away on the AskUserQuestion; revisit)

- Q1 band-only nav → **show with prompt**. Q2 personal songs → **yes**. Q3 scope → **core first**.
