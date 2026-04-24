-- Test: Realtime Configuration
-- Purpose: Validate realtime publication and replica identity settings
-- Category: Realtime
-- Created: 2025-11-07

begin;

-- Plan was 14; +6 for jam tables in publication + REPLICA IDENTITY FULL (2026-04-22).
-- jam_sessions/jam_participants/jam_song_matches all need realtime so participants
-- + setlist edits + match recomputes propagate live to every open browser.
select plan(20);

-- ============================================================================
-- Test Tables in Realtime Publication
-- ============================================================================

-- Check each table individually to avoid collation issues with results_eq
select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'audit_log'
  ),
  'audit_log should be in realtime publication'
);

select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'practice_sessions'
  ),
  'practice_sessions should be in realtime publication'
);

select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'setlists'
  ),
  'setlists should be in realtime publication'
);

select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'shows'
  ),
  'shows should be in realtime publication'
);

select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'songs'
  ),
  'songs should be in realtime publication'
);

-- Jam tables — all three need realtime to power the live UI:
--   jam_sessions      → host setlist edits / status changes propagate
--   jam_participants  → join/leave events refresh the participant list
--   jam_song_matches  → recompute writes show up live on every open browser
select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jam_sessions'
  ),
  'jam_sessions should be in realtime publication (host setlist + status broadcasts)'
);

select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jam_participants'
  ),
  'jam_participants should be in realtime publication (join/leave events)'
);

select ok(
  EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'jam_song_matches'
  ),
  'jam_song_matches should be in realtime publication (recompute fan-out)'
);

-- ============================================================================
-- Test Replica Identity FULL on Sync Tables
-- ============================================================================

-- Check each table individually to avoid collation issues with results_eq
select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'songs') = 'f',
  'Songs should have REPLICA IDENTITY FULL'
);

select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'setlists') = 'f',
  'Setlists should have REPLICA IDENTITY FULL'
);

select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'shows') = 'f',
  'Shows should have REPLICA IDENTITY FULL'
);

select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'practice_sessions') = 'f',
  'Practice sessions should have REPLICA IDENTITY FULL'
);

select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'audit_log') = 'f',
  'Audit log should have REPLICA IDENTITY FULL'
);

-- Jam tables need FULL so the realtime payloads include the OLD/NEW row
-- (otherwise UPDATEs only carry the PK and clients can't merge into local
-- state without a re-fetch).
select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'jam_sessions') = 'f',
  'jam_sessions should have REPLICA IDENTITY FULL'
);

select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'jam_participants') = 'f',
  'jam_participants should have REPLICA IDENTITY FULL'
);

select ok(
  (SELECT relreplident FROM pg_class WHERE relname = 'jam_song_matches') = 'f',
  'jam_song_matches should have REPLICA IDENTITY FULL'
);

-- ============================================================================
-- Test Non-Sync Tables NOT in Realtime
-- ============================================================================

select is_empty(
  $$select tablename from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'bands'$$,
  'Bands should NOT be in realtime publication'
);

select is_empty(
  $$select tablename from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'users'$$,
  'Users should NOT be in realtime publication'
);

select is_empty(
  $$select tablename from pg_publication_tables
    where pubname = 'supabase_realtime'
    and tablename = 'band_memberships'$$,
  'Band memberships should NOT be in realtime publication'
);

-- ============================================================================
-- Test Publication Exists
-- ============================================================================

select ok(
  EXISTS(SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'),
  'Should have supabase_realtime publication'
);

select * from finish();
rollback;
