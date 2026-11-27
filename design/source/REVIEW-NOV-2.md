# Design review · Nov 2 2026

> **Status Nov 7 2026: every recommendation (→) below is applied on both demos and logged in DECISIONS.md → "Nov 7 · final pass". Nothing here is open any more except Events vs Jam (DECISIONS → Open).**

Full sweep of `demo/Rock On Mobile.html`, `demo/Rock On Desktop.html`, the 21 locked screen pages, DECISIONS, PARITY and the spec pages. Nothing was changed. Each item lists options and, where there is enough context, a recommendation (→). Tick items off here; when a decision is made, move it into DECISIONS.md with its law.

Legend: **[M]** mobile · **[D]** desktop · **[Both]** · **[Doc]** documentation.

---

## 1. Same job, different pattern

### 1.1 Creating a show vs a practice [Both]
Practice has a New / Duplicate editor with Save. Show has no create flow: "New → Show", Home "Book show" and the Acoustic Duo "Book" card all open the existing Neumos page. Spec says shows edit in place.
- A. Shows edit in place: add a blank "new show" state of the show page (venue, date, time pre-focused) and keep practice's editor as is. Two patterns, each justified by the spec.
- B. Give shows the same New editor as practice. One pattern for both event types.
- C. Make practice edit in place too, matching the spec's show model.
- → **A.** Practices are created in bulk and often duplicated (the editor earns its keep); a show is one record you fill in over weeks. Jakob's Law within each type matters more than symmetry across types. Draw the blank state on both platforms.

