# Mobile ⇄ desktop parity

Updated Nov 7 2026 (final pass + build handoff Part A: Practice history deferred; jam guest web flow is the anonymous-write surface, see DECISIONS). ✓ in the demo · ✗ missing · partial (a control exists but is a stub) · — not on this layout by decision.
Intentional exceptions: Venue kiosk and Bar TV are desktop / iPad only; the jam guest flow is phone / web only on desktop (the desktop Invited row opens the guest view in Jam Night).
Mobile phones added Nov 7 live in `demo/screens/Final Pass.html`; desktop additions in `demo/desktop-final.js`. `demo/Jam Night.html` is a working jam at any width.

| Area | Feature | Mobile | Desktop |
|---|---|---|---|
| Core | Home (band / Personal / new band), walkthroughs | ✓ | ✓ |
| Core | Context switcher, switch prompt (long, then short) | ✓ | ✓ |
| Core | Global search, scoped + "all contexts" | ✓ | ✓ (⌘K or sidebar) |
| Core | Notifications popout, all, app updates | ✓ | ✓ |
| Core | Offline banner (one, at the top) | ✓ | ✓ |
| Songs | Catalog, sort = field + direction, view options, show hidden | ✓ | ✓ |
| Songs | Row actions (mobile swipe / hold; desktop hover + right-click) | ✓ | ✓ |
| Songs | Loading / empty / no matches / error | ✓ | ✓ (States panel) |
| Songs | Personal: band songs not in My Songs → Copy all / Pick | ✓ | ✓ |
| Songs | Song view, Used in, notes full screen | ✓ | ✓ (notes full screen partial) |
| Songs | Add / edit song: Spotify matches, album, tuning, key (circle of fifths), links, Also add to My Songs | ✓ | ✓ |
| Songs | Notes edited in place | ✓ | partial |
| Chart | Reader, Controls, show/hide chords, chord viewer | ✓ | ✓ |
| Chart | Chart editor (own screen): paste, lyrics + chords / chords only, starting note | ✓ | ✓ |
| Tools | Tuner, metronome, chord lookup | ✓ | ✓ |
| Tools | Custom tuning editor | ✓ | ✓ |
| Setlists | List: sort, card ⋯ (Duplicate / Delete), New setlist | ✓ | ✓ |
| Setlists | Editor, Add menu, browser, timeline, retune + Tune, notes | ✓ | ✓ |
| Setlists | Insert break / section at a position, edit length / label, remove, empty state | ✓ | ✓ |
| Calendar | Agenda, filters (All · Shows · Practices · Jams), one New with type menu | ✓ | ✓ |
| Calendar | Error + Retry, empty | ✓ | ✓ |
| Calendar | Month view | — (deferred until sync) | — (deferred until sync) |
| Calendar | New show = blank show page, edit in place | ✓ | ✓ |
| Calendar | Show: confirmed, cancelled, no set (copy / new), offline, delete, RSVP | ✓ | ✓ |
| Practice | Practice page, focus, songs, RSVP | ✓ | ✓ |
| Practice | New / duplicate practice: Start–End lists, filtered song picker | ✓ | ✓ |
| Practice | Session stage, Up next, Tune now, notes as sheet / panel, wrap-up | ✓ | ✓ |
| Practice | Practice history (practices, songs, recap) | ✓ drawn, **deferred** (Nov 7) | ✓ drawn, **deferred** (Nov 7) |
| Account | Sign in, errors, forgot, check email, get started | ✓ | ✓ |
| Account | Settings, appearance, tunings, profile, instruments, push, about, change password, delete account | ✓ | ✓ (change photo partial) |
| Band | Members, roles, member menu, invite, regenerate code | ✓ | ✓ (QR full screen partial) |
| Band | Transfer, leave, create band, band mark, join preview, band profile | ✓ | ✓ (delete band partial) |
| Band | Friends, add a friend, privacy | ✓ | ✓ |
| Jam | Hub, host a jam (two fields), empty state, join with a code | ✓ | ✓ |
| Jam | Planned lineup / requests / people, settings, Go live | ✓ | ✓ |
| Jam | Host live: Up next, fill a part, walk-up, queue actions | ✓ | ✓ (hover actions, right-click menu, drag) |
| Jam | Guest: lineup, raise hand, pitch, web guest | ✓ | — (phone / web) |
| Jam | Venue kiosk | — | ✓ |
| Jam | Bar TV | — | ✓ |

Partial items are listed in DECISIONS → Nov 7 → §3. None is on a primary path.
