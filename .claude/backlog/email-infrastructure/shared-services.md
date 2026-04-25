---
title: Shared Email Infrastructure
created: 2026-04-24T17:04
status: Research Complete
description: Shared scaffolding (Resend, edge function patterns, templates, logging) used by both email-invitations and calendar-events features
---

# Shared Email Infrastructure

## Purpose

Rock On ships two distinct email-driven features that share a common
delivery substrate:

1. **`email-invitations`** — band invitation emails sent when an admin
   invites a new member.
2. **`calendar-events`** — calendar invite emails (iCalendar `.ics`
   attachments) sent when a show or practice is created, updated, or
   cancelled.

Rather than duplicate the Resend account setup, domain verification,
edge function patterns, and logging table across both feature specs,
this document captures the shared pieces once. Both feature specs
reference it.

---

## 1. Resend Account & Domain Setup

### 1.1 Provider choice

Resend is the chosen provider. Rationale lives in
`../email-invitations/research.md` § 1. Summary:

- Free tier: 3,000 emails/mo (comfortably covers v1)
- Pro: $20/mo for 50k emails
- Modern, TypeScript-first API
- First-class React Email support (optional)
- Works natively with Supabase Edge Functions (Deno runtime via
  `https://esm.sh/resend@4.0.0`)
- Ships signed unsubscribe links and bounce webhooks out of the box

### 1.2 Account provisioning (one-time)

1. Create account at https://resend.com
2. Add sending domain `rockon.app`
3. Publish DNS records for domain verification:
   - **SPF** — `TXT v=spf1 include:_spf.resend.com ~all`
   - **DKIM** — three CNAME records pointing to `resend.com` subdomains
     (Resend generates these at verification time)
   - **DMARC** — `TXT v=DMARC1; p=none; rua=mailto:dmarc@rockon.app`
     initially, tighten to `p=quarantine` after ~2 weeks of clean
     reports
4. Verify domain in Resend dashboard — wait for green check on all
   three record types
5. Generate production API key (scoped to `sending` only)
6. Generate a separate `test` API key — Resend has a special
   `re_test_...` key prefix that captures sends without delivering;
   useful for local and CI environments

### 1.3 Sending identities

Until higher-volume use cases land, one sending identity is enough:

```
Rock On <noreply@rockon.app>
```

For v2+, consider subdomaining to protect reputation:

- `invites@mail.rockon.app` — band invitations
- `calendar@mail.rockon.app` — calendar event invites
- `updates@mail.rockon.app` — future digest/notification emails

Each subdomain can have its own DKIM key and reputation profile.
Deferred to v2.

### 1.4 Reply-to strategy

v1 sets `Reply-To: noreply@rockon.app` and relies on the in-app
messaging/notifications to handle responses. v2 (RSVP capture) may
introduce a parseable `Reply-To: rsvp+<token>@rockon.app` pattern
that routes inbound mail to an RSVP ingestion edge function.

---

## 2. Edge Function Conventions

Both `send-invitation` (invitations feature) and `send-event-invite`
(calendar-events feature) are Supabase Edge Functions. They share the
same directory structure, auth pattern, error-handling pattern, and
logging approach.

### 2.1 Directory layout

```
supabase/functions/
├── _shared/
│   ├── cors.ts               # Standard CORS headers helper
│   ├── email.ts              # Resend client factory + template helpers
│   ├── logging.ts            # Email log writer (writes to email_logs)
│   └── rateLimit.ts          # In-memory rate limit helper
├── send-invitation/
│   └── index.ts              # Band invitation sender
└── send-event-invite/
    └── index.ts              # Calendar invite sender (NEW — calendar-events)
```

The `_shared/` folder is a Supabase convention for utilities that
aren't themselves deployed but are imported by deployed functions.

### 2.2 Auth mode policy

Per CLAUDE.md § "Edge Function Policy", every function has a row in
`supabase/functions/FUNCTIONS.md`. Both email-sending functions MUST
be deployed with `--verify-jwt` (the default). Rationale:

- Only authenticated users should be able to trigger email sends
- Prevents spam / abuse from anonymous callers
- Allows the function to extract `auth.uid()` for authorization
  checks (e.g., "is this user a band admin?")

| Function            | Auth mode      | Role context                   |
| ------------------- | -------------- | ------------------------------ |
| `send-invitation`   | `--verify-jwt` | service_role (inside function) |
| `send-event-invite` | `--verify-jwt` | service_role (inside function) |

