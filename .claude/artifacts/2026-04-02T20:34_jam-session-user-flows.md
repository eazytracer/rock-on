# Jam Session — Comprehensive User Flows & Lifecycle Spec

**Created:** 2026-04-02T20:34  
**Status:** Research document — foundation for workflow refinement  
**Scope:** All jam session user journeys, lifecycle, and open design questions

---

## Background: What the Feature Currently Does

The jam session feature is built around **collaborative song matching**. Every participant shares their personal song catalog, the app finds songs that multiple participants all know, and the host curates a setlist from those common songs.

However, this document also covers the **host-broadcast flow** the product needs — where the host builds a setlist and guests simply _see_ it — because the current implementation is a good foundation but does not fully express that simpler flow yet.

---

## Core Concepts

| Term                  | Definition                                                                                                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session**           | A live jam event. Has a 6-char short code (e.g. `4B3D9F`) and a 24-hour lifespan (free tier).                                                                          |
| **Host**              | The authenticated user who created the session. Controls the setlist, confirms fuzzy matches, saves at the end.                                                        |
| **Participant**       | An authenticated user who joined via short code or link. Their song catalog is used for matching.                                                                      |
| **Guest (anonymous)** | A user without an account who visits the public view link. Read-only, sees the match list.                                                                             |
| **Common Songs**      | Songs that appear in multiple participants' catalogs. The core output of the session.                                                                                  |
| **My Song Queue**     | The host's manually curated list of songs to bring into the jam regardless of matches.                                                                                 |
| **Short Code**        | 6-char alphanumeric code (e.g. `4B3D9F`). Used to join by typing. No ambiguous chars (0/O, 1/I).                                                                       |
| **View Link**         | Full URL with a one-time view token embedded (`/jam/view/4B3D9F?t=...`). Allows anonymous read-only access via Edge Function. Separate expiry from the session itself. |

---

## Flow 1: Host Creates a Jam Session

**Entry point:** Authenticated user navigates to `/jam` via the Jam sidebar item.

```
/jam (main page)
  └─ [Optional] Enter session name (e.g. "Thursday Practice")
  └─ Click "Create Jam Session"
       │
       ├─ App generates 6-char short code
       ├─ App generates a secure view token (SHA-256 hashed, stored in DB)
       ├─ Session record created in DB: status=active, expires_at=now+24h
       ├─ Host auto-added as first participant
       └─ Redirects to /jam/:sessionId
```

**On the session page (`/jam/:sessionId`), the host sees:**

- Session card: short code, expiry countdown, copy-link button, QR code toggle
- **Common Songs** panel — empty until ≥2 active participants with songs
- **My Song Queue** panel — host can add songs manually from their personal catalog

**Current gap:** There is no "share this setlist with guests" toggle. The common songs panel is the only shared output. The host's queued songs are _not_ visible to guests via the public view link.

---

## Flow 2: Host Invites Participants

The host has two invitation mechanisms:

### 2a. Share the Link (copy-link or QR)

```
Host clicks "Copy Link"
  └─ Copies: https://app.rock-on.com/jam/view/4B3D9F?t={viewToken}
  └─ Shares via text, band chat group, etc.
  └─ Recipient visits URL → JamViewPage (public, no login required)
```

### 2b. Share the Short Code

```
Host reads/shares the 6-char code verbally or via any channel
  └─ Recipient must be logged in and go to /jam
  └─ Types the code into "Join a Session"
  └─ Clicks Join → lands on the live session page
```

**Design note:** The link flow and the code flow lead to _very different experiences_. The link → anonymous read-only view. The code → authenticated, live participant. This distinction is not clearly communicated to users today and is the biggest UX friction point.

**Recommended:** When the host shares a link, that link should also have an obvious "Join this session" CTA that (1) takes logged-in users directly into the session as a participant, and (2) prompts non-logged-in users to sign up/in then lands them in the session. The separate code-join flow can remain for in-person use.

---

## Flow 3: Participant WITH an Account Joins

### Via the view link

```
User receives: /jam/view/4B3D9F?t={viewToken}
  └─ Visits URL while logged in
  └─ JamViewPage shows read-only match list + "Join this Jam" CTA
  └─ User clicks "Join this Jam"
       └─ App redirects to /jam
       └─ User enters the short code 4B3D9F (currently manual)
       └─ Clicks Join
            └─ App adds user as participant
            └─ Match recomputation triggered
            └─ User sees the live Common Songs + their own song contributions
```

**Current gap:** After clicking the CTA on the view page, the user is _not_ automatically dropped into the session — they must re-enter the short code. The short code should be pre-filled or the CTA should route directly to `/jam?join=4B3D9F` so the join is one-click.

### Via short code (e.g. in-person)

