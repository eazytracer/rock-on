---
timestamp: 2025-10-22T00:51
prompt: "Create an artifact laying out band management userflows including editing band name, invite codes, removing members, assigning default instruments, and other common use-cases"
---

# Band Management User Flows

## Overview
This document outlines the core user flows for band management functionality in the Rock-On application. These flows cover the most common operations users will need to perform when managing their bands.

---

## 1. Creating a New Band

**User Flow:**
1. User clicks "Create New Band" button (in bands section or main navigation)
2. Modal/form appears with fields:
   - Band Name (required)
   - Description (optional)
   - Genre (optional)
3. User fills in band name and submits
4. System generates unique invite code
5. User is automatically added as band admin/owner
6. User is redirected to band details page or band list with success message

**Edge Cases:**
- Duplicate band names allowed (different bands can have same name)
- Minimum 2 characters for band name

---

## 2. Viewing Band Details

**User Flow:**
1. User navigates to Bands section
2. User sees list of their bands (both owned and member of)
3. User clicks on a band to view details
4. Band details page shows:
   - Band name
   - Description
   - Member list with roles/instruments
   - Invite code (for admins)
   - Band settings (for admins)
   - Shared songs count
   - Shared setlists count

**Information Hierarchy:**
- Owner/admin status clearly visible
- Member count prominently displayed
- Active invite code visible to admins

---

## 3. Editing Band Information

**User Flow:**
1. User (with admin rights) navigates to band details
2. User clicks "Edit Band" or pencil icon next to band name
3. Editable form appears with current values:
   - Band Name
   - Description
   - Genre
4. User makes changes and saves
5. System validates and updates
6. Success message shown, changes reflected immediately

**Permissions:**
- Only band owners/admins can edit
- Non-admins see read-only view

**Edge Cases:**
- Empty band name prevents save
- Changes broadcast to other active members (future: real-time updates)

---

## 4. Managing Invite Code

**User Flow - Viewing Invite Code:**
1. Admin navigates to band details
2. Clicks "Invite Members" or "Get Invite Code"
3. Modal shows:
   - Current invite code (large, easy to copy)
   - Copy to clipboard button
   - QR code (optional future enhancement)
   - Share button for native share (mobile)

**User Flow - Regenerating Invite Code:**
1. Admin clicks "Regenerate Invite Code"
2. Confirmation dialog warns that old code will be invalidated
3. Admin confirms
4. New code generated and displayed
5. Old invites using previous code are invalidated

**User Flow - Sharing Invite Code:**
1. Admin clicks "Share Invite"
2. Native share dialog opens (mobile) or copy to clipboard (desktop)
3. Message template includes: "Join my band [Band Name] on Rock-On! Use invite code: [CODE]"

**Security Considerations:**
- Invite codes are unique per band
- Codes can be regenerated if compromised
- Track when codes were last regenerated

---

## 5. Joining a Band via Invite Code

**User Flow:**
1. User receives invite code from band admin
2. User clicks "Join Band" in app
3. Modal prompts for invite code
4. User enters code and submits
5. System validates code:
   - If valid: User added to band, sees success message, navigates to band details
   - If invalid: Error message shown with suggestions
6. User can now see band songs, setlists, and members

**Edge Cases:**
- Already a member: Show message "You're already in this band"
- Invalid code: "Invalid invite code. Please check and try again"
- Expired/regenerated code: "This invite code is no longer valid"

---

## 6. Viewing Band Members

**User Flow:**
1. User navigates to band details
2. Members section shows list of all members:
   - Avatar/initial
   - Name/username
   - Role/status (Owner, Admin, Member)
   - Default instruments
   - Join date
3. Admin can click on member for more options

**Display Priority:**
- Owner listed first
- Then admins
- Then members alphabetically

---

## 7. Assigning Default Instruments to Members

**User Flow:**
1. Admin navigates to band details → Members section
2. Clicks on a member or "Edit" icon next to their name
3. Member profile modal shows:
   - Current default instruments
   - "Add Instrument" button
4. Admin clicks "Add Instrument"
5. Dropdown shows all instruments (vocals, guitar, bass, drums, keys, etc.)
6. Admin selects one or more instruments
7. Admin can set proficiency level (optional: Beginner, Intermediate, Advanced, Expert)
8. Admin saves changes
9. These become the member's default instruments for casting suggestions

**Member Self-Service Flow:**
1. Member can edit their own default instruments from profile
2. Changes are visible to band admins
3. Used for automatic casting suggestions

**Use Cases:**
- Used for smart casting suggestions when assigning songs
- Visible when creating setlists
- Helps with quick role assignment

---

## 8. Removing Members from Band

