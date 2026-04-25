# Rock-On Backlog

Master overview of planned features in the `.claude/backlog/` directory.

**Last Updated:** 2026-04-24
**Total Features:** 12

## Feature Overview

| Feature                                                 | Status                 | Priority | Complexity  | Dependencies             |
| ------------------------------------------------------- | ---------------------- | -------- | ----------- | ------------------------ |
| [ci-cd-pipeline](#ci-cd-pipeline)                       | Research Complete      | High     | High        | None                     |
| [multi-band-support](#multi-band-support)               | Plan Complete          | High     | High        | None                     |
| [account-tiers-and-access](#account-tiers-and-access)   | Research Complete      | High     | High        | multi-band-support       |
| [social-catalog](#social-catalog)                       | Research Complete      | High     | Very High   | account-tiers-and-access |
| [email-infrastructure](#email-infrastructure)           | Research Complete      | Medium   | Low-Medium  | None                     |
| [unified-kebab-menu](#unified-kebab-menu)               | Research Complete      | Medium   | Medium      | None                     |
| [email-invitations](#email-invitations)                 | Research Complete      | Medium   | Medium      | email-infrastructure     |
| [calendar-events](#calendar-events)                     | Specification Complete | Medium   | Medium-High | email-infrastructure     |
| [enhanced-security-testing](#enhanced-security-testing) | Research Complete      | Medium   | Medium      | ci-cd-pipeline           |
| [guitar-tuning-system](#guitar-tuning-system)           | Research Complete      | Medium   | Medium-High | None                     |
| [no-console-eslint-rule](#no-console-eslint-rule)       | Research Complete      | Low      | Medium      | None                     |
| [react-native-app](#react-native-app)                   | Research Complete      | Low      | Very High   | All core features        |

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                      FOUNDATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  ci-cd-pipeline ←── enhanced-security-testing                   │
│  (GitHub Actions)    (SAST scanning, RLS tests)                │
│                                                                 │
│  multi-band-support ←── account-tiers-and-access ←── social-catalog  │
│  (95% exists)           (Free/Pro tiers)          (Personal songs,   │
│                                                    setlists + jams)   │
│                                                                 │
│  email-infrastructure ←── email-invitations                     │
│  (Resend + edge fn       (Band join invites)                    │
│   patterns + email_logs) ←── calendar-events                    │
│                              (.ics for shows & practices)       │
├─────────────────────────────────────────────────────────────────┤
│                     INDEPENDENT FEATURES                        │
├─────────────────────────────────────────────────────────────────┤
│  unified-kebab-menu    guitar-tuning-system                     │
│  (UI consistency)      (Per-string storage                      │
│                         + setlist retuning)                     │
│                                                                 │
│  no-console-eslint-rule                                         │
│  (456 violations to fix)                                        │
├─────────────────────────────────────────────────────────────────┤
│                       FUTURE MILESTONE                          │
├─────────────────────────────────────────────────────────────────┤
│  react-native-app                                               │
│  (Requires all core features stable)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Recommended Implementation Order

### Phase 1: Infrastructure & Quality

1. **ci-cd-pipeline** - Essential for safe deployments
2. **no-console-eslint-rule** - Code quality improvement (can parallel with CI)

### Phase 2: Core Features

3. **multi-band-support** - 95% infrastructure exists, quick win
4. **unified-kebab-menu** - UI consistency before adding more features
5. **email-infrastructure** - Foundation for email-invitations + calendar-events; implement as part of whichever of those ships first
6. **email-invitations** - Enables band growth (builds on email-infrastructure)
7. **calendar-events** - Auto-send .ics calendar invites for shows/practices (also on email-infrastructure; can ship alongside or after email-invitations)

### Phase 3: Security & Business

8. **enhanced-security-testing** - Depends on CI pipeline
9. **account-tiers-and-access** - Depends on multi-band (revenue feature)
10. **social-catalog** - Personal songs + personal setlists + jam sessions (depends on account-tiers for tier gating stub)

### Phase 4: Musician Features

11. **guitar-tuning-system** - Per-string tuning with setlist retuning indicators

### Phase 5: Mobile (Post-1.0)

12. **react-native-app** - Major undertaking, requires stable web app; QR-based jam session joining is high-value on native

---

## Feature Details

### ci-cd-pipeline

**Directory:** `ci-cd-pipeline/`
**Status:** Research Complete
**Priority:** High
**Complexity:** High (20+ hours)

**Summary:** GitHub Actions workflow for automated testing, linting, type checking, and deployment. Includes pre-commit hooks via Husky.

**Key Components:**

- PR validation workflow (lint, type-check, unit tests)
- Deployment workflow (build, deploy to production)
- Pre-commit hooks (lint-staged)
- Database migration safety checks

**Blockers:** None

---

### multi-band-support

**Directory:** `multi-band-support/`
**Status:** Plan Complete (95% infrastructure exists)
**Priority:** High
**Complexity:** High (but mostly UI/UX work)

**Summary:** Allow users to belong to multiple bands and switch between them. Most database infrastructure already exists (band_memberships table, RLS policies).

**Key Components:**

- Band switcher UI in navbar
- CurrentBand context enhancement
- Navigation/routing updates
- IndexedDB partitioning by band

**Blockers:** None - infrastructure largely complete

**Note:** This is a prerequisite for account-tiers-and-access.

---

### account-tiers-and-access

**Directory:** `account-tiers-and-access/`
**Status:** Research Complete
**Priority:** High
**Complexity:** High (30+ hours)

**Summary:** User-based tier system with free and pro tiers. Free tier limited to 1 band, pro tier unlimited. Access codes for promotional/beta access.

**Key Components:**

- User tiers (free/pro) stored in users table
- Access codes system with redemption tracking
- Stripe integration for subscriptions
- Feature gating based on tier
- Admin panel for access code management

**Dependencies:** multi-band-support (users need multi-band before tiers matter)

---

### social-catalog

**Directory:** `social-catalog/`
**Status:** Research Complete
**Priority:** High
**Complexity:** Very High (40–50 hours)

**Summary:** Unified initiative covering personal song catalog, personal setlists, and jam sessions. Users maintain a personal song library independent of any band, can create personal setlists, and can host/join temporary "jam sessions" where participants find common songs via QR code or short hash. Non-authenticated users can view jam session results via a scoped read-only token (onboarding hook). Free users get 1 active jam session; pro users unlimited.

**Key Components:**

- Personal song catalog UI (schema exists, UI does not)
- Personal setlists (requires relaxing `setlists.band_id` to nullable)
- `jam_sessions`, `jam_participants`, `jam_song_matches` new tables
- Multi-tier song matching algorithm (`normalize_text()` SQL function + `normalized_title`/`normalized_artist` columns)
- QR code + short hash invite system
- Supabase Edge Function for unauthenticated read-only jam view
- Public route `/jam/view/:shortCode` outside `ProtectedLayoutRoute`
- `users.account_tier` stub column (default 'free') for future tier gating
- Save jam session as personal setlist (tagged with 'jam')

**Dependencies:** account-tiers-and-access (for `account_tier` column pattern and tier limit constants)

**Schema Changes Required:**

- New tables: `jam_sessions`, `jam_participants`, `jam_song_matches`
- New columns: `songs.normalized_title`, `songs.normalized_artist`, `users.account_tier`, `users.tier_updated_at`, `setlists.context_type`, `setlists.context_id`, `setlists.jam_session_id`, `setlists.tags`
- Breaking change: `setlists.band_id` becomes nullable

---

### unified-kebab-menu

**Directory:** `unified-kebab-menu/`
**Status:** Research Complete
**Priority:** Medium
**Complexity:** Medium (8-12 hours)

**Summary:** Consolidate 5 different kebab menu styling patterns into a single reusable component. Improves UI consistency and mobile usability.

**Key Components:**

- `KebabMenu` component with standardized API
- Migration of 8 component locations
- Proper accessibility (keyboard nav, ARIA)
- Consistent styling across all pages

**Blockers:** None

**Note:** Should be done before adding new features to maintain UI consistency.

---

### email-infrastructure

**Directory:** `email-infrastructure/`
**Status:** Research Complete
**Priority:** Medium
**Complexity:** Low-Medium (6-10 hours standalone, or folds into the first email feature shipped)

**Summary:** Shared email scaffolding — Resend account & domain verification, edge function conventions (`_shared/` helpers for CORS, Resend client, logging, rate limiting), unified `email_logs` table, `user_notification_prefs` table, sending identity setup, and deliverability best practices. Not a standalone "feature" a user sees; it's the substrate both `email-invitations` and `calendar-events` build on.

**Key Components:**

- Resend account setup + `rockon.app` domain verification (SPF/DKIM/DMARC)
- `supabase/functions/_shared/` utilities: `cors.ts`, `email.ts`, `logging.ts`, `rateLimit.ts`
- `email_logs` table — unified across all sending purposes (invitation, event-invite, event-update, event-cancel, welcome, digest)
- `user_notification_prefs` table — per-user opt-out toggles
- Hand-rolled HTML template conventions + plain-text fallback requirement
- List-Unsubscribe header (Gmail/Yahoo Feb 2024 bulk sender compliance)
- In-memory rate limiter for v1; Postgres-backed deferred to v2
- Secrets: `RESEND_API_KEY`, `APP_URL`, `EMAIL_FROM_ADDRESS`

**Blockers:** None

**Note:** This document formalizes the shared infrastructure so whichever of `email-invitations` or `calendar-events` ships first builds it once and the second feature reuses it. If shipping both at once, do this setup as Phase 1 and then the two features' Phase 2+ work runs in parallel.

---

### email-invitations

**Directory:** `email-invitations/`
**Status:** Research Complete
**Priority:** Medium
**Complexity:** Medium (15-20 hours on top of email-infrastructure)

**Summary:** Send email invitations to join bands using Resend service. Replaces current "share join code" workflow with direct email invites. Enhanced `/join?code=xxx` flow that skips the create-band / join-band decision for invited users and sends them directly to a confirmation page.

**Key Components:**

- Resend integration (via shared `email-infrastructure`)
- Invitation tokens with expiration (`nanoid`, 10 chars)
- Email templates for invitations
- `/join?code=xxx` invitation acceptance flow with `sessionStorage`-based code persistence across auth redirects
- Supabase Edge Function `send-invitation` for sending
- `invite_codes` schema additions: `type`, `invited_email`, `email_sent_at`, `email_status`

**Dependencies:** `email-infrastructure` (shared Resend setup + `email_logs` table)

**Blockers:** None

---

### calendar-events

**Directory:** `calendar-events/`
**Status:** Specification Complete
**Priority:** Medium
**Complexity:** Medium-High (3-4 weeks if email-infrastructure is already in place; +1 week from scratch)

**Summary:** Auto-send iCalendar (`.ics`) invites to all band members when a show or practice is created, updated, or cancelled. v1 uses standards-based `.ics` attachments over Resend — works universally across Gmail, Apple Mail, Outlook, Yahoo without per-user OAuth. Native Google Calendar / Microsoft Graph APIs deferred to v2. Calendly / Cal.com availability sharing deferred to v3 (with a recommendation to build native, not integrate third-party).

**Key Components:**

- `send-event-invite` edge function (auth-verified, service_role for cross-member lookups)
- `ical-generator` library for VTIMEZONE-aware `.ics` generation
- Stable UID + incrementing SEQUENCE for update/cancel semantics
- Schema additions to `shows` + `practice_sessions`: `timezone`, `end_time`, `calendar_uid`, `calendar_sequence`
- `user_notification_prefs` toggles for event invites / updates / cancellations (shared with `email-infrastructure`)
- Timezone selector in event create/edit forms (default to creator's browser IANA zone)
- "Calendar invites" admin panel on event detail page showing delivery status per recipient
- List-Unsubscribe one-click support

**Dependencies:** `email-infrastructure` (Resend + `email_logs` + `_shared/` edge fn helpers)

**Blockers:** None

**v2 Deferred:** RSVP capture, external `ShowContact` invitees (venue mgr, sound engineer), native Google Calendar / Microsoft Graph API integration, recurring events (RRULE), bounce webhooks.

**v3 Deferred:** Member availability sharing. Research recommends native implementation over Calendly (no availability API) or Cal.com (requires separate account per member).

---

### enhanced-security-testing

**Directory:** `enhanced-security-testing/`
**Status:** Research Complete
**Priority:** Medium
**Complexity:** Medium (15-20 hours)

**Summary:** Add SAST (Static Application Security Testing) scanning to CI pipeline. Includes RLS policy testing and security-focused pgTAP tests.

**Key Components:**

- Semgrep or similar SAST tool in CI
- RLS policy behavior tests
- Secrets scanning (git-secrets or similar)
- Security-focused code review checklist

**Dependencies:** ci-cd-pipeline (needs CI infrastructure first)

---

### guitar-tuning-system

**Directory:** `guitar-tuning-system/`
**Status:** Research Complete
**Priority:** Medium
**Complexity:** Medium-High (8-12 days)

**Summary:** Per-string tuning storage system that enables retuning effort visualization in setlists. Store actual notes per string (not just labels) to calculate how much retuning is needed between songs.

**Key Components:**

- `GuitarTuning` JSONB type with per-string notes
- `TuningLibrary` with pre-built tunings (Standard, Drop D, etc.)
- `TuningComparator` algorithm for effort calculation
- `CustomTuningDialog` for band-specific tunings
- `RetuningIndicator` component in setlist view

**Use Case:**

```
Standard → Drop D = 1 string (quick tune)
Standard → Half-step down = 6 strings (full retune or guitar swap)
```

**Blockers:** None

**Note:** Updated from simpler TEXT-field approach based on user requirement for retuning effort visualization in setlists.

---

### no-console-eslint-rule

**Directory:** `no-console-eslint-rule/`
**Status:** Research Complete
**Priority:** Low
**Complexity:** Medium (2-4 hours)

**Summary:** Enable ESLint's `no-console` rule and migrate 456 violations across 44 files to use the `createLogger` utility.

**Key Components:**

- Enable `no-console: 'warn'` initially
- Migrate services (47 violations in RealtimeManager alone)
- Handle special cases (logger.ts itself, debug utilities)
- Escalate to `no-console: 'error'`

**Blockers:** None

---

### react-native-app

**Directory:** `react-native-app/`
**Status:** Research Complete
**Priority:** Low (Post-1.0)
**Complexity:** Very High (100+ hours)

**Summary:** Native mobile app using React Native with true offline-first architecture. Shares business logic with web app via shared packages.

**Key Components:**

- React Native setup (Expo or bare)
- SQLite or WatermelonDB for local storage
- Shared sync engine with web
- Native UI components
- Push notifications

**Dependencies:** All core features should be stable first

**Note:** This is a major undertaking planned for post-1.0 when the web app is feature-complete and stable.

---

## Outdated/Superseded Items

### custom-tuning-support (CONSOLIDATED)

**Reason:** Merged into `guitar-tuning-system`. The original research (2025-12-11) proposed a JSONB-based system. The updated `guitar-tuning-system` research (2026-01-22) incorporates this approach with per-string note storage to enable retuning effort calculation for setlist planning.

---

## Backlog Directory Structure

```
.claude/backlog/
├── BACKLOG.md                      # This file
├── account-tiers-and-access/
│   └── 2026-01-21T19:05_research.md
├── calendar-events/
│   ├── spec.md
│   ├── research.md
│   └── flow-diagrams.md
├── ci-cd-pipeline/
│   └── 2025-11-21T23:44_research.md
├── email-infrastructure/
│   └── shared-services.md
├── email-invitations/
│   ├── spec.md
│   ├── research.md
│   └── flow-diagrams.md
├── enhanced-security-testing/
│   └── 2026-01-06T16:33_research.md
├── guitar-tuning-system/
│   ├── 2026-01-06T16:31_research.md (original)
│   └── 2026-01-22T15:25_research.md (enhanced with per-string storage)
├── multi-band-support/
│   └── plan.md
├── no-console-eslint-rule/
│   └── research.md
├── react-native-app/
│   └── 2025-12-11T16:54_research.md
└── unified-kebab-menu/
    └── 2026-01-20T22:48_research.md
```

## How to Use This Backlog

1. **Start a feature:** Move directory from `backlog/` to `features/` when starting work
2. **Research phase:** Run `/research <feature-name>` to create/update research document
3. **Planning phase:** Run `/plan <feature-name>` to create implementation plan and tasks
4. **Implementation:** Run `/implement <feature-name>` to execute tasks
5. **Completion:** Run `/finalize <feature-name>` to move to `completed/`

See `CLAUDE.md` for full workflow documentation.
