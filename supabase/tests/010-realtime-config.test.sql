-- Test: Realtime Configuration
-- Purpose: Validate realtime publication and replica identity settings
-- Category: Realtime
-- Created: 2025-11-07

begin;

-- Note: Plan updated from 10 to 14 - split publication check into 5 individual tests to avoid collation issues
select plan(14);

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
