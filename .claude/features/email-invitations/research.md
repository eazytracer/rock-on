---
title: Email Integration & Invitation System - Technical Research
created: 2025-12-05T20:13
status: Research Complete
description: Technical research on email providers, implementation approaches, and security considerations
---

# Technical Research: Email Integration & Invitation System

## 1. Email Service Provider Analysis

### 1.1 Resend (Recommended)

**Why Resend for Rock On:**

| Aspect | Details |
|--------|---------|
| **Pricing** | Free: 3,000 emails/mo, Pro: $20/mo for 50k emails |
| **API Quality** | Modern, TypeScript-first, excellent DX |
| **React Email** | First-class support for building emails with React |
| **Deliverability** | High deliverability, managed sending domains |
| **Supabase Integration** | Works great with Edge Functions |

**Setup Requirements:**
1. Create Resend account at https://resend.com
2. Verify sending domain (DNS records)
3. Generate API key
4. Store as Supabase secret

**Sample Integration:**

```typescript
// supabase/functions/send-invitation/index.ts
import { Resend } from 'resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const { data, error } = await resend.emails.send({
  from: 'Rock On <invites@rockon.app>',
  to: recipientEmail,
  subject: `You've been invited to join ${bandName}`,
  html: emailHtml,
});
```

### 1.2 Alternative Providers Comparison

| Provider | Free Tier | Cost at Scale | Best For |
|----------|-----------|---------------|----------|
| **Resend** | 3k/mo | $20/50k | Modern apps, DX |
| **SendGrid** | 100/day | $15/100k | High volume |
| **Postmark** | 100/mo | $15/10k | Transactional |
| **AWS SES** | 62k/mo* | $0.10/1k | Cost-sensitive |
| **Mailgun** | 1k/mo (3mo) | $15/50k | Flexibility |

*AWS SES free tier requires sending from EC2

**Recommendation:** Start with Resend. If email volume grows significantly (>50k/mo), evaluate SendGrid migration.

---

## 2. Supabase Edge Functions

### 2.1 Why Edge Functions for Email

- **Security:** API keys never exposed to client
- **Rate Limiting:** Can implement server-side limits
- **Validation:** Server-side validation before sending
- **Logging:** Central place for email tracking

### 2.2 Edge Function Structure

```
supabase/
└── functions/
    └── send-invitation/
        ├── index.ts          # Main handler
        └── _shared/
            ├── cors.ts       # CORS headers
            └── email.ts      # Email template
