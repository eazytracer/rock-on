-- Test: Tunings feature (structured per-string tunings + custom tunings)
-- Purpose: Lock down the tunings table (schema, CHECKs, grants, RLS), the seeded
--          built-ins, the builtin_tuning_slug() backfill helper, and songs.tuning_id.
-- Category: Schema + Constraints + RLS + Functions
-- Created: 2026-07-04 (tunings feature)
--
-- Note: tests.get_supabase_uid() reads auth.users (not selectable by 'authenticated'),
-- so uids are captured into GUCs while role=postgres, then referenced under RLS.

begin;

select plan(31);

-- ── Schema exists (3) ────────────────────────────────────────────────────────
select has_table('tunings', 'tunings table exists');
select has_column('songs', 'tuning_id', 'songs.tuning_id column exists');
select ok(EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'builtin_tuning_slug'),
  'builtin_tuning_slug() exists');

-- ── Constraints (3) ──────────────────────────────────────────────────────────
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'tunings_pitch_len'
  AND conrelid = 'public.tunings'::regclass), 'tunings_pitch_len CHECK exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'tunings_builtin_xor_owned'
  AND conrelid = 'public.tunings'::regclass), 'tunings_builtin_xor_owned CHECK exists');
select ok(EXISTS(SELECT 1 FROM pg_constraint WHERE conname = 'tunings_slug_key'
  AND conrelid = 'public.tunings'::regclass AND contype = 'u'), 'slug UNIQUE constraint exists');

-- ── RLS + grants (2) ─────────────────────────────────────────────────────────
select ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.tunings'::regclass),
  'RLS enabled on tunings');
select ok(has_table_privilege('authenticated', 'public.tunings', 'INSERT'),
  'authenticated can INSERT tunings');

-- ── Seeded built-ins (2) ─────────────────────────────────────────────────────
select is((SELECT count(*)::int FROM public.tunings WHERE is_builtin), 17,
  '17 built-in tunings seeded');
select is((SELECT pitches FROM public.tunings WHERE slug = 'standard'),
  ARRAY[40,45,50,55,59,64]::smallint[], 'standard = E2 A2 D3 G3 B3 E4 (MIDI)');

-- ── builtin_tuning_slug() normalization (3) ──────────────────────────────────
select is(public.builtin_tuning_slug('Eb Standard'), 'half-step-down',
  '"Eb Standard" → half-step-down');
select is(public.builtin_tuning_slug('Standard (EADGBE)'), 'standard',
  '"Standard (EADGBE)" → standard');
select is(public.builtin_tuning_slug('Totally Custom XYZ'), NULL,
  'unrecognized label → NULL (stays a custom / unmatched)');

-- ── CHECK constraints reject bad rows (2) ────────────────────────────────────
-- pitches length must equal string_count.
select throws_ok(
  $q$INSERT INTO public.tunings (instrument, string_count, pitches, name, slug, is_builtin)
     VALUES ('guitar', 6, '{1,2,3,4,5}', 'Bad Len', 'bad-len', true)$q$,
  '23514', NULL, 'pitches length must match string_count');

-- built-in must have a slug and no owner (this violates the XOR: builtin + owner).
select throws_ok(
  $q$INSERT INTO public.tunings (instrument, string_count, pitches, name, is_builtin, context_type, context_id)
     VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'Bad Builtin', true, 'band', 'x')$q$,
  '23514', NULL, 'built-in with an owner violates builtin_xor_owned');

-- ── RLS behavior (4) ─────────────────────────────────────────────────────────
select tests.create_supabase_user('tun-a@test.com');
select tests.create_supabase_user('tun-b@test.com');
DO $$ BEGIN
  PERFORM set_config('test.a', tests.get_supabase_uid('tun-a@test.com')::text, true);
  PERFORM set_config('test.b', tests.get_supabase_uid('tun-b@test.com')::text, true);
END $$;

-- Built-ins are world-readable: user A sees all 17.
select tests.authenticate_as('tun-a@test.com');
select is((SELECT count(*)::int FROM public.tunings WHERE is_builtin), 17,
  'built-ins are world-readable to any authenticated user');

-- A user cannot create a built-in (RLS write policy requires NOT is_builtin).
select throws_ok(
  $q$INSERT INTO public.tunings (instrument, string_count, pitches, name, slug, is_builtin)
     VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'Hack', 'hack-slug', true)$q$,
  '42501', NULL, 'a user cannot insert a built-in tuning');

-- A user CAN create a personal custom tuning they own.
select lives_ok(
  format($q$INSERT INTO public.tunings
             (instrument, string_count, pitches, name, is_builtin, context_type, context_id, created_by)
           VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'A private tuning', false, 'personal', %L, %L)$q$,
    current_setting('test.a'), current_setting('test.a')),
  'a user can create a personal custom tuning');

-- User B cannot see user A's personal custom tuning.
select tests.authenticate_as('tun-b@test.com');
select is(
  (SELECT count(*)::int FROM public.tunings WHERE name = 'A private tuning'),
  0, 'a user cannot see another users personal custom tuning');

-- ═══ Negative / "attacker-can't" matrix ═════════════════════════════════════
-- (authenticated as tun-b from the SELECT-leak test above)