### 1.2 Chart editing lives in two places [Both]
Mobile: a separate Chart editor (Cancel / Save, Lyrics / Chords / Preview, Paste). Desktop: chart paste + Lyrics+chords / Chords-only inside the song editor. Mobile has no route into the chart editor ("Add chords & lyrics" isn't wired; chartEdit / chartPaste are unlinked).
- A. Separate chart editor on both; song editor keeps only a "Chords & lyrics" row that opens it.
- B. Chart lives inside the song editor on both (mobile gets a collapsible Chart section).
- C. Keep as is and document it as an intentional platform difference.
- → **A.** The chart is a working document with its own modes and preview; the song editor is a form. Desktop has the room to show the chart editor as a wide dialog or second pane. Wire the mobile route.

### 1.3 Notes | Chart toggle in practice session [M, tablet]
Chart reader rule: no Chart | Notes toggle anywhere, notes open as a sheet. Practice session still uses a segmented Notes | Chart.
- A. Apply the rule: Notes become a sheet (phone) or side panel (tablet) from a "Notes" button.
- B. Exempt the session: amend the rule to "except the practice session, where notes are the primary content".
- → **A.** One mental model for where notes live; the session already has a sheet pattern for the set list.

### 1.4 Setlist editor dock [Both]
Mobile: one full-width Add → Songs / Break / Section. Desktop: three buttons; Break and Section append to the end with no length / label editing and no insert-at-position.
- A. Desktop adopts the single Add menu; Break and Section insert after the selected row and open their inline editor.
- B. Keep three buttons on desktop (room allows it) but add the insert-after-selection and inline editing.
- → **B** for the buttons, since the space is there and it saves a click (Fitts), but the behaviour (insert position, editable length / label) must match mobile.

### 1.5 "Open on stage" on the desktop setlist [D]
Opens the Amazing Grace chart; stage view is deferred in DECISIONS; mobile has no equivalent.
- A. Remove the button until the stage view exists.
- B. Rename to "Open first chart" and keep.
- → **A.** A labelled promise the app can't keep is worse than no button.

### 1.6 Calendar "Events" vs "Jams" [Both]
The Jam decision renamed the filter and the demo routes to Jams, but the locked Calendar page still shows Events / "New event"; Home still says "Upcoming events".
- A. Finish the rename everywhere: Jams filter, "New jam", "Upcoming" on Home.
- B. Keep "Events" as the umbrella (shows, practices, jams are all events) and rename only the Jam-specific buttons.
- → **A.** The filter is a type picker; its three values should be the three types. "Events" as an umbrella word only belongs in the Calendar title.

### 1.7 Calendar New [Both]
Mobile: FAB label follows the filter; type picker on All. Desktop: a separate "New practice" button plus a "New" stub without a type picker.
- A. Desktop mirrors mobile: one New button whose label follows the filter; type menu on All.
- B. Desktop shows all three New buttons (Show / Practice / Jam) since there is room.
- → **A.** Same rule on both platforms (consistency); one button keeps the header calm.

### 1.8 Song sort, view options and filter [D]
Decision: sort = field + direction toggle. Desktop sorts by column header; has density toggle only (no Artist / Key / BPM / Links / Next show / Show hidden column options) and no Filter (tuning only).
- A. Desktop adds the same Sort, View and Filter controls as mobile, and header click is a shortcut to the same sort state.
- B. Header-click sort is the desktop idiom; add the View / Filter menus only.
- → **A.** Header click is fine as an accelerator, but the visible control must exist so the sort state is readable (visibility of system status) and consistent.

### 1.9 Jam host settings [Both]
Mobile Host-a-jam has Who can join / Song requests / Approve requests myself. Desktop planned page has Group sets and Access instead. Desktop has no Host-a-jam form; "Host a jam" opens the existing Tuesday jam.
- A. Define one settings set (Who can join, Song requests, Approve requests, Group sets) and show it in the Host form on both; Access on the planned page reflects the same values.
- B. Keep Host form minimal (name, date, who can join); everything else lives on the planned page's Access / Settings on both.
- → **B.** The Host form should be a two-field start (Doherty threshold); refinements belong where the host comes back to tune them. Draw the desktop Host form.

### 1.10 Band invite: Regenerate code [D]
Mobile has it (with warning); desktop doesn't.
- A. Add to desktop Band → Invite with the same warning dialog.
- → **A.** Straightforward parity.

---

## 2. Spec Musts not drawn on either platform

### 2.1 Setlists list: card menu, sort, notes [Both]
Duplicate / Delete (with confirmation), sort, and Markdown notes in the editor are Musts.
- A. Card ⋯ menu with Duplicate / Delete; sort control in the header (Next show, Name, Updated); Notes as a sheet from the editor header.
- B. Long-press / right-click only for the menu, no visible affordance.
- → **A.** Visible affordance matches the song row's ⋯ and the show page's Notes sheet.

### 2.2 Personal context catalog [Both]
"Songs in my bands not in my catalog" (copy all / pick some) and the "from ‹band›" tag on linked copies aren't drawn; only Personal Home exists.
- A. Draw the Personal Songs page: catalog plus a dismissible "12 songs in your bands aren't in My Songs · Copy all · Pick" banner; linked copies carry a small band chip.
- B. Skip the banner; show band songs inline with a filter "Mine / From bands".
- → **A.** It matches the spec and keeps the catalog list clean. Same component on both platforms.

### 2.3 Attendance / RSVP [M]
Desktop show has Going / Maybe / Can't; mobile show and both practice pages have nothing. Decision: drawn now, ships later.
- A. Draw the same three-chip RSVP row on mobile show and on practice (both platforms).
- B. Remove from desktop until it ships so no screen shows it.
- → **A.** "Drawn now" means on every surface it will appear on, or the build team will guess the layout.

### 2.4 Friends → Add a friend [Both]
Stub on both.
- A. Sheet / dialog: search by name, or enter a friend code; your own code shown with Copy and QR.
- → **A.** Mirrors the band invite pattern already drawn.

### 2.5 Loading, error and offline states [Both]
Kit has skelRow, error banner, offline banner; no screen uses a skeleton or error-with-retry; offline appears only on the show page. Songs empty / no-matches exist only in Components.html. Jam hub empty state not drawn.
- A. Add one example of each state to the demos: Songs (skeleton, empty, no matches), Calendar (error with Retry), Home (offline banner), Jam hub (empty).
- B. Rely on Components.html and a written rule in DECISIONS ("every list uses skelRow while loading, RetryCard on error").
- → **A + the rule.** Testers will hit these in week one; one drawn instance per state removes ambiguity.

### 2.6 Song view "Used in" [M]
Desktop has "In setlists"; mobile song view has none.
- A. Add "Used in" (setlists, next show) under the facts on mobile.
- → **A.**

### 2.7 Settings → About and Change password [D]
On mobile, missing on desktop.
- A. Add About (version, What's new, Help) and Change password to desktop Settings → Account.
- → **A.**

### 2.8 Month view [Both]
Spec: design now, ship with sync. Demos: explore later.
- A. Draw it now (desktop grid, mobile compact dots + list) so the build has it.
- B. Keep deferred and record the reason in DECISIONS.
- → **B** unless sync lands in the first build. The agenda list already answers "what's next"; Month is a browsing view and can wait, but the decision should be explicit.

### 2.9 Practice session on desktop [D]
Spec keeps the desktop / TV session; the Nov decision made it mobile / tablet only.
- A. Confirm mobile / tablet only and update the spec page.
- B. Add a desktop session (large chart, set list rail) reusing the tablet layout.
- → **B**, lightly. The tablet layout scales to desktop with no new components, and rehearsal rooms often have a laptop on a stand. Low cost, real use.

---

## 3. Desktop dead ends

Buttons that only toast or do nothing: Global search (⌘K, marked ✓ in PARITY), New setlist, Edit band info, member ⋯ menus, Delete band, QR, Add link, Notes FULL SCREEN, notes editing, Profile Change photo / Edit instruments, Jam "Join with a code", the Invited jam row, Forgot password. Song editor lacks Album, Tags, Spotify suggestions, "Also add to My Songs", Manage tunings, and uses free-text Key instead of the circle of fifths.
- A. Wire each to the mobile behaviour (sheets become centred dialogs) before build.
- B. Leave as stubs but mark them "partial" in PARITY so the build team knows.
- C. Wire the ones on primary paths (search, New setlist, Join with a code, Key picker, Forgot password) and mark the rest partial.
- → **C.** Primary paths need real behaviour to test flows; the rest can be documented.

---

## 4. Sample-data drift

Fall Kickoff Nov 1 vs Nov 7; Thursday run Oct 30 vs Nov 5; 45 vs 11 songs; Open G custom tuning missing from tuner chips; Song Row setlist phones show a pre-kit "Start Play-Along" dock.
- A. One shared fixture (dates, counts, tunings) used by every screen page and both demos.
- B. Fix the dates by hand and accept count differences.
- → **A.** Drift will keep returning otherwise; `desktop-data.js` is the natural home. Redraw the Song Row setlist phones on the kit.

---

## 5. Documentation drift

- CLAUDE.md points at `refresh/LAWS-OF-UX.md`, `refresh/01…`, `refresh/03 SPEC-RECONCILIATION.md`, `design-system/tokens.html` and Geist / JetBrains Mono; these moved to `refresh/archive/` or `source/`, and the fonts are Big Shoulders / Atkinson / Martian Mono.
- DECISIONS.md header says Oct 30 with Nov 1 entries; the Open section still lists the font question and "not yet redrawn: setlist timeline, practice, show page", all since locked.
- PARITY.md overstates desktop: Global search ✓ (stub), Host a jam ✓ (no form), Friends ✓ (Add is a stub), Setlists List ✓ (no next-show, New setlist dead).
- A. Rewrite CLAUDE.md to point at `demo/` + `source/` only; prune the Open section; re-grade PARITY with "partial" for stubs.
- → **A.** Do this first; every agent reads CLAUDE.md before touching anything.

---

## Suggested order
1. §5 docs (an hour, prevents wrong work).
2. §1.1, 1.6, 1.7 (calendar / show creation: highest traffic).
3. §2.5 states and §3 primary-path stubs.
4. §1.2, 1.3, 1.4, 1.8, 1.9 pattern alignment.
5. §2 remaining Musts, §4 fixtures.
