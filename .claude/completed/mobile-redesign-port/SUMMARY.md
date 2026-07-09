# Mobile-Redesign Port + Social/Event Layer — Summary

**Completed:** 2026-07-08
**Version:** 0.4.0 (shipped as PRs #15–#17; the flagship of 0.4 is Events + Friends)

## Overview

Large combined effort that (1) ported the whole app onto the refreshed dark design and (2) added a net-new **social/event layer** (Events, Friends, Notifications) on top. The key reframe: the real app was already dark-only, so the "redesign" was mostly a **token-consolidation + gap-fill** — establish CSS custom properties, unify three competing oranges to one `--accent`, and re-skin ~65 arbitrary-hex files incrementally, one screen per pass. On top of that foundation came genuinely new surfaces: a 5-tab bottom nav, Personal↔band context switching, a band-less user flow, and the Events/casting console. **Design source of truth = the Claude Design "Rock On" project** (`app/spec-rows/` + `DESIGN_NOTES.md`, project `019df065-4ee1-707b-bfd9-d821331f5cad`); the local dated planning docs were rationale-only and superseded by it. Built on branch `feature/events-friends-and-ui-oh-my`, local-only until the human's prod review.

## What shipped

- **Design-system overhaul** — CSS token `:root` (surfaces/ink/accent/semantic), Tailwind mapping + TS `tokens.ts` mirror, Geist + JetBrains Mono, tuning palette reconciled to `tunings.ts` "Palette A" (canonical); one-file re-skin from then on.
- **5-tab nav + IA** — re-skinned/wired `BottomNavigation` (Home · Songs · Sets · Calendar · More); Shows/Practices/Events nest under a **Calendar parent** (`?filter=` deep-links); desktop sidebar kept as a superset; header bell for notifications.
- **Context switching (Personal↔band)** — brand-chip switcher, persisted; Songs + Setlists personal-capable.
- **Band-less user flow** — "has a band" is a capability flag, not an auth gate; post-signup StartChooser ("Just me" first-class, band code, event code, new band); band-only pages get "join or create a band" empty states.
- **Events** — host/guest model, tabbed detail (Lineup · Requests · People · Access), lineup as source-tagged songs, **casting console** (List = per-song `LineupCard` + inline `SongCastPanel`; Grid = songs×instruments matrix, sticky song col, stacked avatars, +N), **raise-a-hand** (`event_hands`), requests→host-approve (auto-link to catalog on approve), **Access** tab (visibility/code/QR + allow-suggestions/auto-approve), invite friends → participants, RSVP, list "N going · X% cast".
- **Casting v1** — shared, context-generic model (events testbed → jam → bands later); fixed instrument set (guitar/bass/drums/vox/keys/other-freetext); free-text cast (no account needed).
- **Friends** — friend-code card (copy + QR), discoverable toggle, add-by-code, **find-by-name** search, requests/friendships, shared-bands count, "who can add you" policy.
- **Notifications** — feed + bell; cross-context "from ‹Band›" chip (name-only, manual switch); release-notes "what's new" gate.
- **Desktop two-pane layouts** — Home dashboard, Settings scroll-spy left-nav, Friends right-rail, Events master/detail, Event-create centered modal.
- **Also:** custom tunings (Settings manager + create/edit); Songs hide/re-add + provenance ("from ‹Band›") + Source filter; native `<select>`→C0 `<Dropdown>` everywhere; dark date/time pickers; 4-state song-notes indicator; realtime/UX bug-fix pass.

## Key decisions / architecture

- **Casting model** — one flat `casting_assignments` table keyed by a generic context (`setlist`|`event`), built surface-agnostic so jam/bands are wiring, not a rewrite; fixed-five default parts + `other`; free-text via `member_name`/null `member_id`; legacy 3-tier casting chain left dormant/dead.
- **Events DB shape** — `events` (+ `event_participants`, `event_lineup_items`, `event_lineup_requests`) + casting + `event_hands`; events are **user-hosted** (`band_id` nullable), personal-catalog-first.
- **Access tiers** — host / cohost / guest / viewer + RSVP; unlisted-by-link stays **jam-only** (every event guest has a real minimal account).
- **Band-less/context model** — session = authenticated regardless of band; `hasBand` capability flag.
- **UI conventions** — create = full-page canonical entity page (D2; modals retired for routeless sub-objects only); Calendar-parent nav (D1); C0 `<Dropdown>` over native selects.
- **Storage** — all new features are **Supabase-only + Realtime** (jam precedent), NOT the band-scoped local-first sync engine.
- **Security** — enums as CHECK constraints matching TS unions exactly (drift is fatal); SECURITY DEFINER helpers to avoid RLS recursion; privileged writes / code lookups / policy-checked inserts via edge functions or SECURITY DEFINER RPCs; every RLS change got a dedicated security-review + negative pgTAP.

## Database

Additive incremental migrations (one per feature; idempotent; grants to authenticated + service_role; RLS + Realtime), applied to prod **2026-07-08**:

- `20260702140919_notifications.sql`, `20260702142222_friends.sql`, `20260702143450_events.sql`, `20260703045901_casting.sql` (incl. `event_hands`, `allow_suggestions`/`auto_approve`), `20260703164738_social_events.sql`, `20260703214829_event_code_join.sql`, `20260704191222_tunings.sql`, `20260706192718_song_hidden.sql`.
- Later 0.4.x follow-ups: `20260708032526_friend_code_ensure.sql`, `20260708034832_drop_db_tuning.sql`, `20260708042932_friend_name_resolution.sql`, `20260709064907_0.4_event_ops_patch.sql`.

## Key files / references

- **Surfaces:** `src/pages/events/*`, `src/pages/friends/*`, `NotificationsPage`, `HomePage`/`CalendarPage`/`MorePage`, `AuthPages` (StartChooser); `components/casting/*` (`SongCastPanel`, `EventCastGrid`, `LineupCard`), `components/notifications/*`.
- **Services/hooks:** `EventService`, `FriendService`, `NotificationService`, `CastingService`, `SongHiddenService`; `useCasting`, `useEventHands`, `useEventParticipants`, `useRealtimeTable`, `useHiddenSongs`, `useSongSources`.
- **Foundation:** `src/index.css` (token `:root`), `tailwind.config.js`, `src/utils/tokens.ts`, `src/utils/tunings.ts` (Palette A canonical).
- **Design SoT:** Claude Design "Rock On" project `app/spec-rows/` — `https://claude.ai/design/p/019df065-4ee1-707b-bfd9-d821331f5cad`.
- **Deferred (user):** ResolveSheet, public/event-owned songs, confidence/fuzzy match, seed-lineup-from-setlist, notification auto-switch-on-open.
- `TASKLIST.md` was the running implementation log (commits, per-item verification, regression register) — the authoritative history this summary compresses.