```
User navigates to /jam
  └─ Enters 6-char code in "Join a Session" field
  └─ Clicks Join
       └─ App validates: session exists, is active, not expired
       └─ User added as participant (idempotent — rejoining is safe)
       └─ Match recomputation runs
       └─ User lands on session view: sees Common Songs + My Song Queue
```

---

## Flow 4: Participant WITHOUT an Account (Anonymous Guest)

### Viewing the session

```
Anonymous user receives: /jam/view/4B3D9F?t={viewToken}
  └─ Visits URL (no login required)
  └─ JamViewPage fetches from Edge Function (no DB credentials needed)
  └─ Sees: session name, host name, participant count, confirmed match list
  └─ CANNOT: add songs, confirm/dismiss matches, or affect the session in any way
  └─ CTA: "Sign up free to join this jam"
```

### Signing up and joining from the view page

```
Anonymous user clicks "Sign up free to join this jam"
  └─ Redirects to /auth?view=signup&redirect=/jam/{shortCode}
  └─ User completes sign-up
  └─ Auth redirects to /jam/4B3D9F (auto-join short code flow)
  └─ User becomes an active participant
  └─ Their songs are matched against the session
```

**Note on value proposition:** An anonymous user signing up _just_ for a jam session will have an empty song catalog. The match algorithm needs their catalog to contribute anything. This means:

- The join flow should prompt them to add songs immediately after joining
- OR the host's "broadcast setlist" mode (see Flow 6) makes this a non-issue — they just watch

---

## Flow 5: How Song Matching Works

This runs automatically whenever a participant joins or their catalog changes.

```
Participant joins or updates songs
  └─ recomputeMatches() triggered
       ├─ Fetches all active participants
       ├─ For each participant, fetches their shared song catalog
       ├─ Runs 3-tier matching algorithm:
       │    ├─ Tier 1 (Exact): normalized title + artist must match exactly
       │    │    → isConfirmed: true, matchConfidence: 'exact'
       │    ├─ Tier 2 (Fuzzy): exact artist + Levenshtein distance ≤ 2 on title
       │    │    → isConfirmed: false, matchConfidence: 'fuzzy' (host must confirm)
       │    └─ Tier 3 (Manual): host manually links two songs
       │         → matchConfidence: 'manual' [NOT YET IMPLEMENTED]
       ├─ Results stored in jam_song_matches table
       └─ UI updates via Supabase Realtime
```

**Host sees in Common Songs panel:**

- Confirmed matches (exact + host-confirmed fuzzy): shown immediately
- Pending fuzzy matches: shown with Confirm / Dismiss buttons
- Participant count per song (how many people know it)

---

## Flow 6: Host Builds and Shares the Setlist (Current + Desired)

### Current behavior

The host uses "My Song Queue" to manually add songs they want to include regardless of matches. At the end they click "Save as Setlist" which combines:

- All confirmed common song matches
- All manually queued songs (deduplicated)

This creates a _personal_ setlist (not band-scoped) tagged with `['jam']` and linked back to the session via `jam_session_id`.

**What guests see:** Only the confirmed common song matches (via Edge Function public view). The host's manually queued songs are NOT visible to guests until the session is saved.

### What the product needs (host-broadcast mode)

The desired flow from the product brief: **"Host builds a setlist, guests see the songs."**

This is a fundamentally different mode from collaborative matching. Proposed design:

```
Host clicks "Add to Setlist" on any song (from their catalog or Common Songs)
  └─ Song added to the session's working setlist
  └─ Guests viewing the public link see this setlist update in real-time
  └─ At end of session, host clicks "Finalize Setlist"
       └─ Setlist saved permanently
       └─ Guests can see the final setlist at the view link until it expires
```

**Implementation path:** The `settings.hostSongIds` field already exists to hold the host's queued songs. The Edge Function just needs to include these in the `JamViewPublicPayload`. This is a small change.

---

## Flow 7: Reconnection After Internet Loss

### Host reconnects

```
Host loses internet (connectivity drops, browser closed, crash)
  └─ Session persists in DB — nothing is lost
  └─ Host reopens app and navigates to /jam
       └─ IF they have the session ID or it's in recent history:
            └─ Navigate directly to /jam/:sessionId
            └─ Session loads from DB, everything intact
       └─ IF they don't have the URL:
            └─ NO current way to list "my sessions" — gap (see below)
```

**Gap:** There is no "My Recent Sessions" list on the `/jam` page. If the host loses their tab, they have no way to find their session other than knowing the `sessionId` UUID or the short code. The short code won't help them because code-join is for _participants_, not host-resumption.

**Fix needed:** `/jam` landing page should show active sessions the user created at the top (e.g. "You have an active jam session: Thursday Practice [4B3D9F] — 18h remaining").

