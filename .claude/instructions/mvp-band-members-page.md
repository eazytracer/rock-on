---
page: Band Members
sprint: Sprint 1
priority: critical
references:
  - /workspaces/rock-on/.claude/specifications/2025-10-22T22:59_functional-mvp-spec.md
  - /workspaces/rock-on/.claude/specifications/2025-10-22T14:01_design-style-guide.md
  - /workspaces/rock-on/.claude/artifacts/2025-10-22T00:51_band-management-userflows.md
output: /workspaces/rock-on/src/pages/NewLayout/BandMembersPage.tsx
---

# MVP Band Members Page - User Stories

## Overview
Build the Band Members page mockup for managing band roster, inviting members, and assigning instruments. **Critical Sprint 1 feature.**

**Access:** Via "Manage Current Band" in Band Selector (top-left dropdown)

**Primary Color:** #f17827ff (Orange) - use for primary CTAs and active states

---

## User Stories

### Story 1: View Band Information
**As a** band member
**I want to** see basic band information
**So that** I understand the band I'm in

**Acceptance Criteria:**
- [ ] Band name displayed prominently at top
- [ ] Member count badge (e.g., "5 members")
- [ ] Created date
- [ ] Description (if set)
- [ ] Back button to return to Songs page
- [ ] Edit button for admins (opens band info edit)

**Design Notes:**
- Page header: large band name, text-3xl
- Info cards: #1a1a1a background
- Edit button: secondary style, only visible to admins

---

### Story 2: Edit Band Name and Description (Admin)
**As a** band admin
**I want to** edit band information
**So that** I can keep details current

**Acceptance Criteria:**
- [ ] "Edit Band Info" button (admin only)
- [ ] Click opens edit modal
- [ ] Fields:
  - Band Name (required)
  - Description (optional, textarea)
- [ ] "Save Changes" button (orange)
- [ ] "Cancel" button
- [ ] Success toast: "Band info updated"
- [ ] Changes reflected immediately

**Design Notes:**
- Modal: centered, max-width 500px
- Simple form, 2-3 fields only
- Focus on band name input on open

---

### Story 3: View Invite Code (Admin)
**As a** band admin
**I want to** see and share the invite code
**So that** I can invite new members

**Acceptance Criteria:**
- [ ] "Invite Members" section (admin only)
- [ ] Displays current invite code (large, easy to read)
- [ ] "Copy to Clipboard" button
- [ ] Success feedback when copied ("Copied!")
- [ ] "Share" button (native share on mobile)
- [ ] Share text template: "Join my band [Band Name] on Rock-On! Use invite code: [CODE]"
- [ ] "Regenerate Code" button (with confirmation)

**Design Notes:**
- Code displayed in monospace font, large (text-2xl)
- Copy button: prominent, with clipboard icon
- Share button: secondary style
- Regenerate: text button, less prominent

---

### Story 4: Regenerate Invite Code (Admin)
**As a** band admin
**I want to** regenerate the invite code
**So that** I can invalidate old codes if needed

**Acceptance Criteria:**
- [ ] "Regenerate Code" button in invite section
- [ ] Click shows confirmation dialog
- [ ] Dialog: "Regenerate invite code? The old code will no longer work."
- [ ] "Regenerate" button (orange)
- [ ] "Cancel" button
- [ ] New code generated and displayed
- [ ] Success toast: "New invite code generated"
- [ ] Copy button ready for new code

**Design Notes:**
- Confirmation dialog: small, centered
- Warning about invalidating old code
- New code smoothly transitions in

---

### Story 5: View Members List
**As a** band member
**I want to** see all band members
**So that** I know who's in the band

**Acceptance Criteria:**
- [ ] Members list displays all band members
- [ ] Each member card/row shows:
  - Avatar (or initial circle)
  - Name
  - Email
  - Role badge (Owner 👑 / Admin / Member)
  - Instruments (with icons)
  - Join date
  - Actions menu (•••) for admins
- [ ] Owner listed first
- [ ] Admins listed next
- [ ] Members alphabetically
- [ ] Search members (if 10+ members)
- [ ] Loading state with skeleton loaders

**Design Notes:**
- Cards or table rows: #1a1a1a, rounded-xl, p-4
- Role badges: colored pills (Owner=orange, Admin=blue, Member=gray)
- Instruments: icon + text or chips
- Avatar: colored circles with initials

---

### Story 6: Search Members
**As a** band member
**I want to** search for specific members
**So that** I can find someone quickly

**Acceptance Criteria:**
- [ ] Search input above member list
- [ ] Live search filters by name, email, or instrument
- [ ] Shows "No members found" if no matches
- [ ] Clear search button (×)
- [ ] Case-insensitive search

**Design Notes:**
- Search bar: consistent with other pages
- Appears when 10+ members (or always show)
- Placeholder: "Search members..."

---

### Story 7: View Member Details
**As a** band member
**I want to** see full member details
**So that** I can know more about them

