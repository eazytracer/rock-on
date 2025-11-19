---
page: Authentication & Account
sprint: Sprint 1
priority: critical
references:
  - /workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md
  - /workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md
output: /workspaces/rock-on/src/pages/NewLayout/AuthPages.tsx
---

# MVP Authentication & Account Pages - User Stories

## Overview
Build authentication and account management pages including sign up, log in, get started flow, and account settings.

**Primary Color:** #f17827ff (Orange) - use for primary CTAs and active states

---

## User Stories - Authentication

### Story 1: Sign Up
**As a** new user
**I want to** create an account
**So that** I can use Rock-On

**Acceptance Criteria:**
- [ ] Sign Up page at `/signup`
- [ ] Clean, centered form on dark background
- [ ] Form fields:
  - Email (required, validated)
  - Password (required, min 8 chars, validated)
  - Confirm Password (required, must match)
  - Display Name (required)
- [ ] "Create Account" button (orange, prominent)
- [ ] Link to "Already have an account? Log in"
- [ ] Form validation:
  - Email format check
  - Password min length
  - Passwords match
  - Display inline errors
- [ ] Success: redirect to Get Started screen
- [ ] Error handling: display friendly messages

**Design Notes:**
- Centered card: max-width 400px
- Logo at top
- Inputs: h-44px, full-width
- Button: full-width, h-44px
- Link: text-sm, orange color

---

### Story 2: Log In
**As a** returning user
**I want to** log in to my account
**So that** I can access my bands

**Acceptance Criteria:**
- [ ] Log In page at `/login`
- [ ] Clean, centered form on dark background
- [ ] Form fields:
  - Email (required)
  - Password (required)
- [ ] "Log In" button (orange, prominent)
- [ ] Link to "Don't have an account? Sign up"
- [ ] "Forgot Password?" link (future feature, can be grayed out)
- [ ] Form validation
- [ ] Success: redirect to last band's Songs page OR Get Started
- [ ] Error: "Invalid email or password"

**Design Notes:**
- Match Sign Up styling
- Simpler form (2 fields)
- Forgot password link: text-sm, secondary color

---

### Story 3: Get Started Screen (First-Time Users)
**As a** new user without bands
**I want to** see how to get started
**So that** I can create or join a band

**Acceptance Criteria:**
- [ ] Shows after sign up or when user has no bands
- [ ] Centered layout with two options:
  - **Create Your First Band** card
    - Icon (band or group)
    - Description: "Start your own band and invite members"
    - Input: Band Name
    - Button: "Create Band" (orange)
  - **Join an Existing Band** card
    - Icon (invite or ticket)
    - Description: "Enter an invite code from your bandmates"
    - Input: Invite Code
    - Button: "Join Band" (orange)
- [ ] Both cards side-by-side on desktop, stacked on mobile
- [ ] After creating/joining: redirect to band's Songs page
- [ ] Success toast with next steps

**Design Notes:**
- Cards: #1a1a1a, rounded-xl, p-6
- Equal width cards
- Icons: 48px, centered above text
- Inputs and buttons: full-width within cards
- Space between cards: gap-6

---

### Story 4: Create Band from Get Started
**As a** new user
**I want to** create my first band
**So that** I can start organizing music

**Acceptance Criteria:**
- [ ] Band name input (required, min 2 chars)
- [ ] "Create Band" button validates and submits
- [ ] Success:
  - Band created with user as Owner
  - Invite code generated
  - Redirect to band's Songs page
  - Success toast: "Band created! Share this invite code: [CODE]"
  - Optional: show quick tour or tips
- [ ] Error: display inline validation

**Design Notes:**
- Input: large, clear
- Button: full-width, orange
- Smooth transition to Songs page

---

### Story 5: Join Band from Get Started
**As a** new user
**I want to** join a band using an invite code
**So that** I can collaborate with my bandmates

**Acceptance Criteria:**
- [ ] Invite code input (required, alphanumeric)
- [ ] "Join Band" button validates and submits
- [ ] Validation:
  - Code exists and active
  - User not already member
- [ ] Success:
  - User added as Member
  - Redirect to band's Songs page
  - Success toast: "You joined [Band Name]!"
- [ ] Error messages:
  - "Invalid invite code"
  - "You're already in this band"
  - Display inline

**Design Notes:**
- Input: large, monospace font for code
- Button: full-width, orange
- Error: red text below input

---

## User Stories - Account Settings

### Story 6: Account Settings Page
**As a** user
**I want to** manage my account settings
**So that** I can update my info and preferences

**Acceptance Criteria:**
- [ ] Accessible from user menu (top-right)
- [ ] Page title: "Account Settings"
- [ ] Sections:
  1. Profile
  2. Security
  3. Preferences
  4. Danger Zone
