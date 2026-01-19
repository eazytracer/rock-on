---
title: Email Integration & Band Invitation System
created: 2025-12-05T20:13
status: Specification Complete
description: Email service integration with Resend for band invitations and the enhanced invitation link flow (/join?code=xxx)
---

# Email Integration & Band Invitation System

## Executive Summary

This feature adds email capabilities to Rock On for sending band invitations and implements an enhanced invitation link flow that streamlines the onboarding experience for invited users.

**Key Deliverables:**

1. Email service integration using Resend
2. Enhanced invitation link flow (`/join?code=abc123`)
3. Invitation management UI in band settings
4. Modified auth flow to skip band creation/join decision for invited users

---

## User Stories

### US-1: Band Admin Sends Email Invitation

**As a** band admin
**I want to** send an email invitation to a potential band member
**So that** they can easily join my band with one click

**Acceptance Criteria:**

- [ ] Can enter email address in band settings
- [ ] System sends invitation email via Resend
- [ ] Email contains a clickable link with invitation code
- [ ] Email shows band name and inviter name
- [ ] Can track sent invitations and their status

### US-2: User Joins via Invitation Link

**As a** potential band member
**I want to** click an invitation link and join a band
**So that** I don't have to manually enter codes or make decisions

**Acceptance Criteria:**

- [ ] `/join?code=abc123` routes to sign-in/sign-up
- [ ] After authentication, user sees confirmation page (not create/join band choice)
- [ ] Confirmation shows band name and who invited them
- [ ] Single "Join Band" button completes the process
- [ ] User is redirected to dashboard after joining

### US-3: Shareable Invitation Links

**As a** band admin
**I want to** generate shareable invitation links
**So that** I can send invitations via text message or other channels

**Acceptance Criteria:**

- [ ] Can generate invitation link from band settings
- [ ] Can copy link to clipboard
- [ ] Link works for both new and existing users
- [ ] Can set expiration and usage limits

### US-4: Existing User Receives Invitation

**As an** existing Rock On user
**I want to** use an invitation link to join another band
**So that** I can be in multiple bands easily

**Acceptance Criteria:**

- [ ] Clicking link while logged in goes directly to confirmation
- [ ] Shows "You're already signed in as [email]" message
- [ ] Can join band without re-authenticating
- [ ] If already a member, shows appropriate message

---

## Database Schema

### Existing Table: `invite_codes`

The current schema already has an `invite_codes` table that we'll enhance:

```sql
-- Current schema (from baseline migration)
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- Nullable - allows permanent invite codes
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
```

### Schema Modifications Needed

Add columns for email invitation tracking:

```sql
-- Add to invite_codes table (modify baseline migration)
ALTER TABLE public.invite_codes ADD COLUMN
  type TEXT NOT NULL DEFAULT 'manual'
    CHECK (type IN ('manual', 'email', 'link'));

ALTER TABLE public.invite_codes ADD COLUMN
  invited_email TEXT;  -- Email address if type='email'

ALTER TABLE public.invite_codes ADD COLUMN
  email_sent_at TIMESTAMPTZ;  -- When invitation email was sent

ALTER TABLE public.invite_codes ADD COLUMN
  email_status TEXT DEFAULT 'pending'
    CHECK (email_status IN ('pending', 'sent', 'failed', 'bounced'));
```

### New Table: `email_logs` (Optional - for tracking)

```sql
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,  -- 'invitation', 'welcome', 'summary'
  recipient_email TEXT NOT NULL,
  band_id UUID REFERENCES public.bands(id),
  user_id UUID REFERENCES public.users(id),
  invite_code_id UUID REFERENCES public.invite_codes(id),
  status TEXT NOT NULL DEFAULT 'pending',
  resend_id TEXT,  -- Resend's message ID for tracking
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## API Endpoints

### Edge Functions Required

#### 1. `send-invitation` - Send Email Invitation

```typescript
// POST /functions/v1/send-invitation
interface SendInvitationRequest {
  bandId: string
  recipientEmail: string
  inviterUserId: string
  message?: string // Optional personal message
}

interface SendInvitationResponse {
  success: boolean
  inviteCodeId?: string
  error?: string
}
```

**Logic:**

1. Validate inviter has admin role in band
2. Generate new invite code (or reuse existing for same email)
3. Send email via Resend
4. Update invite_codes with email status
5. Return result

#### 2. `validate-invitation` - Validate Invitation Code (Client-callable)

```typescript
// POST /functions/v1/validate-invitation
interface ValidateInvitationRequest {
  code: string
}

interface ValidateInvitationResponse {
  valid: boolean
  bandName?: string
  bandId?: string
  inviterName?: string
  expiresAt?: string
  error?: string
}
```

---

## Email Templates

### Template 1: Band Invitation

**Subject:** You've been invited to join {bandName} on Rock On

**Content:**

```
Hi there!

{inviterName} has invited you to join {bandName} on Rock On.

[Join {bandName}]  ← Button links to /join?code=abc123

Rock On is a band management app that helps bands organize
setlists, track practices, and coordinate shows.

This invitation expires on {expirationDate}.

