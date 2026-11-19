# 13 · Build brief: Account, band, friends (Phase 6)

**Status: built Nov 18 2026** (slices 6a–6g). Decisions answered Nov 18 (see Decisions at the end).

Phase 6 is next in the plan ([05](05-plan.md)). Unlike Phase 5 it is mostly **rework**: every screen exists in some
form (`AuthPages.tsx` 1.9k lines, `SettingsPage.tsx`, `BandMembersPage.tsx` 1.4k lines, `FriendsPage.tsx`), but
several of the things behind them are missing or broken. The research found more server work than UI work.

| Slice                       | What                                                                                                                                                             | Ships                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **6a** · Owner + band RPCs  | Migration starts: `'owner'` role + backfill + unique index, `create_band` / `band_preview_by_code` / `join_band` / `regenerate_invite_code` / member RPCs, pgTAP | `[Unreleased]`, as Phase 5 |
| **6b** · Band page          | `/band` replaces `/band-members`: invite card (link, QR, Regenerate), members with ⋯ by permission, transfer, leave, delete; More's band section                 | Same                       |
| **6c** · Create, join, mark | Create band (one field → the band, invite card on top), join preview + `/j/:code`, band mark picker, Band profile                                                | Same                       |
| **6d** · Auth screens       | Sign in, inline errors, forgot / check email / set new password, sign up, Get started's four rows, OAuth `returnTo`                                              | Same                       |
| **6e** · Settings           | Settings sections (Profile, Appearance, Music, Tunings, Notifications, Account, About), Profile + ordered instruments, Music prefs, push prefs, change password  | Same                       |
| **6f** · Delete account     | `created_by` FKs made nullable / SET NULL, `delete_account` RPC + edge function, owner block, typed confirm                                                      | Same, last                 |
| **6g** · Friends            | Privacy status line that rolls open, Add a friend sheet / dialog (by name · by code), `send_friend_request` enforcing the policy, richer name search             | Same                       |

One migration file (`supabase/migrations/2026112xxxxxxx_redesign_phase_6.sql`), created in 6a and amended in place.
No version number of its own (Phase 5 decision 3 still holds).

## Read first

- `design/source/DECISIONS.md`: Part A · 4 (owner role and backfill), band create / join (lines ~148–149), friends,
  settings, delete account.
- `design/OPERATIONS.md`: bands, memberships, invites, friends, preferences, account.
- `docs/redesign/03-screens.md` → "Account, settings, band, friends"; `04-data.md` → Bands, profiles, preferences.
- Design: `demo/screens/Account and Settings.html` (1–11), `Band and Friends.html` (1–11), `Band Identity.html`,
  `Final Pass.html` (FP 14), `Tools on Home.html` (4, More); desktop `demo/desktop.js:133–142`,
  `desktop-more.js:60–93`, `desktop-final.js:114–131`.

---

## Part 1 · Where things stand

### 1.1 Auth (`src/pages/AuthPages.tsx`)

- **Sign in** works with email and Google, in the old styling ("Welcome Back", gradient "R" tile).
  **Forgot password? is dead** (a button with no handler, `:789`). Errors are Supabase's raw message under the
  password field; session-expired and OAuth errors are toasts.
- **Sign up** (name, email, password + confirm) works; its Check your email panel has no resend.
- **Forgot / reset / set new password don't exist.** Nothing calls `resetPasswordForEmail` or `updateUser`.
- **Get started** has all four paths, as inline forms, Solo first. Create lands on `/songs` with a toast of the code.
  **Join has no preview** and is a multi-step write from the client (against [08](08-api-conventions.md)).
- **Google only.** Its `redirectTo` drops `returnTo`, so signing in with Google loses a pending join link. Apple is
  disabled in `supabase/config.toml`. Server password minimum is 6, client 8.
- Dev-only: mock-user quick logins and the build ID on the sign-in page. Dead code: `_CreateBandModal`,
  `_JoinBandModal` and dropdowns (`:1284–1800`).

