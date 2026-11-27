# Rock On · decisions

Hard rules: what the app must and must not do. One bullet each: the rule, the date it was decided, and why. The
code is the source of truth for how; this page records only the rules that constrain future work. Add a bullet
when a rule is decided; edit it when a rule changes (newer wins, no history here; git keeps it). Coding rules live
in `CLAUDE.md`; the design team's full record is `design/source/DECISIONS.md`.

## Product scope and platforms

- The web app is online-only: no offline mode, one offline banner, edits blocked with no connection (Nov 7 2026), because offline is left to the native apps.
- The web client does no phone-only workarounds (metronome wake lock, iOS silent switch, iOS audio session); the Flutter app handles them (Nov 16 2026), because they can't be done well in a browser.
- No Apple sign-in until the Flutter apps; the OAuth call takes the provider as a parameter (Nov 18 2026), so adding Apple is config plus a button.
- Any change that removes or hides an existing capability is flagged and asked first (Oct 30 2026), so nothing disappears silently.
- Both platforms in the same pass: a screen isn't done until phone and desktop both match (Nov 7 2026), so parity doesn't drift.
- Practice history, month view, push delivery, RSVP, band history, public band profile and practice count-in are not in the redesign launch (Nov 7–16 2026), to keep launch scope fixed.
- Band casting (who plays what per song on band setlists and shows) is a future "band director" tier reusing the jam Grid view; its tables (`song_castings`, `casting_templates`, `song_assignments`) stay until then (Nov 20 2026), for larger groups that swap members per song.
- The redesign ships as one release: no per-phase version numbers after Phase 4; work goes under CHANGELOG `[Unreleased]` (Nov 16 2026), because it ships as one package.

## UI rules

- Never native date / time inputs or `<select>`; use the kit pickers (Oct 31 2026), because native ones can't be themed or tested.
- Colours come from the design tokens (`src/index.css`, `tailwind.config.js`, `src/utils/tokens.ts`; tunings via `tuningColor()`), never raw hex (Jul 5 2026), so the dark theme and accent stay one system.
- Overlays by job: full-screen route for anything with fields, bottom sheet for picks and actions, dialog only for destructive confirms that name the consequence, toast for your own actions (Oct 30 2026), for one predictable model.
- Typed confirmation only for deleting an account or a band; transfer ownership is a plain confirm (Oct 30 2026), so friction matches the damage.
- Every list has a skeleton while loading, an empty state with its action, and an error with Retry (Oct 30 2026), so no list is ever blank.
- Targets at least 44 px (64 on stage screens); body text 16, never below 13 (Oct 30 2026), for touch and stage use.
- Icons: caret ⌄ only opens something right there; swap ⇄ opens a sheet that changes what you're looking at; chevron › means go there or pick a value (Nov 8 2026), so an icon promises what happens next.
- The sidebar stays on every desktop page; only stage screens (chart reader, practice session, jam host) take the full window (Nov 8 2026), so navigation never vanishes.
- Tunings always show colour and name; built-in hues stay as they were except Drop D (lime) and Drop C (fuchsia) (Nov 7 2026), because bands' muscle memory wins.

## Songs and notes

- A song is edited only on its song page, field by field with Undo; the full-screen editor is Add song only (Nov 8 2026), so there's one place to edit.
- Every shared write sends `version`; on a conflict, show the latest value, and for notes keep the draft and ask (Nov 8 2026), so nobody's edit is silently lost.
- Back from a song, setlist or chart follows the `?from=` origin, never `history.back()` (Nov 8 2026), so deep links never leave the app.
- A song has one shared band note (`songs.notes`, with last editor); `song_note_entries` are the practice log; My notes are private (Nov 7 2026), so there's one band note to read.
- Duplicate song copies facts, links and chart, not notes (Nov 16 2026), since notes are about the original.
- A My Songs linked copy gets its own chart, copied once, with no fallback to the band's (Nov 16 2026), so the two can diverge cleanly.
- Charts are stored as ChordPro; the client converts chords-over-lyrics on paste (Nov 16 2026), so the server stores one format.
- Chart reader: every arrow, PgUp / PgDn and Space page; transpose has no keys (Nov 16 2026), so a pedal can never change key.

## Setlists, shows and practices

- A show's set is a copy of the setlist; editing it never changes the source setlist (Nov 7 2026), so a played set is a record.
- Setlists have no status (draft / active / archived) (Nov 7 2026), because sort by next show replaces it.
- Show Confirmed is its own field beside status (Nov 7 2026), so Undo of Cancelled restores exactly what was there.
- Instruments are an ordered list with no primary; first shows first; each user edits only their own (Nov 7, Nov 18 2026), so order carries the meaning.

## Tools

- Metronome clicks are scheduled on the AudioContext clock with lookahead, visuals from rAF; never JS timers (Oct 30 2026), for sample-accurate timing.
- Tempo range 30–260 everywhere, one constant (Nov 16 2026), so every entry point agrees.
- The tuner starts on the song's tuning but isn't tied to it; tuner memory is per device (Nov 16 2026), since tuning is about the instrument in hand.
- Ask for the microphone on first press, never on load (Nov 16 2026), because browsers punish load-time prompts.
- Custom tunings: per string −12 to +7 semitones from standard; Guitar 6 / 7 / 8, Bass 4 / 5 / 6; no duplicate of a built-in or another custom tuning in the context (Nov 16 2026), because strings flop or snap beyond that and duplicates confuse pickers.
- Settings stores metronome sound choices; the tools read them and don't change for it (Nov 18 2026), to keep the tools simple.

## Bands and members