- [ ] Each section in separate card
- [ ] Save buttons per section or auto-save
- [ ] Success toasts on save

**Design Notes:**
- Full-page layout
- Sections stacked vertically
- Cards: #1a1a1a, rounded-xl, p-6
- Max-width: 800px, centered

---

### Story 7: Profile Settings
**As a** user
**I want to** update my profile information
**So that** others see my current details

**Acceptance Criteria:**
- [ ] Profile section shows:
  - Display Name (editable)
  - Email (read-only for now)
  - Profile Picture (future, placeholder shown)
- [ ] "Save Changes" button (orange)
- [ ] Validation:
  - Display name required, min 2 chars
- [ ] Success toast: "Profile updated"

**Design Notes:**
- Avatar placeholder: circular, 80px
- "Change Photo" button (future feature, grayed out)
- Inputs: standard styling

---

### Story 8: Change Password
**As a** user
**I want to** change my password
**So that** I can keep my account secure

**Acceptance Criteria:**
- [ ] Security section with password change form:
  - Current Password (required)
  - New Password (required, min 8 chars)
  - Confirm New Password (required, must match)
- [ ] "Change Password" button (orange)
- [ ] Validation:
  - Current password correct
  - New password meets requirements
  - Passwords match
- [ ] Success toast: "Password changed"
- [ ] Error: "Current password incorrect"

**Design Notes:**
- Form in Security section
- Password strength indicator (future)
- Show/hide password toggles

---

### Story 9: Preferences
**As a** user
**I want to** set my preferences
**So that** the app works how I like

**Acceptance Criteria:**
- [ ] Preferences section with settings:
  - Theme: Dark / Light (default: Dark) - toggle or dropdown
  - Email Notifications: On / Off - toggle
  - (Future: Default context, language, etc.)
- [ ] Auto-save on change OR "Save Preferences" button
- [ ] Success toast when saved

**Design Notes:**
- Toggle switches for boolean settings
- Dropdowns for multi-option settings
- Clear labels and descriptions

---

### Story 10: Delete Account (Danger Zone)
**As a** user
**I want to** delete my account
**So that** I can remove my data

**Acceptance Criteria:**
- [ ] Danger Zone section at bottom
- [ ] Red border, warning styling
- [ ] "Delete Account" button (red, danger)
- [ ] Click shows confirmation dialog:
  - "Permanently delete your account?"
  - Warning: "This will delete all your data and remove you from all bands."
  - Warning: "This action cannot be undone."
  - Require typing "DELETE" to confirm
- [ ] "Delete My Account" button (red, disabled until typed)
- [ ] "Cancel" button
- [ ] Success: log out and redirect to login
- [ ] Toast: "Account deleted"

**Design Notes:**
- Danger zone: red border, at bottom
- Strong confirmation (type to confirm)
- Clear about permanent deletion

---

### Story 11: Log Out
**As a** user
**I want to** log out of my account
**So that** others can't access my data

**Acceptance Criteria:**
- [ ] "Log Out" in user menu (top-right dropdown)
- [ ] Click logs out immediately (no confirmation)
- [ ] Clears session/auth token
- [ ] Redirects to login page
- [ ] Success toast: "Logged out"

**Design Notes:**
- Menu item: secondary/danger style
- Quick action, no friction
- Clear feedback

---

## User Stories - Navigation & Context

### Story 12: User Menu Dropdown
**As a** user
**I want to** access user options
**So that** I can manage my account

**Acceptance Criteria:**
- [ ] User avatar/initial in top-right corner
- [ ] Click opens dropdown menu with:
  - User name (displayed, not clickable)
  - User email (displayed, not clickable)
  - Divider
  - "Account Settings"
  - "Log Out" (secondary/danger color)
- [ ] Click outside closes menu
- [ ] Keyboard accessible (Escape to close)

**Design Notes:**
- Dropdown: #1f1f1f bg, #2a2a2a border
- User info at top: name + email, grayed
- Menu items: hover highlight
- Positioned below avatar, right-aligned

---

### Story 13: Band Selector Dropdown
**As a** user
**I want to** switch between bands and manage them
**So that** I can work in different bands

**Acceptance Criteria:**
- [ ] Band name + dropdown icon in top-left navbar
- [ ] Click opens dropdown with:
  - List of user's bands (if multiple)
    - Band name
    - Member count
    - Click to switch
  - Divider
  - "Manage Current Band" → Band Members page
  - "Create New Band" → Create band modal
  - "Join Band" → Join band modal
- [ ] Current band highlighted
- [ ] Switching band refreshes page content to new band context
- [ ] Click outside closes menu

**Design Notes:**
- Dropdown: larger than user menu
- Current band: orange highlight or checkmark
- Band items: hover highlight
- Max-height with scroll if many bands

---

