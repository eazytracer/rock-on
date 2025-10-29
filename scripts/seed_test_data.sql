-- ============================================================================
-- Rock On - Test Data Seeding Script
-- ============================================================================
-- Purpose: Populate database with test data for development and testing
-- Created: 2025-10-27
--
-- This script creates:
--   - Test user account
--   - Test band
--   - Sample songs
--   - Sample setlists
--   - Sample shows (practice_sessions with type='gig')
--   - Sample practice sessions
-- ============================================================================

-- Disable RLS temporarily for seeding
SET session_replication_role = replica;

-- ============================================================================
-- TEST USERS (Eric, Mike, Sarah from Supabase Auth)
-- ============================================================================

-- Note: These user IDs must match the authenticated users in auth.users
-- Eric (primary test user)
INSERT INTO public.users (id, email, name, created_date, auth_provider)
VALUES (
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  'eric@ipodshuffle.com',
  'Eric',
  NOW(),
  'email'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (user_id, display_name, primary_instrument, instruments, bio)
VALUES (
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  'Eric',
  'Guitar',
  ARRAY['Guitar', 'Vocals'],
  'Lead guitarist and vocalist'
)
ON CONFLICT (user_id) DO NOTHING;

-- Mike
INSERT INTO public.users (id, email, name, created_date, auth_provider)
VALUES (
  '0c9c3e47-a4e0-4b70-99db-3e14c89ba9b3',
  'mike@ipodshuffle.com',
  'Mike',
  NOW(),
  'email'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (user_id, display_name, primary_instrument, instruments, bio)
VALUES (
  '0c9c3e47-a4e0-4b70-99db-3e14c89ba9b3',
  'Mike',
  'Bass',
  ARRAY['Bass', 'Harmonica', 'Vocals'],
  'Bass player and harmonica specialist'
)
ON CONFLICT (user_id) DO NOTHING;

-- Sarah
INSERT INTO public.users (id, email, name, created_date, auth_provider)
VALUES (
  'b7e6bb62-5c26-4a78-be6b-2e7a1cbe5f77',
  'sarah@ipodshuffle.com',
  'Sarah',
  NOW(),
  'email'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (user_id, display_name, primary_instrument, instruments, bio)
VALUES (
  'b7e6bb62-5c26-4a78-be6b-2e7a1cbe5f77',
  'Sarah',
  'Drums',
  ARRAY['Drums', 'Percussion'],
  'Drummer and percussion specialist'
)
ON CONFLICT (user_id) DO NOTHING;

\echo '✓ Test users created (Eric, Mike, Sarah)'

-- ============================================================================
-- TEST BAND (iPod Shuffle)
-- ============================================================================

-- Create test band
INSERT INTO public.bands (id, name, description, created_date, settings, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'iPod Shuffle',
  'Rock cover band playing classic hits',
  NOW(),
  '{"rehearsalDay": "Thursday", "rehearsalTime": "19:00"}'::jsonb,
  true
)
ON CONFLICT (id) DO NOTHING;

-- Add Eric as band admin
INSERT INTO public.band_memberships (
  user_id,
  band_id,
  role,
  permissions,
  joined_date,
  status
)
VALUES (
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  '00000000-0000-0000-0000-000000000002',
  'admin',
  ARRAY['admin', 'member'],
  NOW(),
  'active'
)
ON CONFLICT (user_id, band_id) DO NOTHING;

-- Add Mike as member
INSERT INTO public.band_memberships (
  user_id,
  band_id,
  role,
  permissions,
  joined_date,
  status
)
VALUES (
  '0c9c3e47-a4e0-4b70-99db-3e14c89ba9b3',
  '00000000-0000-0000-0000-000000000002',
  'member',
  ARRAY['member'],
  NOW(),
  'active'
)
ON CONFLICT (user_id, band_id) DO NOTHING;

-- Add Sarah as member
INSERT INTO public.band_memberships (
  user_id,
  band_id,
  role,
  permissions,
  joined_date,
  status
)
VALUES (
  'b7e6bb62-5c26-4a78-be6b-2e7a1cbe5f77',
  '00000000-0000-0000-0000-000000000002',
  'member',
  ARRAY['member'],
  NOW(),
  'active'
)
ON CONFLICT (user_id, band_id) DO NOTHING;

\echo '✓ Test band created with all members'

-- ============================================================================
-- SAMPLE SONGS
-- ============================================================================

-- Song 1: Rock song
INSERT INTO public.songs (
  id,
  title,
  artist,
  key,
  tempo,
  time_signature,
  duration,
  difficulty,
  genre,
  notes,
  created_date,
  confidence_level,
  context_type,
  context_id,
  created_by,
  visibility
)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Sweet Child O'' Mine',
  'Guns N'' Roses',
  'D',
  120,
  '4/4',
  306,
  3,
  'Rock',
  'Classic rock song with iconic intro riff',
  NOW(),
  4,
  'band',
  '00000000-0000-0000-0000-000000000002',
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  'band'
)
ON CONFLICT (id) DO NOTHING;

-- Song 2: Blues song
INSERT INTO public.songs (
  id,
  title,
  artist,
  key,
  tempo,
  time_signature,
  duration,
  difficulty,
  genre,
  notes,
  created_date,
  confidence_level,
  context_type,
  context_id,
  created_by,
  visibility
)
VALUES (
  '00000000-0000-0000-0000-000000000011',
  'Pride and Joy',
  'Stevie Ray Vaughan',
  'E',
  130,
  '12/8',
  221,
  4,
  'Blues',
  'Shuffle feel, use Texas tone',
  NOW(),
  3,
  'band',
  '00000000-0000-0000-0000-000000000002',
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  'band'
)
ON CONFLICT (id) DO NOTHING;

-- Song 3: Pop rock
INSERT INTO public.songs (
  id,
  title,
  artist,
  key,
  tempo,
  time_signature,
  duration,
  difficulty,
  genre,
  notes,
  created_date,
  confidence_level,
  context_type,
  context_id,
  created_by,
  visibility
)
VALUES (
  '00000000-0000-0000-0000-000000000012',
  'Wonderwall',
  'Oasis',
  'F#m',
  87,
  '4/4',
  258,
  2,
  'Pop Rock',
  'Capo on 2nd fret for original key',
  NOW(),
  5,
  'band',
  '00000000-0000-0000-0000-000000000002',
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  'band'
)
ON CONFLICT (id) DO NOTHING;

-- Song 4: Metal
INSERT INTO public.songs (
  id,
  title,
  artist,
  key,
  tempo,
  time_signature,
  duration,
  difficulty,
  genre,
  notes,
  created_date,
  confidence_level,
  context_type,
  context_id,
  created_by,
  visibility
)
VALUES (
  '00000000-0000-0000-0000-000000000013',
  'Enter Sandman',
  'Metallica',
  'E',
  123,
  '4/4',
  331,
  3,
  'Metal',
  'Drop D tuning, palm muting on verses',
  NOW(),
  4,
  'band',
  '00000000-0000-0000-0000-000000000002',
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  'band'
)
ON CONFLICT (id) DO NOTHING;

-- Song 5: Alternative
INSERT INTO public.songs (
  id,
  title,
  artist,
  key,
  tempo,
  time_signature,
  duration,
  difficulty,
  genre,
  notes,
  created_date,
  confidence_level,
  context_type,
  context_id,
  created_by,
  visibility
)
VALUES (
  '00000000-0000-0000-0000-000000000014',
  'Black Hole Sun',
  'Soundgarden',
  'G',
  51,
  '4/4',
  320,
  4,
  'Alternative',
  'Slow tempo, heavy chorus',
  NOW(),
  3,
  'band',
  '00000000-0000-0000-0000-000000000002',
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  'band'
)
ON CONFLICT (id) DO NOTHING;

\echo '✓ Sample songs created'

-- ============================================================================
-- SAMPLE SETLISTS
-- ============================================================================

-- Setlist 1: Rock Classics
INSERT INTO public.setlists (
  id,
  name,
  band_id,
  notes,
  status,
  created_date,
  last_modified,
  created_by,
  items
)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  'Rock Classics Set',
  '00000000-0000-0000-0000-000000000002',
  'Best rock songs for crowd engagement',
  'active',
  NOW(),
  NOW(),
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  '[
    {"type": "song", "songId": "00000000-0000-0000-0000-000000000010", "position": 1},
    {"type": "song", "songId": "00000000-0000-0000-0000-000000000013", "position": 2},
    {"type": "break", "duration": 10, "position": 3, "notes": "Quick break"},
    {"type": "song", "songId": "00000000-0000-0000-0000-000000000012", "position": 4},
    {"type": "song", "songId": "00000000-0000-0000-0000-000000000014", "position": 5}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Setlist 2: Blues Night
INSERT INTO public.setlists (
  id,
  name,
  band_id,
  notes,
  status,
  created_date,
  last_modified,
  created_by,
  items
)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  'Blues Night',
  '00000000-0000-0000-0000-000000000002',
  'For smaller venues and intimate shows',
  'draft',
  NOW(),
  NOW(),
  '7e75840e-9d91-422e-a949-849f0b8e2ea4',
  '[
    {"type": "song", "songId": "00000000-0000-0000-0000-000000000011", "position": 1}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

\echo '✓ Sample setlists created'

-- ============================================================================
-- SAMPLE SHOWS (practice_sessions with type='gig')
-- ============================================================================

-- Show 1: Upcoming show
INSERT INTO public.practice_sessions (
  id,
  band_id,
  setlist_id,
  scheduled_date,
  duration,
  location,
  type,
  notes,
  songs,
  attendees,
  created_date,
  -- Show-specific fields
  name,
  venue,
  load_in_time,
  soundcheck_time,
  payment,
  contacts
)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000020',
  (NOW() + INTERVAL '14 days')::timestamptz,
  90,
  '123 Main St, Music City, USA',
  'gig',
  'Annual charity event, family-friendly audience',
  '[]'::jsonb,
  '[]'::jsonb,
  NOW(),
  -- Show fields
  'Toys 4 Tots Benefit Concert',
  'The Whiskey Room',
  '6:00 PM',
  '7:00 PM',
  50000,  -- $500
  '[
    {
      "id": "c1",
      "name": "John Smith",
      "role": "Venue Manager",
      "phone": "555-123-4567",
      "email": "john@whiskey.com"
    },
    {
      "id": "c2",
      "name": "Sarah Johnson",
      "role": "Sound Engineer",
      "phone": "555-987-6543",
      "email": "sarah@soundtech.com"
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Update setlist to reference the show (bidirectional link)
UPDATE public.setlists
SET show_id = '00000000-0000-0000-0000-000000000030'
WHERE id = '00000000-0000-0000-0000-000000000020';

-- Show 2: Upcoming show without setlist
INSERT INTO public.practice_sessions (
  id,
  band_id,
  scheduled_date,
  duration,
  location,
  type,
  notes,
  songs,
  attendees,
  created_date,
  -- Show fields
  name,
  venue,
  load_in_time,
  soundcheck_time,
  payment,
  contacts
)
VALUES (
  '00000000-0000-0000-0000-000000000031',
  '00000000-0000-0000-0000-000000000002',
  (NOW() + INTERVAL '30 days')::timestamptz,
  120,
  '456 Rock Ave, Downtown',
  'gig',
  'New venue, larger capacity',
  '[]'::jsonb,
  '[]'::jsonb,
  NOW(),
  -- Show fields
  'New Year''s Eve Bash',
  'Downtown Music Hall',
  '5:00 PM',
  '6:30 PM',
  100000,  -- $1000
  '[
    {
      "id": "c3",
      "name": "Mike Davis",
      "role": "Event Coordinator",
      "phone": "555-246-8135",
      "email": "mike@musicevents.com"
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Show 3: Past show (completed)
INSERT INTO public.practice_sessions (
  id,
  band_id,
  setlist_id,
  scheduled_date,
  duration,
  location,
  type,
  notes,
  songs,
  attendees,
  created_date,
  session_rating,
  -- Show fields
  name,
  venue,
  load_in_time,
  soundcheck_time,
  payment,
  contacts
)
VALUES (
  '00000000-0000-0000-0000-000000000032',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000021',
  (NOW() - INTERVAL '7 days')::timestamptz,
  75,
  '789 Blues Lane',
  'gig',
  'Great crowd, good sound system',
  '[]'::jsonb,
  '[]'::jsonb,
  NOW(),
  5,  -- Excellent rating
  -- Show fields
  'Blues Night at Smokey''s',
  'Smokey''s Bar & Grill',
  '7:00 PM',
  '7:30 PM',
  30000,  -- $300
  '[
    {
      "id": "c4",
      "name": "Tom Wilson",
      "role": "Owner",
      "phone": "555-369-2580",
      "email": "tom@smokeys.com"
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

\echo '✓ Sample shows created'

-- ============================================================================
-- SAMPLE PRACTICE SESSIONS (type='rehearsal')
-- ============================================================================

-- Practice 1: Upcoming rehearsal
INSERT INTO public.practice_sessions (
  id,
  band_id,
  scheduled_date,
  duration,
  location,
  type,
  notes,
  objectives,
  songs,
  attendees,
  created_date
)
VALUES (
  '00000000-0000-0000-0000-000000000040',
  '00000000-0000-0000-0000-000000000002',
  (NOW() + INTERVAL '3 days')::timestamptz,
  120,
  'Band practice space',
  'rehearsal',
  'Prepare for upcoming shows',
  ARRAY['Work on new songs', 'Tighten up transitions', 'Practice harmonies'],
  '[]'::jsonb,
  '[]'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Practice 2: Past rehearsal
INSERT INTO public.practice_sessions (
  id,
  band_id,
  scheduled_date,
  duration,
  location,
  type,
  notes,
  objectives,
  completed_objectives,
  songs,
  attendees,
  created_date,
  session_rating
)
VALUES (
  '00000000-0000-0000-0000-000000000041',
  '00000000-0000-0000-0000-000000000002',
  (NOW() - INTERVAL '3 days')::timestamptz,
  90,
  'Band practice space',
  'rehearsal',
  'Good session, made progress on new material',
  ARRAY['Learn new songs', 'Work on timing'],
  ARRAY['Learn new songs'],
  '[]'::jsonb,
  '[]'::jsonb,
  NOW(),
  4
)
ON CONFLICT (id) DO NOTHING;

\echo '✓ Sample practice sessions created'

-- Re-enable RLS
SET session_replication_role = DEFAULT;

-- ============================================================================
-- SUMMARY
-- ============================================================================

\echo ''
\echo '===================================='
\echo '✓ Test data seeding complete!'
\echo '===================================='
\echo ''
\echo 'Created:'
SELECT
  (SELECT COUNT(*) FROM public.users) as users,
  (SELECT COUNT(*) FROM public.bands) as bands,
  (SELECT COUNT(*) FROM public.songs) as songs,
  (SELECT COUNT(*) FROM public.setlists) as setlists,
  (SELECT COUNT(*) FROM public.practice_sessions WHERE type = 'gig') as shows,
  (SELECT COUNT(*) FROM public.practice_sessions WHERE type = 'rehearsal') as practices;

\echo ''
\echo 'Test credentials:'
\echo '  Email: test@rockon.dev'
\echo '  Band: The Test Band'
\echo ''
\echo 'Shows created:'
SELECT
  name as show_name,
  venue,
  scheduled_date::date as date,
  payment / 100.0 as payment_dollars
FROM public.practice_sessions
WHERE type = 'gig'
ORDER BY scheduled_date;

\echo ''
