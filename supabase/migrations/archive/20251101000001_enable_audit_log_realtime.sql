-- Enable Realtime for audit_log table
-- This allows WebSocket subscriptions for real-time collaboration
-- Part of Phase 4a: Audit-First Real-Time Sync

-- Add audit_log to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE audit_log;

-- Enable full replica identity for audit_log
-- This allows Supabase Realtime to receive complete row data
ALTER TABLE audit_log REPLICA IDENTITY FULL;

-- Verify configuration
SELECT
  'Realtime Publication:' as check_type,
  schemaname,
  tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'audit_log';

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
WHERE c.relname = 'audit_log';
