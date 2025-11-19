-- Enable Realtime for all sync tables
-- This allows WebSocket subscriptions via Supabase Realtime
-- Reference: https://supabase.com/docs/guides/realtime/postgres-changes

-- Enable Realtime for songs table
ALTER PUBLICATION supabase_realtime ADD TABLE songs;

-- Enable Realtime for setlists table
ALTER PUBLICATION supabase_realtime ADD TABLE setlists;

-- Enable Realtime for shows table
ALTER PUBLICATION supabase_realtime ADD TABLE shows;

-- Enable Realtime for practice_sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE practice_sessions;

-- Verify publications
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
