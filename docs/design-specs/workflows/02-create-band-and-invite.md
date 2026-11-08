# Workflow: Create a band & invite members

**Goal:** go from a new account to a band your bandmates have joined, in a few minutes, without help.

## Flow

1. **Start:** you reach "Create or join a band" from Get Started (after sign-up), the context switcher, Home, or More.
2. **Create:**
   - Enter a band name; that's the only required field.
   - You become the **owner**, and the band gets a reusable invite code.
3. **Land:** you arrive on Home in the new band's context, with the **new-band walkthrough**:
   - Invite bandmates.
   - Add your first songs.
   - Build a setlist.
   - Schedule a practice.

   Each item ticks itself off when done, and the whole walkthrough can be dismissed.

4. **Invite** (Band Members, or the walkthrough):
   - Share an **invite link** through the phone's share sheet, or copy it.
   - Show a **QR code** for bandmates in the room.
   - The **code** itself is shown for typing in.
5. **Bandmate joins:**
   - They tap the link (or scan, or enter the code).
   - They sign up or log in if needed, and the invite survives that step.
   - They see a **band preview**: name, a few member names, member count, and a **Join** button.
   - They land on Home in the band's context.
6. **Owner organises:** makes trusted members admins, and members add their instruments.

## Must

- Creating a band asks for its name only. Description and other details come later, under Edit Band Info.
- Invite link, QR and code all lead to the same preview-then-join screen.
- Joining when you aren't signed in carries you through sign-up and back to the join preview.
- Clear messages for: an expired code, a code at its use limit, already a member, and a code that doesn't exist.
- Only the owner and admins see invite controls. **Regenerate** warns that the old link and code stop working.
- The new member sees the band in the switcher straight away. The owner sees them in Members in real time.
- Member list:
  - Name, role badge (Owner / Admin / Member), instruments with a starred primary, joined date.
  - Email shown to the owner and admins only.
- Admin actions:
  - The owner can make or remove admins, and transfer ownership (type a confirmation; the old owner becomes an admin).
  - The owner and admins can remove members.
  - Admins can't remove other admins.

## Must not

- Join someone to a band without the preview and an explicit tap on **Join**.
- Show bandmates' emails to non-admins.
- Reload the app when switching to the new band.
- Leave a brand-new band on an empty screen with no next step.

## States

- **No band yet:** Home, More and the switcher all offer "Create or join a band".
- **Band of one:** Members shows you alone, plus a prominent invite card.
- **Lost the code?** Admins can always see the current code and link on Band Members.

## Future

- [Future] Email invitations.
- [Future] Instruments from a fixed list plus "Other", on your profile.
- Leave band / delete band: covered in `12-manage-band.md`.
