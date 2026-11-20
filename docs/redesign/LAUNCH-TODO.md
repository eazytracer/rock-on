# Redesign launch to-do

Manual steps the code can't do: settings on the hosted Supabase project (or elsewhere) that must change when the
redesign ships. Add to this list as phases need them; tick items off when done.

## Hosted Supabase (Authentication settings)

- [ ] **Password minimum length → 8** (Phase 6 decision 4). Local `supabase/config.toml` is set to match; the client
      requires 8. Existing shorter passwords keep working; the rule applies when a password is set or changed.
- [ ] **Redirect URLs** (Authentication → URL Configuration, Phase 6 slice 6d). Site URL = the production origin.
      Add `https://<prod-origin>/auth/callback**` (Google and sign-up confirmation links carry `?returnTo=…`) and
      `https://<prod-origin>/auth/reset` (password reset links). A link whose `redirectTo` isn't listed falls back to the
      Site URL; the app then forwards a recovery session to `/auth/reset`, but `returnTo` is lost. Local
      `supabase/config.toml` now lists `http://localhost:5173/**` (applies after a Supabase restart).
- [ ] **Link expiry 1 hour** (Email OTP expiration = 3600 s). Forgot password and Check your email say "works for 1 hour".
- [ ] **Resend interval ≥ 60 s matches** the app's Resend countdown (60 s). Hosted email without custom SMTP is capped at
      a few emails an hour, so set up custom SMTP before launch or Resend will often fail with a rate-limit error.
- [ ] **Google provider** stays enabled (client ID / secret); Apple stays off until the Flutter apps (decision 1).

## Database

- [ ] **Dry-run the Phase 6 owner backfill against production data** before `db push`: every band must end up with
      exactly one owner (old owner flag → creator → earliest admin → earliest member). Run `migration list --linked`
      first; a human reviews the push.

## App content

- [ ] **Terms and Privacy** (`/terms`, `/privacy`, `src/pages/LegalPage.tsx`): generic placeholder wording. Have it
      reviewed, add the operator's legal name and jurisdiction if advised, and update the date.
- [ ] **Support address**: `HELP_MAILTO` (`src/components/settings/AboutSettings.tsx`) is a placeholder,
      `support@rockon.band`. Point it at a real inbox.
