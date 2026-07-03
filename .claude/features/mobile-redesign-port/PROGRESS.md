# Mobile Redesign Port — Progress Log

Orchestrator working log. Source of truth for status. No git push until user review.
Branch: `feature/events-friends-and-ui-oh-my`.

---

## ▶ RESUME HERE — Band-less user flow **Phase 2** (fresh context starts here)

**Where we are (all committed; tree clean):**

- **Phase 1 DONE + validated** (commit `904f191`, **LOCAL — not pushed**): "has a band" is now a
  capability, not an auth gate. Personal accounts work end-to-end (signup → "Continue with a personal
  account" → band-less app). Regression-checked (band users unaffected). Tests updated. Details: see the
  dated "BAND-LESS USER FLOW Phase 1" entry below + `2026-07-03T17:04_bandless-user-flow-plan.md`.
- Pushed to origin: `e2931c0` (UI consistency + social-events A+B casting) and `8456578` (band-less design doc).
- **⚠ `904f191` (Phase 1 auth) is committed but NOT pushed** — decide whether to push before/with Phase 2.

**Phase 2 tasks (from `2026-07-03T17:04_bandless-user-flow-plan.md` §Phased plan):**

1. **Event-code join at signup** — the security-sensitive piece. Needs a `resolve_event_code(code)`
   SECURITY DEFINER RPC (a non-participant must find/join an event by code; events RLS blocks that today).
   Mirror `resolve_friend_code` (in `20260702142222_friends.sql`) + the jam `short_code`/confusable-free
   alphabet. Then `EventService.joinByCode` + an `EventJoinForm` card on GetStartedPage. **Security-review
   the RPC first** (adversarial pass like friends/jam/casting). New incremental migration.
2. **Band-only empty states** — Setlists/Shows/Practices show a "Join or create a band to use this"
   prompt when `!currentBandId` (DECISION Q1 = show-with-prompt). Hide band-only Home quick actions
   (New setlist / Schedule practice / Book show) when band-less.
3. **Upgrade path** — a band-less user creating/joining a band later switches context cleanly
   (`AuthContext.switchBand` exists).

**Provisional decisions (user confirmed "go ahead"):** Q1 band-only nav = show-with-prompt · Q2 personal
songs = yes · Q3 = core-first phased. **Local dev:** `npm run start:dev`; login eric@testband.demo / test123.
**Everything LOCAL** — no `db push --linked`, no remote migration.

---

## Operating rules (from user)

- Small serial code changes; validate as you go. **No parallel code edits.**
- Sub-agents for validation (unbiased) + research/QC parallelism only.
- Playwright validates behavior + visual consistency.
- Tag components (`data-testid`/`id`) + update e2e tests per pass.
- Track progress here; keep context lean. **Do not push to git.**

## Status board

| Pass | Task                              | Status              | Notes                                                                           |
| ---- | --------------------------------- | ------------------- | ------------------------------------------------------------------------------- |
| P0   | T001 tokens in index.css          | ✅ done             | channel-format `--x-rgb` + ready `--x` colors                                   |
| P0   | T002 tailwind map + fonts         | ✅ done             | `rgb(var(--x-rgb)/<alpha-value>)`; Geist + JetBrains Mono                       |
| P0   | T003 tokens.ts                    | ✅ done             | var-refs + BADGE/STATUS tone maps + instrument spine; re-exports tunings/avatar |
| P0   | T004 unify oranges                | ✅ done (revised)   | see note below                                                                  |
| P0   | T005 verify P0                    | ✅ done             | validated (see log)                                                             |
| P1   | T006 Badge                        | ✅ done             | static semantic pill; 5 unit tests                                              |
| P1   | T007 Eyebrow                      | ✅ done             | mono uppercase label                                                            |
| P1   | T008 generic Avatar               | ✅ done             | Avatar + SongAvatar wrapper; 5 unit tests                                       |
| P1   | T009 bottom-sheet                 | ✅ done             | SlideOutTray `position='bottom'` + tokenized (identical hexes)                  |
| P2   | T010 re-skin BottomNavigation     | ✅ done             | router-driven, 5 tabs, dark tokens, accent-active                               |
| P2   | T011 wire into ModernLayout       | ✅ done             | mobile-only + main pb-20                                                        |
| P2   | T012 reconcile Sidebar IA         | ✅ done             | +Home +Calendar; blue→accent active/logo                                        |
| P2   | T013 routes + stubs + bell        | ✅ done             | Home/Calendar/More/Notifications pages+routes; header bell                      |
| P2   | verify P2                         | ✅ done             | e2e 12/12 after eruda gate fix; SIGNED OFF                                      |
| —    | strategy checkpoint               | decided (user away) | see decision below                                                              |
| P9a  | Home dashboard (real)             | ✅ done             | e2e 13/13; SIGNED OFF                                                           |
| P9b  | Calendar aggregator (real)        | ✅ done             | e2e 13/13; SIGNED OFF                                                           |
| —    | CHECKPOINT: paused before DB tier | awaiting user       | see "STOPPED HERE" below                                                        |
| P10  | Notifications                     | ✅ done             | DB+service+UI; e2e validated (login→badge=2→feed→mark-all persists); SIGNED OFF |
| P11  | Friends                           | ✅ done             | e2e validated (code, accept→2 friends, persists); SIGNED OFF                    |
| P12  | Events                            | ✅ done             | e2e validated (approve→lineup promotion persists; new request); SIGNED OFF      |

## ⚠️ CORRECTION (2026-07-02, user review) — "complete" was PREMATURE

User reviewed and found real gaps/regressions I missed by over-pivoting away from screen fidelity:

- **Double nav** (top hamburger + bottom bar both showing on mobile) — MY regression (added bottom
  nav, left MobileDrawer/hamburger). ✅ FIXED: removed MobileDrawer + hamburger from ModernLayout/
  MobileHeader (nav now bottom-bar only; header keeps brand + bell).
- **Events not in Calendar** — Events should be on the Calendar page (green) + a **create-event
  button**; currently only under More. TODO.
- **Song cards not color-coded by tuning** — SongsPage renders its OWN cards (does NOT use the shared
  SongListItem which has the tuning warmth-spine); tuning shows as uncolored text. Regression/gap. TODO.
- **Date/time pickers** — design revamped them (dark popovers, 15-min slot scroller, month calendar,
  type-to-edit); real app pickers may not match. TODO — audit.
- **Comprehensive screen-by-screen audit** (real vs design app) requested → RUNNING via Playwright
  sub-agent (both apps, mobile). Will produce a deviation report + prioritized fix list.
- Lesson: my "app already in the design language, re-skins low-value" call was wrong — real fidelity
  gaps exist. Re-opening the screen-fidelity work.

### 2026-07-02 — Design-fidelity audit + fixes (post user review)

- **Audit** (Playwright, real vs design app, both mobile): saved to `2026-07-02T15:00_design-fidelity-audit.md`
  - screenshots in scratchpad. Confirmed user's reports + found more (dashboard, link glyphs, event
    console casting, More menu).
