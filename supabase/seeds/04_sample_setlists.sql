-- Rock On Sample Setlists
-- Seed file: Sample setlists, practice sessions, and castings for development and testing
-- Created: 2025-10-25

-- ============================================================================
-- SETLISTS
-- ============================================================================

-- Motörhead setlists
INSERT INTO public.setlists (id, name, band_id, status, created_date, created_by, notes) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Motörhead Greatest Hits', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'active', '2024-02-01 10:00:00+00', '11111111-1111-1111-1111-111111111111', 'Classic setlist for shows'),
  ('30000000-0000-0000-0000-000000000002', 'Motörhead New Material', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'draft', '2024-03-15 10:00:00+00', '11111111-1111-1111-1111-111111111111', 'Working on new songs');

-- Foo Fighters setlists
INSERT INTO public.setlists (id, name, band_id, status, created_date, created_by, notes) VALUES
  ('30000000-0000-0000-0000-000000000003', 'Foo Fighters Stadium Tour', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active', '2024-02-10 10:00:00+00', '22222222-2222-2222-2222-222222222222', 'Main setlist for stadium shows'),
  ('30000000-0000-0000-0000-000000000004', 'Foo Fighters Acoustic Set', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'active', '2024-03-01 10:00:00+00', '22222222-2222-2222-2222-222222222222', 'Stripped down acoustic performances'),
  ('30000000-0000-0000-0000-000000000005', 'Foo Fighters Festival Set', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'draft', '2024-04-01 10:00:00+00', '22222222-2222-2222-2222-222222222222', 'High energy 60-minute festival set');

-- ============================================================================
-- PRACTICE SESSIONS
-- ============================================================================

-- Motörhead practice sessions
INSERT INTO public.practice_sessions (id, band_id, setlist_id, scheduled_date, start_time, end_time, duration, location, type, notes, objectives, completed_objectives, session_rating, attendees) VALUES
  -- Completed sessions
  ('40000000-0000-0000-0000-000000000001',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '30000000-0000-0000-0000-000000000001',
   '2024-10-01 18:00:00+00',
   '2024-10-01 18:00:00+00',
   '2024-10-01 21:00:00+00',
   180,
   'Studio A',
   'rehearsal',
   'Great energy, nailed the classics',
   ARRAY['Run through setlist', 'Work on transitions', 'Test new amp settings'],
   ARRAY['Run through setlist', 'Work on transitions'],
   5,
   '[{"user_id": "11111111-1111-1111-1111-111111111111", "attended": true}, {"user_id": "33333333-3333-3333-3333-333333333333", "attended": true}, {"user_id": "44444444-4444-4444-4444-444444444444", "attended": true}]'::jsonb
  ),
  ('40000000-0000-0000-0000-000000000002',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '30000000-0000-0000-0000-000000000002',
   '2024-10-08 19:00:00+00',
   '2024-10-08 19:00:00+00',
   '2024-10-08 22:00:00+00',
   180,
   'Studio A',
   'writing',
   'Good progress on new material',
   ARRAY['Write new riff', 'Develop song structure', 'Record demo'],
   ARRAY['Write new riff', 'Develop song structure'],
   4,
   '[{"user_id": "11111111-1111-1111-1111-111111111111", "attended": true}, {"user_id": "33333333-3333-3333-3333-333333333333", "attended": true}, {"user_id": "44444444-4444-4444-4444-444444444444", "attended": false}]'::jsonb
  ),
  ('40000000-0000-0000-0000-000000000003',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '30000000-0000-0000-0000-000000000001',
   '2024-10-15 18:00:00+00',
   '2024-10-15 18:00:00+00',
   '2024-10-15 20:30:00+00',
   150,
   'Studio A',
   'rehearsal',
   'Phil had gear issues, worked around it',
   ARRAY['Polish problem songs', 'Tighten timing'],
   ARRAY['Polish problem songs'],
   3,
   '[{"user_id": "11111111-1111-1111-1111-111111111111", "attended": true}, {"user_id": "33333333-3333-3333-3333-333333333333", "attended": true}, {"user_id": "44444444-4444-4444-4444-444444444444", "attended": true}]'::jsonb
  ),
  -- Upcoming sessions
  ('40000000-0000-0000-0000-000000000004',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '30000000-0000-0000-0000-000000000001',
   '2024-10-29 18:00:00+00',
   NULL,
   NULL,
   NULL,
   'Studio A',
   'rehearsal',
   'Final rehearsal before show',
   ARRAY['Full setlist run', 'Work on stage transitions'],
   ARRAY[]::text[],
   NULL,
   '[]'::jsonb
  );

-- Foo Fighters practice sessions
INSERT INTO public.practice_sessions (id, band_id, setlist_id, scheduled_date, start_time, end_time, duration, location, type, notes, objectives, completed_objectives, session_rating, attendees) VALUES
  -- Completed sessions
  ('40000000-0000-0000-0000-000000000005',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '30000000-0000-0000-0000-000000000003',
   '2024-10-05 17:00:00+00',
   '2024-10-05 17:00:00+00',
   '2024-10-05 21:00:00+00',
   240,
   'Warehouse Studio',
   'rehearsal',
   'Solid run-through, crowd energy simulation worked well',
   ARRAY['Run full stadium set', 'Practice pyro timing', 'Test in-ear monitors'],
   ARRAY['Run full stadium set', 'Practice pyro timing', 'Test in-ear monitors'],
   5,
   '[{"user_id": "22222222-2222-2222-2222-222222222222", "attended": true}, {"user_id": "55555555-5555-5555-5555-555555555555", "attended": true}, {"user_id": "66666666-6666-6666-6666-666666666666", "attended": true}, {"user_id": "77777777-7777-7777-7777-777777777777", "attended": true}]'::jsonb
  ),
  ('40000000-0000-0000-0000-000000000006',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '30000000-0000-0000-0000-000000000004',
   '2024-10-10 14:00:00+00',
   '2024-10-10 14:00:00+00',
   '2024-10-10 17:00:00+00',
   180,
   'Warehouse Studio',
   'rehearsal',
   'Acoustic arrangements coming together nicely',
   ARRAY['Rehearse acoustic versions', 'Work on harmonies', 'Test capo changes'],
   ARRAY['Rehearse acoustic versions', 'Work on harmonies'],
   4,
   '[{"user_id": "22222222-2222-2222-2222-222222222222", "attended": true}, {"user_id": "55555555-5555-5555-5555-555555555555", "attended": true}, {"user_id": "66666666-6666-6666-6666-666666666666", "attended": true}, {"user_id": "77777777-7777-7777-7777-777777777777", "attended": true}]'::jsonb
  ),
  ('40000000-0000-0000-0000-000000000007',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '30000000-0000-0000-0000-000000000005',
   '2024-10-18 16:00:00+00',
   '2024-10-18 16:00:00+00',
   '2024-10-18 19:00:00+00',
   180,
   'Warehouse Studio',
   'writing',
   'Festival setlist taking shape',
   ARRAY['Select best festival songs', 'Create dynamic flow', 'Time the set'],
   ARRAY['Select best festival songs', 'Create dynamic flow'],
   4,
   '[{"user_id": "22222222-2222-2222-2222-222222222222", "attended": true}, {"user_id": "55555555-5555-5555-5555-555555555555", "attended": false}, {"user_id": "66666666-6666-6666-6666-666666666666", "attended": true}, {"user_id": "77777777-7777-7777-7777-777777777777", "attended": true}]'::jsonb
  ),
  ('40000000-0000-0000-0000-000000000008',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '30000000-0000-0000-0000-000000000003',
   '2024-10-22 17:00:00+00',
   '2024-10-22 17:00:00+00',
   '2024-10-22 20:00:00+00',
   180,
   'Warehouse Studio',
   'recording',
   'Recorded live takes for documentary',
   ARRAY['Record full set', 'Capture video footage', 'Test camera angles'],
   ARRAY['Record full set', 'Capture video footage'],
   5,
   '[{"user_id": "22222222-2222-2222-2222-222222222222", "attended": true}, {"user_id": "55555555-5555-5555-5555-555555555555", "attended": true}, {"user_id": "66666666-6666-6666-6666-666666666666", "attended": true}, {"user_id": "77777777-7777-7777-7777-777777777777", "attended": true}]'::jsonb
  ),
  -- Upcoming sessions
  ('40000000-0000-0000-0000-000000000009',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '30000000-0000-0000-0000-000000000003',
   '2024-10-28 16:00:00+00',
   NULL,
   NULL,
   NULL,
   'Warehouse Studio',
   'rehearsal',
   'Pre-tour final rehearsal',
   ARRAY['Full production rehearsal', 'Test all gear', 'Run backup songs'],
   ARRAY[]::text[],
   NULL,
   '[]'::jsonb
  ),
  ('40000000-0000-0000-0000-000000000010',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '30000000-0000-0000-0000-000000000004',
   '2024-11-05 15:00:00+00',
   NULL,
   NULL,
   NULL,
   'Warehouse Studio',
   'rehearsal',
   'Acoustic set refinement',
   ARRAY['Polish acoustic arrangements', 'Work on banter', 'Test lighting'],
   ARRAY[]::text[],
   NULL,
   '[]'::jsonb
  );

-- ============================================================================
-- SONG CASTINGS (Band-level defaults)
-- ============================================================================

-- Motörhead band-level castings
INSERT INTO public.song_castings (id, context_type, context_id, song_id, created_by, created_date) VALUES
  ('50000000-0000-0000-0000-000000000001', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000002', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000003', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '10000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00');

-- Foo Fighters band-level castings
INSERT INTO public.song_castings (id, context_type, context_id, song_id, created_by, created_date) VALUES
  ('50000000-0000-0000-0000-000000000004', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000005', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000006', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '20000000-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00');

-- ============================================================================
-- SONG ASSIGNMENTS (Who plays what)
-- ============================================================================

-- Motörhead - Ace of Spades assignments
INSERT INTO public.song_assignments (song_casting_id, member_id, is_primary, confidence, added_by, added_date) VALUES
  ('50000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', true, 5, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', true, 5, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', true, 5, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00');

-- Motörhead - Overkill assignments
INSERT INTO public.song_assignments (song_casting_id, member_id, is_primary, confidence, added_by, added_date) VALUES
  ('50000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', true, 5, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', true, 5, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', true, 5, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00');

-- Motörhead - The Hammer assignments
INSERT INTO public.song_assignments (song_casting_id, member_id, is_primary, confidence, added_by, added_date) VALUES
  ('50000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', true, 4, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', true, 4, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', true, 4, '11111111-1111-1111-1111-111111111111', '2024-02-01 10:00:00+00');

-- Foo Fighters - Everlong assignments
INSERT INTO public.song_assignments (song_casting_id, member_id, is_primary, confidence, added_by, added_date) VALUES
  ('50000000-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666666', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000004', '77777777-7777-7777-7777-777777777777', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00');

-- Foo Fighters - The Pretender assignments
INSERT INTO public.song_assignments (song_casting_id, member_id, is_primary, confidence, added_by, added_date) VALUES
  ('50000000-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666666', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000005', '77777777-7777-7777-7777-777777777777', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00');

-- Foo Fighters - Learn to Fly assignments (with varied confidence)
INSERT INTO public.song_assignments (song_casting_id, member_id, is_primary, confidence, added_by, added_date) VALUES
  ('50000000-0000-0000-0000-000000000006', '22222222-2222-2222-2222-222222222222', true, 5, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000006', '55555555-5555-5555-5555-555555555555', true, 4, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000006', '66666666-6666-6666-6666-666666666666', true, 3, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00'),
  ('50000000-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', true, 4, '22222222-2222-2222-2222-222222222222', '2024-02-10 10:00:00+00');

-- ============================================================================
-- ASSIGNMENT ROLES (Specific instruments/parts)
-- ============================================================================

-- Motörhead - Ace of Spades roles
INSERT INTO public.assignment_roles (assignment_id, type, name, is_primary) VALUES
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000001' AND member_id = '11111111-1111-1111-1111-111111111111'), 'instrument', 'bass', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000001' AND member_id = '11111111-1111-1111-1111-111111111111'), 'vocal', 'lead vocals', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000001' AND member_id = '33333333-3333-3333-3333-333333333333'), 'instrument', 'lead guitar', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000001' AND member_id = '44444444-4444-4444-4444-444444444444'), 'instrument', 'drums', true);

-- Foo Fighters - Everlong roles
INSERT INTO public.assignment_roles (assignment_id, type, name, is_primary) VALUES
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000004' AND member_id = '22222222-2222-2222-2222-222222222222'), 'instrument', 'guitar', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000004' AND member_id = '22222222-2222-2222-2222-222222222222'), 'vocal', 'lead vocals', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000004' AND member_id = '55555555-5555-5555-5555-555555555555'), 'instrument', 'drums', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000004' AND member_id = '55555555-5555-5555-5555-555555555555'), 'vocal', 'backing vocals', false),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000004' AND member_id = '66666666-6666-6666-6666-666666666666'), 'instrument', 'bass', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000004' AND member_id = '77777777-7777-7777-7777-777777777777'), 'instrument', 'rhythm guitar', true),
  ((SELECT id FROM public.song_assignments WHERE song_casting_id = '50000000-0000-0000-0000-000000000004' AND member_id = '77777777-7777-7777-7777-777777777777'), 'vocal', 'backing vocals', false);
