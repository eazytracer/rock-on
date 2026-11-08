# 07 · Handoff: settle these with Eric, then pass back the files below

From the build agent, after reviewing guides 01–06 against branch `redesign/integration`.

The guides are good. Two things stop the build from starting:

1. The design project itself isn't in the repo.
2. A handful of decisions are still open.

Work through **Part A** with Eric, deliver **Part B**, and commit everything to `redesign/integration`.

## Facts about this branch (the guides were written against `main` @ v0.5.0)

- **Version:** the app is at **0.6.1**, unreleased. Renumber the phases in 05-plan from **0.7.0**.
- **Online-only.** The IndexedDB mirror and sync queue are gone. Every read and write goes straight to Supabase, with TanStack Query as an in-memory cache.
  - Ignore "IndexedDB mirror" in 04-data.
  - The leftover sync icons and indicators are dead code, to be removed.
- **Already done on this branch:**
  - Other users' emails are hidden, except to band admins/owners (`get_user_emails`).
  - Jams can only be found and joined with the exact code (`join_jam_session`).
  - Bandmates can read each other's profiles.
- **Owner is currently a permission flag**, `'owner' = ANY(permissions)`, not a role.
- **Flutter is next.** iOS and Android apps will share the web app's backend. Logic must live behind an API, not in React. See B3.

## Part A · Decisions to settle with Eric

For each one, record the answer in `source/DECISIONS.md` (dated), and in the guide it changes.

1. **Tuning colours.**
   - 01 §7 replaces the current palette with the pitch-ordered OKLCH spine.
   - Eric's spec (`docs/design-specs/00-overview.md`) says keep the current mapping, for muscle memory.
   - Pick one. If it's the spine, Eric confirms the swap explicitly.
2. **Events vs Jam** (guide 06). Choose A, B or C. Also answer:
   - Do walk-ups, web guests and kiosk entries without accounts **write** data (hands, pitches, names)?
     - If yes, they need anonymous write endpoints. That's the biggest security surface in the redesign.
     - Say exactly what an anonymous person can do, and how the host stops abuse: approve, remove, close requests.
3. **Offline scope.** There's no local database any more. List exactly which screens must open with no signal, read-only:
   - Proposed: the chart reader, practice session, the next show, the next practice.
   - Anything else?
   - Is "last viewed in the past N days" enough, or must they be downloaded ahead of time?
4. **Owner as a role.**
   - Confirm exactly one owner per band.
   - Transfer is a plain confirm (03), delete is typed.
   - The current owner-flag holders become `role='owner'`.
5. **Instruments with no primary.** An ordered list, first shown first. That drops the ★ from the spec. Confirm.
6. **Shows: Confirmed / Cancelled.** Should Undo of Cancelled restore Confirmed? (If yes, Confirmed becomes its own column; see 04.)
7. **Band notes.** One shared note per song with its last editor, or a history of entries (today's data)? Pick one for the song view.
8. **Scope moved into launch.** The spec had these as future; the design brings them in. Confirm each is in this redesign:
   - Global search.
   - Tools (tuner, metronome, chords).
   - The chart reader and editor.
   - Practice history.
9. **Removed or hidden capabilities.** List everything the design drops from today's app. Eric approves each one. Known so far:
   - The Shows and Practices list pages.
   - The Events casting console.
   - The "Open on stage" button.
   - Song duplicate.
   - Setlist statuses.
   - Home stats.

## Part B · What the build agent needs back

Commit to `redesign/integration` under `design/`:

1. **The design project, as files:**
   - The `demo/` folder:
     - `Rock On Mobile.html` (with its checklist).
     - `Rock On Desktop.html`.
     - `Jam Night.html`.
     - The `screens/` folder, including `Final Pass.html`.
   - The `source/` folder:
     - `DECISIONS.md`, `PARITY.md`, `CHART-DATA-MODEL.md`.
     - `Foundations.html`, `Components.html`.
     - `kit/rock.css`, `kit/rock.js` (with `SPINE`, `okhex`, `customTuning`, `ICONS`), `kit/pickers.*`.
   - `design_handoff_rock_on_refresh/DATA-IMPLICATIONS.md`.
   - Every page must open locally from the repo, with no claude.ai login needed.
2. **Part A answered,** in `source/DECISIONS.md`. Update 03, 04 and 05 wherever an answer changes them.
3. **The operations list:** `design/OPERATIONS.md`, one table per area. This becomes the API contract that web and Flutter both call. For every user action, give:

   | Operation                 | Who may         | Inputs        | Result                  | Rules the server must enforce                                       | Errors the user sees    |
   | ------------------------- | --------------- | ------------- | ----------------------- | ------------------------------------------------------------------- | ----------------------- |
   | e.g. `attach_set_to_show` | any band member | show, setlist | the show's set (a copy) | copy items; label "Copied from" + date; the source is never changed | "This setlist is empty" |
   - Include reads that combine data, e.g. "band preview by code", "who knows your songs", "Used in".
   - Leave out pure display maths (totals, retune counts). The build agent decides where those live.

4. **Native-only behaviour:** `design/PLATFORM-NOTES.md`. List what differs on iOS/Android vs web:
   - Wake lock, pedals, QR scanning, microphone (tuner), audio clock (metronome), share sheet, push, haptics.
   - Anything else the demos assume.
5. **Phase order confirmed,** in 05-plan. The build agent will add a short **API conventions** step before phase 0's code.

## When you're done

Tell Eric. He'll point the build agent at this branch, and building starts from `design/` and `DECISIONS.md`.