### 1.2 Settings (`src/pages/SettingsPage.tsx`) and More

- Sections today: Account (read-only email, name, user ID), Appearance (done, saves `user_preferences.theme`), Tunings
  (done in 5g), Data & Privacy, App Info, Dev.
- **Delete account doesn't delete anything:** it types DELETE, clears the cache and signs out (`:58–90`, TODO `:69`).
  Its copy says it deletes "all bands you created", which contradicts the design.
- **No Profile, Music, Notifications or change password.** `user_preferences` already has `metronome` and `push` JSONB
  columns (Phase 0), unused; `services/api/preferences.ts` reads only theme, list views and chart.
- **Instruments** are `user_profiles.instruments TEXT[]` + `primary_instrument`; the primary is read or written in
  six places. The only editor is in `BandMembersPage` (★ primary), and it writes _other people's_ profiles, which RLS
  (update-own) silently refuses.
- **Some users have no `user_profiles` row**; `updateUserProfile` uses `.update()`, so their saves do nothing.
- More: band card + Manage band, a You row to Settings, Jam, Friends, Settings, Help (a "coming soon" toast), Sign out.
  Missing the design's Band rows (Members · Band profile · Invite) and the theme toggle.

### 1.3 Band (`src/pages/BandMembersPage.tsx`)

- **Ownership is effectively unset.** The app never sets the `'owner'` flag in `band_memberships.permissions`; only
  seed data has it. The creator trigger inserts `role='admin'`.
- **Transfer is broken:** `useUpdateMemberRole` maps owner → admin, so "transfer" makes both people admins.
- **Only a band's creator can change or remove members** (update / delete policies check `bands.created_by`); a
  non-creator admin's changes fail silently.
- Invite card: code, Copy, Share, Regenerate. **Regenerate never deactivates the old code**, and codes are created
  with `max_uses = 10`, so a code silently stops after 10 joins. No link, no QR.
