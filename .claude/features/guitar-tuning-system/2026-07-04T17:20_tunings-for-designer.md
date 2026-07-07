# Tunings — how they're stored (for UI design)

A quick, practical guide to the new **tunings** data so you can design the UI. No
database knowledge needed. TL;DR: a tuning is a **named list of the pitch of each
string**, there's a **built-in set** plus **user-created custom** ones, and **each song
points at exactly one tuning**.

---

## 1. What a tuning is

A tuning describes **what note each string is tuned to**, for a given instrument.

- **Instrument:** `guitar` or `bass` (more later).
- **Number of strings:** 3–12.
- **Per-string pitches:** one note per string, listed **lowest (thickest) string →
  highest (thinnest) string**.
- **Name:** e.g. "Standard", "Drop D", or whatever a user types for a custom one.
- **Color:** built-ins have a brand color (used today for the little colored spine on
  song cards). Custom tunings can fall back to a neutral color.

Example — **guitar Standard** has 6 strings tuned: `E2 A2 D3 G3 B3 E4`
(low E → high E). **Drop D** is the same but the lowest string drops to `D2`.

> **How pitch is stored (for the dev, not the user):** each string's note is stored as a
> **MIDI number** (an integer that uniquely identifies a pitch incl. octave). The UI
> shows friendly note names like "E2"; the app converts to/from MIDI. Designer takeaway:
> **users pick a note per string** (letter + octave, e.g. `D#3` / `Eb3`), never a raw
> number.

---

## 2. Two kinds of tunings

|                   | **Built-in**                  | **Custom**                               |
| ----------------- | ----------------------------- | ---------------------------------------- |
| Who makes them    | We ship them                  | A user creates them                      |
| Who sees them     | Everyone                      | Just the owner (personal) or their band  |
| Editable by users | No (read-only)                | Yes (the owner / band can edit & delete) |
| Examples          | Standard, Drop D, Eb, DADGAD… | "My weird open tuning"                   |

**Built-in set shipping now (16):**

- **Guitar (6-string):** Standard · Drop D · Eb / Half-step down · D / Whole-step down ·
  Drop C · Drop B · Open G · Open D · DADGAD
- **Guitar (extended):** 7-string standard · 8-string standard
- **Bass:** Bass standard (4) · Bass Drop D · Bass Eb / Half-step down · 5-string bass ·
  6-string bass

For the UI, a good grouping is **by instrument, then Built-in vs Your tunings**.

---

## 3. Custom tunings — what the "create" UI needs

To make a custom tuning, a user provides:

1. **Instrument** — guitar or bass.
2. **Number of strings** — 3 to 12 (this sets how many note pickers appear).
3. **A note for each string** — lowest → highest. Each is a note name + octave
   (e.g. `E2`). A sensible starting point is to prefill with the matching standard tuning
   for that instrument/string count, then let them tweak individual strings.
4. **A name** (required) and optionally a color.

That's the whole model. Everything else (built-in flag, ownership) is handled
automatically.

---

## 4. How a song uses a tuning

- **Each song references exactly one tuning** (v1). In the song editor, replace the
  current free-text tuning field with a **tuning picker** (built-ins + the user's/band's
  customs, grouped by instrument).
- Existing songs are **auto-mapped** to the matching built-in where we recognized the old
  text (e.g. "Eb Standard" → Eb / Half-step down). A song we couldn't match keeps its old
  label and simply has **no tuning selected yet** — the picker should show an
  "unset / choose a tuning" state for those.
- The song still keeps a **plain-text tuning label** alongside the reference (used as a
  fallback for display). You don't need to design for that separately — just show the
  selected tuning's name.

---

## 5. Fields available to the UI (per tuning)

| Field         | Meaning                                            | UI use                                  |
| ------------- | -------------------------------------------------- | --------------------------------------- |
| `name`        | Display name                                       | Label everywhere                        |
| `instrument`  | `guitar` / `bass`                                  | Group / filter, icon                    |
| `stringCount` | 3–12                                               | Render the right number of strings      |
| `pitches`     | Ordered notes, low→high (MIDI ints under the hood) | The string list / note pickers          |
| `color`       | Brand color (built-ins)                            | The colored spine / chips on song cards |
| `isBuiltin`   | Read-only vs editable                              | Hide edit/delete on built-ins           |

---

## 6. Coming soon — design with room for these

These aren't in v1, but the data was built to support them, so leave conceptual space:

- **Set "tuning changes" view:** because every string's pitch is stored, we can show,
  between two songs in a setlist, whether you need to **retune one string**,
  **retune the whole guitar**, or **swap to a different guitar/instrument**. Think:
  small per-string diff indicators.
- **Change key → suggest alternate tunings:** e.g. propose Eb across a set to minimize
  retuning. Likely a "suggested tuning" affordance on the song/set.

---

## 7. One worked example

**Drop D (guitar, 6 strings)** — how it'd render in a string list:

```
6 (low)  D2   ← dropped from E
5        A2
4        D3
3        G3
2        B3
1 (high) E4
```

vs **Standard** which has `E2` on string 6. That single-string difference is exactly what
the future "just tune one string" indicator will read from.

---

_Questions for the dev side: pitches are MIDI note numbers, low→high; note-name display
(incl. flats vs sharps like Eb/D#) is derived in the app. Built-in list + colors live in
`src/utils/tunings.ts` (to be expanded with pitch data) and the `tunings` table._