**Acceptance Criteria:**
- [ ] Click member card opens detail modal
- [ ] Displays:
  - Name, Email
  - Role and status
  - All instruments with proficiency levels
  - Join date
  - Bio (if set)
  - Songs contributed (count)
  - Setlists created (count)
- [ ] "Edit" button (admin or self)
- [ ] "Close" button

**Design Notes:**
- Modal or side panel
- Organized sections
- Instruments listed with proficiency badges

---

### Story 8: Edit Member Instruments (Admin or Self)
**As a** band admin or member
**I want to** edit a member's instruments
**So that** we track what everyone plays

**Acceptance Criteria:**
- [ ] "Edit Instruments" button in member detail (admin or self)
- [ ] Opens edit modal
- [ ] Shows current instruments with remove button (×)
- [ ] "Add Instrument" button
- [ ] Add instrument form:
  - Instrument dropdown (Guitar, Bass, Drums, Keys, Vocals, Other)
  - Proficiency dropdown (Beginner, Intermediate, Advanced, Expert)
  - "Primary Instrument" checkbox (only one can be primary)
- [ ] "Save Changes" button (orange)
- [ ] "Cancel" button
- [ ] Success toast: "[Member Name]'s instruments updated"
- [ ] Changes reflected immediately

**Design Notes:**
- Modal: scrollable if many instruments
- Instrument list: each with remove button
- Add form: compact, inline
- Primary instrument: star icon or badge

---

### Story 9: Remove Member (Admin)
**As a** band admin
**I want to** remove a member from the band
**So that** I can manage the roster

**Acceptance Criteria:**
- [ ] "Remove from Band" in member actions menu (admin only)
- [ ] Cannot remove self
- [ ] Cannot remove other admins (unless owner)
- [ ] Cannot remove owner
- [ ] Confirmation dialog: "Remove [Member Name] from [Band Name]? They will lose access to all band content."
- [ ] "Remove" button (red, danger)
- [ ] "Cancel" button
- [ ] Success toast: "[Member Name] removed"
- [ ] Member removed from list immediately
- [ ] Removed member's content remains (songs, etc.)

**Design Notes:**
- Confirmation dialog: warning icon, danger styling
- Clear about losing access
- Permanent action

---

### Story 10: Make Admin / Remove Admin (Owner Only)
**As a** band owner
**I want to** promote members to admin or demote admins
**So that** I can delegate management

**Acceptance Criteria:**
- [ ] "Make Admin" in member actions menu (owner only, for members)
- [ ] "Remove Admin" in member actions menu (owner only, for admins)
- [ ] Make Admin: simple confirmation "Make [Member Name] an admin?"
- [ ] Remove Admin: confirmation "Remove admin rights from [Member Name]?"
- [ ] Success toasts
- [ ] Role badge updates immediately
- [ ] Owner badge never changes (except on transfer)

**Design Notes:**
- Quick actions, minimal UI
- Role changes visible immediately

---

### Story 11: Transfer Ownership (Owner Only)
**As a** band owner
**I want to** transfer ownership to another member
**So that** I can step down or delegate

**Acceptance Criteria:**
- [ ] "Transfer Ownership" in member actions menu (owner only)
- [ ] Strong confirmation dialog:
  - "Transfer ownership of [Band Name] to [Member Name]?"
  - Warning: "You will become an admin. This cannot be undone."
  - Require typing "TRANSFER" to confirm
- [ ] "Transfer Ownership" button (orange, disabled until text typed)
- [ ] "Cancel" button
- [ ] After confirmation:
  - New member becomes Owner
  - Previous owner becomes Admin
  - Role badges update
  - Success toast: "Ownership transferred to [Member Name]"
- [ ] Cannot be undone

**Design Notes:**
- Extra strong confirmation (type to confirm)
- Very clear about consequences
- Owner crown (👑) moves to new owner

---

### Story 12: Leave Band (Non-Owner)
**As a** band member
**I want to** leave a band
**So that** I can stop being part of it

**Acceptance Criteria:**
- [ ] "Leave Band" button in page settings or user menu
- [ ] Owner cannot leave (must transfer ownership first)
- [ ] Confirmation dialog: "Leave [Band Name]? You will lose access to all band content."
- [ ] "Leave Band" button (red)
- [ ] "Cancel" button
- [ ] Success toast: "You left [Band Name]"
- [ ] Redirect to band list or "No bands" state
- [ ] Member removed from band
- [ ] Can rejoin with invite code

**Design Notes:**
- Leave button: danger zone in settings
- Clear about losing access
- Redirect smoothly

---

### Story 13: Delete Band (Owner Only)
**As a** band owner
**I want to** delete the band
**So that** I can remove it permanently

**Acceptance Criteria:**
- [ ] "Delete Band" in danger zone (owner only)
- [ ] Very strong confirmation:
  - "Permanently delete [Band Name]?"
  - Warning: "This will delete all band songs, setlists, shows, practices, and member associations."
  - Warning: "This action cannot be undone."
  - Require typing band name to confirm
