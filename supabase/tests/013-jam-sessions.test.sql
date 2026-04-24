-- Test: Jam Sessions schema-level coverage
-- Purpose: Lock down indexes, FK actions, check constraints, and the
--          functional cascade behavior that the rest of the suite was
--          missing for jam_sessions / jam_participants / jam_song_matches.
-- Category: Schema + Data Integrity
-- Created: 2026-04-22
--
-- See `.claude/artifacts/2026-04-22T21:37_pgtap-coverage-review.md` for the
-- broader review that motivated this file. The intent is that any future
-- migration that touches jam tables must update this file or break a test —
-- so the social-catalog surface stays anchored.

begin;

-- 12 indexes + 8 FK on-delete + 3 check + 4 unique + 4 cascade-functional = 31
select plan(31);

-- ============================================================================
-- Indexes (12)
-- ----------------------------------------------------------------------------
-- pgTAP's `has_index(name, name, text)` overload is brittle when the third
-- argument disambiguates against the `(name, name, name)` form (it ends up
-- treating the description as a column name). Use the 4-arg form:
--   has_index(table, index, columns_array, description)
-- which is unambiguous.
-- ============================================================================

select has_index('jam_sessions', 'jam_sessions_pkey', ARRAY['id'],
  'jam_sessions should have PK index');
select has_index('jam_sessions', 'jam_sessions_short_code_key', ARRAY['short_code'],
  'jam_sessions.short_code should have UNIQUE index (join code lookup)');
select has_index('jam_sessions', 'jam_sessions_view_token_key', ARRAY['view_token'],
  'jam_sessions.view_token should have UNIQUE index (anon view lookup)');
select has_index('jam_sessions', 'idx_jam_sessions_host', ARRAY['host_user_id'],
  'jam_sessions should have host index (resume-active-jam query)');
select has_index('jam_sessions', 'idx_jam_sessions_status', ARRAY['status'],
  'jam_sessions should have status index (expiry sweep)');
select has_index('jam_sessions', 'idx_jam_sessions_short_code', ARRAY['short_code'],
  'jam_sessions should have short_code lookup index');
select has_index('jam_sessions', 'idx_jam_sessions_view_token', ARRAY['view_token'],
  'jam_sessions should have view_token lookup index');

select has_index('jam_participants', 'jam_participants_pkey', ARRAY['id'],
  'jam_participants should have PK index');
select has_index('jam_participants', 'idx_jam_participants_session', ARRAY['jam_session_id'],
  'jam_participants should have jam_session_id index (participant list)');
select has_index('jam_participants', 'idx_jam_participants_user', ARRAY['user_id'],
  'jam_participants should have user_id index (resume-active-jam)');

select has_index('jam_song_matches', 'idx_jam_song_matches_session', ARRAY['jam_session_id'],
  'jam_song_matches should have jam_session_id index');
select has_index('jam_song_matches', 'idx_jam_song_matches_canonical', ARRAY['canonical_title', 'canonical_artist'],
  'jam_song_matches should have canonical title/artist index (match lookup)');

-- ============================================================================
-- FK on-delete actions (8) — these are what the harness reset bug exposed.
-- Lock the cascade behavior in tests so no future migration can silently
-- flip a CASCADE to RESTRICT (or vice versa) without breaking a test.
-- ============================================================================

-- jam_sessions outbound
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jam_sessions_host_user_id_fkey')::text,
  'c',
  'jam_sessions.host_user_id should ON DELETE CASCADE (deleting host wipes their jams)'
);

select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jam_sessions_seed_setlist_id_fkey')::text,
  'n',
  'jam_sessions.seed_setlist_id should ON DELETE SET NULL (preserve the jam if seed setlist is deleted)'
);

select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jam_sessions_saved_setlist_id_fkey')::text,
  'n',
  'jam_sessions.saved_setlist_id should ON DELETE SET NULL (preserve the jam if saved setlist is deleted)'
);

-- jam_sessions.last_modified_by is intentionally NO ACTION (RESTRICT). This
-- is the same RESTRICT pattern the harness reset has to NULL-out before
-- deleting a user. If the schema ever flips this to CASCADE or SET NULL,
-- update `cascadeDeletePublicUserRows` in scripts/test-harness/personas.ts
-- to remove the matching cleanup step.
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jam_sessions_last_modified_by_fkey')::text,
  'a',
  'jam_sessions.last_modified_by should be NO ACTION (RESTRICT) — harness cascadeDeletePublicUserRows clears it explicitly'
);

