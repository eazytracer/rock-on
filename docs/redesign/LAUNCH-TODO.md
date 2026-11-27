# Redesign launch to-do

Manual steps the code can't do: settings on the hosted Supabase project (or elsewhere) that must change when the
redesign ships. Add to this list as phases need them; tick items off when done.

## Hosted Supabase (Authentication settings)

- [ ] **Password minimum length → 8** (Phase 6 decision 4). Local `supabase/config.toml` is set to match; the client
      requires 8. Existing shorter passwords keep working; the rule applies when a password is set or changed.
- [ ] **Redirect URLs** (Authentication → URL Configuration, Phase 6 slice 6d). Site URL = the production origin.
      Production origin: `https://www.rockon.band` (`https://www.rockon.band/**` and `https://rockon.band/**` are
      already in the allow list; the Site URL was still `http://localhost:5173` on Nov 26 2026).
      Add `https://<prod-origin>/auth/callback**` (Google and sign-up confirmation links carry `?returnTo=…`) and
      `https://<prod-origin>/auth/reset` (password reset links). A link whose `redirectTo` isn't listed falls back to the
      Site URL; the app then forwards a recovery session to `/auth/reset`, but `returnTo` is lost. Local
      `supabase/config.toml` now lists `http://localhost:5173/**` (applies after a Supabase restart).
- [x] **Link expiry 1 hour** (Email OTP expiration = 3600 s; already set on hosted, checked Nov 26 2026). Forgot
      password and Check your email say "works for 1 hour". The resend interval (60 s) matches the app's countdown.
- [ ] **Custom SMTP**, deferred (Nov 26 2026) as the first feature after launch. Until then hosted email is capped at a
      few emails an hour, so Resend and password reset can hit a rate-limit error.
- [x] **Google provider** stays enabled (checked Nov 26 2026); Apple stays off until the Flutter apps (decision 1).

## Database

- [x] **Dry-run the Phase 6 owner backfill against production data** before `db push`: every band must end up with
      exactly one owner (old owner flag → creator → earliest admin → earliest member). Done Nov 26 2026: every
      migration on a fresh prod data dump; all 6 bands have exactly one owner.

## Jam guests, bar TV, counter iPad (Phase 7c)

- [ ] **Client IP header behind the hosted gateway.** `_jam_ip()` takes `cf-connecting-ip`, else `x-real-ip`, else the
      last `x-forwarded-for` hop. From a phone on mobile data and from a second network, call `resolve_code` and read
      `jam_rate_limits` (bucket `code`): the key must be that client's public IP, not a gateway / load-balancer address
      (if every row shares one key, the per-IP limits throttle everyone at once). Also check a client-sent
      `X-Forwarded-For: 1.2.3.4` doesn't change the key.
- [ ] **Per-IP limits vs a bar's shared Wi-Fi.** Guests on one venue network share a public IP. Caps per IP per
      10 minutes: 300 web-guest joins, 1000 code lookups, 600 TV polls, and 30 wrong codes across preview / resolve /
      join / TV. Past the wrong-code cap even the right code is refused for everyone on that IP. Watch
      `jam_rate_limits` (bucket `code_miss`) on the first real nights and raise the cap if typos trip it.
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
