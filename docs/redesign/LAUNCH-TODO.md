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

## Jam guests, bar TV, counter iPad (Phase 7c)

- [ ] **Client IP header behind the hosted gateway.** `_jam_ip()` takes `cf-connecting-ip`, else `x-real-ip`, else the
      last `x-forwarded-for` hop. From a phone on mobile data and from a second network, call `resolve_code` and read
      `jam_rate_limits` (bucket `code`): the key must be that client's public IP, not a gateway / load-balancer address
      (if every row shares one key, the per-IP limits throttle everyone at once). Also check a client-sent
      `X-Forwarded-For: 1.2.3.4` doesn't change the key.
- [ ] **Per-IP limits vs a bar's shared Wi-Fi.** Guests on one venue network share a public IP: 20 web-guest joins and
      60 code lookups (`/j/CODE` = 2: `resolve_code` + `jam_preview_by_code`) per 10 minutes per IP. A busy night can
      hit that in the first rush. Decide before launch whether to raise the join / code limits or key them on
      IP + code.
- [ ] **Realtime for anonymous visitors.** The web guest, TV and kiosk listen to the public broadcast topic
      `jam:<code>` with the anon key; confirm on hosted that an anon client receives `changed` (local does). Without it
      they still catch up on the 20 s poll.
- [ ] **Kiosk link host.** The counter iPad QR is `${origin}/kiosk#k=<token>&e=<jam>`; check the production origin
      opens it on an iPad camera scan, and that the hash never reaches server or CDN logs.

## App content

- [ ] **Terms and Privacy** (`/terms`, `/privacy`, `src/pages/LegalPage.tsx`): generic placeholder wording. Have it
      reviewed, add the operator's legal name and jurisdiction if advised, and update the date.
- [ ] **Support address**: `HELP_MAILTO` (`src/components/settings/AboutSettings.tsx`) is a placeholder,
      `support@rockon.band`. Point it at a real inbox.
