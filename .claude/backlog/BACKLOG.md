# Rock-On Backlog

Master overview of planned features in the `.claude/backlog/` directory.

**Last Updated:** 2026-09-01 (reconciled against shipped v0.4.5)
**Open Features:** 7 (see below)

> **2026-09-01 reconciliation:** This backlog was reconciled against the actual
> v0.4.5 codebase. Several large items shipped since the previous update
> (2026-04-24) and have been moved to "Shipped / Superseded" below. The
> human-facing curated view — with consolidation rationale — lives in the vault
> note **Rock On Backlog** (`30-resources/`).

## Feature Overview (open items only)

| Feature                                                             | Status                           | Priority | Complexity   | Dependencies       |
| ------------------------------------------------------------------- | -------------------------------- | -------- | ------------ | ------------------ |
| [email-and-notifications](#email-and-notifications)                 | Research/Spec Complete           | Medium   | Medium-High  | None               |
| [account-tiers-and-access](#account-tiers-and-access)               | Stub shipped — wire-up remaining | High     | Medium       | None (stub exists) |
| [multi-band-support](#multi-band-support)                           | Mostly implemented               | Medium   | Low (polish) | None               |
| [enhanced-security-testing](#enhanced-security-testing)             | Unblocked — ready                | Medium   | Medium       | ci-cd (shipped)    |
| [ci-cd: deploy + migration-safety](#ci-cd-deploy--migration-safety) | Partial                          | Medium   | Medium       | None               |
| [no-console-eslint-rule](#no-console-eslint-rule)                   | Research Complete                | Low      | Medium       | None               |
| [react-native-app](#react-native-app)                               | Research Complete                | Low      | Very High    | Stable web app     |
| [open-jam-venue-mode](#open-jam-venue-mode)                         | Open questions                   | Medium   | High         | Events (shipped)   |

## Recommended Implementation Order

1. **no-console-eslint-rule** — quick code-quality win, can parallel anything.
2. **multi-band-support** — verify remaining UI polish (logic mostly exists).
3. **email-and-notifications** — Phase 1 infra, then invitations + .ics invites.
4. **enhanced-security-testing** — CI now exists; add SAST + RLS/security tests.
5. **account-tiers-and-access** — wire tier gating + Stripe onto the shipped stub.
6. **ci-cd: deploy + migration-safety** — extend the existing validation workflow.
7. **open-jam-venue-mode** — resolve open questions; aligns with the venue /
   jukebox-for-tips product direction.
8. **react-native-app** — post-1.0, requires a stable web app.

---

## Feature Details

### email-and-notifications

**Directory:** `email-and-notifications/` (consolidated 2026-09-01 from the former
`email-infrastructure`, `email-invitations`, and `calendar-events` items)
**Status:** Research / Spec Complete — not built (no `_shared/`, no `email_logs`,
no Resend as of v0.4.5)
**Priority:** Medium
**Complexity:** Medium-High

**Summary:** One epic, three phases — a shared email substrate plus two
consumers. See the folder's `README.md` for the phase breakdown.

- **Phase 1 — Infrastructure** (`infrastructure-shared-services.md`): Resend
  setup, `supabase/functions/_shared/` helpers, `email_logs` +
  `user_notification_prefs` tables, deliverability compliance.
- **Phase 2a — Band invitations** (`invitations-*.md`): tokenized email invites
  to join a band, `/join?code=xxx` flow.
- **Phase 2b — Calendar / .ics invites** (`ics-invites-*.md`): auto-send `.ics`
  attachments on show/practice create/update/cancel.

**⚠️ Naming:** the `ics-invites-*` files were the old `calendar-events` item.
Renamed to avoid collision with the **shipped Events feature** (venue lineups) —
a completely different thing.

**Blockers:** None.

---

### account-tiers-and-access

**Directory:** `account-tiers-and-access/`
**Status:** Stub shipped — enforcement remaining
**Priority:** High
**Complexity:** Medium (reduced — schema groundwork done)

**Summary:** Free/pro tier system with feature gating. **The dependency
inverted:** social-catalog already shipped the `users.account_tier` stub column
(default 'free') and left an explicit `TODO: wire to account_tier limits when
account-tiers-and-access ships` in `JamSessionService`. What remains is the
gating enforcement + Stripe + admin/access-code UI — NOT the schema work the
original research assumed.

**Remaining:** tier-limit enforcement (e.g. jam session caps), Stripe
subscriptions, access-code redemption, feature gating, admin panel.

**Blockers:** None (was: multi-band-support — no longer gating).

---

### multi-band-support

**Directory:** `multi-band-support/`
**Status:** Mostly implemented — verify polish
**Priority:** Medium
**Complexity:** Low (remaining is UI polish)

**Summary:** Belong to multiple bands and switch between them. Band-switch logic
already exists in `AuthContext` (`switchBand` / `onSwitchBand`); most DB
infrastructure (band_memberships, RLS) predates this. Re-scope to: audit what's
live vs. the plan's "95% done" claim and finish any remaining switcher UI/UX.

**Blockers:** None.

---

### enhanced-security-testing

**Directory:** `enhanced-security-testing/`
**Status:** Unblocked — ready to start
**Priority:** Medium
**Complexity:** Medium

**Summary:** SAST scanning + RLS policy behavior tests + security-focused pgTAP
in CI. Its only dependency (ci-cd) now exists (`.github/workflows/ci.yml`), so
this is ready to pick up.

**Key Components:** Semgrep-or-similar SAST in CI, RLS behavior tests, secrets
scanning, security review checklist.

**Blockers:** None (ci-cd shipped).

---

### ci-cd: deploy + migration-safety

**Directory:** `ci-cd-pipeline/` (kept for the deploy/migration-safety research)
**Status:** Partial — validation shipped, deploy not
**Priority:** Medium
**Complexity:** Medium

**Summary:** The CI _validation_ pipeline shipped — `.github/workflows/ci.yml`
runs lint, type-check, prettier, ER-diagram check, and unit tests with coverage
on PRs. **Remaining:** a deploy workflow (build + deploy to prod) and a
migration-safety job. Re-scoped from "build CI" to "extend the existing CI."

**Blockers:** None.

---

### no-console-eslint-rule

**Directory:** `no-console-eslint-rule/`
**Status:** Research Complete — not started
**Priority:** Low
**Complexity:** Medium

**Summary:** Enable ESLint `no-console` and migrate the violations to
`createLogger`. Rule is still not enabled in `.eslintrc.cjs` as of v0.4.5.
(Original count: ~456 violations across 44 files — re-count before starting.)

**Blockers:** None.

---

### react-native-app

**Directory:** `react-native-app/`
**Status:** Research Complete (Post-1.0)
**Priority:** Low
**Complexity:** Very High (100+ hours)

**Summary:** Native mobile app (React Native) with offline-first architecture,
sharing the sync engine with web. Major undertaking; requires a stable web app.
QR-based jam-session joining is high-value on native.

**Blockers:** All core features should be stable first.

---

### open-jam-venue-mode

**Directory:** `open-jam-venue-mode/`
**Status:** Open questions captured
**Priority:** Medium
**Complexity:** High

**Summary:** Venue-hosted open jams — the seed of the product direction toward
venues and live-jukebox-for-tips acts. Builds on the shipped Events feature. Not
in the previous BACKLOG.md (added after 2026-04-24). See
`open-jam-venue-mode/2026-04-29T06:06_open-questions.md`.

**Blockers:** Open product questions to resolve first.

---

## Shipped / Superseded (retired from the active backlog)

These were open items in the 2026-04-24 backlog; verified shipped against v0.4.5
on 2026-09-01.

### social-catalog — ✅ SHIPPED

Personal catalog + jam sessions landed in
`supabase/migrations/20260422220000_social_catalog_and_jam_sessions.sql`
(`JamSessionService`, public `/jam/view/:shortCode` route). The single biggest
backlog item — done. (Left a deliberate `account_tier` stub for the tiers item.)

### Events / venue lineups — ✅ SHIPPED

`supabase/migrations/20260703164738_social_events.sql`, `EventService`,
EventsPage. Venue lineups, RSVP, "raise a hand," host casting. **Distinct from
the `calendar-events`/.ics-invites item** (now under `email-and-notifications/`).

### unified-kebab-menu — ✅ SHIPPED

`src/components/common/KebabMenu.tsx` exists and is adopted across ~6 components.
The "5 inconsistent kebab patterns" problem is resolved.

### guitar-tuning-system — ✅ SHIPPED (0.4.0–0.4.1)

Per-string tuning + retuning indicators. Summary in
`.claude/completed/guitar-tuning-system/SUMMARY.md`.

### custom-tuning-support — CONSOLIDATED

Merged into guitar-tuning-system (per-string JSONB storage for retuning-effort
calculation).

### ci-cd-pipeline (validation) — ✅ SHIPPED

The validation half shipped (`ci.yml`). Only the deploy + migration-safety work
remains — tracked above as its own re-scoped item.

---

## Backlog Directory Structure

```
.claude/backlog/
├── BACKLOG.md                          # This file
├── account-tiers-and-access/
│   └── 2026-01-21T19:05_research.md
├── ci-cd-pipeline/                     # deploy + migration-safety remain
│   ├── README.md
│   ├── 2025-11-21T23:44_research.md
│   ├── 2025-11-21T23:44_implementation-plan.md
│   └── 2026-07-09T19:57_empirical-gaps-and-release-gates.md
├── email-and-notifications/            # consolidated epic (infra + invites + .ics)
│   ├── README.md
│   ├── infrastructure-shared-services.md
│   ├── invitations-research.md
│   ├── invitations-spec.md
│   ├── invitations-flow-diagrams.md
│   ├── ics-invites-research.md
│   ├── ics-invites-spec.md
│   └── ics-invites-flow-diagrams.md
├── enhanced-security-testing/
│   ├── 2026-01-06T16:33_research.md
│   └── tasks.md
├── multi-band-support/
│   ├── plan.md
│   └── tasks.md
├── no-console-eslint-rule/
│   └── research.md
├── open-jam-venue-mode/
│   └── 2026-04-29T06:06_open-questions.md
└── react-native-app/
    └── 2025-12-11T16:54_research.md
```

## How to Use This Backlog

1. **Start a feature:** move its directory from `backlog/` to `features/`.
2. **Research → Plan → Implement → Finalize** via the workflow in
   `docs/DEVELOPMENT.md`.
3. **Completion:** summarize and move to `completed/`.

See `docs/DEVELOPMENT.md` for the full workflow and the vault **Rock On Backlog**
note for the curated roadmap view.
