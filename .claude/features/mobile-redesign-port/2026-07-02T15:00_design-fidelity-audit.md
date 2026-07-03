---
feature: mobile-redesign-port
doc: Design fidelity audit — REAL app vs DESIGN prototype (screen-by-screen)
created: 2026-07-02T15:00
method: Playwright, both apps @ 390x844 mobile. Screenshots in scratchpad audit-*.png.
---

# Design Fidelity Audit — REAL vs DESIGN

Confirms the user's reported gaps + more. Tags: [REGRESSION] design had it/real lost it ·
[MISSING] never built · [DIFFERENT] diverges · [OK-JUSTIFIED] acceptable.

## Confirmed fixed

- **Double nav** (top hamburger + bottom bar) — FIXED (bottom-nav only; header keeps brand + bell).

## HIGH priority (fixing this pass)

1. **Songs tuning color-coding — [REGRESSION]** SongsPage rows show tuning as gray text, no colored
   left "warmth spine", no colored TuningPill. (SongsPage renders own cards, doesn't use SongListItem
   which HAS the spine.) → restore using `tuningColor()` from tunings.ts (**Palette A, the approved
   canonical palette** — standard=blue #60a5fa, not the design's older gold warmth map; this also
   unifies with Setlist detail which already uses Palette A). Resolves audit item #8 too.
2. **Calendar missing Events — [MISSING]** No Events filter chip, no green event rows aggregated.
   → add Events source (green) + Events filter to CalendarPage.
3. **Calendar missing create button — [MISSING]** No "New" (New practice/gig/event) control.
   → add a create menu to CalendarPage.
4. **Native date/time inputs — [REGRESSION/DIFFERENT]** Show/Practice forms use native
   `<input type=date|time>` (via `EntityHeader` L205/230, `ShowViewPage` L638/651,
   `SessionForm` datetime-local) instead of the custom dark DatePicker/TimePickerDropdown the design
   uses (month-calendar popover; 15-min slot scroller; type-to-edit). → migrate to custom pickers.

## HIGH but larger scope (needs user greenlight — deferred this pass)

5. **Event host console — [MISSING]** Design event console has per-song PARTS (Guitar/Bass/Drums/
   Vox) with cast avatars, "hand up", "Cast open parts", People/Access tabs, List/Grid, Host/Guest
   toggle, cast-progress. Real detail is a basic MVP (lineup list + requests + request form).
   NOTE: casting was "SHELVED in the main app" per DESIGN_NOTES but IS part of the Events design —
   confirm scope before building the full casting matrix (big).

## MEDIUM (follow-up)

6. Songs list rows: add external-link glyphs (YouTube/Spotify/Guitar Tab). [MISSING on mobile list]
7. Home dashboard: 4-stat grid (add Upcoming practices + Active setlists), Recent-activity feed,
   embed linked setlist in Next-Show card, event-invite card. [DIFFERENT/MISSING]
8. Unify tuning color palette app-wide to Palette A (Songs none / detail blue / design gold today).
9. Calendar item cards richer (date chip, "In N days", location icon, setlist/cast line). [DIFFERENT]

## LOW (follow-up)

10. More menu: band identity card, Account/profile row, Help & feedback, version footer, sectioning.
11. Setlists list preview: per-song tuning color dots.

## Good fidelity (no action)

- Setlists list + detail (sections/breaks, status pills, linked-show) — strong match.
- Bottom nav 5 tabs, dark theme, accent — matches.