-- jam_participants inbound from jam_sessions
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jam_participants_jam_session_id_fkey')::text,
  'c',
  'jam_participants.jam_session_id should ON DELETE CASCADE'
);

-- jam_participants → users (cascade so user delete wipes their participations)
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jam_participants_user_id_fkey')::text,
  'c',
  'jam_participants.user_id should ON DELETE CASCADE'
);

-- jam_song_matches inbound from jam_sessions
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'jam_song_matches_jam_session_id_fkey')::text,
  'c',
  'jam_song_matches.jam_session_id should ON DELETE CASCADE'
);

-- setlists.jam_session_id (the "save jam → personal setlist" link). Should
-- SET NULL so saved setlists survive jam deletion.
select is(
  (SELECT confdeltype FROM pg_constraint WHERE conname = 'setlists_jam_session_id_fkey')::text,
  'n',
  'setlists.jam_session_id should ON DELETE SET NULL (saved setlists outlive their source jam)'
);

-- ============================================================================
-- Check constraints (3) — enum-style allowed values
-- ============================================================================

-- jam_sessions.status: 'active' | 'expired' | 'saved'
select ok(
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jam_sessions_status_check'
      AND conrelid = 'public.jam_sessions'::regclass
      AND contype = 'c'
  ),
  'jam_sessions should have status check constraint'
);

-- jam_participants.status: 'active' | 'left' | 'kicked'
select ok(
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jam_participants_status_check'
      AND conrelid = 'public.jam_participants'::regclass
      AND contype = 'c'
  ),
  'jam_participants should have status check constraint'
);

-- jam_song_matches.match_confidence: 'exact' | 'fuzzy' | 'manual'
select ok(
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jam_song_matches_match_confidence_check'
      AND conrelid = 'public.jam_song_matches'::regclass
      AND contype = 'c'
  ),
  'jam_song_matches should have match_confidence check constraint'
);

-- ============================================================================
-- Unique constraints (4)
-- ============================================================================

-- short_code MUST be unique — join codes are looked up by code alone.
select ok(
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jam_sessions_short_code_key'
      AND conrelid = 'public.jam_sessions'::regclass
      AND contype = 'u'
  ),
  'jam_sessions.short_code should be UNIQUE'
);

-- view_token (hashed) is unique because the anon-view lookup uses code+token.
select ok(
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jam_sessions_view_token_key'
      AND conrelid = 'public.jam_sessions'::regclass
      AND contype = 'u'
  ),
  'jam_sessions.view_token should be UNIQUE'
);

-- A user may only be in a session once (UNIQUE (jam_session_id, user_id)).
select ok(
  EXISTS(
    SELECT 1 FROM pg_constraint
    WHERE conname = 'jam_participants_jam_session_id_user_id_key'
      AND conrelid = 'public.jam_participants'::regclass
      AND contype = 'u'
  ),
  'jam_participants should be UNIQUE on (jam_session_id, user_id)'
);

-- Functional check: inserting a duplicate participant should raise 23505.
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_session_id UUID := gen_random_uuid();
BEGIN
  -- Set up a user + session as service-role (bypasses RLS).
  INSERT INTO public.users (id, email, name)
  VALUES (test_user_id, format('jam-dup-%s@example.com', test_user_id::text), 'Dup Test');
  INSERT INTO public.jam_sessions (id, host_user_id, short_code, status, expires_at)
  VALUES (test_session_id, test_user_id, substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6), 'active', now() + interval '1 hour');
  -- First insert: succeeds.
  INSERT INTO public.jam_participants (jam_session_id, user_id, status, joined_date, shared_contexts)
  VALUES (test_session_id, test_user_id, 'active', now(), '[]'::jsonb);
  PERFORM set_config('test.jam_session_id', test_session_id::text, true);
  PERFORM set_config('test.jam_user_id', test_user_id::text, true);
END $$;

