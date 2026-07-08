---
feature: mobile-redesign-port / casting
doc: Casting design (setlist metadata + band history) — FOR REVIEW before implementation
created: 2026-07-02T22:49
status: DESIGN DRAFT — validate in loops (security first), then user approval, then build
---

# Casting Design — "who plays what, per song"

Casting = per-song, per-role assignment of a **member** to a **part**, attached as **metadata to a
setlist** (and, by the same mechanism, an event lineup). Band-scoped **history** ("who played
guitar on Wonderwall across our last 5 sets"). A **pro / band-director** feature.

## 0. Ground truth from research (why we build fresh)

The app already has a casting subsystem — but it is **dead code with 6 fatal defects**: 3 enum-drift
CHECK mismatches (TS `RoleType` vs SQL CHECKs), a broken Dexie compound index, numeric-id vs UUID
mismatch, **local-only (never synced)**, and **RLS enabled with ZERO policies (all access denied)**.
We keep the good _ideas_ (casting→assignment→role shape, MemberCapability) but build a **clean,
Supabase-native, RLS-secured, flat model**. We do NOT revive the legacy `song_castings`/
`song_assignments`/`assignment_roles`/Dexie tables.

Key facts that shape the model:

- **`SetlistItem.id`** (stable string, survives forks via deep-copy) is the correct per-song anchor —
  NOT `songId` (a song can appear twice in a set; `songId` collapses them). Setlist items live in a
  **JSONB `items` column**, so casting rows **cannot FK to a setlist item** — the slot reference is a
  _soft_ reference (app-enforced).
- Each show/event **forks its own setlist row** → casting is naturally per-copy (matches "setlists
  are unique per event"). Forks currently don't copy casting (fine — per-event unique).
- **Events use `event_lineup_items`** (stable `id`, `song_id`) in practice, NOT `events.setlist_id`.
- Casting must be **band-shared** → it can't use the local-only Dexie path. Go **Supabase-only +
  Realtime**, like events/friends/notifications.

## 1. Core model — ONE flat table: `casting_assignments`

One row = "member M plays role R on the song in slot S of context C." Flat (not the legacy 3-tier)
because our unit of casting is (slot, role, member).

```sql
CREATE TABLE public.casting_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHERE the casting applies (the "castable slot")
  context_type  TEXT NOT NULL CHECK (context_type IN ('setlist','event')),
  context_id    UUID NOT NULL,           -- setlists.id OR events.id
  slot_id       TEXT NOT NULL,           -- SetlistItem.id OR event_lineup_items.id (SOFT ref — JSONB)

  -- WHAT song (for band-wide history). Nullable: external event songs have no song row.
  band_id       UUID REFERENCES public.bands(id) ON DELETE CASCADE,   -- NULL for personal-hosted events
  song_id       UUID REFERENCES public.songs(id) ON DELETE SET NULL,

  -- THE role + WHO
  role          TEXT NOT NULL CHECK (role IN
                  ('lead_vocals','backing_vocals','guitar','bass','drums','keys','other')),
  role_label    TEXT,                    -- required-ish when role='other' (e.g. "Sax", "Tambourine")
  member_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- the cast member
  member_name   TEXT,                    -- snapshot for history durability if member later removed
  is_primary    BOOLEAN NOT NULL DEFAULT true,  -- primary player vs backup for the same slot+role

  -- HISTORY support
  occurred_on   DATE,                    -- the show/event date (denormalized snapshot; NULL=unscheduled)
  notes         TEXT,

  created_by    UUID NOT NULL REFERENCES public.users(id),
  created_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version       INTEGER NOT NULL DEFAULT 1,

  -- One member per (slot, role) — but allow a primary + backups (differ by member_id)
  UNIQUE (context_type, context_id, slot_id, role, member_id)
);
```

**Why flat over the legacy 3-tier** (casting→assignment→role): our design assigns one member to one
role on one slot. Multi-role-per-member (e.g. "sings + plays guitar") = two rows. Multi-member-per-
role (2 guitars) = two rows (distinguished by member, `is_primary`). This is simpler to query,
simpler to secure, and maps 1:1 to the prototype's role rows.

**Roles**: a small canonical set (`lead_vocals, backing_vocals, guitar, bass, drums, keys`) + `other`
with a free-text `role_label`. This gives flexibility WITHOUT enum drift (the killer bug) — the CHECK
is the single source of truth and the TS union must match it exactly. (Future: a band-scoped custom-
roles reference table if directors need first-class custom roles; `other`+label covers v1.)

## 2. Security (RLS) — the crux

Helpers (SECURITY DEFINER, like `is_event_manager`): `is_band_member(band_id, uid)`,
`is_band_admin(band_id, uid)` (from `band_memberships.role='admin'`). Reuse `is_event_manager`,
`is_event_participant`.

| Op                              | Who                                                                | Policy                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **SELECT** (view)               | band members (setlist) / event participants (event)                | `(context_type='setlist' AND is_band_member(band_id, uid)) OR (context_type='event' AND is_event_participant(context_id, uid))` |
| **INSERT/UPDATE/DELETE** (cast) | the **director**: band admin (setlist) / event host+cohost (event) | `(context_type='setlist' AND is_band_admin(band_id, uid)) OR (context_type='event' AND is_event_manager(context_id, uid))`      |

- **Pro-tier gating is NOT in RLS.** RLS enforces the _authorization_ boundary (director/admin/host).
  The pro/tier gate is a **product** gate in the service/UI (like the jam tier stub) — tiers change,
  and RLS shouldn't couple to them. Security = who's allowed; tier = who's offered the feature.
- Grants: `authenticated` + `service_role` (both). Realtime publication + REPLICA IDENTITY FULL.
- `member_name` is a snapshot only — never trust it for authz; `member_id` is the real reference.

## 3. History — "who was cast on song X"

Query: `SELECT … FROM casting_assignments WHERE band_id=? AND song_id=? ORDER BY occurred_on DESC`.
Returns member (name via `member_name` snapshot or join), role, the context (which set/event), date.
Complete only for song-backed slots (external event songs have `song_id NULL`).
**Where to show it** (user: "not sure where yet") — proposed: a **"Cast history" section on the Song
detail** (per role, who's played it, most recent first) + optionally a **member profile** ("parts
Sarah has played"). Confirm placement with user.

## 4. Attach points (the two worlds, one mechanism)

- **Setlist**: `context_type='setlist'`, `context_id=setlist.id`, `slot_id=SetlistItem.id`,
  `song_id=item.songId`, `band_id=setlist.band_id`, `occurred_on=linked show/event date`.
- **Event**: `context_type='event'`, `context_id=event.id`, `slot_id=event_lineup_items.id`,
  `song_id=lineup_item.song_id` (nullable), `band_id=event.band_id` (nullable), `occurred_on=event.scheduled_date`.
  This satisfies "casting is metadata on ANY setlist" and extends to events without refactoring the
  just-shipped events feature onto setlists. (Alternative considered: force events to use setlists —
  rejected as a bigger refactor; event lineup items carry event-specific fields — source/owner/external
  display tuple — that don't map cleanly to setlist items.)

## 5. Flexibility knobs

- Roles: canonical set + `other`/`role_label` (add roles later via CHECK edit or a future ref table).
- `is_primary`: primary vs backup per role (covers "understudy"/depping).
- Works on any setlist and any event; band-scoped OR event-scoped (band_id nullable for personal events).
- History is provenance-rich (context + date + role) without extra joins.

## 6. Edge cases (enumerated — validate these in the loops)

1. Same song twice in a set → keyed by `slot_id`, distinct. ✓
2. Setlist forked for show/event → new setlist row; casting NOT auto-copied (per-event unique). Optional "copy from source" action later. History unaffected (band+song).
3. Setlist item reordered → `slot_id` stable, casting survives. ✓
4. **Setlist item deleted → casting dangles** (JSONB, no FK). Mitigation: read-time filter to existing slot ids + a cleanup routine. Soft reference is the accepted tradeoff of JSONB items.
5. Song deleted → `song_id` SET NULL; `member_name`/role snapshot preserves "who played what"; drops out of by-song history.
6. Member removed from band → `member_id` SET NULL; `member_name` snapshot shows "former member" in history.
7. External event song (no `song_id`) → casting allowed; excluded from band-song history.
8. Casting a member with no capability for the role → allowed (director override); capability is advisory (UI warns).
9. Two players same role (2 guitars) → two rows (distinct member, one `is_primary`). Or split roles.
10. Concurrent director edits → UNIQUE + upsert-on-conflict; realtime; last-write-wins per row.
11. Personal setlist (no band) casting → **deferred v1** (band setlists + events only). Owner-only casting later.
12. Pro-tier gate → service/UI; RLS unaffected.
13. **Enum drift (the historical killer)** → CHECK is the single source of truth; TS `CastingRole` union
    generated to match EXACTLY; a schema test asserts parity.
14. Setlist not attached to any show/event → `occurred_on` NULL ("unscheduled"); history still lists it.

## 7. Storage / sync decision

**Supabase-only + Realtime** (like events/friends/notifications). Rationale: casting must be band-
shared (the legacy Dexie-local approach is exactly why casting was dead), events are already
Supabase-only, and the sync engine is band-scoped/complex. Tradeoff: casting not available offline
while setlists are — acceptable for an online pro/director feature (flag: add to sync engine later if
offline casting is needed).

## 8. Reuse decision

- **Build fresh**: `casting_assignments` (this doc) + `CastingService` (Supabase-native) + UI.
- **Reuse ideas, not tables**: the role concept, `is_primary`, and `member_capabilities` (already in
  baseline) for future capability-aware _suggestions_ (defer suggestions to v2).
- **Leave legacy tables dormant** (they're frozen in baseline; adding policies to them is wasted — we
  don't use them). Optionally document them as deprecated.

## 9. UI plan (bones for pro feature; match the prototype)

- **Cast surface on a setlist/event song**: per-song role rows (parts), each showing the assigned
  member avatar (or "open"); tap a role → member picker (band members, capability-hinted) → assign.
  Two views from the prototype: **List** (song-by-song role slots — the primary) and **Grid** (songs ×
  roles matrix — director's spreadsheet) as a toggle. Cast-progress summary ("4/6 parts cast").
- **History**: "Cast history" on Song detail (per role, recent first).
- **Gating**: show casting only for pro/director context (stub allows all for now).

---

# VALIDATION RESULTS + REVISED DESIGN (v2) — after 2 adversarial loops

Two adversarial reviews (security + flexibility) found the v1 draft **not safe/complete to build**.
Security fixes are DEFINITIVE (apply verbatim). Flexibility fixes reshape the model with a v1/v2 split.

## A. SECURITY — hardened (MUST apply; verbatim from the review)

The v1 write policy was forgeable. Confirmed the helpers already exist and are hardened:
`is_band_member`/`is_band_admin` (baseline `:1008-1057`, both enforce `status='active'`),
`is_event_participant`/`is_event_manager` (events.sql `:88-101`). ⚠ **Trap:** songs store their band in
`context_id::text`, NOT a `band_id` column.

Changes (all required):

1. **CRITICAL** — bind `band_id ↔ context_id ↔ song_id` (and event `slot_id`) in `WITH CHECK` via two
   SECURITY DEFINER helpers `casting_setlist_ctx_ok(ctx,band,song)` and
   `casting_event_ctx_ok(ctx,band,slot,song)` (owned by postgres). Without this a band admin can forge
   casting rows against ANOTHER band's setlist/songs.
2. **HIGH** — split into **4 separate policies** (SELECT/INSERT/UPDATE/DELETE); UPDATE needs its own
   `WITH CHECK` (not just USING); do NOT use `FOR ALL` (it also widens SELECT).
3. **MED** — constrain `member_id` to the band/event (`is_band_member`/`is_event_participant`); pin
   `created_by = auth.uid()` in WITH CHECK.
4. **LOW** — table CHECK `context_type <> 'setlist' OR band_id IS NOT NULL` (setlist rows always band-scoped;
   makes the SELECT NULL-safety structural). SELECT side is otherwise sound (fail-closed on NULL band_id,
   mutually-exclusive context branches).
   The review supplied the exact hardened 4-policy SQL — use it. Pro-tier stays OUT of RLS (product gate only).

## B. FLEXIBILITY / EDGE — model reshape

**P0 — Required roles (THE gap): the model stores only FILLED assignments, so "N/M cast" and "open
slots" (the prototype's defining surface) are unbuildable — there's no denominator.**
→ Add a **required-parts** concept, separate from `casting_assignments`:

- v1: a **band default lineup** (e.g. lead_vox, guitar, bass, drums, keys) — gives every song an M with
  zero data entry. `parts_cast = COUNT(DISTINCT role among filled primary rows)`, `open = required − filled`.
- v2: **per-slot `required_roles` override** (acoustic vs electric — the prototype's context-specificity),
  stored on the SetlistItem (JSONB) / event_lineup_items.
  Do NOT put a global required-set on `songs` (contradicts context-specific instrumentation). Do NOT
  overload `member_id IS NULL` as "open" (it already means "member removed").

**P1 — One canonical casting context per performance (else history double-counts).** Rule: casting
attaches wherever the songs actually live — **events use `event_lineup_items` → cast in event context;
shows/setlists → cast in setlist context.** Never both for the same performance. (Events don't populate
`setlist_id` today, so this is clean.) History query stays single-context.

**P1 — Roles as DATA, not a CHECK enum (eliminates the drift-bug class + enables custom parts).** The
canonical-6 + `other/label` collapses sax/percussion/harmony/lead-vs-rhythm into one "Other" → breaks the
Grid column axis + history grouping. Recommended: a small **band-scoped `band_roles` reference table**
(`id, band_id, key, label, sort`) seeded with defaults; `casting_assignments.role_key` references it.
Stable keys → groupable history + stable Grid columns + per-band vocabulary with no migrations, and no
TS-vs-CHECK parity to drift. (v1 fallback: canonical enum + require `role_label` when `other` — accept
Grid/history debt. **Decision ⭐ below.**)

**P1 — Slot integrity.** Event slots get a REAL FK: `event_lineup_item_id UUID REFERENCES
event_lineup_items(id) ON DELETE CASCADE` (event side has referential integrity — the v1 uniform TEXT
`slot_id` threw this away). Setlist slots stay a soft `setlist_item_id TEXT` (JSONB, no FK). `song_id` is a
**snapshot for history durability only** — the LIVE slot is source of truth; reconcile/clear casting on
setlist-save when a slot's song changes (else silent history corruption on song-swap).

**P1/P2 — `occurred_on`:** drop the drift-prone cast-time snapshot; **resolve the set's date+name at read
time via `context_id`** (setlist→show / event.scheduled_date). Optionally freeze an "as-performed"
snapshot only at event completion (status='completed').

**P2 — Counting + fields:** "parts cast" = DISTINCT role among filled **primary** rows (ignore backups, so
2 guitarists ≠ "2/6"). Keep `is_primary` (starter vs cover) + optional `priority INT` for ranked subs;
model genuinely-distinct simultaneous parts as distinct roles. Re-add `confidence SMALLINT` (the
"ready to perform" signal the prototype leans on) and `arrangement TEXT` ("Drop D"/"Acoustic").

## C. Revised table (net)

`casting_assignments`: `id, context_type('setlist'|'event'), context_id, setlist_item_id TEXT NULL,
event_lineup_item_id UUID NULL REFERENCES event_lineup_items ON DELETE CASCADE, band_id, song_id (snapshot),
role_key (→band_roles) [or role enum+label per ⭐], member_id, member_name, is_primary, priority INT NULL,
confidence SMALLINT NULL, arrangement TEXT NULL, notes, created_by, created_date, updated_date, version` +
CHECK(setlist ⇒ band_id NOT NULL) + CHECK(exactly one of setlist_item_id/event_lineup_item_id per context)

- UNIQUE(context_type,context_id,slot,role,member) + 4 hardened policies + 2 binding helpers. Supabase-only+Realtime.

## PROVISIONAL DEFAULTS (my recommendation — awaiting user confirm before build)

1. Roles = **band-scoped `band_roles` reference table** (drift-proof, custom parts, stable Grid/history).
2. Scope = **v1 "bones"**: table + hardened RLS + service + List cast surface (open slots + N/M) + history
   read. Defer Grid, per-slot required-roles override, suggestions, completion snapshot to v2.
3. Multi-player = **primary + backups** (only primary counts toward "parts cast"; +optional priority).
4. Band default lineup (required parts) = **lead_vox, guitar, bass, drums, keys** (editable).
5. History = **Song-detail "Cast history"** (store now regardless; wire display in the cast-UI pass).
6. Offline = **Supabase-only + Realtime** (online-only for v1).
7. Pro-tier = **service/UI stub (allow-all)**; RLS still enforces admin/host authorization.
   Build order once confirmed: migration + 2 binding helpers + `band_roles` seed + pgTAP → CastingService →
   List cast UI on setlist/event songs → history read. Each with a validation loop; LOCAL-only, held for review.

## 10. Open decisions for the user (post-validation; ⭐ = affects schema)

1. ⭐ **Roles: reference table vs enum.** Recommended = band-scoped `band_roles` table (data, drift-proof,
   custom parts like "Sax", stable Grid/history) — a bit more build. v1-simpler = fixed enum
   (lead_vox/backing_vox/guitar/bass/drums/keys/other+label), accept custom-role debt. Which?
2. ⭐ **Required roles / "parts cast".** v1 = single **band default lineup** (which parts? e.g.
   lead_vox+guitar+bass+drums+keys) to give every song an "N/M" out of the box. Per-slot override
   (acoustic vs electric) = v2. OK to start with a band default set — and what should it be?
3. ⭐ **Multiple players per role** — keep `is_primary` (starter + backups, backups don't count toward
   "parts cast") + optional ranked `priority`? Or one-member-per-role only for v1?
4. **History placement** — "Cast history" on the Song detail (per role, recent first) + member profile?
   Where do you picture surfacing it?
5. **Fork behavior** — forking a setlist for a show/event starts casting **blank** (default) + an optional
   "copy casting from source" action? Or always inherit?
6. **Scope for v1** — build the **bones**: table + RLS + service + the cast surface (List view + open
   slots + N/M) + history read. Defer to v2: **Grid view**, **per-slot required-roles override**,
   capability-aware **suggestions**, **as-performed completion snapshot**. Agree?
7. **Offline** — Supabase-only (proposed, online-only) OK for v1, or must casting work offline (adds it to
   the sync engine — bigger)?
8. **Pro-tier** — gate in service/UI now (stub allow-all, RLS still enforces admin/host) vs wire a real
   tier check later (account-tiers feature)?