-- Built-in tamper: writes are hidden by RLS (USING NOT is_builtin) → 0 rows, value stays.
UPDATE public.tunings SET name = 'HACKED' WHERE slug = 'standard';
select is((SELECT name FROM public.tunings WHERE slug = 'standard'), 'Standard',
  'a user cannot UPDATE a built-in tuning (unchanged)');
DELETE FROM public.tunings WHERE slug = 'standard';
select is((SELECT count(*)::int FROM public.tunings WHERE is_builtin), 17,
  'a user cannot DELETE a built-in tuning (all 17 remain)');

-- Ownership forgery on INSERT (WITH CHECK binds created_by + owner to auth.uid()).
select throws_ok(
  format($q$INSERT INTO public.tunings
             (instrument, string_count, pitches, name, is_builtin, context_type, context_id, created_by)
           VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'Forge CB', false, 'personal', %L, %L)$q$,
    current_setting('test.b'), current_setting('test.a')),
  '42501', NULL, 'cannot INSERT a custom tuning with a foreign created_by');
select throws_ok(
  format($q$INSERT INTO public.tunings
             (instrument, string_count, pitches, name, is_builtin, context_type, context_id, created_by)
           VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'Forge Ctx', false, 'personal', %L, %L)$q$,
    current_setting('test.a'), current_setting('test.b')),
  '42501', NULL, 'cannot INSERT a personal tuning owned by another user');

-- Ownerless custom row rejected by the XOR constraint. Run as postgres so RLS is
-- bypassed and the CHECK (23514) is what fires (under RLS it'd be 42501 first).
set local role postgres;
select throws_ok(
  $q$INSERT INTO public.tunings (instrument, string_count, pitches, name, is_builtin)
     VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'Ownerless', false)$q$,
  '23514', NULL, 'a non-builtin tuning with no owner violates builtin_xor_owned');
select tests.authenticate_as('tun-b@test.com');

-- User B cannot UPDATE/DELETE user A's personal tuning (RLS hides it → 0 rows).
UPDATE public.tunings SET name = 'STOLEN' WHERE name = 'A private tuning';
DELETE FROM public.tunings WHERE name = 'A private tuning';
select tests.authenticate_as('tun-a@test.com');
select is((SELECT count(*)::int FROM public.tunings WHERE name = 'A private tuning'), 1,
  'another user cannot UPDATE/DELETE your personal tuning (intact)');

-- Owner cannot flip is_builtin or forge created_by (pinned by trg_tunings_lock_ownership).
UPDATE public.tunings
   SET is_builtin = true, created_by = current_setting('test.b')::uuid
 WHERE name = 'A private tuning';
select is(
  (SELECT is_builtin::text || '/' ||
          (created_by = current_setting('test.a')::uuid)::text
     FROM public.tunings WHERE name = 'A private tuning'),
  'false/true',
  'owner cannot flip is_builtin or forge created_by (ownership pinned)');

-- ── Band tenancy ─────────────────────────────────────────────────────────────
set local role postgres;
DO $$
DECLARE v_band uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.bands (id, name, created_by)
    VALUES (v_band, 'Tun Band', current_setting('test.a')::uuid);
  -- A band-creator trigger may already add the creator as admin; be idempotent.
  INSERT INTO public.band_memberships (user_id, band_id, role, status)
    VALUES (current_setting('test.a')::uuid, v_band, 'admin', 'active')
    ON CONFLICT (user_id, band_id) DO NOTHING;
  INSERT INTO public.tunings
    (instrument, string_count, pitches, name, is_builtin, context_type, context_id, created_by)
    VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'Band tuning', false, 'band',
            v_band::text, current_setting('test.a')::uuid);
  PERFORM set_config('test.band', v_band::text, true);
END $$;

select tests.authenticate_as('tun-a@test.com');
select is((SELECT count(*)::int FROM public.tunings WHERE name = 'Band tuning'), 1,
  'a band member can SELECT the bands custom tuning');

select tests.authenticate_as('tun-b@test.com');
select is((SELECT count(*)::int FROM public.tunings WHERE name = 'Band tuning'), 0,
  'a non-member cannot SELECT another bands custom tuning');
select throws_ok(
  format($q$INSERT INTO public.tunings
             (instrument, string_count, pitches, name, is_builtin, context_type, context_id, created_by)
           VALUES ('guitar', 6, '{40,45,50,55,59,64}', 'Intruder', false, 'band', %L, %L)$q$,
    current_setting('test.band'), current_setting('test.b')),
  '42501', NULL, 'a non-member cannot INSERT a tuning into another band');
UPDATE public.tunings SET name = 'B WUZ HERE' WHERE name = 'Band tuning';
DELETE FROM public.tunings WHERE name = 'Band tuning';
select tests.authenticate_as('tun-a@test.com');
select is((SELECT count(*)::int FROM public.tunings WHERE name = 'Band tuning'), 1,
  'a non-member cannot UPDATE/DELETE another bands tuning (intact)');

-- A member re-homing a band tuning into personal is pinned → stays band-owned.
UPDATE public.tunings SET context_type = 'personal', context_id = current_setting('test.a')
 WHERE name = 'Band tuning';
select is((SELECT context_type FROM public.tunings WHERE name = 'Band tuning'), 'band',
  'a member cannot re-home a band tuning into personal ownership (pinned)');

select * from finish();
rollback;
