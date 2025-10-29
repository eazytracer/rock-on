-- Rock On Sample Songs
-- Seed file: Sample songs for development and testing
-- Created: 2025-10-25

-- Insert Motörhead songs
INSERT INTO public.songs (id, title, artist, key, tempo, time_signature, duration, difficulty, genre, context_type, context_id, created_by, visibility) VALUES
  -- Motörhead classics
  ('10000000-0000-0000-0000-000000000001', 'Ace of Spades', 'Motörhead', 'E', 280, '4/4', 168, 4, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'band'),
  ('10000000-0000-0000-0000-000000000002', 'Overkill', 'Motörhead', 'E', 234, '4/4', 320, 5, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'band'),
  ('10000000-0000-0000-0000-000000000003', 'The Hammer', 'Motörhead', 'E', 180, '4/4', 167, 3, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'band'),
  ('10000000-0000-0000-0000-000000000004', 'Iron Fist', 'Motörhead', 'E', 200, '4/4', 170, 4, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'band'),
  ('10000000-0000-0000-0000-000000000005', 'Killed By Death', 'Motörhead', 'E', 168, '4/4', 226, 3, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'band'),
  ('10000000-0000-0000-0000-000000000006', 'Bomber', 'Motörhead', 'E', 190, '4/4', 213, 4, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'band'),
  ('10000000-0000-0000-0000-000000000007', 'Stay Clean', 'Motörhead', 'A', 170, '4/4', 164, 3, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'band'),
  ('10000000-0000-0000-0000-000000000008', 'Rock Out', 'Motörhead', 'D', 160, '4/4', 189, 2, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'band'),
  ('10000000-0000-0000-0000-000000000009', 'Thunder Rising', 'Motörhead', 'G', 155, '4/4', 245, 3, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'band'),
  ('10000000-0000-0000-0000-000000000010', 'Metal Storm', 'Motörhead', 'E', 220, '4/4', 198, 4, 'Rock', 'band', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'band'),

  -- Foo Fighters songs
  ('20000000-0000-0000-0000-000000000001', 'Everlong', 'Foo Fighters', 'D', 158, '4/4', 250, 3, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'band'),
  ('20000000-0000-0000-0000-000000000002', 'The Pretender', 'Foo Fighters', 'Am', 174, '4/4', 269, 4, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'band'),
  ('20000000-0000-0000-0000-000000000003', 'Learn to Fly', 'Foo Fighters', 'B', 136, '4/4', 238, 2, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'band'),
  ('20000000-0000-0000-0000-000000000004', 'My Hero', 'Foo Fighters', 'E', 130, '4/4', 260, 2, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'band'),
  ('20000000-0000-0000-0000-000000000005', 'Best of You', 'Foo Fighters', 'A', 120, '4/4', 256, 3, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'band'),
  ('20000000-0000-0000-0000-000000000006', 'All My Life', 'Foo Fighters', 'E', 156, '4/4', 263, 4, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'band'),
  ('20000000-0000-0000-0000-000000000007', 'Times Like These', 'Foo Fighters', 'D', 132, '4/4', 266, 2, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'band'),
  ('20000000-0000-0000-0000-000000000008', 'Monkey Wrench', 'Foo Fighters', 'B', 173, '4/4', 231, 4, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'band'),
  ('20000000-0000-0000-0000-000000000009', 'Walk', 'Foo Fighters', 'A', 138, '4/4', 256, 2, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'band'),
  ('20000000-0000-0000-0000-000000000010', 'These Days', 'Foo Fighters', 'C', 90, '4/4', 288, 1, 'Rock', 'band', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'band');