- Member ⋯: Edit instruments (anyone's), Make / Remove admin, Transfer (typed "TRANSFER"), Remove.
  Plus a member detail modal and a Members / Created / Description stats grid.
- **No Leave or Delete band in the UI.** Services exist: `leaveBand` (last-admin check, sets inactive),
  `deleteBand` (refuses bands with any content, hard-deletes).
- `BandMark` is initials on fixed orange. No picker, no Band profile screen, no storage bucket in any migration.

### 1.4 Friends (`src/pages/FriendsPage.tsx`)

Closest to done: code + copy + QR, Discoverable switch and request policy (always open), name search inline, add by
code in a modal, Requests / Sent / Friends. Design wants privacy as a status line that rolls open, an Add a friend
sheet with "By name · Friend code" and "Share my code", order Requests · Friends · Sent, ⋯ per friend.
**The request policy (code only, friends of friends) is enforced nowhere**; the insert policy checks only the
requester.

### 1.5 Security holes found (all in this phase's tables)

Verified in `20251106000000_baseline_schema.sql`:

- `memberships_insert_self` (`:1299`) only checks `user_id = auth.uid()`: **anyone signed in can add themselves to
  any band, as any role.**
- `invite_codes_select_authenticated` (`:1340`) is `USING (true)`: **anyone signed in can read every invite code.**
- The friend request policy above.

Phase 6's RPCs replace the client writes these policies exist for, so closing them is part of the work, not extra.

---

## Part 2 · The target

### 2.1 Routes

| Route                                                            | Was                      | Notes                                              |
| ---------------------------------------------------------------- | ------------------------ | -------------------------------------------------- |
| `/auth` (sign in), `/auth/signup`, `/auth/forgot`, `/auth/reset` | `/auth` with view state  | Full screen, no sidebar on desktop (420 px column) |
| `/get-started`                                                   | same                     | Four rows; each opens its own screen               |
| `/j/:code`                                                       | none                     | Join preview; signed out → sign in → back here     |
| `/band`, `/band/profile`, `/band/new`                            | `/band-members`          | No redirect from the old path (decision 14)        |
| `/settings/:section`                                             | `/settings` (scroll-spy) | Phone: list → sub-screens; desktop: tabs           |
| `/friends`                                                       | same                     |                                                    |

### 2.2 Shared pieces

Reuse what Phases 4–5 built: `BackCrumb`, `MoreButton`, `Sheet` / `SheetItem`, `ConfirmDialog` (typed variant for
delete band / delete account), `Segmented`, `PageTitle`. New and shared: an auth screen frame (logo, column, inline
error slot) used by every auth screen; an `InviteCard` used on the band page, after create, and on More;
`BandMarkPicker`; an ordered `InstrumentList` (drag, ×, add chip).

### 2.3 Data the screens read and write (all through RPCs or owner-only tables)

- `user_preferences.metronome` (click sound) and `.push` — merged writes, never whole-column overwrites.
- `user_profiles`: `display_name`, `instruments` (ordered), `personal_color` — upserted.
- Bands: `mark`, profile fields, invite codes, memberships — RPCs only once 6a lands.

---

## Part 3 · Data and API

### 3.1 Migration

1. **Owner role.** Allow `'owner'` in `membership_role_check`. Backfill per Part A · 4: holders of the `'owner'` flag
   (earliest joined wins), else `bands.created_by` if still an active member, else the earliest admin. Partial unique
   index on `(band_id) WHERE role = 'owner' AND status = 'active'`. Creator trigger inserts `'owner'`. Rewrite
   `get_user_emails` without the flag. **Dry-run the backfill against production data before pushing.**
2. **Bands.** `mark JSONB` (kind, initials, symbol, colour, lettering; default initials + orange), `city`, `genres
TEXT[]`, `links JSONB`, `deleted_at` (soft delete).
3. **RPCs** (`SECURITY DEFINER`, `SET search_path = public`, errors as `RAISE … MESSAGE = key, HINT = copy`, pgTAP each):
   `create_band`, `band_preview_by_code` (minimum fields, no leak on bad or expired codes), `join_band`,
   `regenerate_invite_code` (deactivates the old; codes last 24 h, unlimited uses, decision 10), `set_member_role`, `remove_member`, `transfer_ownership` (atomic), `leave_band` (owner
   refused → transfer), `delete_band` (owner, typed name, soft), `send_friend_request` (enforces policy),
   `find_people` (name search + instruments + mutual count), `delete_account` (see 6f).
4. **Policies.** Drop `memberships_insert_self`, the creator-only update / delete, and the open invite-code select,
   once the RPCs cover their callers.
5. **Profiles.** `personal_color TEXT`; instruments reordered with `primary_instrument` first (column kept, no longer
   read).
6. **Delete account.** Make the `created_by` / `added_by` FKs to `public.users` nullable with `ON DELETE SET NULL`
   (songs, setlists, shows, invite codes, song groups, castings, …; the full list is in the research notes). The
   `auth.users` row needs `auth.admin.deleteUser`, so an edge function (`delete-account`, JWT-verified, service role,
   recorded in `supabase/functions/FUNCTIONS.md`) calls the RPC then deletes the auth user.
7. No storage bucket: Upload waits (decision 9).

### 3.3 As built (Nov 18, migration `20261120120000_redesign_phase_6.sql`)

All RPCs: `SECURITY DEFINER`, `search_path = public`, execute for `authenticated` + `service_role`. Errors are
`P0001` with MESSAGE = key, HINT = user copy. Every band RPC can raise `forbidden` (not signed in / not an active
member / not allowed) and `not_found` (no such band, or soft-deleted). Thin client wrappers: `src/services/api/bands.ts`,
`src/services/api/friends.ts`.

| RPC                                                                                        | Returns                                                                                   | Rules / error keys                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_band(p_name, p_mark jsonb = null)`                                                 | `bands` row                                                                               | Owner membership via the creator trigger + a fresh 24 h code. `invalid_name` (1–60 trimmed), `invalid_mark`                                                                                                                                                                                                  |
| `band_preview_by_code(p_code)`                                                             | `name, mark, description, member_first_names text[], member_count, song_count, is_member` | No ids or emails. Bad / expired / regenerated / deleted-band → `invite_invalid`                                                                                                                                                                                                                              |
| `join_band(p_code)`                                                                        | `band_memberships` row                                                                    | `invite_invalid`, `already_member`. Former members re-activate as member                                                                                                                                                                                                                                     |
| `regenerate_invite_code(p_band_id)`                                                        | `invite_codes` row                                                                        | Owner / admin. Old code dies now; new: 8 chars, `expires_at` now() + 24 h, unlimited                                                                                                                                                                                                                         |
| `set_member_role(p_band_id, p_user_id, p_role)`                                            | membership                                                                                | `admin` / `member` only (`invalid_role`). Admins promote members; only the owner changes admins. Owner target → `owner_role_fixed`                                                                                                                                                                           |
| `remove_member(p_band_id, p_user_id)`                                                      | membership (inactive)                                                                     | Owner / admin; self → `forbidden` (use leave); owner → `cannot_remove_owner`; only the owner removes an admin                                                                                                                                                                                                |
| `transfer_ownership(p_band_id, p_user_id)`                                                 | new owner's membership                                                                    | Owner only; atomic; old owner → admin                                                                                                                                                                                                                                                                        |
| `leave_band(p_band_id)`                                                                    | membership (inactive)                                                                     | `owner_must_transfer`; sole owner → `owner_must_delete`                                                                                                                                                                                                                                                      |
| `delete_band(p_band_id, p_confirm_name)`                                                   | `bands` row (`deleted_at`)                                                                | Owner only; name trimmed, case-insensitive, else `confirm_mismatch`. Soft: retires codes, memberships inactive                                                                                                                                                                                               |
| `update_band_profile(p_band_id, p_name, p_description, p_mark, p_city, p_genres, p_links)` | `bands` row                                                                               | All optional (NULL = unchanged, `''` clears). Owner / admin. `invalid_links` (array of `{label?, url}`), `invalid_name`, `invalid_mark`                                                                                                                                                                      |
| `send_friend_request(p_target_user_id = null, p_code = null)`                              | `friend_requests` row                                                                     | A code skips the target's policy. `not_found`, `cannot_friend_self`, `already_friends`, `request_pending`, `requests_closed` (neutral). If they'd already asked you, it's accepted                                                                                                                           |
| `find_people(p_query)`                                                                     | `user_id, name, instruments, personal_color, mutual_count`                                | Discoverable only, not yourself, 2+ chars, max 20                                                                                                                                                                                                                                                            |
| `ensure_my_profile()`                                                                      | `user_profiles` row                                                                       | Creates the caller's row if missing                                                                                                                                                                                                                                                                          |
| `delete_account()`                                                                         | void                                                                                      | `auth.uid()` only. `owns_band` (HINT names the bands). Deletes personal rows, prefs, profile, friendships, requests, memberships, `public.users`; band rows keep `created_by` NULL. The `delete-account` edge function calls it with the user's JWT, then `auth.admin.deleteUser` (see the migration header) |

Shapes: `bands.mark` = `{kind: 'initials' | 'symbol', initials, symbol, color, lettering}` (initials derived from
the name if missing; `color` default `'orange'`; color / symbol / lettering are UI-owned keys, ≤ 32 chars). New
`bands` columns `city`, `genres` (default `{}`), `links` (default `[]`), `deleted_at`. `list_my_contexts()` returns
`mark` and hides deleted bands. Plain members can't read invite codes (owner / admins only). Memberships have no client
write policies: every change goes through an RPC. `user_profiles.personal_color`; profile saves upsert.

Seed (password `test123`): Eric owns Demo Band, Mike admin, Sarah member; Jess, Dana, Leo, Priya added. Eric's Friends:
Sarah, Leo; Requests from Mike, Dana; Sent to Jess. Dana is code-only (`DANA2345`), Leo friends-of-friends; Jess, Leo,
Priya findable. Demo Band: symbol mark, Seattle, genres, links, code `ROCK2025` (24 h from reset). 16 songs with
links of every type; 7 charts.

### 3.2 Removals and changes (need your OK; repo rule)

| Today                                                     | After                                                  |
| --------------------------------------------------------- | ------------------------------------------------------ |
| Typed "TRANSFER" confirm                                  | Plain confirm that names what changes (design)         |
| ★ primary instrument                                      | Ordered list; first shows first (design)               |
| Admins edit other members' instruments                    | Self only (decision 7)                                 |
| Member detail modal; Members / Created / Description grid | Gone; the member row and band card carry it (design)   |
| Custom instrument names in the band page modal            | Moves to the Settings instrument picker                |
| "Band created!" toast with the code                       | The band page with the invite card on top (design)     |
| `deleteBand` refuses bands with content, hard-deletes     | Soft delete, typed name, members' My Songs copies stay |
| Invite codes: 10 uses, never expire, old ones live on     | 24 h, unlimited uses; Regenerate kills the old         |
| `/band-members`                                           | `/band`, no redirect                                   |
| Last-admin rule on leave                                  | The owner must transfer first                          |
| Get started inline forms, Solo first                      | Four rows in the design's order, each its own screen   |
| Settings: read-only User ID                               | Gone (dev section stays in dev)                        |
| Fake delete account                                       | Real delete                                            |

---

## Part 4 · Slices

### 6a · Owner + band RPCs

Migration with 3.1 items 1–4, pgTAP for every RPC (transfer atomic; preview leaks nothing; join refuses inactive
codes; regenerate kills the old; non-owners can't transfer or delete). Repository methods call the RPCs; the client
role type widens to include `'owner'`.

### 6b · Band page

`/band`: band card, `InviteCard` (code, link, QR, Copy, Share, "Expires in 23 h", New code when expired, Regenerate with
warning), Members with search and ⋯ by
permission (Make admin / member, Transfer to ‹name›…, Remove), Danger zone (Transfer… / Leave / Delete band…). More
gets the Band section (card subtitle "Owner · 3 members", rows Members · Band profile · Invite).

### 6c · Create, join, mark, Band profile

Create: name under a live mark, then the band with the invite card on top. Join: `/j/:code` and Get started → code →
preview (mark, description, first names, song count; big Join, small Not now; an expired code says so without naming
the band). Band mark picker (Initials / Symbol, 16 colours, 8 letterings). Band profile: mark, city, genres, links, edited in place.

### 6d · Auth screens

Auth frame; Sign in (Google standard button, OR rule, email, password with eye, Forgot password?, New here?);
inline errors (wrong password offers reset; session expired; cancelled social sign-in); Forgot → Check your email
("check your email", the address, Resend countdown, Use a different email; no Open Mail) → Set new password; Sign up
(name, email, one password with eye); Get started rows ("Got a jam code?"). OAuth carries `returnTo`. Keep the dev quick logins.

### 6e · Settings

Phone: a list (profile row, Appearance inline, Account, Music, Notifications, About, Delete account… alone at the
bottom) with sub-screens. Desktop: tabs. Profile (name, ordered instruments, personal colour). Music (Tunings +
click sound: Beep (today's) / Woodblock / Hi-hat) into `user_preferences.metronome`, read by the metronome; the Tools
screen itself doesn't change (decision 6). Notifications (push prefs, "Push isn't on
yet"). Account (sign-in methods, change password with the current one). About (version, What's new, Help).

### 6f · Delete account

FK changes, `delete_account` RPC + edge function, owner block ("transfer the bands you own first"), typed confirm.
pgTAP: personal rows go, band rows stay with `created_by` null, owners refused.

### 6g · Friends

Privacy status line that rolls open; Add a friend sheet (phone) / dialog (desktop) with By name · Friend code and
Share my code; Requests · Friends · Sent; ⋯ per friend; `send_friend_request` + `find_people`.

---

## Decisions (Nov 18 2026, answered with the user)

**Auth**

1. **No Apple yet.** Apple sign-in comes with the Flutter apps. Phase 6 ships Google only; the OAuth call takes the
   provider as a parameter so Apple is a config change and a button later.
2. **Sign up and Set new password** (not drawn) use the auth frame and the kit like the other auth screens. Sign up =
   name, email, one password with eye (no confirm field) → Check your email → Get started. Set new password = one field
   with eye + Save → Home.
3. **"Got a jam code?"** with "Jump straight into a jam or event." Kept thin: a code entry that calls today's
   event join; Phase 7 rebuilds it.
4. **Password minimum 8**, server and client. Local `config.toml` changed; the hosted setting is in
   [LAUNCH-TODO.md](LAUNCH-TODO.md).
5. **No Open Mail.** Check your email says to go check your email, shows the address, Resend countdown, Use a
   different email.

**Settings**

6. **Music:** a Music tab on desktop too (Tunings + metronome). Click sound Beep (default, today's) / Woodblock /
   Hi-hat, synced. Flash stays as it works today; no vibrate; last BPM / signature / subdivision stay per device. **The
   tools themselves don't change**: Settings stores the choice, the metronome reads it.
7. **Instruments: self only**, a simple ordered list in Profile. Instrument labels aren't used much yet; no extra work
   on them.
8. **Delete account:** personal things deleted; band songs / setlists / shows stay with the band (creator shown as
   "Former member", `created_by` set to null); blocked while you own a band; typed DELETE.

**Band**

9. **Band mark:** Initials + Symbol now, Upload later. **16 colours** (Band Identity's 10 plus 6 that work in both
   themes and don't clash with the context accents), 8 letterings from Band Identity, fonts loaded only in the picker.
10. **Invite codes last 24 hours, unlimited uses.** The card shows "Expires in 23 h"; expired → New code (owner /
    admin). Regenerate still kills the current code early. An expired or regenerated link says so without naming the
    band. A new band opens with a fresh code. Fixed 24 h, no duration picker. (`invite_codes.expires_at` exists.)
11. **Band profile** (mark, city, genres, links) in Phase 6, edited in place; no public page.
12. **A sole owner** gets Delete band… (typed name, soft delete) instead of Leave.
13. **Close the three security holes** (1.5) as part of moving joins, member changes and friend requests to RPCs.
    Check events / jam code for direct membership inserts before dropping `memberships_insert_self`.
14. **URLs:** `/band`, `/band/profile`, `/band/new`, `/j/:code` on the app's own domain. **No redirects** for old links
    (`/band-members` just goes).

**Friends**

15. **Request policy enforced** in `send_friend_request`: friends of friends needs a shared friend; code only needs
    the code. A refused sender sees "They aren't taking requests this way. Ask for their friend code."

## Risks

- **The owner backfill runs on production data** where the flag is almost never set; most bands fall back to
  `created_by`. Dry-run it and read the result before pushing.
- **Real delete account is irreversible.** Build it last, behind the owner block and the FK changes, with pgTAP.
- Moving joins to RPCs and dropping the self-insert policy breaks anything else that inserts memberships directly
  (events and jam code paths: check before dropping).
- Many e2e specs target today's band page and Get started markup; keep test ids where the element survives.
- Phase 7 rebuilds the jam-code path; don't over-build it in 6d.
