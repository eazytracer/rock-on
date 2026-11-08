# Workflow: Sign up & get started

**Goal:** a new user is signed in and pointed at what they came for (a band, an event, a jam, or just their own songs) in under a minute.

## Flow

1. **Arrive:** often from a link (band invite, event invite, jam). The link must survive sign-up.
2. **Sign up / log in:**
   - **Apple**, **Google**, or email and password.
   - Sign-up asks for a display name; email sign-up confirms the email.
   - [Not built] **Apple sign-in** (required for iOS).
   - [Not built] **Forgot password**: today the link does nothing.
3. **Back to the link:** you're returned to where the link pointed (join preview, event, jam).
4. **Get Started** (no link and no band):
   - **Create a band** → `02-create-band-and-invite.md`.
   - **Join a band** with a link or code → `03-join-a-band.md`.
   - **Got an event code?** → the event.
   - **Continue solo** → Home in Personal.
5. **New-user walkthrough** on Home: dismissable, adapted to what you chose.

## Must

- A signed-out user hitting any protected link gets sent back to it after signing in.
- Clear, friendly errors: wrong password, unconfirmed email, cancelled Apple/Google sign-in.
- After sign-out or an expired session, say why ("You were signed out") on the login screen.
- A display name is set at sign-up. It's never derived from the email.

## Must not

- Dead buttons (Forgot password).
- Developer or test-login panels.
- Dropping the user on an empty screen with no next step.
