# Workflow: Account (profile, settings, delete)

**Goal:** people control how they appear to others and how the app behaves for them, and can leave entirely.

## Profile [Not built]

- Display name, photo, instruments (a fixed list plus "Other", one starred as primary).
- Reached from More (your account row), Settings, and your own row on Band Members.

## Settings

- **Profile:** link to the profile above.
- **Account:** email, sign-in methods (Apple / Google / password), change password.
- **Tunings:**
  - Create custom tunings: instrument, string count, notes, name, colour.
  - Built-ins are read-only.
  - Deleting a tuning keeps its label on songs that use it.
- **Notifications:** [Future] per-type push on/off. Types:
  - Show or practice added or changed.
  - RSVP requested.
  - Upcoming show's set changed.
  - Scheduled jam going live.
  - Friend request.
  - Practice-prep reminder.
- **Appearance:** System / Light / Dark.
- **About:** version, What's new, Help & feedback.

Song display options live on the lists themselves, not in Settings.

## Help & feedback [Not built]

- Send feedback: message, optional screenshot, app version attached automatically.
- A link to What's new.

## Delete account [Not built]

- Type DELETE to confirm.
- Works like leaving every band: band content stays with the bands.
- Your personal catalog, notes, friends and profile are permanently deleted.
- Owners must transfer or delete their bands first.
- Required by the app stores; it must really delete.

## Must not

- A developer section, or "clear local data".
- A fake delete that only signs you out.