**User Flow:**
1. Admin navigates to band details → Members section
2. Clicks on member to remove
3. Clicks "Remove from Band" button
4. Confirmation dialog appears:
   - "Are you sure you want to remove [Member Name] from [Band Name]?"
   - Warning: "They will lose access to all band songs and setlists"
   - Option to keep or remove their contributions (optional)
5. Admin confirms
6. Member is removed immediately
7. Removed member receives notification (if notifications enabled)

**Permissions:**
- Only owners/admins can remove members
- Owners cannot be removed (must transfer ownership first)
- Admins cannot remove other admins (only owner can)

**Edge Cases:**
- Cannot remove yourself if you're the only owner
- Member's song contributions remain but with "Former Member" tag
- Member's casting assignments are preserved in setlists for historical tracking

---

## 9. Managing Member Roles (Owner/Admin)

**User Flow - Promoting to Admin:**
1. Owner navigates to band details → Members
2. Clicks on member
3. Clicks "Make Admin"
4. Member is promoted with admin privileges

**User Flow - Demoting Admin:**
1. Owner clicks on admin member
2. Clicks "Remove Admin Rights"
3. Confirmation dialog appears
4. Admin is demoted to regular member

**User Flow - Transferring Ownership:**
1. Current owner navigates to member list
2. Clicks on member to make new owner
3. Clicks "Transfer Ownership"
4. Strong confirmation dialog:
   - "Transfer ownership of [Band Name] to [Member Name]?"
   - Warning: "You will become an admin. This cannot be undone."
5. Owner confirms
6. Ownership transferred
7. Previous owner becomes admin

**Permissions:**
- Only current owner can transfer ownership
- Only current owner can promote/demote admins
- Must have at least one owner at all times

---

## 10. Leaving a Band

**User Flow:**
1. Member navigates to band details
2. Clicks "Leave Band" (usually in settings/options menu)
3. Confirmation dialog:
   - "Are you sure you want to leave [Band Name]?"
   - Warning: "You will lose access to all band songs and setlists"
   - If owner: "You must transfer ownership before leaving"
4. Member confirms
5. Member is removed from band
6. Redirect to bands list

**Edge Cases:**
- Owner must transfer ownership before leaving
- Member's contributions remain with "Former Member" attribution
- Can rejoin using invite code if still valid

---

## 11. Deleting a Band

**User Flow:**
1. Owner navigates to band details → Settings
2. Scrolls to danger zone
3. Clicks "Delete Band"
4. Strong confirmation dialog:
   - "Permanently delete [Band Name]?"
   - Warning: "This will delete all band songs, setlists, and member associations"
   - Warning: "This action cannot be undone"
   - Requires typing band name to confirm
5. Owner types band name and confirms
6. Band and all associated data deleted
7. All members notified (if notifications enabled)
8. Redirect to bands list

**Permissions:**
- Only band owner can delete band
- Cannot be undone

**Data Handling:**
- All band-specific songs deleted
- All setlists deleted
- All member associations removed
- Members retain their personal songs

---

## 12. Band Member Capabilities View

**User Flow:**
1. User navigates to band details → Members
2. Clicks "View All Capabilities" or "Skills Matrix"
3. Table view shows:
   - Rows: Each member
   - Columns: Each instrument
   - Cells: Proficiency level or checkmark
4. Helps with quick casting decisions
5. Can be filtered by instrument

**Use Cases:**
- Quick reference for setlist planning
- Identify gaps in band capabilities
- Plan for multi-song role coverage

---

## UI/UX Considerations

### Navigation
- Bands accessible from main navigation
- Quick access to "My Bands" vs "Create Band"
- Breadcrumb: Bands → [Band Name] → Section

### Visual Indicators
- Owner crown icon
- Admin badge
- Member count badge
- Active/inactive status

### Mobile Optimization
- Swipe actions for quick member management
- Bottom sheet for invite code sharing
- Responsive member list layout

### Notifications
- New member joined
- Member removed
- Ownership transferred
- Invite code regenerated
- Band deleted

---

## Implementation Priority

**Phase 1 (MVP):**
1. View band details with members
2. Edit band name
3. View/copy invite code
4. Join band via invite code
5. Leave band

**Phase 2:**
1. Assign default instruments to members
2. Remove members (admin)
3. Regenerate invite code
4. Member capabilities view

**Phase 3:**
1. Promote/demote admins
2. Transfer ownership
3. Delete band
4. Advanced member management
5. Notification system

---

## Future Enhancements
- Real-time collaboration indicators
- Band activity feed
- Band-specific practice schedules
- Band performance history
- Member attendance tracking
- Public band profiles
- Band photo/avatar
- Band social media links
- Export band roster
- Member onboarding checklist