- **Fixes done this pass (validating):**
  1. ✅ Double nav — removed MobileDrawer + hamburger (ModernLayout/MobileHeader); bottom-nav only.
  2. ✅ Songs tuning color — SongsPage `SongRow` + `SongCard` now render the colored warmth spine
     (border-left) + colored tuning text via `tuningColor()` (Palette A, matches SongListItem/detail).
  3. ✅ Date picker native→custom — `DatePicker` autoEdit (new mode) was rendering a native
     `<input type="date">`; now opens the custom dark calendar popover instead. (TimePickerDropdown
     was already custom; audit's "native time" was a misread of the `type="time"` prop.)
  4. ✅ Events on Calendar — CalendarPage aggregates events (green) + an "Events" filter chip.
  5. ✅ Calendar "New" create menu (New event / New show / New practice) + EventsPage "+ New".
  6. ✅ Create-event flow — `EventService.createEvent` + `EventCreatePage` (/events/new, uses custom
     DatePicker) → creates event + host participant → navigates to detail.
- Validation: type-check ✅ eslint ✅ quick 275/275 build ✅. **Unbiased MCP sub-agent: all 6 checks
  PASS** — no double-nav; Songs border-left 3px + tuning text colored (Standard blue rgb96,165,250 /
  Drop D orange); /shows/new + /events/new have 0 native `input[type=date]` (custom dark calendar);
  Calendar has Events filter + green "Backyard Summer Jam" row + New menu; create-event ("Test Party")
  persists + aggregates onto Calendar. (Console "not defined" msgs were transient HMR artifacts —
  don't reproduce on clean load; production build passes.)
- `SessionForm.tsx` (native datetime-local, light-themed) is **orphaned/dead code** (imported nowhere)
  — left as-is per surgical rules; not a live picker.
- **Still open (from audit, need user greenlight on scope):** event host console casting (parts/roles/
  cast avatars/People/Access — big; casting was "shelved" in main app), Songs list link glyphs on
  mobile, Home dashboard enrichment (activity feed/4th stat/embedded setlist/invite card), More menu
  (band card/account/help/version), SessionForm datetime-local → custom pickers, Calendar row richness.

## (superseded) earlier GOAL note — 3 DB features implemented LOCAL + validated end-to-end

- **Notifications, Friends, Events**: migrations applied via `supabase db reset` (LOCAL only, nothing
  pushed/remote), pgTAP green (full suite PASS), seeded demo data, UI wired + reachable, each
  validated end-to-end by an unbiased Playwright sub-agent (all PASS).
- Full app suite **823/823**, build ✅, type-check ✅, eslint ✅, lint:migrations ✅.
- Nothing committed or pushed — held for user review (50 files changed on the feature branch).

### How to test end-to-end (local dev is running: Vite :5173 + Supabase)

Log in as **eric@testband.demo / test123** (Demo Band). Seeded to exercise everything:

- **Notifications**: header bell shows unread **2** → open → feed (4 items) + "What's new v0.4.0";
  Mark all read persists. (Desktop: sidebar "Notifications".)
- **Friends** (More → Friends): your code **GTAR2345**; 1 friend (Sarah); 1 incoming request from
  Mike → Accept → 2 friends (persists). Add-by-code: try **BASS6789**/**DRMS4567**. Discoverable toggle.
- **Events** (More → Events): "Backyard Summer Jam" → lineup (Mr. Brightside) + pending request from
  Mike (Seven Nation Army) → **Approve → it joins the lineup**. Request-a-song form adds a new pending
  request (host can approve own).

### Known items to flag for the user (not blockers)

- Song-request POLICY enforcement (everyone/friends_of_friends/code_only) deferred; friend-request
  policy likewise (any authed user can send). Both are documented refinements.
- Friend/event RPC+trigger used instead of edge functions (simpler, fully local; documented).
- Non-discoverable request senders would show "Someone" (RLS profile visibility) — demo users are
  discoverable so fine.
- Transient **session-invalid redirect** can drop a mid-action write (pre-existing auth re-check
  behavior, seen by 2 validators) — not introduced here, but a rough UX edge worth watching.
- Deferred UI: events on the Calendar (green), create-event flow, RSVP UI, QR block, guest harness.
- No realtime subscriptions on the new feeds yet (refetch on nav) — can add RealtimeManager channels.
- Optional: persistent login-based E2E specs for the 3 features (validated via MCP this session).

### Orchestration note

Used sub-agents for all end-to-end validation (unbiased). Authored migrations/services/UI directly:
the first DB sub-agent died at 0 tool-uses, and CLAUDE.md warns sub-agents can't reliably persist
files — so critical-path authoring was done in-loop, with sub-agents gating each step.

## CASTING (2026-07-02): design-first — approved feature to build the "bones" for a pro/director tier

- Requirements (user): casting = **metadata on any setlist** (setlists are per-event); **band-wide
  history** (who was cast on song X across past sets); flexible; **security-first**; pro/director feature.
- Research done (3 probes): prototype casting model (roles=instrument spine; per-song role→member;
  event overlay adds "hands"/volunteers); setlist model (**anchor on SetlistItem.id, NOT songId**;
  items are JSONB → casting slot ref is SOFT, no FK; shows/events fork own setlist rows); existing
  casting subsystem is **dead code w/ 6 fatal defects** (enum drift ×3, broken Dexie index, numeric
  vs UUID ids, local-only/never-synced, **RLS enabled w/ ZERO policies**). → build FRESH clean model.
- **Design doc:** `2026-07-02T22:49_casting-design.md` — one flat `casting_assignments` table
  (context setlist|event, slot_id soft-ref, band_id+song_id for history, role enum + other/label,
  member+snapshot, is_primary, occurred_on); RLS (view=band member/event participant, write=band
  admin/event host+cohost); Supabase-only+Realtime; pro-tier gated in service not RLS. 14 edge cases
  - 6 open decisions for user.
- **Validation loops DONE (2 adversarial reviews):**
  - SECURITY: v1 draft was FORGEABLE (band admin could write casting vs another band's setlist/songs).
    Fixed in design: bind band_id↔context_id↔song_id in WITH CHECK via 2 SECURITY DEFINER helpers;
    4 separate policies (UPDATE needs own WITH CHECK; no FOR ALL); constrain member_id to band/event;
    pin created_by. Helpers is_band_member/is_band_admin already exist (enforce status='active'). Trap:
    songs' band lives in context_id::text.
  - FLEXIBILITY: P0 gap = no "required roles" → "N/M cast"/open slots unbuildable (fix: band default
    lineup v1 + per-slot override v2). Also: one canonical context per performance (else history double-
    counts); roles as DATA (band_roles ref table) not enum (kills drift bug class); song_id=snapshot,
    live slot=source of truth; occurred_on via context join not stored; count DISTINCT primary roles.
- Design revised → `2026-07-02T22:49_casting-design.md` (v1 draft + v2 validation + provisional defaults).
- **HELD for user decisions** (asked 4 ⭐ questions; user away): roles model (ref table vs enum), v1
  scope (bones), multi-player (primary+backups), history placement. Provisional defaults recorded.
  NOT building until user confirms — this is the "be deliberate" feature they flagged. Original goal
  (3 DB features + fidelity fixes) is DONE + validated; casting is a new, decision-laden thread.

## SOCIAL EVENTS + FRIENDS INTEGRATION (2026-07-03) — planned, HELD for user direction

- User insight: events are USER-hosted (not band-tied); guests (incl. lightweight/non-band accounts)
  volunteer to play parts. Casting currently only offers band members; Friends is standalone.
- Verified: **DB already supports it** (events.band_id nullable; casting scopes to is_event_participant,
  NOT band membership). Gap is UI/service bias (SongCastPanel uses useBandMembers; roles from band_roles;
  no invite/volunteer flow) + Friends not wired to events.
- Plan: `2026-07-03T07:00_social-events-plan.md`. Pieces A–E; provisional = "core first" (A+B+C:
  cast participants + band-less roles + invite friends) then D+E (volunteer + guest accounts, security
  pass first). Asked user 2 ⭐ questions (order; guest-account model) — user away → HELD (security-
  sensitive guest RLS deserves confirmation; casting v1 already committed+pushed as a clean checkpoint).
- Ready to execute A+B on confirmation.

## CASTING v1 BUILD (2026-07-03) — user approved "go with recommendations" + committed/pushed prior work

- Prior session work COMMITTED + PUSHED: `ad35cd5` on feature/events-friends-and-ui-oh-my (token system,
  nav, Home/Calendar, Notifications/Friends/Events, fidelity fixes). Clean tree, ER-diagram check passed.
- **Casting DB**: `20260703045901_casting.sql` — `band_roles` (per-band role vocab, seeded default lineup
  via trigger + backfill) + `casting_assignments` (flat: context setlist|event, polymorphic slot
  [setlist_item_id soft / event_lineup_item_id FK], band_id+song_id history snapshot, role_key→band_roles,
  member+snapshot, is_primary/confidence/arrangement). 4 hardened RLS policies + 2 binding helpers
  (casting_setlist/event_ctx_ok) that bind band↔context↔song (block cross-band forgery). pgTAP
  `017-casting.test.sql` (23, incl. functional security: forged inserts rejected).
  - **2 adversarial security reviews** (design + as-written migration): as-written = CLEAN (no forgery,
    leak, injection, recursion, SELECT-widening). Applied 1 fix: UPDATE no longer pins created_by (lets
    co-directors edit each other's rows; still fully bound). db reset ✅ pgTAP full PASS ✅ lint:migrations ✅.
- **Casting app**: `models/Casting.ts`, `services/CastingAssignmentService.ts` (named to avoid the legacy
  dead `CastingService` — getBandRoles/getCasting/assign/unassign/update/getSongHistory), `hooks/useCasting.ts`,
  `components/casting/SongCastPanel.tsx` (role slots, open/assign/remove, N/M progress, "previously cast"
  history). Wired into EventDetailPage (per-lineup "Cast" toggle). Added Event.bandId.
- type-check ✅ eslint ✅ quick 275/275. E2E (host assigns members → N/M updates → persists → remove) via
  sub-agent — running. Then commit + push casting.
- Deferred to v2 (per plan): Grid view, per-slot required-roles override, capability suggestions, setlist
  casting surface (SetlistViewPage), Song-detail history display, completion snapshot.

## 2026-07-03 — Desktop sidebar ↔ mobile-nav IA consistency (user /loop: "ensure sidebar consistent with mobile grouping")

- **Gap found:** desktop `Sidebar` was MISSING **Events** and **Friends** entirely (present in mobile
  More hub + design's desktop sidebar `Home/Songs/Setlists/Events/Schedule/Friends`). Also a flat list
  with no grouping — didn't mirror the mobile bottom-nav's Primary + "More" structure.
- **Fix (`src/components/layout/Sidebar.tsx`):** split nav into a **primary** group (Home · Songs ·
  Setlists · Calendar · Shows · Practices — the 4 tabs + Calendar's time-axis children as desktop
  superset) and a labeled **MORE** group (Jam · Band Members · Events · Friends) that expands the
  mobile More hub inline. Icons match `MorePage` (Radio/Users/PartyPopper/UserPlus) for cross-surface
  consistency. Factored a `renderNavItem` helper (no markup dup). Kept existing hex styling (surgical).
- **Friends badge:** added `useIncomingRequestCount()` to `useFriends.ts` (lightweight, refetch-on-route,
  mirrors `useUnreadCount`) → blue count pill on Friends row.
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. Playwright (login eric@testband.demo, 1280px):
  sidebar renders MORE group + Events(PartyPopper)/Friends(badge **1**)/Notifications(badge **2**);
  Events link → /events + active highlight. Screenshot `sidebar-desktop.png`.
- **Deferred/flagged:** design §9 removed the Events row from mobile More (Events lives in Calendar);
  our app keeps it in More AND Calendar (2 entry points, non-regressive) — left as-is. The signup
  auth-flow branch (band-code / event-code / new-band / personal-account — user's plan answer) is
  decision-laden + security-sensitive → NOT auto-built; needs a design pass with the user.

## 2026-07-03 — Mobile More page fidelity port (design `MoreScreen` → our `MorePage`)

- **Gap:** our `MorePage` was a flat card list (Jam/Band/Events/Friends/Settings/SignOut); design's More is
  much richer — band identity card, Account card, grouped **Account / Features / App** sections (Eyebrow
  labels), Help & feedback, version footer.
- **Rebuilt `src/pages/MorePage.tsx`** to mirror the design with REAL data (no mock filler):
  - Band identity card (accent gradient, band icon, `currentBand.name` + `description` tagline, member
    avatar stack via `useBandMembers(currentBandId)`, "N members", "Manage band →" → /band-members).
  - **Account** card: user avatar + `displayName`/name + `roleLabel` · in band → /settings (no /profile
    route exists, so linked to settings honestly).
  - **Features** group: Jam Sessions · Events · Friends · Band Members (icons match sidebar More group).
  - **App** group: Settings · Help & feedback (themed toast, no dead button) · Sign out (danger).
  - Version footer `Rock On · v0.3.3`. Reused `Avatar` + `Eyebrow` primitives; tokens throughout.
  - Fixed 2 non-existent tokens mid-build (`accent-deep`, `stage-black`→surface) → solid `bg-accent` +
    `text-white` band tile, matching the sidebar brand convention.
- Preserved `more-page` testid (only one referenced by e2e). Validated: type-check ✅ eslint ✅ quick
  275/275 ✅. Playwright (390px, logged in): renders all sections + avatars (EJ/MT/SC) + tagline + footer,
  0 console errors; band-card→/band-members and account→/settings confirmed. Screenshot `more-mobile.png`.
- Note: design moved Events out of More (into Calendar); we keep Events in More AND Calendar (2 entry
  points, non-regressive per user's "avoid major regression").

## 2026-07-03 — Calendar agenda-card fidelity (design `AgendaCard` → our `CalendarPage` Row)

- **Gap:** our Calendar Row was flat (thin color bar + title + one meta line). Design's `AgendaCard` has a
  **date-tile badge**, a **kind eyebrow** (icon + SHOW/PRACTICE/EVENT, "· Hosting" for hosted events),
  and a **countdown** — none of which we had.
- **`src/pages/CalendarPage.tsx` Row → AgendaCard:** left **date tile** (mono month + bold day, tinted by
  kind color via `color-mix`), **kind eyebrow** (icon + label colored accent/info/success, "· Hosting"
  when `event.hostUserId === currentUser.id`), **countdown** top-right, left 3px accent border. KEPT our
  status Badge in the meta row (time · place · status) — no regression on info our version surfaced well.
  Added `kindLabel`/`icon`/`isHosting` to `AgendaItem`; pulled `currentUser` for host detection.
- **DRY:** extracted HomePage's local `countdown()` → shared `formatCountdown()` in `dateHelpers.ts`
  (Today/Tomorrow/In N days/Nd ago); HomePage now imports it (pure refactor, identical output).
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. Playwright (390px): date tiles toned by kind
  (JUL/4 orange show, JUL/13 green event, JUN/27 blue practice), "EVENT · HOSTING" renders on Backyard
  Summer Jam (Eric=host), countdowns correct (Tomorrow / In 10 days / 6d ago), status badges intact,
  0 console errors. Screenshot `calendar-mobile.png`. No e2e testid deps on changed rows.

## 2026-07-03 — Band Members page: safe consistency fixes (NOT a re-skin — page is richer than design)

- **Assessment:** our `BandMembersPage` (1470 lines: role mgmt, transfer-ownership, invite/regenerate codes,
  instrument editor w/ custom instruments, desktop table + mobile cards, search) is FAR more complete than
  the design's simple `BandScreen`. This is the user's "well thought out in our version, don't regress" case
  → did NOT re-skin toward the (simpler) design. Made two safe, additive fixes only:
  1. **Avatar consistency (real cross-screen bug):** page hand-rolled avatar `<div>`s via a local
     `getAvatarColor(userId)` using a DIFFERENT palette/algorithm than the shared `Avatar`/`generateAvatarColor`
     — so the same person showed different colors on More vs Band. Migrated all 3 avatar sites (table/mobile/
     detail) to the shared `Avatar` primitive (seeded by name, matching MorePage). Removed orphaned
     `getAvatarColor` + `avatarColor` field. Now EJ=green/MT=pink/SC=purple on BOTH screens.
  2. **Non-restrictive instrument framing (design detail):** added the design's info callout to the Edit
     Instruments modal — "Just a preference — nobody's locked in. Anyone can jump on any part; this only helps
     suggest players when casting a song. ★ = go-to." Ties instruments→casting-suggestions per design intent.
- No role/permission/modal LOGIC touched. Validated: type-check ✅ eslint ✅ (only pre-existing db-write
  warning on L299) quick 275/275 ✅. Playwright: avatars match More-page colors, framing note renders as
  accent callout in editor, 0 console errors. Screenshots `band-mobile.png`, `band-instrument-editor.png`.
- **Flagged (deferred, too big/risky to auto-do):** this page is still entirely in the OLD hex palette
  (`#1a1a1a/#2a2a2a/#f17827/#707070`...) not tokens — a full tokenization is a large diff w/ regression
  surface on a critical page; needs a careful dedicated pass.

## 2026-07-03 — Friends page: surface Sent requests + friend-code QR (design `FriendsHome` gaps)

- Compared our `FriendsPage` (already tokenized/clean) to design `FriendsHome`. Two real, safe, non-mock gaps:
  1. **Sent (outgoing) requests were never rendered** — `useFriends` already returns `outgoing`, but the page
     only showed incoming. Added a "Sent (N)" section (avatar + name + "Pending" chip, read-only — no cancel
     method exists server-side, so didn't fake one). Zero new backend; pure data-surfacing gap fix.
  2. **Friend-code QR** — added a "Show QR" toggle in the code card rendering a lazy `qrcode.react` QR that
     encodes a `${origin}/friends?code=<code>` deep link; added a `?code=` prefill effect so scanning →
     lands on Friends with the add-a-friend input filled. End-to-end (scan → prefilled → Send), not a mock.
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. Playwright: QR renders + encodes deep link
  ("Scan to add GTAR2345"); `/friends?code=zzz9876` prefills input "ZZZ9876"; 0 console errors. Screenshot
  `friends-qr.png`. No e2e testid deps.
- **Flagged (deferred):** design's "Who can send you requests" (everyone/friends-of-friends/code-only)
  segmented control — the `policy` field EXISTS on user_profiles + in `MyFriendProfile`, but there's no
  `setPolicy` service method AND enforcement is deferred (RLS doesn't gate on it yet). A UI control would be
  non-enforcing → didn't add a fake toggle. Also deferred: people-finder/search (needs a search-discoverable
  service method) + inline-collapse of the visibility card (pure UX, no new function).

## 2026-07-03 — Notifications: segmented filter + Recent/Earlier grouping (design `NotificationCenter`)

- Our `NotificationsPage` (already clean/tokenized: What's-new card, typed rows, mark-all, dismiss) lacked the
  design's two presentation features. Added both (pure client-side over existing data, no backend):
  1. **Segmented All / Updates / Activity filter** — Updates = `kind==='release'`, Activity = activity/event/
     friend; What's-new card hidden on Activity. Mirrors CalendarPage's segmented-control style.
  2. **Recent / Earlier grouping** — splits the filtered feed at 24h, each under an Eyebrow label.
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. Playwright (login eric): All=4 rows + What's-new;
  Activity=3 rows, card hidden; Updates=1 release row; Recent(Sarah/Mike)/Earlier(release/setlist) groups
  render; 0 console errors. Screenshot `notifications.png`. Preserved all testids (persistent-layout e2e ok);
  added `notifications-tab-*`.
- Deferred (design has, needs model/data): per-row inline actions (Accept/Review) + actor avatars on activity
  rows (notification model has no actor avatar) + WelcomeBackCard digest + WhatsNewSheet one-time spotlight.

## 2026-07-03 — Songs audit (no change) + Events list grouped Hosting/Invited

- **Songs page audited** vs design (mobile link glyphs was an open audit item): `LinkIcons` already renders
  icon-only glyph buttons (brand-colored) in both `SongRow` (desktop) + `SongCard` (mobile), tuning warmth
  spine present, colored meta. **No defect** — the earlier tuning-spine pass addressed it; demo songs just
  have few/no reference links. Left as-is (no change). (Deferred nit: mobile card prefixes "Links:" vs the
  design's bare glyphs — cosmetic, not worth a touch.)
- **EventsPage → Hosting / Invited grouping:** the flat list didn't reflect the user-hosted event model
  ("you host some, you're a guest at others" — the plan's core insight). Split `events` by
  `hostUserId === currentUser.id` into **Hosting (N)** / **Invited (N)** Eyebrow-labeled sections (each
  hidden when empty). Consistent with the Calendar card's "· Hosting" treatment. Extracted a reusable
  `EventCard`. Pure presentation over existing data — no new queries, no logic change.
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. Playwright (login eric): "HOSTING (1)" = Backyard
  Summer Jam (Eric hosts), Invited section correctly hidden (no guest events); 0 console errors. Screenshot
  `events-grouped.png`. Preserved `events-list` testid; added `events-hosting`/`events-invited`.
- Deferred (needs data our model lacks): event-type filter (All/Gigs/Open jams/Parties — no `type` column)
  - per-card cast-progress/coming counts (needs lineup+casting joins on the list query).

## 2026-07-03 — Desktop content-width consistency (mobile-first nav pages were stretching)

- **Found (desktop audit, 1440px):** the mobile-first single-column nav pages (Home/Calendar/More/Events/
  Friends/Notifications) had NO max-width, so in the wide desktop content area (`ModernLayout` wrapper is
  just `p-6 md:p-8 lg:p-10`, no cap) their cards stretched to ~1100px — awkward, phone-content-blown-up look.
- **Fix:** added a uniform `max-w-3xl` (768px) to those six nav-page root divs → they read as a consistent
  left-anchored content column on desktop. **No-op on mobile** (verified: /more is 342px on a 390px viewport).
  Left the table/grid pages (Songs/Setlists/Band/Shows/Practices) alone — they have their own responsive
  full-width layouts designed for the width.
- Rationale for per-page (not a global layout cap): a single layout max-width can't serve both narrow card
  lists AND the wide desktop data-tables; opt-in on the narrow pages is surgical + zero table-regression risk.
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. Playwright: /more desktop now capped/column (screenshot
  `more-desktop-capped.png` vs before `more-desktop-wide.png`); mobile width unchanged; 0 console errors.
  All page testids preserved (only added a className).

## 2026-07-03 — Desktop verification sweep + EventDetail width cap

- **Desktop verification (1440px)** of the cumulative work: sidebar (restructured MORE group + Friends/
  Notifications badges) + capped-width nav pages read as ONE consistent system. Spot-checked Calendar
  (agenda date-tiles + "EVENT · HOSTING" + countdowns), More, EventDetail — all cohesive, 0 console errors.
  Screenshots: `calendar-desktop.png`, `event-detail-desktop.png`.
- **EventDetailPage:** added `max-w-3xl` (was uncapped → stretched on desktop like the nav pages did).
  Now consistent with list→detail navigation (both capped). Page was already clean/tokenized/functional
  (lineup + cast toggle + requests approve-reject + request form) — no logic touched.
- **SetlistsPage: left as-is** — large complex builder (@dnd-kit drag-drop, predates tokenization); like
  BandMembersPage it's richer than any design screen → not safe to re-skin autonomously. Flagged for a
  careful dedicated pass.
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. Observed (pre-existing, not new): an event request
  shows requester as "Someone" — the known non-discoverable-requester RLS fallback (documented under P11/P12).

## 2026-07-03 — Alignment verification + LOOP PAUSED (safe consistency surface complete)

- **Shows/Practices audited:** already `max-w-6xl mx-auto` (own width caps + 2-col grids) — did NOT need my
  earlier nav-page fix. Uses old hexes (85/31 occurrences) = tokenization tech debt, but layout is fine.
- **Alignment decision (explored + reverted):** tried adding `mx-auto` to the 7 nav/detail pages to match
  Shows/Practices' centering — but verified visually it's WORSE: Shows' `max-w-6xl` nearly fills the width
  so its content sits ~near-left (~24px margin), whereas centering a narrow `max-w-3xl` pushes content to a
  ~216px indent → a DIFFERENT left-edge origin, so nav↔grid navigation would jump. **Reverted to left-aligned
  `max-w-3xl`** (consistent left origin with Shows/Practices on ≤1440 screens). Net code change this
  iteration: none (explore→revert); value = locked in the correct alignment + confirmed Shows/Practices are fine.
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅.

### ⏸ LOOP PAUSED — safe consistency surface is DONE; remaining work needs user direction

**Shipped this loop (12 files, +826/−243, ALL local/uncommitted, held for review):**

1. Sidebar restructured → mirrors mobile nav (primary + MORE group; added missing Events/Friends; live badges).
2. More page → design-fidelity port (band card, Account, Features/App groups, version footer).
3. Calendar → design AgendaCard (date tiles, kind eyebrows, "· Hosting", countdowns); shared `formatCountdown`.
4. Band Members → avatar cross-screen consistency (shared primitive) + non-restrictive instrument framing.
5. Friends → surfaced Sent requests + friend-code QR w/ `?code=` deep-link prefill.
6. Notifications → segmented All/Updates/Activity filter + Recent/Earlier grouping.
7. Events list → Hosting/Invited grouping (+ EventDetail width cap).
8. Desktop content-width fix → uniform `max-w-3xl` on the 6 nav pages (was stretching).
9. Songs audited (healthy, no change); Shows/Practices audited (fine).

**Remaining = NOT safe to auto-do (needs your input):**

- **Social-events feature** (the plan's answered Qs): signup auth-flow (band-code/event-code/new-band/personal
  account), volunteering ("raise hand" → host casts from volunteers), free-text-name casting for non-app guests.
  All decision-laden + schema-touching → HELD for a design pass with you.
- **Large re-skins:** SetlistsPage + BandMembersPage full tokenization (old hex palette) — big diffs, regression
  risk on critical pages; want a dedicated careful pass, not an autonomous loop tick.
- **EventDetail tabs / cast-progress rollup, Friends policy control, people-finder** — need model/data work.

## 2026-07-03 — SOCIAL EVENTS A+B (+ free-text casting) — user said "press forward" ✅ LOCAL

**Un-biased casting from band-members → event PARTICIPANTS, + band-less roles + free-text names.**
Key discovery: the casting DB already supported the whole vision (casting_insert/update authorize
`is_event_participant` + allow `member_id IS NULL`); the bias was purely UI (SongCastPanel used
`useBandMembers`). So this was mostly UI + ONE RLS visibility policy.

- **Migration `20260703164738_social_events.sql`** (piece A's stated need): `are_event_coparticipants()`
  SECURITY DEFINER helper (owner postgres) + `users_select_event_coparticipant` +
  `user_profiles_select_event_coparticipant` SELECT policies — mirrors the proven jam co-participant
  pattern so a host can resolve GUEST names in the cast picker. (Security surface identical to the existing
  jam policy; documented in-file.) db reset ✅ · lint:migrations ✅ · pgTAP: updated `006-rls-policies`
  (users 5→6, user_profiles 6→7, +2 existence checks, plan 116→118) → **full suite PASS (840 tests)**.
- **App:** `DEFAULT_LINEUP` const (band-less roles, mirrors seed_band_roles) + `EventParticipant` model;
  `EventService.getParticipants()`; `useEventParticipants` hook; `useCasting` falls back to DEFAULT_LINEUP
  when band-less (piece B); **`SongCastPanel`** now sources the pool by context (event→participants,
  setlist→band members) + a **free-text "Or type a name…"** input (piece D: cast someone not on the app →
  `member_id NULL`, `member_name` snapshot).
- Validated: type-check ✅ eslint ✅ quick 275/275 ✅. **E2E (Playwright, host=eric on Backyard Summer Jam):**
  cast picker lists PARTICIPANTS (Eric/Mike/Sarah, names resolved via new RLS) + free-text; cast Mike →
  Lead Vocals AND free-text "Bob (sax, walk-in)" → Guitar; **both persist across reload** (2/5 parts cast),
  0 console errors. Screenshot `event-casting-participants.png`.
- **LOCAL only** (migration NOT pushed to remote; nothing committed) — held for review per pattern.
- **Next (plan order):** C = invite friends/guests to an event (multi-select + share code/link + QR → RSVP,
  wiring Friends↔Events). Then D-proper (volunteering "raise hand" queue) + E (lightweight guest accounts +
  the signup auth-flow: band-code/event-code/new-band/personal — the security-sensitive one).

## 2026-07-03 — Pushed to branch + band-less user flow DESIGNED (build held for user confirm)

- **Pushed** the design-consistency pass + social-events A+B to `feature/events-friends-and-ui-oh-my`
  (`e2931c0`, was `8c59292`) at user request — for a design-app comparison. Pre-commit hooks (eslint/
  prettier/ER-diagram) passed.
- **Band-less (personal & guest) user flow — DESIGN doc:** `2026-07-03T17:04_bandless-user-flow-plan.md`.
  Core finding: the app is band-mandatory because `useAuthCheck` treats _no band_ as an auth failure
  (redirect → get-started). The fix is to make "has a band" a CAPABILITY, not an auth gate. Signup gains a
  4-way "how do you want to start?" chooser (band code / event code / new band / personal). Reconciled
  "event code at signup" with "no unlisted guests" (guests get real minimal accounts, not anon links).
  Flagged the sharp security edge: an event-code join needs a `resolve_event_code` SECURITY DEFINER RPC
  (non-participant reads an event by code) — Phase 2, security-review first.
- Provisional decisions (user away on the 3 AskUserQuestion forks): band-only nav = show-with-prompt;
  personal songs = yes; scope = core-first (phased). **HOLD Phase-1 build** (auth-gate flip is high-stakes,
  affects all users' login) until user confirms — design doc ready for review.

## 2026-07-03 — BAND-LESS USER FLOW Phase 1 ✅ (user "go ahead and proceed") — LOCAL, held for review

Made "has a band" a **capability, not an auth gate** + added the personal-account signup path.

- **Gate flip:** `useAuthCheck` — removed the `!bandId → isAuthenticated:false ('no-band')` branch;
  now returns `isAuthenticated: true, hasBand: !!bandId`. `ProtectedLayoutRoute` — removed the
  `no-band → /auth?view=get-started` redirect. **Verified safe:** AuthContext auto-selects a band
  user's first band on login (AuthContext L518-523), so band users are unaffected; only zero-membership
  users land band-less.
- **Signup chooser:** GetStartedPage gains a "Continue with a personal account →"
  (`personal-account-button`) that lands the user in the app with no band. (Create/Join band unchanged;
  **event-code join deferred to Phase 2** — needs the `resolve_event_code` RPC.)
- **Band-less layout:** Sidebar header → "Personal account" + "Create or join a band →"
  (`sidebar-create-band`) when `!currentBandId`; MorePage band card → "Create or join a band" CTA
  (→ /get-started); fixed band-aware copy (Home subtitle, More account row).
- **Validated (Playwright, local):** (1) REGRESSION — eric (band user) logs in → "Demo Band",
  currentBandId set, Home renders. (2) NEW — signed up fresh personal account (Priya) → chose personal
  account → lands on `/` band-less (currentBandId null), sidebar "Personal account", 0 console errors;
  swept Songs/Setlists/Shows/Practices/BandMembers/Events/Friends/Calendar/More — **none crash**.
- **Tests updated** (behavior intentionally changed): `useAuthCheck.test` no-band scenario → now asserts
  authenticated+hasBand=false; `ProtectedLayoutRoute.test` → band-less renders app (not redirect); e2e
  `protected-routes` "user without band" → now asserts personal account reaches /songs. type-check ✅
  eslint ✅ quick **275/275** ✅.
- **Phase 2 next:** event-code join (`resolve_event_code` SECURITY DEFINER RPC — security review first) +
  band-only "join or create a band" empty states (Setlists/Shows/Practices) + hide band-only Home quick
  actions when band-less. Committed LOCAL; NOT pushed (auth change — held for review).

## GOAL (2026-07-02): implement approved DB changes in LOCAL dev + finalize UI for end-to-end testing

- Orchestrate via sub-agents; verify each file lands on disk; validate each step.
- **LOCAL ONLY** — no `--linked`/remote/`db push`, no git push.
- Defaults for the 3 ⭐ decisions (single-row friendships, 4 event tiers, author-declared source).
- Order: Notifications → Friends → Events. Each = migration+pgTAP → model/service/repo/realtime
  → UI wiring → validate (db reset + test:db + lint:migrations + type-check + e2e).
- End state: user can sign up locally and exercise notifications, friends, and events (incl. the
  event song-request → host-approve flow) end-to-end.
  | P1 | T006–T009 primitives | pending | |
  | P2 | T010–T013 nav/shell | pending | |
  | P3–P9 | screen re-skins | pending | each carries parity checklist |
  | P10 | Notifications | pending | DB |
  | P11 | Friends | pending | DB |
  | P12 | Events | pending | DB |

## ⏸ STOPPED HERE — checkpoint for user review (2026-07-02)

**Shipped & validated this session (all local, NOTHING pushed to git):**

- P0 tokens · P1 primitives · P2 nav/shell (e2e 12/12) · P9a Home dashboard (e2e 13/13) ·
  P9b Calendar aggregator (e2e 13/13). type-check + eslint clean throughout; quick unit suite 275 + 10 new.

**Why paused here (not a failure — a decision boundary):**

- All remaining backlog = the DB tier (P10 Notifications, P11 Friends, P12 Events).
- These need schema sign-off (asked user twice via AskUserQuestion; user was away both times).
- Higher-stakes (migrations + RLS); user said don't push / review before remote.
- Best started fresh (context) with user's confirmation on the research §7 schema proposal.

**To resume (recommended order):** P10 Notifications → P11 Friends → P12 Events, each:
migration (LOCAL: db reset + pgTAP + lint:migrations) → model+service+mappers → RealtimeManager
→ edge fns (friends) → wire the already-built stub UI (NotifBell/NotificationsPage/More rows).
Schema proposal ready in `2026-07-02T04:55_research.md` §7. Deferred P3–P8 screen re-skins are
optional token polish (app already visually consistent).

## Log

### 2026-07-02 — P10 Notifications: DB layer ✅ (LOCAL)

- Migration `supabase/migrations/20260702140919_notifications.sql` (notifications + release_notes
  tables, users.last_seen_release_version, indexes, GRANTs both roles, RLS incl. service_role-only
  INSERT, realtime publication). pgTAP `supabase/tests/014-notifications.test.sql` (22 assertions).
- Validated LOCAL: `supabase db reset` clean · `supabase test db` **707/707 PASS** · `lint:migrations` ✅.
- (Sub-agent for this died at 0 tool-uses; authored directly — reliable for critical-path DB.)
- Local seeded test users available for E2E: eric@testband.demo / mike@ / sarah@ (pw test123), Demo Band.
- Next: Notification model + NotificationService + realtime + wire NotificationsPage/bell.

### 2026-07-02 — P10 Notifications: service + UI ✅ (LOCAL)

- `src/models/Notification.ts` (AppNotification/ReleaseNote), `src/services/NotificationService.ts`
  (list/unreadCount/markRead/markAllRead/dismiss/getReleaseNotes — direct Supabase, RLS-scoped, no
  band-sync repo). `src/hooks/useNotifications.ts` (feed hook + `useUnreadCount` for the bell).
- UI: NotificationsPage = real feed (What's-new release card via MarkdownRenderer, typed rows,
  unread dots, per-item dismiss, mark-all-read). Header bell unread badge (mobile) + sidebar
  Notifications row w/ badge (desktop parity).
- Seed: added 2 release_notes + 4 notifications for demo user Eric (2 unread) to seed-mvp-data.sql
  (used E'' strings for markdown newlines). Verified: 4 notifs / 2 releases / eric 2 unread.
- Validation: type-check ✅ eslint ✅ quick suite 275/275. E2E (login as eric, exercise feed/badge/
  mark-all-read) via unbiased MCP sub-agent — running.
- NOTE: no realtime subscription yet (bell refetches on route change). Fine for testing; can add
  RealtimeManager channel later if desired.

### 2026-07-02 — P11 Friends ✅ (LOCAL, DB+app)

- **Deviation from schema doc (documented):** used a SECURITY DEFINER **RPC** (`resolve_friend_code`)
  - **trigger** (`on_friend_request_accepted` writes the canonical friendship row) instead of edge
    functions. Simpler, works fully local, still secure (DEFINER funcs). Friend-request POLICY
    enforcement (everyone/friends_of_friends/code_only) deferred — any authenticated user can send a
    request (RLS: requester=self); noted as a refinement.
- Migration `20260702142222_friends.sql` (user_profiles +discoverable/friend_code/policy, gen_friend_code(),
  friend_requests, friendships canonical, are_friends, resolve_friend_code RPC, accept trigger, RLS,
  grants, realtime). pgTAP `016... no —015-friends.test.sql` (22). Updated `006-rls-policies` for the
  2 new user_profiles policies (count 4→6, +2 existence checks, plan 114→116).
- Seed: demo codes (eric GTAR2345 / mike BASS6789 / sarah DRMS4567), all discoverable; eric↔Sarah
  friendship + Mike→Eric pending request. Verified via SQL + resolve_friend_code RPC.
- App: `models/Friend.ts`, `services/FriendService.ts` (friends/requests/getMyProfile/setDiscoverable/
  sendRequestToCode/accept/decline/unfriend), `hooks/useFriends.ts`, `pages/FriendsPage.tsx` (code+copy,
  discoverable toggle, add-by-code, incoming requests accept/decline, friends list). Route + More row enabled.
- Validated: db reset+seed clean · pgTAP full suite **PASS** · lint:migrations ✅ · type-check ✅ ·
  eslint ✅ · quick 275/275. E2E (accept Mike's request → 2 friends, persist) via sub-agent — running.
- ⚠ KNOWN LIMITATION: a request from a NON-discoverable, non-friend user would show name "Someone"
  (their user_profiles row isn't RLS-readable). Demo users are discoverable so it's fine; general
  fix = a request-party profile policy or denormalized requester name. Noted for later.

### 2026-07-02 — P12 Events ✅ (LOCAL, DB+app)

- Migration `20260702143450_events.sql`: 4 tables (events, event_participants w/ access_tier+rsvp,
  event_lineup_items, event_lineup_requests), is_event_participant/is_event_manager helpers,
  **approve trigger** (request status→approved → SECURITY DEFINER inserts a lineup item + links
  resolved_lineup_item_id — atomic, no edge fn), indexes, grants both roles, RLS (host/participant
  scoped; requests: requester insert if participant, host/cohost approve), realtime. pgTAP
  `016-events.test.sql` (20, incl. functional approve→lineup promotion). Full suite PASS, lint ✅.
- Seed: Eric hosts "Backyard Summer Jam" (unlisted, code JAM4567); Mike+Sarah guests; 1 lineup song
  (Mr. Brightside); 1 PENDING request from Mike (Seven Nation Army) — the demoable approve flow.
- App: models/Event.ts, services/EventService.ts (getEvents/getEvent/getLineup/getPendingRequests/
  addRequest/approveRequest/rejectRequest), hooks/useEvents.ts (list + detail w/ isManager), pages
  EventsPage + EventDetailPage (lineup, pending requests approve/reject for host, request-a-song form).
  Routes /events + /events/:id; More→Events enabled.
- Validated: type-check ✅ eslint ✅ quick 275/275. E2E (approve Mike's request → lands in lineup;
  create a new request) via sub-agent — running.
- Deferred (noted): calendar aggregation of events (green), full create-event UI, guest/host harness,
  RSVP UI, cohost management. Core song-request→approve is the demoable target.

### 2026-07-02 — user feedback round

- **Schema reviewed by user — no objections.** Song-request-during-events is the piece they most
  want to see working before judging (build Events to be exercisable). Full DDL written to
  `2026-07-02T13:44_db-schema-proposal.md`.
- **Notification retention DECIDED: 90 days.** Added a critical invariant to the schema doc: prune
  scoped to `notifications` only; friend REQUESTS live in `friend_requests` and stay on the Friends
  screen indefinitely regardless of notification pruning.
- **NEW: `key` is now OPTIONAL on songs** (so quick song entry — e.g. event sign-up — doesn't force
  a key lookup). UI/model-only — DB `songs.key` was already nullable, NO migration.
  - `Song.key: string → key?: string`; EditSongModal: dropped required-check + asterisk, placeholder
    "Select"→"Optional"; guarded 3 display sites (`song.key || '—'`); `SongList` key-filter `?? ''`.
  - Validation: type-check ✅, eslint ✅, RealtimeManager 30/30, quick suite 275/275, and a new
    e2e `tests/e2e/songs/optional-key.spec.ts` (create song with title+artist only) — **PASS**.

### 2026-07-02 — session start

- Research + plan + tasks complete. Feature activated in features/.
- Decisions: tunings.ts Palette A canonical; desktop sidebar superset; friendships single-row;
  release notes version-gated; Events Supabase-only; auth re-skinned in P0.
- Starting P0 T001.

### 2026-07-02 — P0 token foundation

- Chose **channel-format tokens** (`--x-rgb: R G B` + `rgb(var(--x-rgb)/<alpha-value>)` in
  Tailwind) over plain `var()` because the codebase uses `/opacity` modifiers on named colors
  (~26 spots). Plain var broke the build (`bg-stage-black/95`). Channel format makes every
  utility + opacity modifier work app-wide — the ergonomic base for migrating the hex files.
  Also expose ready `--x` (rgb(var(--x-rgb))) for direct CSS/JS use.
- **T004 resolved with ZERO component edits.** The only visually-divergent orange was
  `#FE4401` (red-orange, rgb 254,68,1), and it was reached exclusively via the Tailwind names
  `energy-orange`/`primary` — remapping those names to the accent in the config unified it.
  The 325 `#f17827` literals are rgb(241,120,39) ≈ the new `#ff7a1a` rgb(255,122,26) —
  visually the same accent already. Tokenizing them → `bg-accent`/`var(--accent)` is deferred
  to each screen's pass (avoids double-touching ~48 files; matches "minimize footprint").
  Net P0 code footprint: index.css, tailwind.config.js, index.html, + new tokens.ts. No
  component files touched.
- build ✅ type-check ✅.
- **P0 validated (unbiased Playwright sub-agent): foundation sound.** Geist loads (first in
  family, woff2 200), `--accent = rgb(255 122 26)`, channel vars correct, `--bg-0 = rgb(10 10 10)`,
  dark theme intact, **0 console errors**, only failed req = `/vite.svg` 404 (pre-existing benign).
  The divergent `#FE4401` regression is ABSENT. Validator flagged (correctly) that auth buttons
  still render `#f17827` via arbitrary `bg-[#…]` classes — this is the DELIBERATE per-screen
  tokenization deferral (single touch per file during each screen pass; #f17827≈#ff7a1a so no
  visible inconsistency meanwhile). **P0 SIGNED OFF.**

### 2026-07-02 — P1 primitives (building the small gaps; reuse the rest)

- Built `Badge` (static semantic, tones from tokens.ts BADGE_TONE), `Eyebrow` (mono label),
  generic `Avatar` (SongAvatar → thin wrapper, API unchanged), and `SlideOutTray position='bottom'`
  bottom-sheet (tokenized its hexes — byte-identical values, 0 visual change).
- Decided NOT to refactor `InlineStatusBadge` to use Badge (surgical: it's an interactive
  dropdown, refactor risks behavior change for little gain). Static Badge stands alone.
- Validation: type-check ✅, eslint ✅ (0/0), Badge+Avatar 10 unit tests ✅, `test:quick` 275/275 ✅.
  P1 primitives not yet wired into screens → visual Playwright validation resumes at P2.
- **P1 SIGNED OFF.**

### 2026-07-02 — P9a Home dashboard (net-new, no DB)

- Replaced the stub HomePage with a real command dashboard: next show + next practice cards
  (countdown, date/time via dateHelpers, venue, status Badge, tap→detail), 3 quick stats
  (songs/setlists/upcoming-shows counts), 4 quick actions (add song / new setlist / schedule
  practice / book show), repertoire link. Data via existing hooks (useUpcomingShows/
  useUpcomingPractices/useSongs/useSetlists) + P1 primitives (Badge, Eyebrow) + tokens. No new
  data layer, no mock/filler (dropped the prototype's mock "activity" feed — no hook backs it).
- Validation: type-check ✅, eslint ✅. Added a home-dashboard e2e assertion; re-running the
  layout spec (real dashboard uses hooks that could throw) via unbiased sub-agent.

### 2026-07-02 — P9b Calendar aggregator (net-new, no DB)

- Replaced the CalendarPage stub with a real unified agenda: merges Shows (accent bar) +
  Practices (info/blue bar) on one time axis, sorted; All/Shows/Practices segmented filter;
  Upcoming + Past groups; status Badges; rows tap→detail; EmptyState with book/schedule CTAs.
  Events will slot in (success/green) when that feature lands. Existing hooks only.
- Updated the layout e2e (removed the old stub's calendar-shows-link dependency → goto('/shows')).
- type-check ✅, eslint ✅. Re-running layout spec via unbiased sub-agent.

### 2026-07-02 — STRATEGY DECISION (user away for both AskUserQuestion prompts)

- **Finding:** ~2000 hardcoded hex literals across src already EXACTLY equal the new token values,
  and 324 `#f17827` ≈ the accent. The existing screens are already in the target dark design
  language (P0 verified). So planned per-screen re-skins P3–P8 are a ~zero-visible-change token
  refactor (big diff, regression risk, low payoff).
- **Decision (best-judgment, revisit when user returns):**
  1. **Defer P3–P8 mechanical re-skins.** Optional maintainability polish, not visible value.
  2. **Prioritize net-new value:** P9 Home + Calendar real content (no DB), then Notifications →
     Friends → Events (DB features — the branch's namesake, explicitly requested).
  3. **DB migrations: LOCAL ONLY, held for review.** Write + `supabase db reset` + pgTAP +
     `lint:migrations` locally; never touch remote/prod; never push. User reviews SQL before remote.
- Rationale ties to user priorities: net-new features are what they asked for; local-only DB
  respects "don't push until I review"; skipping re-skins respects "minimize footprint / less code".

### 2026-07-02 — P2 navigation / shell

- Rewrote orphaned `BottomNavigation` → router-driven (`useLocation`/`useNavigate`), dark tokens,
  5 tabs Home·Songs·Sets·Calendar·More with lucide icons + `match[]` prefixes so child routes
  light the owning tab (Shows/Practices→Calendar; Jam/Band/Settings/Events/Friends→More).
  Dropped the dead `useBottomNavigation` hook (window.history-based, bypassed router, unused).
- Wired into `ModernLayout` mobile-only (`md:hidden`) + `<main> pb-20 md:pb-0`. Tokenized
  layout bg `bg-[#0a0a0a]`→`bg-bg-0` (identical).
- Reconciled desktop `Sidebar` to the IA (added Home + Calendar as a superset) and switched the
  blue brand accent → unified orange (logo + active icon) for look-and-feel consistency. Left the
  syncing pulse/badge blue (semantic).
- Added stub pages HomePage/CalendarPage/MorePage/NotificationsPage (+routes); replaced the
  `/`→`/songs` redirect with HomePage (removed now-unused `Navigate` import). More is a functional
  hub; Events/Friends shown as disabled "coming soon". Header bell (MobileHeader) → /notifications;
  unified its logo accent too.
- E2E: extended `persistent-layout.spec.ts` — added the 4 new pages to the TestId test + a new
  "Mobile Bottom Navigation" describe (tab nav, Calendar→Shows active-state, bell→notifications).
- Validation: type-check ✅, eslint ✅ (0/0). Unbiased sub-agent: layout e2e **11/12 pass**,
  /auth dark + orange (no blue) at mobile+desktop, 0 console errors. The 1 failure was a real
  collision my nav surfaced — the **eruda** mobile debug-console launcher (dev-only, loads on
  localhost:5173) floats bottom-right and intercepted clicks on the rightmost "More" tab at
  390px. **Fix (harness-level):** gate eruda on `!navigator.webdriver` in index.html so it's
  skipped under Playwright — also unblocks all future mobile e2e. Re-running to confirm green.
  (Authed nav/sidebar accent not visually confirmable — no login creds for the MCP browser;
  behavior covered by the e2e spec.)