```

### 2.3 Sample Edge Function

```typescript
// supabase/functions/send-invitation/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@4.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bandId, recipientEmail, inviterUserId, message } = await req.json()

    // Initialize Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validate inviter has admin role
    const { data: membership } = await supabaseAdmin
      .from('band_memberships')
      .select('role')
      .eq('user_id', inviterUserId)
      .eq('band_id', bandId)
      .single()

    if (!membership || membership.role !== 'admin') {
      throw new Error('Only band admins can send invitations')
    }

    // Get band and inviter details
    const [{ data: band }, { data: inviter }] = await Promise.all([
      supabaseAdmin.from('bands').select('name').eq('id', bandId).single(),
      supabaseAdmin.from('users').select('name').eq('id', inviterUserId).single(),
    ])

    // Generate invite code
    const code = generateCode(10)

    // Create invite code record
    const { data: inviteCode, error: codeError } = await supabaseAdmin
      .from('invite_codes')
      .insert({
        band_id: bandId,
        code,
        created_by: inviterUserId,
        type: 'email',
        invited_email: recipientEmail,
        max_uses: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .select()
      .single()

    if (codeError) throw codeError

    // Send email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

    const appUrl = Deno.env.get('APP_URL') ?? 'https://rockon.app'
    const joinUrl = `${appUrl}/join?code=${code}`

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'Rock On <invites@rockon.app>',
      to: recipientEmail,
      subject: `You've been invited to join ${band.name} on Rock On`,
      html: generateEmailHtml({
        bandName: band.name,
        inviterName: inviter.name,
        joinUrl,
        message,
      }),
    })

    if (emailError) {
      // Update invite code with failure
      await supabaseAdmin
        .from('invite_codes')
        .update({ email_status: 'failed' })
        .eq('id', inviteCode.id)
      throw emailError
    }

    // Update invite code with success
    await supabaseAdmin
      .from('invite_codes')
      .update({
        email_status: 'sent',
        email_sent_at: new Date().toISOString(),
      })
      .eq('id', inviteCode.id)

    return new Response(
      JSON.stringify({ success: true, inviteCodeId: inviteCode.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function generateCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function generateEmailHtml(params: {
  bandName: string
  inviterName: string
  joinUrl: string
  message?: string
}): string {
  // Simple HTML template - can be replaced with React Email
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: sans-serif; padding: 20px;">
        <h1>You're invited to join ${params.bandName}!</h1>
        <p>${params.inviterName} has invited you to join their band on Rock On.</p>
        ${params.message ? `<p><em>"${params.message}"</em></p>` : ''}
        <p>
          <a href="${params.joinUrl}"
             style="background: #f97316; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 8px; display: inline-block;">
            Join ${params.bandName}
          </a>
        </p>
        <p style="color: #666; font-size: 14px; margin-top: 40px;">
          Rock On is a band management app that helps bands organize
          setlists, track practices, and coordinate shows.
        </p>
      </body>
    </html>
  `
}
```

### 2.4 Deployment

```bash
# Deploy the function
supabase functions deploy send-invitation

# Set secrets
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
supabase secrets set APP_URL=https://rockon.app
```

---

## 3. Invitation Code Generation

### 3.1 Current Implementation

The existing codebase uses a simple 6-character alphanumeric code:

```typescript
// From JoinBandForm.tsx
const formatInviteCode = (value: string) => {
  return value
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)
}
```

### 3.2 Recommended Enhancement

Use `nanoid` for better entropy and URL-safety:

```typescript
import { nanoid } from 'nanoid'

// 10 characters = ~60 bits of entropy
// ~10^14 possible combinations
const code = nanoid(10)  // e.g., "V1StGXR8_Z"
```

**Comparison:**

| Approach | Length | Entropy | Example |
|----------|--------|---------|---------|
| Current (6 char) | 6 | ~31 bits | `ABC123` |
| nanoid(10) | 10 | ~60 bits | `V1StGXR8_Z` |
| UUID | 36 | ~122 bits | `550e8400-e29b-41d4-a716-446655440000` |

**Recommendation:** Use 10-character nanoid for good balance of entropy and usability.

### 3.3 Code Validation Logic

```typescript
// InvitationService.ts
async function validateInviteCode(code: string): Promise<ValidationResult> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select(`
      id,
      band_id,
      expires_at,
      max_uses,
      current_uses,
      is_active,
      bands (name),
      users!created_by (name)
    `)
    .eq('code', code)
    .single()

  if (error || !data) {
    return { valid: false, error: 'Invalid invitation code' }
  }

  if (!data.is_active) {
    return { valid: false, error: 'This invitation has been deactivated' }
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'This invitation has expired' }
  }

  if (data.current_uses >= data.max_uses) {
    return { valid: false, error: 'This invitation has reached its usage limit' }
  }

  return {
    valid: true,
    bandId: data.band_id,
    bandName: data.bands.name,
    inviterName: data.users.name,
    expiresAt: data.expires_at,
  }
}
```

---

## 4. React Email Templates

### 4.1 Why React Email

- **Type Safety:** TypeScript support for email templates
- **Component Reuse:** Use React patterns
- **Preview:** Local development preview server
- **Compatibility:** Generates HTML that works across email clients

### 4.2 Sample Template

```tsx
// emails/BandInvitation.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface BandInvitationProps {
  bandName: string
  inviterName: string
  joinUrl: string
  message?: string
}

export const BandInvitation = ({
  bandName,
  inviterName,
  joinUrl,
  message,
}: BandInvitationProps) => (
  <Html>
    <Head />
    <Preview>Join {bandName} on Rock On</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://rockon.app/logo.png"
          width="40"
          height="40"
          alt="Rock On"
        />
        <Heading style={heading}>
          You're invited to join {bandName}!
        </Heading>
        <Text style={paragraph}>
          {inviterName} has invited you to join their band on Rock On.
        </Text>
        {message && (
          <Section style={messageBox}>
            <Text style={messageText}>"{message}"</Text>
          </Section>
        )}
        <Button style={button} href={joinUrl}>
          Join {bandName}
        </Button>
        <Text style={footer}>
          Rock On is a band management app that helps bands organize
          setlists, track practices, and coordinate shows.
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#f6f9fc', padding: '20px 0' }
const container = { backgroundColor: '#ffffff', padding: '40px', borderRadius: '8px' }
const heading = { fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }
const paragraph = { fontSize: '16px', lineHeight: '24px', color: '#374151' }
const messageBox = { backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', margin: '24px 0' }
const messageText = { fontStyle: 'italic', margin: 0 }
const button = { backgroundColor: '#f97316', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold' }
const footer = { fontSize: '14px', color: '#6b7280', marginTop: '40px' }

export default BandInvitation
```

### 4.3 Rendering for Edge Functions

```typescript
import { render } from '@react-email/render'
import { BandInvitation } from './emails/BandInvitation'

const html = render(BandInvitation({
  bandName: 'iPod Shuffle',
  inviterName: 'Eric',
  joinUrl: 'https://rockon.app/join?code=abc123',
}))
```

---

## 5. Client-Side Implementation

### 5.1 Route Structure

```tsx
// App.tsx routes
<Route path="/join" element={<JoinPage />} />
<Route path="/join/confirm" element={<JoinConfirmPage />} />
```

### 5.2 JoinPage Component Logic

```tsx
// src/pages/JoinPage.tsx
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export const JoinPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, isLoading } = useAuth()
  const code = searchParams.get('code')

  const [validating, setValidating] = useState(true)
  const [validation, setValidation] = useState<ValidationResult | null>(null)

  useEffect(() => {
    if (!code) {
      navigate('/login')
      return
    }

    // Store code for after auth
    sessionStorage.setItem('pendingInviteCode', code)

    // Validate code
    validateInviteCode(code).then(result => {
      setValidation(result)
      setValidating(false)
    })
  }, [code])

  useEffect(() => {
    // If already logged in and code is valid, go to confirm
    if (!isLoading && user && validation?.valid) {
      navigate('/join/confirm')
    }
  }, [isLoading, user, validation])

  if (validating) {
    return <LoadingSpinner />
  }

  if (!validation?.valid) {
    return <InvalidCodeError error={validation?.error} />
  }

  // Show sign-in page with band context
  return (
    <div>
      <h1>Sign in to join {validation.bandName}</h1>
      <p>Invited by {validation.inviterName}</p>
      <GoogleSignInButton />
    </div>
  )
}
```

### 5.3 AuthContext Modification

```typescript
// contexts/AuthContext.tsx - additions

interface AuthContextType {
  // ... existing fields
  pendingInviteCode: string | null
  clearPendingInvite: () => void
}

// In provider
const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(
  () => sessionStorage.getItem('pendingInviteCode')
)

const clearPendingInvite = () => {
  sessionStorage.removeItem('pendingInviteCode')
  setPendingInviteCode(null)
}

// After successful auth, check for pending invite
useEffect(() => {
  if (user && pendingInviteCode) {
    // Redirect to confirm page instead of normal onboarding
    navigate('/join/confirm')
  }
}, [user, pendingInviteCode])
```

---

## 6. Security Considerations

### 6.1 Rate Limiting

**Server-side (Edge Function):**

```typescript
// Simple in-memory rate limiting (use Redis for production)
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = rateLimits.get(userId)

  if (!record || record.resetAt < now) {
    rateLimits.set(userId, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

// Usage in handler
if (!checkRateLimit(inviterUserId, 10, 60 * 60 * 1000)) {
  throw new Error('Rate limit exceeded. Try again later.')
}
```

**Client-side (Supabase RLS):**

```sql
-- Add rate limiting trigger (optional)
CREATE OR REPLACE FUNCTION check_invite_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM invite_codes
  WHERE created_by = NEW.created_by
    AND created_date > NOW() - INTERVAL '1 hour';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_invite_rate_limit
  BEFORE INSERT ON invite_codes
  FOR EACH ROW EXECUTE FUNCTION check_invite_rate_limit();
```

### 6.2 Code Brute Force Protection

- **10-character codes:** ~10^14 combinations
- **Rate limit validation attempts:** 20/minute per IP
- **Lock out after failures:** Temporary IP block after 100 failed attempts

### 6.3 Email Validation

```typescript
// Validate email format and domain
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) return false

  // Block common disposable email domains
  const disposableDomains = ['tempmail.com', 'throwaway.com', /* ... */]
  const domain = email.split('@')[1].toLowerCase()
  if (disposableDomains.includes(domain)) return false

  return true
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// tests/unit/services/InvitationService.test.ts
describe('InvitationService', () => {
  describe('validateInviteCode', () => {
    it('returns valid for active, unexpired code', async () => {
      // ...
    })

    it('returns invalid for expired code', async () => {
      // ...
    })

    it('returns invalid for max uses reached', async () => {
      // ...
    })

    it('returns invalid for deactivated code', async () => {
      // ...
    })
  })
})
```

### 7.2 E2E Tests

```typescript
// tests/e2e/invitations/join-flow.spec.ts
test.describe('Invitation Join Flow', () => {
  test('new user can join band via invitation link', async ({ page }) => {
    // 1. Create invitation code in database
    // 2. Navigate to /join?code=xxx
    // 3. Verify band info displayed
    // 4. Complete Google sign-in
    // 5. Verify confirmation page
    // 6. Click Join Band
    // 7. Verify redirected to dashboard
    // 8. Verify band membership created
  })

  test('existing user can join via invitation link', async ({ page }) => {
    // ...
  })

  test('shows error for invalid code', async ({ page }) => {
    // ...
  })

  test('shows error for expired code', async ({ page }) => {
    // ...
  })
})
```

---

## 8. Open Questions Resolved

| Question | Answer |
|----------|--------|
| **Invitation code format?** | 10-char nanoid (URL-safe, high entropy) |
| **Where to store pending code?** | sessionStorage (survives auth redirect) |
| **Email provider?** | Resend (modern API, React Email support) |
| **Rate limiting approach?** | Server-side in Edge Function + optional DB trigger |
| **Handle existing members?** | Check membership, show "already a member" message |
| **Weekly summaries?** | Future feature using pg_cron + Edge Function |

---

## 9. Future Considerations

### 9.1 Weekly Activity Summaries

- Use `pg_cron` to trigger weekly Edge Function
- Aggregate practice sessions, songs added, upcoming shows
- User preference for email frequency (daily/weekly/never)

### 9.2 Email Preferences

```sql
-- Future: Add to user_profiles
ALTER TABLE user_profiles ADD COLUMN email_preferences JSONB DEFAULT '{
  "invitations": true,
  "weekly_summary": true,
  "show_reminders": true
}';
```

### 9.3 Custom Sending Domain

- Set up SPF, DKIM, DMARC for `rockon.app`
- Improves deliverability and branding
- Required for "Rock On" to show instead of project subdomain

---

## 10. References

- [Resend Documentation](https://resend.com/docs)
- [React Email](https://react.email)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [nanoid](https://github.com/ai/nanoid)
- [Existing invite_codes schema](../../../supabase/migrations/20251106000000_baseline_schema.sql)
