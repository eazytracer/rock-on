# Email & Notifications (epic)

Consolidated 2026-09-01 from three previously-separate backlog items:
`email-infrastructure`, `email-invitations`, and `calendar-events`. They were
always one dependency chain — a shared substrate plus two consumers — so they're
now one epic folder.

None of this is built yet (no `supabase/functions/_shared/`, no `email_logs`
table, no Resend integration as of v0.4.5).

## Phases

**Phase 1 — Infrastructure** (`infrastructure-shared-services.md`)
Shared Resend setup, `_shared/` edge-fn helpers (cors, email, logging, rate
limit), unified `email_logs` table, `user_notification_prefs` table, domain
verification (SPF/DKIM/DMARC), List-Unsubscribe compliance. Build once; both
consumers below reuse it.

**Phase 2a — Band invitations** (`invitations-*.md`)
Email invites to join a band (Resend + tokenized `/join?code=xxx` flow),
replacing the share-a-code workflow. Builds on Phase 1.

**Phase 2b — Calendar / .ics invites** (`ics-invites-*.md`)
Auto-send iCalendar `.ics` attachments to band members when a show or practice is
created/updated/cancelled. Builds on Phase 1; can ship in parallel with 2a.

Phase 2a and 2b are independent consumers of Phase 1 and can run in parallel once
the infrastructure exists.

## ⚠️ Naming note

The files here named `ics-invites-*` were previously the **`calendar-events`**
backlog item. They are renamed to avoid collision with the **shipped Events
feature** (venue lineups / RSVP / casting, `20260703164738_social_events.sql`),
which is a completely different thing. "calendar-events" in old docs = these
`.ics` email invites, NOT the live Events feature.

See `.claude/backlog/BACKLOG.md` for the master overview.
