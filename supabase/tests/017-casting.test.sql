-- Test: Casting feature schema + SECURITY coverage
-- Purpose: Lock down band_roles + casting_assignments (columns, CHECKs, unique
--          slot index, RLS 4-policy split, grants) AND functionally prove the
--          band↔context↔song binding helpers reject cross-band forgery + the
--          band-role seed trigger.
-- Category: Schema + RLS + Security
-- Created: 2026-07-03 (mobile-redesign-port / casting)

begin;

select plan(23);

-- ── Tables + columns (4) ────────────────────────────────────────────────────
select has_table('band_roles', 'band_roles table exists');
select has_table('casting_assignments', 'casting_assignments table exists');
select has_column('casting_assignments', 'role_key', 'casting_assignments.role_key exists');
select has_column('casting_assignments', 'event_lineup_item_id', 'casting_assignments.event_lineup_item_id exists');

-- ── CHECK constraints (3) ───────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname='casting_assignments_context_type_check'
  AND conrelid='public.casting_assignments'::regclass), 'context_type CHECK exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname='casting_slot_matches_context'
  AND conrelid='public.casting_assignments'::regclass), 'slot-matches-context CHECK exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname='casting_setlist_needs_band'
  AND conrelid='public.casting_assignments'::regclass), 'setlist-needs-band CHECK exists');

-- ── Indexes (2) ─────────────────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='uq_casting_slot_role_member'),
  'unique polymorphic slot index exists');
select ok(EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_casting_band_song'),
  'band_id+song_id history index exists');

-- ── RLS + policies (6) ──────────────────────────────────────────────────────
select ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.band_roles'::regclass), 'RLS on band_roles');
select ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.casting_assignments'::regclass), 'RLS on casting_assignments');
select ok(EXISTS(SELECT 1 FROM pg_policies WHERE tablename='casting_assignments' AND policyname='casting_select'), 'casting_select policy');
select ok(EXISTS(SELECT 1 FROM pg_policies WHERE tablename='casting_assignments' AND policyname='casting_insert'), 'casting_insert policy');
select ok(EXISTS(SELECT 1 FROM pg_policies WHERE tablename='casting_assignments' AND policyname='casting_update'), 'casting_update policy');
select ok(EXISTS(SELECT 1 FROM pg_policies WHERE tablename='casting_assignments' AND policyname='casting_delete'), 'casting_delete policy');

-- ── Binding helpers exist (2) + grant (1) ───────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname='casting_setlist_ctx_ok'), 'casting_setlist_ctx_ok() exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname='casting_event_ctx_ok'), 'casting_event_ctx_ok() exists');
select ok(has_table_privilege('authenticated','public.casting_assignments','INSERT'), 'authenticated can INSERT casting_assignments');

-- ── Functional: band-role seed trigger + default lineup (2) ──────────────────
DO $$
DECLARE u UUID := gen_random_uuid(); b UUID := gen_random_uuid();
        sl UUID := gen_random_uuid(); sg UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.users (id, email, name) VALUES (u, format('cast-%s@example.com', u::text), 'Cast Tester');
  INSERT INTO public.bands (id, name, created_by) VALUES (b, 'Cast Band', u);   -- trigger seeds band_roles
  INSERT INTO public.setlists (id, name, context_type, context_id, created_by, status, band_id)
    VALUES (sl, 'Cast Set', 'band', b::text, u, 'active', b);
  INSERT INTO public.songs (id, title, artist, context_type, context_id, created_by)
    VALUES (sg, 'Wonderwall', 'Oasis', 'band', b::text, u);
  PERFORM set_config('test.cast_band', b::text, true);
  PERFORM set_config('test.cast_setlist', sl::text, true);
  PERFORM set_config('test.cast_song', sg::text, true);
END $$;

select results_eq(
  format($f$SELECT count(*)::int FROM public.band_roles WHERE band_id=%L$f$, current_setting('test.cast_band')),
  ARRAY[6], 'band-insert trigger seeds 6 default roles');
select results_eq(
  format($f$SELECT count(*)::int FROM public.band_roles WHERE band_id=%L AND is_default_part$f$, current_setting('test.cast_band')),
  ARRAY[5], 'default required lineup = 5 parts (vox+gtr+bass+drums+keys)');

-- ── Functional SECURITY: binding helper accepts matching, REJECTS forgery (3) ─
select results_eq(
  format($f$SELECT casting_setlist_ctx_ok(%L::uuid, %L::uuid, %L::uuid)$f$,
    current_setting('test.cast_setlist'), current_setting('test.cast_band'), current_setting('test.cast_song')),
  ARRAY[true], 'ctx_ok TRUE when setlist+song belong to the band');
select results_eq(
  format($f$SELECT casting_setlist_ctx_ok(%L::uuid, gen_random_uuid(), %L::uuid)$f$,
    current_setting('test.cast_setlist'), current_setting('test.cast_song')),
  ARRAY[false], 'ctx_ok FALSE when band_id is forged (setlist not in that band)');
select results_eq(
  format($f$SELECT casting_setlist_ctx_ok(%L::uuid, %L::uuid, gen_random_uuid())$f$,
    current_setting('test.cast_setlist'), current_setting('test.cast_band')),
  ARRAY[false], 'ctx_ok FALSE when song_id is not a band song (cross-band song forgery)');

select * from finish();
rollback;