Inside the function, the supabase-js client uses the service_role key
so it can bypass RLS for cross-member lookups (e.g., resolving every
band member's email to send the invite to). Authorization is done
explicitly in the function handler (verify admin role, verify band
membership) — RLS cannot be relied on once service_role is used.

### 2.3 Standard handler skeleton

```typescript
// supabase/functions/send-event-invite/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/email.ts'
import { logEmailSend } from '../_shared/logging.ts'
import { checkRateLimit } from '../_shared/rateLimit.ts'

serve(async req => {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Parse + validate input
    const body = await req.json()

    // 3. Extract caller identity from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    // 4. Create service-role client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 5. Derive caller user_id from JWT (separate anon client with user JWT)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const {
      data: { user },
    } = await supabaseUser.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // 6. Authorization check (must be band admin for destructive sends)
    // ... domain-specific logic ...

    // 7. Rate limit check
    if (!checkRateLimit(user.id, /* limit */ 10, /* windowMs */ 3600_000)) {
      throw new Error('Rate limit exceeded')
    }

    // 8. Resolve recipients (filter by notification prefs)
    // ... domain-specific logic ...

    // 9. Build email content (template + optional .ics attachment)
    // ... domain-specific logic ...

    // 10. Send via Resend (sendEmail wraps the API call + logs)
    const result = await sendEmail({
      /* ... */
    })

    // 11. Log to email_logs (via logEmailSend helper)
    await logEmailSend(supabaseAdmin, {
      /* ... */
    })

    // 12. Return structured success
    return new Response(JSON.stringify({ success: true /* ... */ }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: error.message === 'Unauthorized' ? 401 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
```

### 2.4 Shared helpers

**`_shared/cors.ts`**

```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}
```

**`_shared/email.ts`**

```typescript
import { Resend } from 'https://esm.sh/resend@4.0.0'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') ?? '')

export interface SendEmailArgs {
  to: string
  subject: string
  html: string
  text?: string // Optional plain-text fallback
  attachments?: Array<{
    filename: string
    content: string // Base64 or raw string
    contentType?: string // e.g., 'text/calendar; method=REQUEST'
  }>
  replyTo?: string
  headers?: Record<string, string> // e.g., 'List-Unsubscribe'
}

export async function sendEmail(args: SendEmailArgs) {
  const { data, error } = await resend.emails.send({
    from: 'Rock On <noreply@rockon.app>',
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
    attachments: args.attachments,
    reply_to: args.replyTo,
    headers: args.headers,
  })

  if (error) throw new Error(`Resend error: ${error.message}`)
  return { resendId: data?.id }
}
```

**`_shared/logging.ts`**

```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface EmailLogEntry {
  purpose: 'invitation' | 'event-invite' | 'event-update' | 'event-cancel'
  recipientEmail: string
  recipientUserId?: string
  bandId?: string
  inviteCodeId?: string
  eventType?: 'show' | 'practice'
  eventId?: string
  sequenceSent?: number // For calendar events
  method?: 'REQUEST' | 'CANCEL' // For calendar events
  status: 'pending' | 'sent' | 'failed' | 'bounced'
  resendId?: string
  errorMessage?: string
}

export async function logEmailSend(
  supabase: SupabaseClient,
  entry: EmailLogEntry
) {
  await supabase.from('email_logs').insert({
    purpose: entry.purpose,
    recipient_email: entry.recipientEmail,
    recipient_user_id: entry.recipientUserId,
    band_id: entry.bandId,
    invite_code_id: entry.inviteCodeId,
    event_type: entry.eventType,
    event_id: entry.eventId,
    sequence_sent: entry.sequenceSent,
    method: entry.method,
    status: entry.status,
    resend_id: entry.resendId,
    error_message: entry.errorMessage,
    sent_at: entry.status === 'sent' ? new Date().toISOString() : null,
  })
}
```

**`_shared/rateLimit.ts`**

```typescript
// Simple in-memory rate limiter. Fine for v1 since Supabase Edge
// Functions run per-region with short instance lifetimes — limits
// are effectively per-region-per-instance. For stricter enforcement
// use a Postgres-backed counter (see rate_limit_buckets in v2).
const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= limit) return false
  b.count++
  return true
}
```

### 2.5 Deployment

Always deploy via the manifest-aware script (per CLAUDE.md):

```bash
source .env.supabase.local
./scripts/deploy-edge-functions.sh send-event-invite
```

This reads `FUNCTIONS.md` and picks the correct `--verify-jwt` /
`--no-verify-jwt` flag. Never `supabase functions deploy` directly.

Post-deploy, always run:

```bash
./scripts/smoke-edge-functions.sh
```

to verify each function returns its expected status for its expected
auth context (both email functions expect 401 without JWT).

---

## 3. Email Template Conventions

### 3.1 v1: hand-rolled HTML

For v1, use plain string templates in the edge function. Rationale:

- Zero build pipeline — Deno edge functions don't have a bundler, so
  React Email's JSX → HTML renderer would require pre-compiling
  templates into JS strings and importing them
- Simpler to review and test
- Email HTML is a constrained subset anyway (tables, inline styles)

Example structure (from `email-invitations/research.md` § 2.3):

```typescript
function renderInvitationHtml(params: {
  bandName: string
  inviterName: string
  joinUrl: string
  message?: string
}): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; padding: 20px; background: #f6f9fc;">
  <div style="max-width: 560px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px;">
    <h1 style="color: #111; font-size: 24px;">You're invited to join ${escapeHtml(params.bandName)}!</h1>
    <p>${escapeHtml(params.inviterName)} has invited you to join their band on Rock On.</p>
    ${params.message ? `<blockquote style="border-left: 4px solid #f97316; padding-left: 16px; margin: 24px 0; color: #555;">${escapeHtml(params.message)}</blockquote>` : ''}
    <p style="margin: 32px 0;">
      <a href="${params.joinUrl}"
         style="background: #f97316; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
        Join ${escapeHtml(params.bandName)}
      </a>
    </p>
    <p style="color: #666; font-size: 14px; margin-top: 40px;">
      Rock On helps bands organize setlists, track practices, and coordinate shows.
    </p>
  </div>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

**Always escape user-controlled strings.** Band names, user names,
personal messages, event names — all flow into templates and all
need HTML-escaping.

### 3.2 Plain-text fallback

Every email must ship with a `text` version alongside the `html`.
Some email clients (and spam filters) penalize HTML-only mail.

```typescript
function renderInvitationText(params: {
  bandName: string
  inviterName: string
  joinUrl: string
  message?: string
}): string {
  return `You're invited to join ${params.bandName}!

${params.inviterName} has invited you to join their band on Rock On.
${params.message ? `\n"${params.message}"\n` : ''}
Join: ${params.joinUrl}

Rock On helps bands organize setlists, track practices, and coordinate shows.
`
}
```

### 3.3 v2+: React Email upgrade path

If email complexity grows (weekly digests, multi-column layouts,
conditional dark-mode support), migrate to React Email:

- Pre-compile templates with `@react-email/render` during build
- Bundle the rendered HTML strings into the edge function
- Or: run a separate template-rendering edge function (slower, adds
  hop)

Don't do this in v1 — HTML strings are fine for two templates.

### 3.4 Deliverability best practices

- Include a text part (see above)
- Set `List-Unsubscribe` header with a one-click URL (Resend supports
  this) — required by Gmail/Yahoo for bulk senders as of Feb 2024
- Avoid spam trigger words in subjects ("FREE", "!!!", all-caps)
- Keep HTML under 102KB (Gmail clips larger)
- Use inline CSS (many clients strip `<style>` blocks)
- Test in https://mail-tester.com before launch

---

## 4. Logging: Unified `email_logs` Table

Both features write to a single shared `email_logs` table. The existing
`email-invitations/spec.md` already proposes this table; this section
formalizes the schema so both features can cohabit it cleanly.

### 4.1 Final schema (supersedes the one in email-invitations/spec.md § "New Table")

```sql
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Discriminator: which feature sent this?
  purpose TEXT NOT NULL
    CHECK (purpose IN ('invitation', 'event-invite', 'event-update', 'event-cancel', 'welcome', 'digest')),

  -- Recipient
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,

  -- Context (all nullable; populate based on purpose)
  band_id UUID REFERENCES public.bands(id) ON DELETE SET NULL,
  invite_code_id UUID REFERENCES public.invite_codes(id) ON DELETE SET NULL,

  -- Calendar-event-specific context
  event_type TEXT CHECK (event_type IN ('show', 'practice')),
  event_id UUID,                              -- No FK: polymorphic between shows + practice_sessions
  sequence_sent INTEGER,                       -- iCalendar SEQUENCE value at send time
  method TEXT CHECK (method IN ('REQUEST', 'CANCEL', 'REPLY')),

  -- Send status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'complained')),
  resend_id TEXT,                              -- Resend's message ID for webhook correlation
  error_message TEXT,

  -- Timestamps
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ                       -- Set by bounce webhook (future)
);