### Participant reconnects

```
Participant loses internet
  └─ Session persists in DB
  └─ Participant navigates to /jam
  └─ Enters the 6-char short code again
  └─ joinSession() is idempotent — re-adds without duplicating
  └─ They're back in the session instantly
```

**OR if they have the view link saved:**

```
Participant visits /jam/view/4B3D9F?t={viewToken}
  └─ JamViewPage shows current state (read-only)
  └─ Clicks "Join" CTA (authenticated) to re-enter as participant
```

This is reasonably solid. The main friction is the CTA not pre-filling the short code.

---

## Session Lifecycle Summary

```
CREATED (active, expires_at = now + 24h)
    │
    ├─ Participants join, songs matched, host curates
    │
    ├─ EXPIRY TRIGGERS (any of these):
    │    ├─ Hook load: if expiresAt < now → auto-expires in DB
    │    ├─ joinSession(): checks before adding → rejects + expires
    │    ├─ Edge Function request: returns HTTP 410 if expired
    │    └─ [Optional] pg_cron sweep every 30 min (not confirmed as implemented)
    │
    ├─ status = 'expired'
    │    └─ View link returns 410 Gone
    │    └─ Short code join rejected
    │    └─ Session page shows "This session has ended"
    │
    └─ status = 'saved' (host clicked Save as Setlist)
         └─ saved_setlist_id populated
         └─ Setlist lives on at /setlists (personal tab)
         └─ Session is closed — not resumable
```

**Tier limits (as designed, free tier active only):**

| Tier | Session Duration | Max Participants | Behavior                    |
| ---- | ---------------- | ---------------- | --------------------------- |
| Free | 24 hours         | Unlimited (stub) | Standard                    |
| Pro  | 7 days           | Unlimited (stub) | Extended (not yet enforced) |

**Can you rejoin after expiry?** No. Once expired, the session is gone. However, the _saved setlist_ persists permanently if the host saved before expiry.

**What happens to matched songs after expiry?** The `jam_song_matches` rows remain in the DB (no cascade delete), but are inaccessible to the app since the session status check prevents loading. This is fine for a first version.

---

## Guest Experience: Styling Issue

The `JamViewPage` (`/jam/view/:shortCode`) currently has different styling — a dark blue theme — vs the rest of the app which uses the standard dark theme.

**Root cause:** `JamViewPage` is a _public_ page, rendered outside `ProtectedLayoutRoute`. It does not inherit the `ModernLayout` wrapper and likely has its own background/container styles that don't match the design system.

**Fix:** Apply the same `bg-gray-900` (or whatever the app-standard dark background variable is) and standard typography classes to `JamViewPage`. It should feel like a "logged-out view" of the app, not a separate product. The Tailwind classes and component styles need to match.

---

## Summary of Gaps and Recommended Fixes

| Priority | Gap                                                                   | Fix                                                        |
| -------- | --------------------------------------------------------------------- | ---------------------------------------------------------- |
| High     | No "My active sessions" list on /jam landing                          | Add a card showing host's active sessions with resume link |
| High     | CTA on view page doesn't auto-join                                    | Route CTA to `/jam?join={shortCode}` and auto-trigger join |
| High     | Host's queued songs not visible to guests                             | Include `hostSongIds` in Edge Function public payload      |
| High     | JamViewPage styling differs from app                                  | Apply standard dark theme classes to the public page       |
| Medium   | No clear distinction communicated between "view link" and "join code" | Add UX copy explaining what each is                        |
| Medium   | New user signing up for jam has empty catalog                         | Post-signup onboarding step to add songs immediately       |
| Medium   | Manual match (`addManualMatch`) not implemented                       | Implement per the existing plan (T037)                     |
| Low      | pg_cron sweep not confirmed                                           | Add cron job or confirm soft-expiry-on-load is sufficient  |
| Low      | Realtime uses songs:changed workaround                                | Implement dedicated jam:session:{id} Realtime channel      |

---

## Questions for Product Decision

1. **Broadcast vs Collaborative:** Should Jam sessions support both modes — (a) host-broadcast where host builds a setlist guests see, and (b) collaborative where all participants contribute songs for matching? Or should we simplify to one primary mode?

2. **Guest participation without account:** Is it worth building a "lightweight guest" join where someone without an account can submit songs to a session without registering? Or is sign-up required to contribute?

3. **Session duration:** Should the session stay alive indefinitely while the host is active, with the 24h timer only counting from last activity? Or is a hard 24h cap acceptable for v1?

4. **Setlist vs "what we're playing tonight":** Is the saved setlist the end goal, or should the session itself be the thing bands refer to during a gig (live setlist view, next song, etc.)?