- A band has exactly one owner, enforced by the database (`role='owner'`, partial unique index) (Nov 7 2026), so ownership is never ambiguous.
- Transfer ownership is one atomic call (old owner → admin); an owner must transfer before leaving; a sole owner gets Delete band instead (Nov 7, Nov 18 2026), so a band is never ownerless.
- Only the owner deletes a band: typed name, soft delete; members' My Songs copies stay (Nov 18 2026), because deletion is irreversible for others.
- Admins promote members; only the owner changes admins or removes an admin; nobody removes the owner (Nov 18 2026), to keep the hierarchy strict.
- Invite codes last 24 hours with unlimited uses; Regenerate kills the old code now; an expired or bad code says so without naming the band (Nov 18 2026), so leaked codes die fast and leak nothing.
- Only the owner and admins can read invite codes; memberships have no client write policies, every change goes through an RPC (Nov 18 2026), which closed the self-join hole.
- Band marks: initials or symbol now, upload later; 16 colours; the context accent stays orange in any band (Nov 18 2026), so the accent always means "band".
- Band URLs are `/band`, `/band/profile`, `/band/new`, `/j/:code`; old links don't redirect (Nov 18 2026), so no legacy routes linger.

## Account, auth and friends

- Password minimum 8, on server and client (Nov 18 2026), as a baseline for account security.
- Delete account removes personal data; band songs, setlists and shows stay with the band credited to "Former member" (`created_by` null); blocked while you own a band; typed DELETE (Nov 18 2026), so leaving doesn't break the band's content.
- Delete account hands a band's events to the band owner and deletes personal events (Nov 19 2026), so a band's jams survive.
- Friend requests follow the target's policy (friends of friends needs a shared friend; a friend code always works); a refused sender gets a neutral message (Nov 18 2026), so privacy settings hold.

## API and data

- One-row reads and writes whose only rule is "who may" use PostgREST + RLS; anything with several writes, an invariant, derived data or validation goes in a Postgres RPC; third parties and secrets go in an edge function (Nov 7 2026), so web and Flutter share one contract.
- Never orchestrate a multi-step write from the client (Nov 7 2026), so writes stay transactional.
- RPCs are `SECURITY DEFINER`, `SET search_path = public`, check access themselves, use `p_` params with defaults for optional ones, and return the affected rows (Nov 7 2026), so they're typed and safe to extend.
- RPC errors: `RAISE … ERRCODE 'P0001', MESSAGE = stable key, HINT = user copy`; keys never change; `forbidden`, `not_found`, `stale_version` are shared (Nov 7 2026), so clients switch on keys and can localise.
- Shared edits take `p_expected_version`; lists use keyset pagination (`p_after`, `p_limit` default 50, max 200), never offsets (Nov 7 2026), for safe concurrency and stable paging.
- Display maths stays in pure functions in `src/domain/` (Nov 7 2026), so it ports to Dart line for line.
- Every RPC gets pgTAP: happy path, each error key, and a non-member denied (Nov 7 2026), because those tests are the contract both clients rely on.

## Jam

- One social type, Jam, built on the Events tables; the 0.3 jam-session screens retire (Nov 7 2026), so there's one "join with a code" feature.
- Only web guests and the kiosk write without an account, through tokens scoped to one jam that die when the jam ends (Nov 7, Nov 20 2026), to keep anonymous writes narrow.
- A guest token lets a guest set a first name (≤ 40) and parts, raise / lower their own hands, pitch while requests are open, and leave; nothing else; joins, hands and pitches are rate-limited per token and per IP (Nov 7 2026), to limit abuse.
- Ending a jam deletes guest names, hands and live tokens; played songs remain (Nov 7 2026), as the design promises guests.
- Each guest-callable function starts with the token check and a one-line comment saying what it allows; pgTAP sweeps every function granted to `anon` (Nov 20 2026), because the code is the record.
- Pitches are pending lineup entries; "Show song requests to everyone" defaults on and is on probation: drop it if usage shows nobody turns it off (Nov 20 2026), so one model covers requests and lineup.
- One "Who can join" setting: Invite only, Friends, Anyone with the code (default); codes work only in Anyone; participants can invite friends in Friends and Anyone (Nov 20 2026), so visibility has one control.
- Jam codes are random 8 characters shown `ABCD-EFGH`, no look-alikes; `/j/:code` is shared with band invites and a code is never both (Nov 20 2026), so one link format serves both.
- Jam songs are a "jam" tag on your personal songs; joining shares from your personal catalog only (Nov 20 2026), so nothing band-private leaks.
- Tags belong to the song's context: a band song's tags are the band's, a My Songs copy has its own (Nov 20 2026), so contexts don't bleed into each other.
- Song matching is a normalised exact match on title + artist in SQL; no fuzzy matcher (Nov 20 2026), because it's predictable and testable.
- The host sets the jam's starting parts; a part is a key plus an optional label; more hands than slots is fine (Nov 20 2026), so any lineup fits.
- The kiosk never holds the host's login: it pairs by QR or a one-time code onto a kiosk token that dies with the jam; exit is a device-local PIN (Nov 20 2026), so a shared iPad can't be hijacked.
- No Cancel: planned jams can be deleted (people are notified); live and ended jams can't (Nov 20 2026), to keep the history of nights that happened.
- Casting is hands plus host accept, one data model, with a Grid view over it (Nov 20 2026), so there's no second casting system.
- Joining a jam counts as Going; RSVP waits for Phase 8 (Nov 20 2026), because jams are mostly ad hoc.
- Per-IP limits are generous for real use (a bar's guests share one Wi-Fi IP: 300 web-guest joins, 1000 code lookups per 10 min) and strict for wrong codes (30 per 10 min across preview / resolve / join / TV) (Nov 20 2026), because guessing is what limits are for, not crowds.
- Cut from v1: lock-screen card, kiosk "who you're with", the "Say hi" wave, the go-live reminder (Nov 20 2026), to ship the core night first.