select throws_ok(
  format(
    $f$INSERT INTO public.jam_participants (jam_session_id, user_id, status, joined_date, shared_contexts)
       VALUES (%L, %L, 'active', now(), '[]'::jsonb)$f$,
    current_setting('test.jam_session_id'),
    current_setting('test.jam_user_id')
  ),
  '23505',
  null,
  'Duplicate participant insert should violate UNIQUE (jam_session_id, user_id)'
);

-- ============================================================================
-- Functional cascade tests (3) — confirm DELETE on jam_sessions wipes
-- participants + matches.
-- ============================================================================

-- Set up: create another jam, add a participant + match, then delete the jam.
DO $$
DECLARE
  cascade_user_id UUID := gen_random_uuid();
  cascade_session_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (cascade_user_id, format('jam-cascade-%s@example.com', cascade_user_id::text), 'Cascade Test');
  INSERT INTO public.jam_sessions (id, host_user_id, short_code, status, expires_at)
  VALUES (cascade_session_id, cascade_user_id, substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6), 'active', now() + interval '1 hour');
  INSERT INTO public.jam_participants (jam_session_id, user_id, status, joined_date, shared_contexts)
  VALUES (cascade_session_id, cascade_user_id, 'active', now(), '[]'::jsonb);
  INSERT INTO public.jam_song_matches (
    jam_session_id, canonical_title, canonical_artist,
    display_title, display_artist, match_confidence, is_confirmed,
    matched_songs, participant_count, computed_at
  ) VALUES (
    cascade_session_id, 'wonderwall', 'oasis',
    'Wonderwall', 'Oasis', 'exact', true,
    '[]'::jsonb, 1, now()
  );
  PERFORM set_config('test.cascade_session_id', cascade_session_id::text, true);
  PERFORM set_config('test.cascade_user_id', cascade_user_id::text, true);
END $$;

-- Pre-conditions: row counts before DELETE.
select results_eq(
  format($f$SELECT count(*)::int FROM public.jam_participants WHERE jam_session_id = %L$f$,
    current_setting('test.cascade_session_id')),
  ARRAY[1],
  'Pre-cascade: participant exists'
);

-- DELETE the parent.
DO $$ BEGIN
  DELETE FROM public.jam_sessions WHERE id = current_setting('test.cascade_session_id')::uuid;
END $$;

-- Post-conditions: cascading children should be gone.
select results_eq(
  format($f$SELECT count(*)::int FROM public.jam_participants WHERE jam_session_id = %L$f$,
    current_setting('test.cascade_session_id')),
  ARRAY[0],
  'Post-cascade: jam_participants rows are wiped when jam_sessions row is deleted'
);

select results_eq(
  format($f$SELECT count(*)::int FROM public.jam_song_matches WHERE jam_session_id = %L$f$,
    current_setting('test.cascade_session_id')),
  ARRAY[0],
  'Post-cascade: jam_song_matches rows are wiped when jam_sessions row is deleted'
);

-- ============================================================================
-- Functional check: seed_setlist_id SET NULL behavior
-- ============================================================================

DO $$
DECLARE
  s_user_id UUID := gen_random_uuid();
  s_setlist_id UUID := gen_random_uuid();
  s_session_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (s_user_id, format('jam-seed-%s@example.com', s_user_id::text), 'Seed Test');
  INSERT INTO public.setlists (id, name, context_type, context_id, created_by, status)
  VALUES (s_setlist_id, 'Seed', 'personal', s_user_id::text, s_user_id, 'active');
  INSERT INTO public.jam_sessions (id, host_user_id, short_code, status, expires_at, seed_setlist_id)
  VALUES (s_session_id, s_user_id, substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6), 'active', now() + interval '1 hour', s_setlist_id);
  PERFORM set_config('test.seed_session_id', s_session_id::text, true);
  PERFORM set_config('test.seed_setlist_id', s_setlist_id::text, true);
END $$;

-- Delete the seed setlist; jam should survive with seed_setlist_id NULL.
DO $$ BEGIN
  DELETE FROM public.setlists WHERE id = current_setting('test.seed_setlist_id')::uuid;
END $$;

select results_eq(
  format($f$SELECT seed_setlist_id IS NULL FROM public.jam_sessions WHERE id = %L$f$,
    current_setting('test.seed_session_id')),
  ARRAY[true],
  'Deleting the seed setlist should NULL out jam_sessions.seed_setlist_id (jam survives)'
);

select * from finish();
rollback;
