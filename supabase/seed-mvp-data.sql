-- =====================================================
-- MVP SEED DATA (Based on seedMvpData.ts)
-- =====================================================
-- This seed file matches the TypeScript seed data exactly
-- Updated for Phase 4a schema (includes last_modified_by, version)
-- =====================================================

BEGIN;

-- Generate consistent UUIDs for our test users, band, and key songs
DO $$
DECLARE
  v_eric_id UUID := '6ee2bc47-0014-4cdc-b063-68646bb5d3ba';
  v_mike_id UUID := 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
  v_sarah_id UUID := 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e';
  v_band_id UUID := 'accfd37c-2bac-4e27-90b1-257659f58d44';
  -- Fixed song UUIDs (for setlist references)
  v_song_all_star UUID := '11111111-1111-1111-1111-111111111101';
  v_song_wonderwall UUID := '11111111-1111-1111-1111-111111111102';
  v_song_man_in_box UUID := '11111111-1111-1111-1111-111111111103';
  v_song_teen_spirit UUID := '11111111-1111-1111-1111-111111111104';
  v_song_creep UUID := '11111111-1111-1111-1111-111111111105';
  v_song_losing_religion UUID := '11111111-1111-1111-1111-111111111106';
  v_song_zombie UUID := '11111111-1111-1111-1111-111111111107';
  v_song_no_rain UUID := '11111111-1111-1111-1111-111111111108';
  v_song_plush UUID := '11111111-1111-1111-1111-111111111109';
  v_song_buddy_holly UUID := '11111111-1111-1111-1111-111111111110';
  v_song_sweet_child UUID := '11111111-1111-1111-1111-111111111111';
  v_song_livin_prayer UUID := '11111111-1111-1111-1111-111111111112';
  v_song_jump UUID := '11111111-1111-1111-1111-111111111113';
  v_song_kickstart UUID := '11111111-1111-1111-1111-111111111114';
  v_song_hotel_california UUID := '11111111-1111-1111-1111-111111111115';
  v_song_dream_on UUID := '11111111-1111-1111-1111-111111111116';
  v_song_free_bird UUID := '11111111-1111-1111-1111-111111111117';
  v_song_mr_brightside UUID := '11111111-1111-1111-1111-111111111118';
  v_song_hey_delilah UUID := '11111111-1111-1111-1111-111111111119';
  v_song_seven_nation UUID := '11111111-1111-1111-1111-111111111120';
  v_song_black UUID := '11111111-1111-1111-1111-111111111121';
  v_song_enter_sandman UUID := '11111111-1111-1111-1111-111111111122';
  -- Fixed show UUIDs (for setlist associations)
  v_show_spring_bash UUID := '22222222-2222-2222-2222-222222222201';
  v_show_memorial_day UUID := '22222222-2222-2222-2222-222222222202';
  v_show_summer_solstice UUID := '22222222-2222-2222-2222-222222222203';
  v_show_july_4th UUID := '22222222-2222-2222-2222-222222222204';
  -- Fixed setlist UUIDs
  v_setlist_friday UUID := '33333333-3333-3333-3333-333333333301';
  v_setlist_acoustic UUID := '33333333-3333-3333-3333-333333333302';
  v_setlist_party UUID := '33333333-3333-3333-3333-333333333303';
  v_setlist_90s UUID := '33333333-3333-3333-3333-333333333304';