---
If you didn't expect this invitation, you can ignore this email.
```

### Template 2: Welcome Email (Future)

Sent after user creates account and joins first band.

### Template 3: Weekly Summary (Future)

Weekly digest of band activity.

---

## User Flows

### Flow 1: New User via Email Invitation

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Band admin enters email in "Invite Member" form          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. System sends email via Resend Edge Function              │
│    - Creates invite_code with type='email'                  │
│    - Email contains /join?code=abc123 link                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Recipient clicks link in email                           │
│    - Opens /join?code=abc123 in browser                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. App stores code in sessionStorage, shows sign-in page    │
│    - "Sign in to join {bandName}"                           │
│    - Google SSO button                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. User completes Google sign-in                            │
│    - New user created in database                           │
│    - Redirected to /join/confirm                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Confirmation page shows:                                 │
│    - "Join {bandName}"                                      │
│    - "Invited by {inviterName}"                             │
│    - [Join Band] button                                     │
│    (NO create band / join band choice!)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. User clicks "Join Band"                                  │
│    - band_membership created                                │
│    - invite_code.current_uses incremented                   │
│    - Redirect to dashboard                                  │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Existing User via Invitation Link

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User receives link (email, text, etc.)                   │
│    - Clicks /join?code=abc123                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Already logged  │
                    │     in?         │
                    └────────┬────────┘
                    YES      │      NO
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ Direct to /join/confirm │   │ Store code, show login  │
│ with code validation    │   │ (Same as Flow 1)        │
└─────────────────────────┘   └─────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Check if already a member of this band                   │
└─────────────────────────────────────────────────────────────┘
              │
    ALREADY   │      NOT MEMBER
    MEMBER    │
┌─────────────┴───────────────────────────────────────────────┐
▼                                                             ▼
┌─────────────────────────┐   ┌─────────────────────────────────┐
│ "You're already in      │   │ Show confirmation:              │
│  {bandName}!"           │   │ - Band info                     │
│ [Go to Dashboard]       │   │ - [Join Band] button            │
└─────────────────────────┘   └─────────────────────────────────┘
```

---

## Error States

| Error             | Message                               | Action                                   |
| ----------------- | ------------------------------------- | ---------------------------------------- |
| Invalid code      | "This invitation code is invalid"     | Show "Request new invitation" suggestion |
| Expired code      | "This invitation has expired"         | Show expiration date, suggest new invite |
| Max uses reached  | "This invitation has been fully used" | Contact band admin                       |
| Already member    | "You're already a member of {band}"   | Link to dashboard                        |
| Band deleted      | "This band no longer exists"          | Generic error                            |
| Email send failed | "Failed to send invitation"           | Retry button                             |

---

## Security Considerations

### Invitation Code Generation

- Use `nanoid` for URL-safe, high-entropy codes
- 10 characters provides ~10^14 combinations
- Example: `Xk9Lm2pQr7`

```typescript
import { nanoid } from 'nanoid'
const code = nanoid(10)
```

### Rate Limiting

- **Invitation creation:** 10 invitations per hour per user
- **Email sending:** 5 emails per hour per user
- **Code validation:** 20 attempts per minute per IP

### Validation Rules

1. Code must exist and be active (`is_active = true`)
2. Code must not be expired (`expires_at IS NULL OR expires_at > NOW()`)
3. Code must have uses remaining (`current_uses < max_uses`)
4. User must not already be a member of the band

---

## Files to Create

### New Files

```
src/
├── pages/
│   └── JoinPage.tsx                    # /join route handler
│   └── JoinConfirmPage.tsx             # /join/confirm confirmation page
├── components/
│   └── invitations/
│       ├── InviteMemberForm.tsx        # Email invitation form
│       ├── InvitationLinkGenerator.tsx # Shareable link UI
│       └── InvitationsList.tsx         # List of sent invitations
├── services/
│   └── InvitationService.ts            # Client-side invitation logic
└── hooks/
    └── useInvitations.ts               # Invitation data hooks

supabase/
└── functions/
    └── send-invitation/
        └── index.ts                    # Edge function for email

emails/                                 # React Email templates (if using)
└── BandInvitation.tsx
```

### Files to Modify

```
src/
├── App.tsx                             # Add /join routes
├── pages/
│   └── AuthPages.tsx                   # Handle pending invitation after auth
├── contexts/
│   └── AuthContext.tsx                 # Store pending invitation code
├── components/
│   └── bands/
│       └── BandSettings.tsx            # Add invitation management section

supabase/
└── migrations/
    └── 20251106000000_baseline_schema.sql  # Add columns to invite_codes
```

---

## Implementation Phases

### Phase 1: Schema & Infrastructure

1. Update `invite_codes` table schema
2. Create `email_logs` table (optional)
3. Set up Resend account and API key
4. Create Edge Function scaffold

### Phase 2: Invitation Link Flow

1. Create `/join` route handler
2. Create `/join/confirm` page
3. Modify auth flow to handle pending invitations
4. Update `AuthContext` to store pending code

### Phase 3: Email Sending

1. Implement `send-invitation` Edge Function
2. Create email template with React Email
3. Build `InviteMemberForm` component
4. Integrate into band settings

### Phase 4: Invitation Management

1. Create `InvitationsList` component
2. Add invitation status tracking
3. Build `InvitationLinkGenerator` for shareable links
4. Add copy-to-clipboard functionality

### Phase 5: Testing & Polish

1. E2E tests for invitation flow
2. Error handling for all edge cases
3. Mobile responsiveness
4. Rate limiting implementation

---

## Dependencies

### New NPM Packages

```json
{
  "dependencies": {
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "@react-email/components": "^0.0.25",
    "react-email": "^3.0.0"
  }
}
```

### Supabase Edge Function Dependencies

```json
{
  "dependencies": {
    "resend": "^4.0.0"
  }
}
```

### Environment Variables

```bash
# .env.local (client)
# No new client-side env vars needed

# Supabase Edge Function secrets
RESEND_API_KEY=re_xxxxxxxxxxxxx
APP_URL=https://rockon.app  # For invitation links
```

---

## Success Metrics

- [ ] Invitation email delivered within 30 seconds
- [ ] < 3 clicks to join band via email invitation
- [ ] 0 manual code entry required for email invites
- [ ] Works on mobile browsers
- [ ] Handles all error states gracefully