- [ ] "Delete Band" button (red, disabled until name typed)
- [ ] "Cancel" button
- [ ] After confirmation:
  - All band data deleted
  - All members removed
  - Redirect to band list
  - Success toast: "[Band Name] deleted"

**Design Notes:**
- Danger zone: red border, bottom of page
- Extra strong confirmation (type band name)
- Clear about permanent deletion

---

### Story 14: Member Role Badges
**As a** band member
**I want to** see member roles clearly
**So that** I know who has what permissions

**Acceptance Criteria:**
- [ ] Role badges visible on member cards
- [ ] Badge styles:
  - **Owner:** Orange badge with crown icon 👑
  - **Admin:** Blue badge with "Admin" text
  - **Member:** Gray badge with "Member" text (or no badge)
- [ ] Tooltip on hover explains permissions
- [ ] Color-coded for quick identification

**Design Notes:**
- Badges: rounded pills, small
- Icons optional but helpful
- Consistent colors across app

---

### Story 15: Mobile Responsive Band Members
**As a** mobile user
**I want to** manage band members on my phone
**So that** I can invite and manage on-the-go

**Acceptance Criteria:**
- [ ] Members display as stacked cards
- [ ] Invite code section: easy to copy on mobile
- [ ] Share button uses native mobile share
- [ ] Swipe actions for quick remove (admin)
- [ ] Modals: full-screen on mobile
- [ ] Touch-friendly buttons (44px min)
- [ ] Smooth scrolling

**Design Notes:**
- Cards: full-width, mb-3
- Large copy button for invite code
- Native share sheet on iOS/Android
- Swipe reveals action buttons

---

### Story 16: Empty State
**As a** band owner
**I want to** see guidance when I'm the only member
**So that** I know to invite others

**Acceptance Criteria:**
- [ ] Shows when band has only 1 member (owner)
- [ ] Displays:
  - "You're the only member"
  - "Invite your bandmates to get started"
  - Invite code prominently displayed
  - Copy and Share buttons
- [ ] Encouraging, helpful tone

**Design Notes:**
- Centered content
- Invite code highlighted
- Clear call-to-action

---

## Technical Implementation Notes

### Component Structure
```
BandMembersPage.tsx
├── PageHeader (band name, back button, edit button)
├── BandInfoCard (name, description, member count, created date)
├── InviteCodeSection (admin only)
│   ├── InviteCodeDisplay
│   ├── CopyButton
│   ├── ShareButton
│   └── RegenerateButton
├── MembersList
│   ├── SearchBar
│   └── MemberCard (for each member)
│       ├── Avatar
│       ├── MemberInfo (name, email, role, instruments)
│       └── ActionsMenu (admin only)
├── EditBandInfoModal
├── EditInstrumentsModal
├── MemberDetailModal
├── RemoveMemberDialog
├── TransferOwnershipDialog
├── DeleteBandDialog
└── EmptyState
```

### State Management
- Current band data
- Members array (fetched from bandMemberships + users)
- User's role in current band
- Invite code
- Selected member (for edit/detail)
- Modal states
- Search query
- Loading and error states

### Data Model
```typescript
interface BandMember {
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  instruments: Instrument[]
  primaryInstrument?: string
  joinedDate: Date
  status: 'active' | 'inactive'
}

interface Instrument {
  name: string
  proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}
```

### Permissions Logic
- **Owner:**
  - All actions
  - Cannot leave (must transfer)
  - Can delete band
- **Admin:**
  - Edit band info
  - Invite/remove members
  - Edit any member's instruments
  - Cannot remove owner or other admins
  - Can leave
- **Member:**
  - View all info
  - Edit own instruments
  - Can leave

---

## Design Specifications Reference

### Colors
- **Owner Badge:** #f17827ff (Orange)
- **Admin Badge:** #3b82f6 (Blue)
- **Member Badge:** #707070 (Gray)
- **Danger Actions:** #D7263D (Red)

### Role Hierarchy Display
```
👑 Owner (orange)
   ↓
🔑 Admin (blue)
   ↓
👤 Member (gray)
```

---

## Testing Checklist
- [ ] Can view band info
- [ ] Admin can edit band info
- [ ] Invite code displays and copies
- [ ] Share button works on mobile
- [ ] Regenerate code creates new code
- [ ] Members list displays correctly
- [ ] Search filters members
- [ ] Can view member details
- [ ] Admin can edit member instruments
- [ ] Admin can remove members
- [ ] Owner can make/remove admins
- [ ] Owner can transfer ownership
- [ ] Members can leave band
- [ ] Owner can delete band
- [ ] Role badges display correctly
- [ ] Permissions enforced correctly
- [ ] Mobile view responsive
- [ ] Empty state shows when alone

---

## Acceptance Definition of Done
- [ ] All user stories implemented
- [ ] Matches design style guide
- [ ] Responsive on mobile and desktop
- [ ] Role permissions enforced
- [ ] Orange primary color used
- [ ] Loading and error states
- [ ] Accessible
- [ ] No console errors
- [ ] Code reviewed and tested
- [ ] Integration with database complete