### Story 14: Create Band Modal (From Dropdown)
**As a** user
**I want to** create a new band from anywhere
**So that** I can start a new project

**Acceptance Criteria:**
- [ ] "Create New Band" opens modal
- [ ] Modal fields:
  - Band Name (required)
  - Description (optional)
- [ ] "Create Band" button (orange)
- [ ] "Cancel" button
- [ ] Success:
  - Band created with user as Owner
  - Switches to new band context
  - Success toast: "Band created!"
  - Optionally redirects to Band Members to show invite code

**Design Notes:**
- Small modal: max-width 500px
- Simple form, quick action
- Smooth transition to new band

---

### Story 15: Join Band Modal (From Dropdown)
**As a** user
**I want to** join a new band from anywhere
**So that** I can collaborate with more bands

**Acceptance Criteria:**
- [ ] "Join Band" opens modal
- [ ] Modal field:
  - Invite Code (required)
- [ ] "Join Band" button (orange)
- [ ] "Cancel" button
- [ ] Validation:
  - Code exists and active
  - User not already member
- [ ] Success:
  - User added as Member
  - Switches to new band context
  - Success toast: "You joined [Band Name]!"
- [ ] Error: inline message

**Design Notes:**
- Small modal: max-width 400px
- Large input for code
- Error below input

---

## Technical Implementation Notes

### Component Structure
```
Auth Pages:
├── SignUpPage.tsx
│   └── SignUpForm (email, password, confirm, name)
├── LoginPage.tsx
│   └── LoginForm (email, password)
└── GetStartedPage.tsx
    ├── CreateBandCard (name input, create button)
    └── JoinBandCard (code input, join button)

Account Settings:
└── AccountSettingsPage.tsx
    ├── ProfileSection (name, email)
    ├── SecuritySection (change password)
    ├── PreferencesSection (theme, notifications)
    └── DangerZone (delete account)

Navigation:
├── UserMenuDropdown (top-right)
│   ├── UserInfo (name, email)
│   ├── AccountSettingsLink
│   └── LogOutButton
└── BandSelectorDropdown (top-left)
    ├── BandList (switchable)
    ├── ManageBandLink
    ├── CreateBandButton → CreateBandModal
    └── JoinBandButton → JoinBandModal
```

### State Management
- User auth state (logged in/out)
- User info (name, email)
- Current band context (bandId, bandName)
- List of user's bands
- Form states (inputs, validation, errors)
- Modal states

### Authentication Flow
```
Sign Up → Auth Service → Success → Get Started
Log In → Auth Service → Success → Last Band OR Get Started
Log Out → Clear Auth → Login Page
```

### Form Validation
- Email: regex pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Password: min 8 characters
- Confirm Password: must match
- Display Name: min 2 chars
- Band Name: min 2 chars
- Invite Code: alphanumeric, exists in DB

### Error Handling
- Network errors: "Unable to connect. Please try again."
- Auth errors: "Invalid email or password"
- Validation errors: inline per field
- Generic errors: "Something went wrong. Please try again."

---

## Design Specifications Reference

### Auth Pages Layout
- Centered card: max-width 400px
- Background: #121212 (full viewport)
- Card: #1a1a1a, rounded-xl, p-8
- Logo at top, centered
- Form inputs: mb-4
- Button: full-width

### Colors
- **Primary CTA:** #f17827ff (Orange)
- **Links:** #f17827ff or #3b82f6
- **Error:** #D7263D (Red)
- **Success:** #4ade80 (Green)

### Typography
- Page title: text-3xl font-bold
- Form labels: text-sm font-medium mb-2
- Input text: text-base
- Links: text-sm

---

## Testing Checklist
- [ ] Can sign up with valid details
- [ ] Cannot sign up with invalid email
- [ ] Cannot sign up with mismatched passwords
- [ ] Can log in with correct credentials
- [ ] Cannot log in with wrong password
- [ ] Get Started shows after sign up
- [ ] Can create band from Get Started
- [ ] Can join band from Get Started
- [ ] Invalid invite code shows error
- [ ] Account settings page loads
- [ ] Can update display name
- [ ] Can change password
- [ ] Preferences save correctly
- [ ] Can log out successfully
- [ ] Delete account requires confirmation
- [ ] User menu dropdown works
- [ ] Band selector dropdown works
- [ ] Can switch between bands
- [ ] Create/join band modals functional

---

## Acceptance Definition of Done
- [ ] All user stories implemented
- [ ] Matches design style guide
- [ ] Responsive on mobile and desktop
- [ ] Form validation working
- [ ] Error handling complete
- [ ] Orange primary color used
- [ ] Accessible (keyboard, screen readers)
- [ ] No console errors
- [ ] Code reviewed and tested
- [ ] Auth integration with backend complete