BEGIN

  -- ========================================
  -- 1. AUTH USERS
  -- ========================================
  RAISE NOTICE '👥 Seeding auth.users...';

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, role, aud,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current, reauthentication_token,
    is_sso_user, is_anonymous
  ) VALUES
    (
      v_eric_id,
      '00000000-0000-0000-0000-000000000000',
      'eric@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Eric Johnson"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    ),
    (
      v_mike_id,
      '00000000-0000-0000-0000-000000000000',
      'mike@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Mike Thompson"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    ),
    (
      v_sarah_id,
      '00000000-0000-0000-0000-000000000000',
      'sarah@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Sarah Chen"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  -- Create auth identities (required for email/password login to work)
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES
    (
      v_eric_id::text,
      v_eric_id,
      format('{"sub":"%s","email":"eric@testband.demo"}', v_eric_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    ),
    (
      v_mike_id::text,
      v_mike_id,
      format('{"sub":"%s","email":"mike@testband.demo"}', v_mike_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    ),
    (
      v_sarah_id::text,
      v_sarah_id,
      format('{"sub":"%s","email":"sarah@testband.demo"}', v_sarah_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    )
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- ========================================
  -- 2. PUBLIC USERS
  -- ========================================
  RAISE NOTICE '👤 Seeding public.users...';

  INSERT INTO public.users (id, email, name, created_date, auth_provider) VALUES
    (v_eric_id, 'eric@testband.demo', 'Eric Johnson', '2024-01-15', 'email'),
    (v_mike_id, 'mike@testband.demo', 'Mike Thompson', '2024-01-20', 'email'),
    (v_sarah_id, 'sarah@testband.demo', 'Sarah Chen', '2024-02-01', 'email')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- ========================================
  -- 3. USER PROFILES
  -- ========================================
  RAISE NOTICE '🎸 Seeding user_profiles...';

  INSERT INTO public.user_profiles (id, user_id, display_name, instruments, primary_instrument, created_date, updated_date) VALUES
    (gen_random_uuid(), v_eric_id, 'Eric', ARRAY['Guitar', 'Vocals'], 'Guitar', NOW(), NOW()),
    (gen_random_uuid(), v_mike_id, 'Mike', ARRAY['Bass', 'Harmonica', 'Vocals', 'Guitar'], 'Bass', NOW(), NOW()),
    (gen_random_uuid(), v_sarah_id, 'Sarah', ARRAY['Drums', 'Percussion'], 'Drums', NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

  -- ========================================
  -- 4. BAND
  -- ========================================
  RAISE NOTICE '🎵 Seeding band...';

  INSERT INTO public.bands (
    id, name, description, created_by, created_date, updated_date,
    settings
  ) VALUES (
    v_band_id,
    'Demo Band',
    'A demo band for testing Rock-On features',
    v_eric_id,
    '2024-01-15',
    NOW(),
    '{"defaultPracticeTime":120,"reminderMinutes":[60,30,10],"autoSaveInterval":30}'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, created_by = EXCLUDED.created_by;

  -- ========================================
  -- 5. BAND MEMBERSHIPS
  -- ========================================
  RAISE NOTICE '👥 Seeding band_memberships...';

  INSERT INTO public.band_memberships (id, user_id, band_id, role, joined_date, status, permissions) VALUES
    (gen_random_uuid(), v_eric_id, v_band_id, 'admin', '2024-01-15', 'active', ARRAY['owner', 'admin']),
    (gen_random_uuid(), v_mike_id, v_band_id, 'admin', '2024-01-20', 'active', ARRAY['admin']),
    (gen_random_uuid(), v_sarah_id, v_band_id, 'member', '2024-02-01', 'active', ARRAY['member'])
  ON CONFLICT (band_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- ========================================
  -- 6. INVITE CODE
  -- ========================================
  RAISE NOTICE '🔑 Seeding invite_codes...';

  INSERT INTO public.invite_codes (
    id, band_id, code, created_by, created_date, expires_at, max_uses, current_uses, is_active
  ) VALUES (
    gen_random_uuid(),
    v_band_id,
    'ROCK2025',
    v_eric_id,
    NOW(),
    NOW() + INTERVAL '30 days',
    999,
    2,
    TRUE
  ) ON CONFLICT (code) DO UPDATE SET current_uses = EXCLUDED.current_uses;

  -- ========================================
  -- 7. SONGS (with fixed UUIDs for setlist references)
  -- ========================================
  RAISE NOTICE '🎶 Seeding songs...';

  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo, difficulty, guitar_tuning,
    context_type, context_id, created_by, visibility,
    created_date, notes, version
  ) VALUES
    -- Songs with fixed UUIDs (used in setlists)
    (v_song_all_star, 'All Star', 'Smash Mouth', 194, 'F#', 104, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Structure\nIntro → Verse → Pre-Chorus → **Chorus** → Verse → Pre-Chorus → **Chorus** → Bridge → **Chorus** → Outro\n\n## Notes\n- Fun crowd pleaser, gets everyone singing\n- Start with palm muted power chords on the F#5\n- Mike: Bass follows root notes, add fills on the pre-chorus\n- Sarah: Keep it tight on the hi-hat during verses\n\n## Lyrics (Chorus)\n> Hey now, you''re an all star\n> Get your game on, go play', 1),

    (v_song_wonderwall, 'Wonderwall', 'Oasis', 258, 'F#m', 87, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Structure\nIntro → Verse → Verse → Pre-Chorus → **Chorus** → Verse → Pre-Chorus → **Chorus** → Outro\n\n## Capo Position\n**Capo 2nd fret** - Play in Em shapes\n\n## Notes\n- Fingerpick the intro, don''t strum\n- Build dynamics into the chorus\n- Everyone sing on "I said maybe"', 1),

    (v_song_man_in_box, 'Man in the Box', 'Alice In Chains', 287, 'E', 108, 4, 'Eb Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Tuning\n**Eb Standard** (half step down): Eb-Ab-Db-Gb-Bb-Eb\n\n## Structure\nIntro (wah riff) → Verse → **Chorus** → Verse → **Chorus** → Bridge → **Chorus** → Outro\n\n## Notes\n- Heavy wah-wah on the intro riff\n- Watch timing on the talk box effect sections\n- Sarah: Ride cymbal during verses, crash on chorus hits\n- Dynamics are KEY - quiet verses, loud choruses', 1),

    (v_song_teen_spirit, 'Smells Like Teen Spirit', 'Nirvana', 301, 'F', 116, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Structure\nIntro → Verse (clean) → Pre-Chorus → **Chorus** (distortion) → Verse → Pre-Chorus → **Chorus** → Solo → Verse → Pre-Chorus → **Chorus** → Outro\n\n## Notes\n- Classic quiet-loud-quiet dynamics\n- Clean tone on verses, slam the distortion for choruses\n- Bass follows guitar on main riff\n- Drums: 4 clicks to start', 1),

    (v_song_creep, 'Creep', 'Radiohead', 238, 'G', 92, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- The quiet-loud dynamic is key\n- G chord strum pattern on verse\n- Hit the distortion HARD on the chorus', 1),

    (v_song_losing_religion, 'Losing my Religion', 'R.E.M.', 269, 'Am', 125, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Mandolin part played on guitar with capo\n- Arpeggiate the chords, don''t strum\n- Mike: Melodic bass line is crucial', 1),

    (v_song_zombie, 'Zombie', 'The Cranberries', 306, 'Em', 84, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Power chord driven\n- Sarah: Military-style snare rolls\n- Build intensity through the song', 1),

    (v_song_no_rain, 'No Rain', 'Blind Melon', 217, 'E', 148, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (v_song_plush, 'Plush', 'Stone Temple Pilots', 310, 'G', 73, 3, 'Eb Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Tuning\n**Eb Standard** (half step down)\n\n## Notes\n- Slow and heavy, don''t rush\n- 12-string acoustic for intro if available\n- Watch the tempo changes in the bridge', 1),

    (v_song_buddy_holly, 'Buddy Holly', 'Weezer', 160, 'A', 121, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Keep it tight and punchy\n- Fun closer for a 90s set', 1),

    (v_song_sweet_child, 'Sweet Child O'' Mine', 'Guns N'' Roses', 356, 'D', 122, 4, 'Eb Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Tuning\n**Eb Standard** (half step down)\n\n## Structure\nIntro (iconic riff) → Verse → **Chorus** → Verse → **Chorus** → Breakdown → Solo → **Chorus** → Outro\n\n## Notes\n- The intro riff is recognizable - nail it!\n- Watch the tempo change in the breakdown\n- Extended solo section - Eric takes first half, trade off\n\n## Lyrics (Chorus)\n> Sweet child o'' mine\n> Sweet love of mine', 1),

    (v_song_livin_prayer, 'Livin'' on a Prayer', 'Bon Jovi', 249, 'Em', 123, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Talk box on the intro (we fake it with wah)\n- Key change going into final chorus - E to G!\n- Everyone sings "Woah-oh!"', 1),

    (v_song_jump, 'Jump', 'Van Halen', 241, 'C', 130, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Synth part covered by Mike on keys\n- Guitar comes in big on the chorus\n- Classic 80s arena rock - play it BIG', 1),

    (v_song_kickstart, 'Kickstart My Heart', 'Mötley Crüe', 284, 'A', 179, 4, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- FAST! Sarah sets the tempo\n- High energy from start to finish\n- Don''t burn out too early', 1),

    (v_song_hotel_california, 'Hotel California', 'Eagles', 390, 'Bm', 74, 4, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Structure\nIntro → Verse → Verse → **Chorus** → Verse → **Chorus** → Extended Outro Solo\n\n## Notes\n- Don''t rush the intro - let it breathe\n- Dual guitar harmonies on the outro\n- This is our closer - make it count!\n- 12-string acoustic sound on intro', 1),

    (v_song_dream_on, 'Dream On', 'Aerosmith', 265, 'Fm', 84, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Builds from quiet piano to full rock\n- Save your voice for the high notes at the end!', 1),

    (v_song_free_bird, 'Free Bird', 'Lynyrd Skynyrd', 548, 'G', 60, 4, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- 9+ minute epic - pace yourself!\n- Slow section is in G, fast section is in G\n- Extended solo section at the end\n- Only play full version for headlining shows', 1),

    (v_song_mr_brightside, 'Mr. Brightside', 'The Killers', 223, 'D', 148, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Crowd always goes CRAZY for this one\n- Keep the energy up from the first note\n- Everyone knows the words - let them sing!', 1),

    (v_song_hey_delilah, 'Hey There Delilah', 'Plain White T''s', 233, 'D', 104, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Acoustic only - Eric solo\n- Good breather in the middle of a set\n- Fingerpick, don''t strum', 1),

    (v_song_seven_nation, 'Seven Nation Army', 'The White Stripes', 231, 'E', 124, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- That riff! Everyone knows it\n- Guitar plays bass line with octave pedal\n- Stomp and clap section gets crowd going', 1),

    (v_song_black, 'Black', 'Pearl Jam', 343, 'E', 107, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Emotional ballad - dynamics are everything\n- Build slowly to the climax\n- Eddie Vedder vibes on vocals', 1),

    (v_song_enter_sandman, 'Enter Sandman', 'Metallica', 331, 'Em', 123, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Structure\nIntro (clean) → Main Riff → Verse → Pre-Chorus → **Chorus** → Verse → Pre-Chorus → **Chorus** → Bridge → Solo → **Chorus** → Outro\n\n## Notes\n- Clean intro, distortion kicks in on main riff\n- Sarah: Double bass section in the bridge\n- Great opener or closer', 1),

    -- Additional songs without fixed UUIDs
    (gen_random_uuid(), 'Just A Girl', 'No Doubt', 210, 'D', 108, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Cumbersome', 'Seven Mary Three', 362, 'E', 87, 3, 'Drop D',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Tuning\n**Drop D**: D-A-D-G-B-E\n\n## Notes\n- Heavy low end, use the dropped D string\n- Long song - watch the arrangement', 1),

    (gen_random_uuid(), 'Everything Zen', 'Bush', 278, 'E', 134, 3, 'Drop D',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Lump', 'The Presidents of the United States of America', 134, 'G', 142, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Lightning Crashes', 'Live', 326, 'E', 90, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Shine', 'Collective Soul', 306, 'E', 150, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'La Grange', 'ZZ Top', 271, 'A', 162, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Notes\n- Shuffle groove throughout\n- Classic blues boogie\n- Mike: That bass riff is ICONIC', 1),

    (gen_random_uuid(), 'Heartache Tonight', 'Eagles', 266, 'G', 113, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'White Rabbit', 'Jefferson Airplane', 153, 'F#m', 105, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Mary Jane''s Last Dance', 'Tom Petty and the Heartbreakers', 272, 'Am', 170, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'When I Come Around', 'Green Day', 178, 'G', 98, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Kryptonite', '3 Doors Down', 233, 'Bm', 100, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Burn It to the Ground', 'Nickelback', 212, 'E', 132, 3, 'Drop D',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Dance, Dance', 'Fall Out Boy', 181, 'D', 114, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Broken', 'Seether', 259, 'Eb', 124, 3, 'Eb Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Harder to Breathe', 'Maroon 5', 174, 'C#m', 150, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Short Skirt/Long Jacket', 'Cake', 197, 'D', 120, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'When You Were Young', 'The Killers', 220, 'F', 130, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Take A Picture', 'Filter', 263, 'D', 99, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Monkey Wrench', 'Foo Fighters', 231, 'B', 174, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Sad But True', 'Metallica', 325, 'D', 89, 4, 'D Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Tuning\n**D Standard**: D-G-C-F-A-D (whole step down)\n\n## Notes\n- HEAVY and SLOW\n- Let the riffs breathe\n- Tight palm muting on the main riff', 1),

    (gen_random_uuid(), 'The Remedy', 'Jason Mraz', 254, 'G', 150, 2, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    (gen_random_uuid(), 'Ocean Avenue', 'Yellowcard', 213, 'C', 190, 3, 'Standard',
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1)
  ON CONFLICT (id) DO NOTHING;

  -- ========================================
  -- 8. SETLISTS (with proper items format using songId references)
  -- ========================================
  RAISE NOTICE '📋 Seeding setlists...';

  INSERT INTO public.setlists (
    id, band_id, name, notes, items, show_id,
    created_by, created_date, last_modified, status, version
  ) VALUES
    (
      v_setlist_friday,
      v_band_id,
      'Friday Night Rock Show',
      'Our standard 90-minute set for bar gigs',
      format('[
        {"id": "%s", "type": "section", "position": 1, "sectionTitle": "Opening - High Energy"},
        {"id": "%s", "type": "song", "position": 2, "songId": "%s", "notes": "Open with a bang"},
        {"id": "%s", "type": "song", "position": 3, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 4, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 5, "songId": "%s"},
        {"id": "%s", "type": "break", "position": 6, "breakDuration": 5, "breakNotes": "Quick band break"},
        {"id": "%s", "type": "section", "position": 7, "sectionTitle": "Crowd Pleasers"},
        {"id": "%s", "type": "song", "position": 8, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 9, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 10, "songId": "%s", "notes": "Key change!"},
        {"id": "%s", "type": "song", "position": 11, "songId": "%s"},
        {"id": "%s", "type": "break", "position": 12, "breakDuration": 15, "breakNotes": "Set break - 15 minutes"},
        {"id": "%s", "type": "section", "position": 13, "sectionTitle": "Set 2 - Deep Cuts"},
        {"id": "%s", "type": "song", "position": 14, "songId": "%s", "notes": "Half step down!"},
        {"id": "%s", "type": "song", "position": 15, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 16, "songId": "%s"},
        {"id": "%s", "type": "section", "position": 17, "sectionTitle": "Finale"},
        {"id": "%s", "type": "song", "position": 18, "songId": "%s", "notes": "Epic closer"}
      ]',
        gen_random_uuid(), -- section 1
        gen_random_uuid(), v_song_enter_sandman, -- song 2
        gen_random_uuid(), v_song_mr_brightside, -- song 3
        gen_random_uuid(), v_song_seven_nation, -- song 4
        gen_random_uuid(), v_song_teen_spirit, -- song 5
        gen_random_uuid(), -- break 6
        gen_random_uuid(), -- section 7
        gen_random_uuid(), v_song_all_star, -- song 8
        gen_random_uuid(), v_song_wonderwall, -- song 9
        gen_random_uuid(), v_song_livin_prayer, -- song 10
        gen_random_uuid(), v_song_sweet_child, -- song 11
        gen_random_uuid(), -- break 12
        gen_random_uuid(), -- section 13
        gen_random_uuid(), v_song_man_in_box, -- song 14
        gen_random_uuid(), v_song_plush, -- song 15
        gen_random_uuid(), v_song_black, -- song 16
        gen_random_uuid(), -- section 17
        gen_random_uuid(), v_song_hotel_california -- song 18
      )::jsonb,
      v_show_spring_bash,
      v_eric_id,
      NOW(),
      NOW(),
      'active',
      1
    ),
    (
      v_setlist_acoustic,
      v_band_id,
      'Acoustic Night',
      'Stripped down set for intimate venues',
      format('[
        {"id": "%s", "type": "section", "position": 1, "sectionTitle": "Acoustic Set"},
        {"id": "%s", "type": "song", "position": 2, "songId": "%s", "notes": "Fingerpick intro"},
        {"id": "%s", "type": "song", "position": 3, "songId": "%s", "notes": "Eric solo"},
        {"id": "%s", "type": "song", "position": 4, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 5, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 6, "songId": "%s", "notes": "Full band joins"},
        {"id": "%s", "type": "song", "position": 7, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 8, "songId": "%s"}
      ]',
        gen_random_uuid(), -- section 1
        gen_random_uuid(), v_song_wonderwall, -- song 2
        gen_random_uuid(), v_song_hey_delilah, -- song 3
        gen_random_uuid(), v_song_creep, -- song 4
        gen_random_uuid(), v_song_losing_religion, -- song 5
        gen_random_uuid(), v_song_black, -- song 6
        gen_random_uuid(), v_song_dream_on, -- song 7
        gen_random_uuid(), v_song_hotel_california -- song 8
      )::jsonb,
      v_show_summer_solstice,
      v_eric_id,
      NOW() - INTERVAL '7 days',
      NOW() - INTERVAL '2 days',
      'active',
      2
    ),
    (
      v_setlist_party,
      v_band_id,
      'Party Mix - Short Set',
      '45-minute high energy set for parties',
      format('[
        {"id": "%s", "type": "section", "position": 1, "sectionTitle": "Party Bangers"},
        {"id": "%s", "type": "song", "position": 2, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 3, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 4, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 5, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 6, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 7, "songId": "%s", "notes": "Big finish!"}
      ]',
        gen_random_uuid(), -- section 1
        gen_random_uuid(), v_song_mr_brightside, -- song 2
        gen_random_uuid(), v_song_all_star, -- song 3
        gen_random_uuid(), v_song_seven_nation, -- song 4
        gen_random_uuid(), v_song_livin_prayer, -- song 5
        gen_random_uuid(), v_song_jump, -- song 6
        gen_random_uuid(), v_song_kickstart -- song 7
      )::jsonb,
      v_show_july_4th,
      v_mike_id,
      NOW() - INTERVAL '14 days',
      NOW() - INTERVAL '14 days',
      'active',
      1
    ),
    (
      v_setlist_90s,
      v_band_id,
      '90s Night Special',
      'All 90s hits for themed nights',
      format('[
        {"id": "%s", "type": "section", "position": 1, "sectionTitle": "Grunge Block"},
        {"id": "%s", "type": "song", "position": 2, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 3, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 4, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 5, "songId": "%s"},
        {"id": "%s", "type": "break", "position": 6, "breakDuration": 10, "breakNotes": "Quick break"},
        {"id": "%s", "type": "section", "position": 7, "sectionTitle": "Alternative Hits"},
        {"id": "%s", "type": "song", "position": 8, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 9, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 10, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 11, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 12, "songId": "%s"},
        {"id": "%s", "type": "section", "position": 13, "sectionTitle": "Closers"},
        {"id": "%s", "type": "song", "position": 14, "songId": "%s"},
        {"id": "%s", "type": "song", "position": 15, "songId": "%s"}
      ]',
        gen_random_uuid(), -- section 1
        gen_random_uuid(), v_song_teen_spirit, -- song 2
        gen_random_uuid(), v_song_man_in_box, -- song 3
        gen_random_uuid(), v_song_plush, -- song 4
        gen_random_uuid(), v_song_black, -- song 5
        gen_random_uuid(), -- break 6
        gen_random_uuid(), -- section 7
        gen_random_uuid(), v_song_wonderwall, -- song 8
        gen_random_uuid(), v_song_creep, -- song 9
        gen_random_uuid(), v_song_losing_religion, -- song 10
        gen_random_uuid(), v_song_zombie, -- song 11
        gen_random_uuid(), v_song_no_rain, -- song 12
        gen_random_uuid(), -- section 13
        gen_random_uuid(), v_song_buddy_holly, -- song 14
        gen_random_uuid(), v_song_all_star -- song 15
      )::jsonb,
      v_show_memorial_day,
      v_sarah_id,
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '1 day',
      'active',
      3
    )
  ON CONFLICT (id) DO NOTHING;

  -- ========================================
  -- 9. SHOWS (with fixed UUIDs for setlist associations)
  -- ========================================
  RAISE NOTICE '🎤 Seeding shows...';

  INSERT INTO public.shows (
    id, band_id, name, venue, scheduled_date, duration,
    status, notes, created_by, created_date,
    version
  ) VALUES
    -- Upcoming shows (90+ days in future from Jan 2026)
    (
      v_show_spring_bash,
      v_band_id,
      'Spring Break Bash',
      'The Crocodile',
      '2026-04-18 21:00:00',
      90,
      'scheduled',
      E'## Event Details\n- **Doors:** 8 PM\n- **Set Time:** 9 PM\n- **Load In:** 6 PM\n\n## Notes\nCollege crowd expected. High energy set. Drink specials running all night.\n\n## Gear Checklist\n- [ ] Extra strings\n- [ ] Backup guitar\n- [ ] Merch table setup',
      v_eric_id,
      NOW(),
      1
    ),
    (
      v_show_memorial_day,
      v_band_id,
      'Memorial Day Festival',
      'Marymoor Park Amphitheater',
      '2026-05-25 16:00:00',
      60,
      'scheduled',
      E'## Event Details\n- **Set Time:** 4 PM (Main Stage)\n- **Load In:** 2 PM\n- **Soundcheck:** 3 PM\n\n## Notes\nOutdoor festival - weather dependent. Bring backup equipment and sun protection.\n\n## Stage Plot\nSubmitted to festival coordinator on 5/1.',
      v_eric_id,
      NOW(),
      1
    ),
    (
      v_show_summer_solstice,
      v_band_id,
      'Summer Solstice Party',
      'The Showbox',
      '2026-06-20 20:00:00',
      120,
      'scheduled',
      E'## Event Details\n- **Doors:** 7 PM\n- **VIP Meet & Greet:** 7 PM\n- **Set 1:** 8 PM\n- **Set 2:** 9:30 PM\n- **Load In:** 4 PM\n\n## Notes\nTwo full sets - plan for costume change during break. This is our biggest headlining show of the year!',
      v_eric_id,
      NOW(),
      1
    ),
    (
      v_show_july_4th,
      v_band_id,
      '4th of July Celebration',
      'Gas Works Park',
      '2026-07-04 19:00:00',
      75,
      'scheduled',
      E'## Event Details\n- **Set Time:** 7 PM\n- **Fireworks:** 10 PM\n\n## Notes\nCity event - expect HUGE crowd (10,000+). Patriotic songs welcome. Finish before fireworks!\n\n## Setlist Notes\nParty Mix set with maybe 1-2 patriotic covers.',
      v_mike_id,
      NOW(),
      1
    ),
    -- Past shows for history
    (
      gen_random_uuid(),
      v_band_id,
      'New Year''s Eve 2025',
      'The Showbox',
      '2025-12-31 22:00:00',
      120,
      'completed',
      E'## Post-Show Notes\nGreat show! Midnight countdown was epic. Confetti everywhere.\n\n## What Worked\n- Balloon drop at midnight\n- Extended jam on final song\n\n## For Next Time\n- Need more merch',
      v_eric_id,
      '2025-11-10',
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'Holiday Charity Concert',
      'The Crocodile',
      '2025-12-20 20:00:00',
      90,
      'completed',
      E'## Post-Show Notes\nRaised $2,500 for local food bank! Best crowd of the year.\n\n## Highlights\n- Sold out venue\n- Amazing crowd energy\n- Local news coverage',
      v_eric_id,
      '2025-11-01',
      1
    )
  ON CONFLICT (id) DO NOTHING;

  -- ========================================
  -- 10. PRACTICE SESSIONS (with future dates 90+ days out)
  -- ========================================
  RAISE NOTICE '🥁 Seeding practice sessions...';

  INSERT INTO public.practice_sessions (
    id, band_id, type, scheduled_date, duration,
    location, notes, created_date, version
  ) VALUES
    -- Upcoming practices (90+ days in future from Jan 2026)
    (
      gen_random_uuid(),
      v_band_id,
      'rehearsal',
      '2026-04-04 14:00:00',
      120,
      'Eric''s Garage',
      'Spring Break Prep - Week 1: Focus on party set. Run through high-energy songs. Work on transitions.',
      NOW(),
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'rehearsal',
      '2026-04-11 14:00:00',
      120,
      'Eric''s Garage',
      'Spring Break Prep - Week 2: Full dress rehearsal. Time the set. Practice stage banter.',
      NOW(),
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'rehearsal',
      '2026-05-16 13:00:00',
      180,
      'Rehearsal Space @ MoPop',
      'Festival Prep Session: Rented pro space for festival prep. Work on shortened set. No breaks allowed.',
      NOW(),
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'rehearsal',
      '2026-06-13 12:00:00',
      180,
      'Eric''s Garage',
      'Summer Solstice Full Run: Complete run-through of both sets. Record video for review.',
      NOW(),
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'rehearsal',
      '2026-06-27 15:00:00',
      120,
      'Eric''s Garage',
      '4th of July Special Practice: Add patriotic songs to set. Practice "Born in the USA" and "American Girl".',
      NOW(),
      1
    ),
    -- Past practices for history
    (
      gen_random_uuid(),
      v_band_id,
      'rehearsal',
      '2026-01-04 14:00:00',
      120,
      'Eric''s Garage',
      'January Jam Session: First practice of the year. Everyone a bit rusty. Need to work on timing.',
      '2025-12-28',
      1
    ),
    (
      gen_random_uuid(),
      v_band_id,
      'rehearsal',
      '2025-12-14 14:00:00',
      150,
      'Eric''s Garage',
      'Holiday Set Review: Pre-holiday show prep. Nailed the transitions. Ready for the gig!',
      '2025-12-01',
      1
    )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ MVP seed data complete!';
  RAISE NOTICE 'Test users: eric@testband.demo, mike@testband.demo, sarah@testband.demo';
  RAISE NOTICE 'Password for all: test123';
  RAISE NOTICE 'Band: Demo Band';

END $$;

COMMIT;

-- Display counts
SELECT 'Auth Users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Public Users', COUNT(*) FROM public.users
UNION ALL
SELECT 'Bands', COUNT(*) FROM public.bands
UNION ALL
SELECT 'Memberships', COUNT(*) FROM public.band_memberships
UNION ALL
SELECT 'Songs', COUNT(*) FROM public.songs
UNION ALL
SELECT 'Setlists', COUNT(*) FROM public.setlists
UNION ALL
SELECT 'Shows', COUNT(*) FROM public.shows
UNION ALL
SELECT 'Practice Sessions', COUNT(*) FROM public.practice_sessions;