CREATE INDEX IF NOT EXISTS idx_email_logs_purpose ON public.email_logs(purpose);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON public.email_logs(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_event ON public.email_logs(event_type, event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_id ON public.email_logs(resend_id) WHERE resend_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO service_role;

-- RLS: users can read their own sent/received logs; admins can read their band's
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own email_logs"
  ON public.email_logs FOR SELECT
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Band admins read band email_logs"
  ON public.email_logs FOR SELECT
  USING (
    band_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.band_memberships
      WHERE band_id = email_logs.band_id
        AND user_id = auth.uid()
        AND role = 'admin'
    )
  );
```

### 4.2 Why polymorphic `event_id` (no FK)

`event_id` references either a `shows.id` or a `practice_sessions.id`
row depending on `event_type`. PostgreSQL doesn't natively support
polymorphic foreign keys; the clean alternatives are:

1. **Two nullable FK columns** (`show_id`, `practice_session_id`) with
   a CHECK constraint that exactly one is non-null
2. **No FK, discriminator column** (current choice)

Going with #2 because:

- Email logs are append-only history — orphaned rows are acceptable
- A show can be deleted without needing to cascade-nullify logs
- Simpler schema; one fewer column

### 4.3 Purpose values

| Value          | Sender            | When                                        |
| -------------- | ----------------- | ------------------------------------------- |
| `invitation`   | send-invitation   | Admin invites a new member                  |
| `event-invite` | send-event-invite | Event created (METHOD:REQUEST)              |
| `event-update` | send-event-invite | Event modified (METHOD:REQUEST, SEQUENCE+1) |
| `event-cancel` | send-event-invite | Event cancelled (METHOD:CANCEL)             |
| `welcome`      | (future)          | New account signup                          |
| `digest`       | (future)          | Weekly band digest                          |

---

## 5. Rate Limiting Strategy

### 5.1 v1 approach: in-memory per-function

See `_shared/rateLimit.ts` above. Concrete limits:

| Feature                         | Per-user limit | Window             |
| ------------------------------- | -------------- | ------------------ |
| Invitations                     | 10 invitations | 1 hour             |
| Event invites (on event create) | 100 recipients | 1 hour (band-wide) |
| Event updates (on event edit)   | 20 updates     | 1 hour (per event) |

The 100 recipients / hour band-wide limit prevents runaway sends (e.g.,
a bug that re-sends on every edit keystroke).

### 5.2 v2: Postgres-backed buckets

If in-memory becomes insufficient (edge functions run multi-region and
each region has its own memory), replace with a `rate_limit_buckets`
table + advisory-lock-protected counter. Deferred.

### 5.3 Database-level belt-and-suspenders

For invitations, also add the trigger documented in
`../email-invitations/research.md` § 6.1:

```sql
CREATE TRIGGER enforce_invite_rate_limit
  BEFORE INSERT ON invite_codes
  FOR EACH ROW EXECUTE FUNCTION check_invite_rate_limit();
```

Even if the edge function's in-memory limiter is bypassed, the DB
enforces the cap at INSERT time.

---

## 6. Secrets & Environment Variables

### 6.1 Secrets (Supabase Edge Function environment)

Set via `supabase secrets set`:

```bash
source .env.supabase.local
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx --project-ref khzeuxxhigqcmrytsfux
supabase secrets set APP_URL=https://rockon.app --project-ref khzeuxxhigqcmrytsfux
supabase secrets set EMAIL_FROM_ADDRESS='Rock On <noreply@rockon.app>' --project-ref khzeuxxhigqcmrytsfux
```

| Secret                      | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `RESEND_API_KEY`            | Resend API authentication                                 |
| `APP_URL`                   | Base URL for links in emails (`${APP_URL}/join?code=...`) |
| `EMAIL_FROM_ADDRESS`        | Sender identity — allows swapping without redeploy        |
| `SUPABASE_URL`              | Auto-injected by Supabase                                 |
| `SUPABASE_ANON_KEY`         | Auto-injected                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected                                             |

### 6.2 Local development (`supabase/.env.local`)

For local edge function testing, create `supabase/.env.local` (git-
ignored) with the same keys. `supabase functions serve --env-file
supabase/.env.local` loads them. Use a `re_test_...` Resend key so
sends are captured without actually delivering.

---

## 7. Local Development & Testing

### 7.1 Running edge functions locally

```bash
npm run start:dev    # Starts Supabase + edge functions runtime + Vite
```

`scripts/start-dev.sh` automatically launches `supabase functions
serve --no-verify-jwt` in the background (logs → `/tmp/edge-functions.log`).
Note: the `--no-verify-jwt` flag applies ONLY in local dev for
convenience; deployment uses the per-function flag from `FUNCTIONS.md`.

To invoke locally from the browser/client:

```typescript
const { data, error } = await supabase.functions.invoke('send-event-invite', {
  body: { eventType: 'show', eventId: showId },
})
```

### 7.2 Capturing sent emails in dev

Use a `re_test_...` Resend key. Sends return `200` with a fake
message ID but no actual email is delivered. Good for confirming the
function runs end-to-end without spamming real inboxes.

Alternative: set `RESEND_API_KEY=` to empty and wrap `sendEmail` in
`_shared/email.ts` with an early-return no-op when the key is missing.
Useful for pure offline development.

### 7.3 Testing strategies

| Layer                       | Approach                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| Unit (template rendering)   | Pure functions; snapshot tests in `tests/unit/functions/`         |
| Integration (edge function) | Use `supabase functions serve` + fetch in test                    |
| E2E (full invite flow)      | Playwright drives UI; email verified via Resend test API          |
| Bounce/failure              | Mock Resend to return errors, assert `email_logs.status='failed'` |

Per CLAUDE.md, add tests under `tests/` (never `src/__tests__`).

---

## 8. Deliverability Monitoring

### 8.1 v1: Resend dashboard

Resend provides a dashboard with delivered / opened / clicked /
bounced / complained metrics per-domain. Check weekly for the first
month after launch to catch deliverability regressions.

### 8.2 v2: Webhook ingestion

Subscribe to Resend's webhooks for `email.bounced` and
`email.complained` events. Wire to a new edge function
(`resend-webhook`) that updates `email_logs.status` and optionally
flips `users.email_suppressed = true` to prevent further sends to
addresses that have bounced hard or complained.

Deferred to v2.

---

## 9. Cross-Cutting Concerns

### 9.1 User notification preferences

Both features need a way for users to opt out. Proposed unified
schema (will be created alongside calendar-events v1):

```sql
CREATE TABLE IF NOT EXISTS public.user_notification_prefs (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email_invitations BOOLEAN NOT NULL DEFAULT true,
  email_event_invites BOOLEAN NOT NULL DEFAULT true,
  email_event_updates BOOLEAN NOT NULL DEFAULT true,
  email_event_cancellations BOOLEAN NOT NULL DEFAULT true,
  email_digest BOOLEAN NOT NULL DEFAULT false,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE ON public.user_notification_prefs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_prefs TO service_role;
```

- Row inserted lazily on first preference change (`UPSERT` pattern)
- Missing row = all defaults apply
- `email_invitations=false` does NOT suppress the initial invite to
  a new user — they haven't opted out yet because they don't have an
  account. It applies to subsequent invites once the account exists.

### 9.2 Audit log integration

All edge-function email sends should write to `email_logs` (above).
They do NOT need to write to the existing `audit_log` table — email
sends are a side-effect of user actions (create show, send invite)
that are already audit-logged via their underlying table triggers.

---

## 10. Implementation Order

If implementing both features together:

1. **Baseline infrastructure** (2-3h)
   - Set up Resend account, verify domain
   - Add `RESEND_API_KEY`, `APP_URL`, `EMAIL_FROM_ADDRESS` secrets
   - Create `email_logs` table migration
   - Create `user_notification_prefs` table migration
   - Create `_shared/` edge function utilities

2. **First feature** (email-invitations or calendar-events)
   - Full feature spec implementation
   - Validates the shared infrastructure under real load

3. **Second feature**
   - Reuses all infrastructure
   - Should be noticeably faster to ship

If implementing separately, still build the `email_logs` table on the
first feature so the second doesn't need to migrate data from a
feature-specific log table.

---

## 11. References

- [Resend Docs](https://resend.com/docs)
- [Resend Attachment API](https://resend.com/docs/api-reference/emails/send-email#body-parameters)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Gmail/Yahoo bulk sender requirements (Feb 2024)](https://support.google.com/mail/answer/81126)
- `../email-invitations/spec.md` — band invitation feature
- `../calendar-events/spec.md` — calendar event feature
- `../email-invitations/research.md` — Resend vs alternatives deep-dive
- CLAUDE.md § "Edge Function Policy" — deployment + manifest rules
- CLAUDE.md § "Migration Policy" — `GRANT ... TO service_role` requirements
