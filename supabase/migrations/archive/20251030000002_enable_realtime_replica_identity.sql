-- Enable full replica identity for realtime sync
-- This allows Supabase Realtime to receive complete row data for UPDATE/DELETE events
-- Required for real-time collaboration features
-- Reference: .claude/artifacts/2025-10-30T21:30_realtime-hello-world-test-results.md

-- Songs table
ALTER TABLE songs REPLICA IDENTITY FULL;

-- Setlists table
ALTER TABLE setlists REPLICA IDENTITY FULL;

-- Shows table
ALTER TABLE shows REPLICA IDENTITY FULL;

-- Practice Sessions table
ALTER TABLE practice_sessions REPLICA IDENTITY FULL;

-- Verify configuration (output for validation)
SELECT
  'Replica Identity Status:' as check_type,
  c.relname as table_name,
  CASE c.relreplident
    WHEN 'd' THEN 'DEFAULT (pk only) - NEEDS FIX'
    WHEN 'f' THEN 'FULL (all columns) - OK'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'i' THEN 'INDEX'
  END as replica_identity
FROM pg_class c
WHERE c.relname IN ('songs', 'setlists', 'shows', 'practice_sessions')
ORDER BY c.relname;
