-- =====================================================
-- MVP SEED DATA (Based on seedMvpData.ts)
-- =====================================================
-- This seed file matches the TypeScript seed data exactly
-- Updated for Phase 4a schema (includes last_modified_by, version)
-- Phase 5/6: reference links of every type, charts, owner role, band profile,
-- a 24 h invite code, profile colours and a friends graph for Eric:
--   Friends  Sarah, Leo          Requests  Mike → Eric, Dana → Eric
--   Sent     Eric → Jess         Findable  Jess, Leo, Priya (+ the band)
--   Policies Jess / Priya everyone · Leo friends_of_friends · Dana code_only (DANA2345)
-- Phase 7: five jams (codes FRDY4JAM, TUES7JAM, SRAH5JAM, HALW3JAM, MKBD6JAM; see
-- "Jams" below) and personal songs tagged 'jam'.
-- =====================================================

BEGIN;

-- Generate consistent UUIDs for our test users, band, and key songs
DO $$
DECLARE
  v_eric_id UUID := '6ee2bc47-0014-4cdc-b063-68646bb5d3ba';
  v_mike_id UUID := 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d';
  v_sarah_id UUID := 'b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e';
  -- Friends-page people (not in the band)
  v_jess_id  UUID := 'c3d4e5f6-7a8b-4c9d-8e0f-3a4b5c6d7e81';
  v_dana_id  UUID := 'c3d4e5f6-7a8b-4c9d-8e0f-3a4b5c6d7e82';
  v_leo_id   UUID := 'c3d4e5f6-7a8b-4c9d-8e0f-3a4b5c6d7e83';
  v_priya_id UUID := 'c3d4e5f6-7a8b-4c9d-8e0f-3a4b5c6d7e84';
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
  -- Public-domain / original songs with full charts (phase 5)
  v_song_rising_sun UUID := '11111111-1111-1111-1111-111111111123';
  v_song_scarborough UUID := '11111111-1111-1111-1111-111111111124';
  v_song_low_end UUID := '11111111-1111-1111-1111-111111111125';
  -- Fixed practice (linked to from bookmarks / manual tests)
  v_practice_first UUID := 'c340b58d-4a47-4c6f-a471-d505c96e6794';
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
    ),
    (
      v_jess_id,
      '00000000-0000-0000-0000-000000000000',
      'jess@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Jess Rivera"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    ),
    (
      v_dana_id,
      '00000000-0000-0000-0000-000000000000',
      'dana@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Dana Park"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    ),
    (
      v_leo_id,
      '00000000-0000-0000-0000-000000000000',
      'leo@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Leo Martins"}'::jsonb,
      FALSE, 'authenticated', 'authenticated',
      '', '',
      '', '', '', '',
      FALSE, FALSE
    ),
    (
      v_priya_id,
      '00000000-0000-0000-0000-000000000000',
      'priya@testband.demo',
      crypt('test123', gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Priya Shah"}'::jsonb,
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
    ),
    (
      v_jess_id::text,
      v_jess_id,
      format('{"sub":"%s","email":"jess@testband.demo"}', v_jess_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    ),
    (
      v_dana_id::text,
      v_dana_id,
      format('{"sub":"%s","email":"dana@testband.demo"}', v_dana_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    ),
    (
      v_leo_id::text,
      v_leo_id,
      format('{"sub":"%s","email":"leo@testband.demo"}', v_leo_id)::jsonb,
      'email',
      NOW(),
      NOW(),
      NOW()
    ),
    (
      v_priya_id::text,
      v_priya_id,
      format('{"sub":"%s","email":"priya@testband.demo"}', v_priya_id)::jsonb,
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
    (v_sarah_id, 'sarah@testband.demo', 'Sarah Chen', '2024-02-01', 'email'),
    (v_jess_id, 'jess@testband.demo', 'Jess Rivera', '2024-03-10', 'email'),
    (v_dana_id, 'dana@testband.demo', 'Dana Park', '2024-04-02', 'email'),
    (v_leo_id, 'leo@testband.demo', 'Leo Martins', '2024-05-18', 'email'),
    (v_priya_id, 'priya@testband.demo', 'Priya Shah', '2024-06-21', 'email')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  -- ========================================
  -- 3. USER PROFILES
  -- ========================================
  RAISE NOTICE '🎸 Seeding user_profiles...';

  -- Instruments are an ordered list (first shows first); primary_instrument is
  -- kept in step with the first one but no longer read.
  INSERT INTO public.user_profiles (id, user_id, display_name, instruments, primary_instrument, created_date, updated_date, discoverable, friend_code, friend_request_policy, personal_color) VALUES
    (gen_random_uuid(), v_eric_id, 'Eric', ARRAY['Guitar', 'Vocals'], 'Guitar', NOW(), NOW(), true, 'GTAR2345', 'everyone', '#ff7a1a'),
    (gen_random_uuid(), v_mike_id, 'Mike', ARRAY['Bass', 'Vocals', 'Harmonica', 'Guitar'], 'Bass', NOW(), NOW(), true, 'BASS6789', 'everyone', '#38bdf8'),
    (gen_random_uuid(), v_sarah_id, 'Sarah', ARRAY['Drums', 'Percussion'], 'Drums', NOW(), NOW(), true, 'DRMS4567', 'everyone', '#c084fc'),
    (gen_random_uuid(), v_jess_id, 'Jess', ARRAY['Keys', 'Vocals', 'Synth'], 'Keys', NOW(), NOW(), true, 'JESS2345', 'everyone', '#4ade80'),
    (gen_random_uuid(), v_dana_id, 'Dana', ARRAY['Guitar', 'Mandolin'], 'Guitar', NOW(), NOW(), false, 'DANA2345', 'code_only', '#f43f5e'),
    (gen_random_uuid(), v_leo_id, 'Leo', ARRAY['Bass', 'Guitar'], 'Bass', NOW(), NOW(), true, 'LEMR2345', 'friends_of_friends', '#facc15'),
    (gen_random_uuid(), v_priya_id, 'Priya', ARRAY['Violin', 'Vocals'], 'Violin', NOW(), NOW(), true, 'PRYA2345', 'everyone', '#2dd4bf')
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    instruments = EXCLUDED.instruments,
    primary_instrument = EXCLUDED.primary_instrument,
    discoverable = EXCLUDED.discoverable,
    friend_code = EXCLUDED.friend_code,
    friend_request_policy = EXCLUDED.friend_request_policy,
    personal_color = EXCLUDED.personal_color;

  -- ========================================
  -- 4. BAND
  -- ========================================
  RAISE NOTICE '🎵 Seeding band...';

  INSERT INTO public.bands (
    id, name, description, created_by, created_date, updated_date,
    settings, mark, city, genres, links
  ) VALUES (
    v_band_id,
    'Demo Band',
    'A demo band for testing Rock-On features',
    v_eric_id,
    '2024-01-15',
    NOW(),
    '{"defaultPracticeTime":120,"reminderMinutes":[60,30,10],"autoSaveInterval":30}'::jsonb,
    '{"kind":"symbol","initials":"DB","symbol":"bolt","color":"orange","lettering":"poster"}'::jsonb,
    'Seattle, WA',
    ARRAY['Rock', 'Grunge', '90s Alternative'],
    '[{"label":"Website","url":"https://demoband.example.com"},
      {"label":"Instagram","url":"https://www.instagram.com/demoband.sea"},
      {"label":"Bandcamp","url":"https://demoband.bandcamp.com"}]'::jsonb
  ) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name, created_by = EXCLUDED.created_by, mark = EXCLUDED.mark,
    city = EXCLUDED.city, genres = EXCLUDED.genres, links = EXCLUDED.links, deleted_at = NULL;

  -- ========================================
  -- 5. BAND MEMBERSHIPS
  -- ========================================
  RAISE NOTICE '👥 Seeding band_memberships...';

  -- Eric owns Demo Band (role 'owner', one per band); permissions mirror the role.
  INSERT INTO public.band_memberships (id, user_id, band_id, role, joined_date, status, permissions) VALUES
    (gen_random_uuid(), v_eric_id, v_band_id, 'owner', '2024-01-15', 'active', ARRAY['owner']),
    (gen_random_uuid(), v_mike_id, v_band_id, 'admin', '2024-01-20', 'active', ARRAY['admin']),
    (gen_random_uuid(), v_sarah_id, v_band_id, 'member', '2024-02-01', 'active', ARRAY['member'])
  ON CONFLICT (band_id, user_id) DO UPDATE SET role = EXCLUDED.role, permissions = EXCLUDED.permissions;

  -- ========================================
  -- 6. INVITE CODE
  -- ========================================
  RAISE NOTICE '🔑 Seeding invite_codes...';

  -- Codes last 24 h from creation, unlimited uses, one active per band (decision 10).
  INSERT INTO public.invite_codes (
    id, band_id, code, created_by, created_date, expires_at, max_uses, current_uses, is_active
  ) VALUES (
    gen_random_uuid(),
    v_band_id,
    'ROCK2025',
    v_eric_id,
    NOW(),
    NOW() + INTERVAL '24 hours',
    NULL,
    2,
    TRUE
  ) ON CONFLICT (code) DO UPDATE SET
    current_uses = EXCLUDED.current_uses, created_date = EXCLUDED.created_date,
    expires_at = EXCLUDED.expires_at, max_uses = NULL, is_active = TRUE;

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
     'band', v_band_id::text, v_eric_id, 'band', NOW(), NULL, 1),

    -- Charted songs: traditional (public domain) and an original riff
    (v_song_rising_sun, 'House of the Rising Sun', 'Traditional', 270, 'Am', 116, 2, 'Standard',
     'band', v_band_id::text, v_mike_id, 'band', NOW(),
     E'## Notes\n- 6/8 feel, arpeggiate every chord\n- Organ solo after verse 3 (Mike on keys)', 1),

    (v_song_scarborough, 'Scarborough Fair', 'Traditional', 205, 'D', 96, 3, 'DADGAD',
     'band', v_band_id::text, v_sarah_id, 'band', NOW(),
     E'## Tuning\n**DADGAD**: D-A-D-G-A-D\n\n## Notes\n- 3/4, let the open strings ring', 1),

    (v_song_low_end, 'Low End Theory (Original)', 'Demo Band', 188, 'A', 140, 4, '7-string Drop A',
     'band', v_band_id::text, v_eric_id, 'band', NOW(),
     E'## Tuning\n**7-string Drop A**: A-E-A-D-G-B-E\n\n## Notes\n- Our own riff, palm-muted chugs on the low A', 1)
  ON CONFLICT (id) DO NOTHING;

  -- Albums, time signatures and the odd missing fact.
  UPDATE public.songs s SET album = v.album, time_signature = v.sig
    FROM (VALUES
      ('All Star', 'Astro Lounge', '4/4'), ('Wonderwall', '(What''s the Story) Morning Glory?', '4/4'),
      ('Man in the Box', 'Facelift', '4/4'), ('Smells Like Teen Spirit', 'Nevermind', '4/4'),
      ('Creep', 'Pablo Honey', '4/4'), ('Losing my Religion', 'Out of Time', '4/4'),
      ('Zombie', 'No Need to Argue', '4/4'), ('No Rain', 'Blind Melon', '4/4'),
      ('Plush', 'Core', '4/4'), ('Buddy Holly', 'Weezer (Blue Album)', '4/4'),
      ('Sweet Child O'' Mine', 'Appetite for Destruction', '4/4'), ('Livin'' on a Prayer', 'Slippery When Wet', '4/4'),
      ('Jump', '1984', '4/4'), ('Kickstart My Heart', 'Dr. Feelgood', '4/4'),
      ('Hotel California', 'Hotel California', '4/4'), ('Dream On', 'Aerosmith', '4/4'),
      ('Free Bird', '(Pronounced ''Lĕh-''nérd ''Skin-''nérd)', '4/4'), ('Mr. Brightside', 'Hot Fuss', '4/4'),
      ('Hey There Delilah', 'All That We Needed', '4/4'), ('Seven Nation Army', 'Elephant', '4/4'),
      ('Black', 'Ten', '4/4'), ('Enter Sandman', 'Metallica', '4/4'),
      ('Just A Girl', 'Tragic Kingdom', '4/4'), ('Cumbersome', 'American Standard', '4/4'),
      ('Everything Zen', 'Sixteen Stone', '4/4'), ('Lump', 'The Presidents of the United States of America', '4/4'),
      ('Lightning Crashes', 'Throwing Copper', '4/4'), ('Shine', 'Hints, Allegations, and Things Left Unsaid', '4/4'),
      ('La Grange', 'Tres Hombres', '4/4'), ('Heartache Tonight', 'The Long Run', '4/4'),
      ('White Rabbit', 'Surrealistic Pillow', '4/4'), ('Mary Jane''s Last Dance', 'Greatest Hits', '4/4'),
      ('When I Come Around', 'Dookie', '4/4'), ('Kryptonite', 'The Better Life', '4/4'),
      ('Burn It to the Ground', 'Dark Horse', '4/4'), ('Dance, Dance', 'From Under the Cork Tree', '4/4'),
      ('Broken', 'Disclaimer II', '4/4'), ('Harder to Breathe', 'Songs About Jane', '4/4'),
      ('Short Skirt/Long Jacket', 'Comfort Eagle', '4/4'), ('When You Were Young', 'Sam''s Town', '4/4'),
      ('Take A Picture', 'Title of Record', '4/4'), ('Monkey Wrench', 'The Colour and the Shape', '4/4'),
      ('Sad But True', 'Metallica', '4/4'), ('The Remedy', 'Waiting for My Rocket to Come', '4/4'),
      ('Ocean Avenue', 'Ocean Avenue', '4/4'),
      ('House of the Rising Sun', NULL, '6/8'), ('Scarborough Fair', NULL, '3/4'),
      ('Low End Theory (Original)', 'Garage Demos', '4/4')
    ) AS v(title, album, sig)
   WHERE s.context_type = 'band' AND s.context_id = v_band_id::text AND s.title = v.title;

  -- Band notes for songs that had none (who last edited + when).
  UPDATE public.songs s SET notes = v.notes, notes_edited_by = v.editor, notes_edited_at = NOW() - v.ago
    FROM (VALUES
      ('No Rain', E'## Notes\n- Bright clean tone, light chorus pedal\n- Sarah: brushes on the intro', v_sarah_id, INTERVAL '3 days'),
      ('Everything Zen', E'## Notes\n- Drop D, big and sludgy\n- Watch the stop before the last chorus', v_mike_id, INTERVAL '6 days'),
      ('Lightning Crashes', E'## Notes\n- Slow build, nobody rush the last chorus', v_eric_id, INTERVAL '1 day'),
      ('Kryptonite', E'## Notes\n- Mike: the bass fill into the chorus is the hook', v_mike_id, INTERVAL '10 days')
    ) AS v(title, notes, editor, ago)
   WHERE s.context_type = 'band' AND s.context_id = v_band_id::text AND s.title = v.title;
  UPDATE public.songs SET notes_edited_by = v_eric_id, notes_edited_at = NOW() - INTERVAL '2 days'
   WHERE context_type = 'band' AND context_id = v_band_id::text AND notes IS NOT NULL AND notes_edited_by IS NULL;

  -- Reference links: every type the app knows (spotify, youtube, tabs incl.
  -- Ultimate Guitar / Songsterr / Guitar Pro, lyrics, drive, dropbox,
  -- soundcloud, other). Stored as [{icon, url, description?}] like the editor.
  UPDATE public.songs s SET reference_links = v.links::jsonb
    FROM (VALUES
      ('All Star', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/3cfOd4CMv2snFaKAnMdnvK"},
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=L_jWHffIx5E","description":"Official video"},
        {"icon":"tabs","url":"https://tabs.ultimate-guitar.com/tab/smash-mouth/all-star-chords-189279","description":"Ultimate Guitar chords"},
        {"icon":"lyrics","url":"https://genius.com/Smash-mouth-all-star-lyrics"},
        {"icon":"soundcloud","url":"https://soundcloud.com/demo-band-sea/all-star-rehearsal-take-2","description":"Rehearsal take 2"}]'),
      ('Wonderwall', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/5qqabIl2vWzo9ApSC317sa"},
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=bx1Bh8ZvH84"},
        {"icon":"tabs","url":"https://tabs.ultimate-guitar.com/tab/oasis/wonderwall-chords-27596","description":"Chords, capo 2"},
        {"icon":"drive","url":"https://docs.google.com/document/d/1hF3kQ9wZbXcV7nLmR2pT8sY4uJ6eA0dG5iK1oP3qWzE/edit","description":"Our chord chart"}]'),
      ('Man in the Box', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/6gZVQvQZOFpzIy3HblJ20F"},
        {"icon":"tabs","url":"https://www.songsterr.com/a/wsa/alice-in-chains-man-in-the-box-tab-s9147","description":"Songsterr (Eb)"},
        {"icon":"tabs","url":"https://www.dropbox.com/s/k2m9q7x4v1z8n3c/man-in-the-box.gp5","description":"Guitar Pro 5 file"}]'),
      ('Smells Like Teen Spirit', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/4CeeEOM32jQcH3eN9Q2dGj"},
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=hTWKbfoikeg"},
        {"icon":"tabs","url":"https://www.songsterr.com/a/wsa/nirvana-smells-like-teen-spirit-tab-s269"}]'),
      ('Creep', '[
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=XFkzRNyygfk"},
        {"icon":"lyrics","url":"https://www.azlyrics.com/lyrics/radiohead/creep.html"}]'),
      ('Sweet Child O'' Mine', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/7o2CTH4ctstm8TNelqjb51"},
        {"icon":"tabs","url":"https://tabs.ultimate-guitar.com/tab/guns-n-roses/sweet-child-o-mine-tabs-1745","description":"Intro riff tab"},
        {"icon":"tabs","url":"https://www.dropbox.com/s/r8t2w6y0u4i9o1p/sweet-child-o-mine.gpx","description":"Guitar Pro 6"},
        {"icon":"dropbox","url":"https://www.dropbox.com/s/a7b3c9d1e5f2g8h/sweet-child-backing-track.mp3","description":"Backing track"}]'),
      ('Hotel California', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/40riOy7x9W7GXjyGp4pjAv"},
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=09839DpTctU","description":"Live, 1977"},
        {"icon":"tabs","url":"https://tabs.ultimate-guitar.com/tab/eagles/hotel-california-tabs-7398","description":"Solo harmony tab"},
        {"icon":"drive","url":"https://drive.google.com/file/d/1Qw8Er4Ty6Ui2Op0As9Df3Gh7Jk1Lz5Xc/view","description":"Outro harmony chart (PDF)"}]'),
      ('Mr. Brightside', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/003vvx7Niy0yvhvHt4a68B"},
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=gGdGFtwCNBE"}]'),
      ('Seven Nation Army', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/3dPQuX8Gs42Y7b454ybpMR"},
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=0J2QdDbelmY"},
        {"icon":"tabs","url":"https://www.songsterr.com/a/wsa/the-white-stripes-seven-nation-army-tab-s19530"}]'),
      ('Enter Sandman', '[
        {"icon":"spotify","url":"https://open.spotify.com/track/5sICkBXVmaCQk5aISGR3x1"},
        {"icon":"youtube","url":"https://www.youtube.com/watch?v=CD-E-LDc384"},
        {"icon":"tabs","url":"https://www.songsterr.com/a/wsa/metallica-enter-sandman-tab-s19"},
        {"icon":"tabs","url":"https://www.dropbox.com/s/p0o9i8u7y6t5r4e/enter-sandman.gp4","description":"Guitar Pro 4 file"},
        {"icon":"other","url":"https://www.setlist.fm/stats/songs/metallica-bd6bd12.html?song=Enter+Sandman","description":"Live stats"}]'),
      ('Black', '[
        {"icon":"lyrics","url":"https://www.musixmatch.com/lyrics/Pearl-Jam/Black"},
        {"icon":"soundcloud","url":"https://soundcloud.com/demo-band-sea/black-acoustic-demo"}]'),
      ('Hey There Delilah', '[
        {"icon":"youtube","url":"https://youtu.be/h_m-BjrxmgI"},
        {"icon":"tabs","url":"https://tabs.ultimate-guitar.com/tab/plain-white-ts/hey-there-delilah-chords-180932"}]'),
      ('Plush', '[
        {"icon":"dropbox","url":"https://www.dropbox.com/scl/fi/x1y2z3a4b5c6/plush-rehearsal-0412.m4a","description":"Rehearsal 04/12"},
        {"icon":"other","url":"https://en.wikipedia.org/wiki/Plush_(song)"}]'),
      ('House of the Rising Sun', '[
        {"icon":"other","url":"https://en.wikipedia.org/wiki/The_House_of_the_Rising_Sun","description":"History of the song"},
        {"icon":"drive","url":"https://docs.google.com/spreadsheets/d/1aB2cD3eF4gH5iJ6kL7mN8oP9qR0sT1uV2wX3yZ4AbCd/edit","description":"Arrangement sheet"}]'),
      ('Scarborough Fair', '[
        {"icon":"other","url":"https://en.wikipedia.org/wiki/Scarborough_Fair_(ballad)"},
        {"icon":"soundcloud","url":"https://soundcloud.com/demo-band-sea/scarborough-fair-dadgad-sketch","description":"DADGAD sketch"}]'),
      ('Low End Theory (Original)', '[
        {"icon":"tabs","url":"https://www.dropbox.com/s/z9x8c7v6b5n4m3l/low-end-theory-7str.gp","description":"Guitar Pro 7 file"},
        {"icon":"dropbox","url":"https://www.dropbox.com/s/q1w2e3r4t5y6u7i/low-end-theory-demo.wav","description":"Garage demo"}]')
    ) AS v(title, links)
   WHERE s.context_type = 'band' AND s.context_id = v_band_id::text AND s.title = v.title;

  -- Charts (phase 5): ChordPro with sections, chords over lyrics and a starting
  -- note (MIDI). Lyrics are traditional (public domain) or placeholder text.
  INSERT INTO public.song_charts (song_id, chordpro, starting_note) VALUES
    (v_song_rising_sun, E'{title: House of the Rising Sun}\n{artist: Traditional}\n{key: Am}\n{time: 6/8}\n\n{comment: Intro}\n[Am] [C] [D] [F] [Am] [E] [Am] [E]\n\n{start_of_verse: Verse 1}\nThere [Am]is a [C]house in [D]New Or[F]leans\nThey [Am]call the [C]Rising [E]Sun\nIt''s [Am]been the [C]ruin of [D]many a poor [F]girl\nAnd [Am]me, O [E]God, for [Am]one [E]\n{end_of_verse}\n\n{start_of_verse: Verse 2}\n[Am]Placeholder [C]words for the [D]second [F]verse\n[Am]Same four [C]bars a[E]gain\n[Am]Hold the [C]last chord [D]under the [F]voice\nThen [Am]round the [E]turn once [Am]more [E]\n{end_of_verse}\n\n{comment: Organ solo}\n[Am] [C] [D] [F] [Am] [C] [E] [E]\n\n{comment: Outro}\n[Am] [D] [Am] [D] [Am]\n', 57),
    (v_song_scarborough, E'{title: Scarborough Fair}\n{artist: Traditional}\n{key: D}\n{time: 3/4}\n\n{start_of_verse: Verse 1}\nAre you [D]going to [C]Scarborough [D]Fair?\n[D]Parsley, [G]sage, rose[D]mary and [A]thyme\nRe[D]member [F#m]me to one who [G]lives there\nShe [D]once was a [C]true love of [D]mine\n{end_of_verse}\n\n{start_of_verse: Verse 2}\nTell her to [D]make me a [C]cambric [D]shirt\n[D]Parsley, [G]sage, rose[D]mary and [A]thyme\nWith[D]out any [F#m]seam or fine [G]needlework\nAnd [D]then she''ll be a [C]true love of [D]mine\n{end_of_verse}\n\n{start_of_tab: Open-string figure}\nD|-0---0---0-----|\nA|---0---2---0---|\nG|-----------0---|\n{end_of_tab}\n', 50),
    (v_song_low_end, E'{title: Low End Theory (Original)}\n{artist: Demo Band}\n{key: A}\n{tempo: 140}\n\n{start_of_tab: Main riff}\nE|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|-----------3-5--|\nE|-0-0-0-1-0------|\nA|-0-0-0-1-0------|\n{end_of_tab}\n\n{start_of_verse: Verse}\n[A5]Placeholder line for the [C5]verse riff\n[A5]Counting chugs on the [Bb5]lowest string\n{end_of_verse}\n\n{start_of_chorus}\n[F5]Big open [G5]chords, [A5]let them ring\n[F5]Sing it [G5]back, the [A5]crowd joins in\n{end_of_chorus}\n\n{chorus}\n', 33),
    (v_song_all_star, E'{title: All Star}\n{artist: Smash Mouth}\n{key: F#}\n{tempo: 104}\n\n{start_of_verse: Verse 1}\n[F#]Placeholder words for the [C#]opening line\n[G#m]Kept short so the [B]chart reads fine\n[F#]Second line, the [C#]chords move on\n[G#m]Bar four lands on [B]B before long\n{end_of_verse}\n\n{start_of_chorus}\n[F#]Chorus placeholder, [C#]everybody sing\n[G#m]Hold the last word, [B]let it ring\n{end_of_chorus}\n\n{chorus}\n', 66),
    (v_song_wonderwall, E'{title: Wonderwall}\n{artist: Oasis}\n{key: F#m}\n{capo: 2}\n\n{comment: Intro}\n[Em7] [G] [Dsus4] [A7sus4]\n\n{start_of_verse: Verse 1}\n[Em7]Placeholder lyric, [G]capo on two\n[Dsus4]Strum the shapes the [A7sus4]way we do\n{end_of_verse}\n\n{start_of_chorus: Pre-chorus}\n[C]Build it [D]up and [Em7]hold it there\n{end_of_chorus}\n\n{start_of_chorus}\n[C]Big sing-a[Em7]long [G]part\n[C]Everyone [Em7]in [G]here\n{end_of_chorus}\n', 66),
    (v_song_man_in_box, E'{title: Man in the Box}\n{artist: Alice In Chains}\n{key: E}\n{comment: Eb Standard, half step down}\n\n{start_of_tab: Main riff (wah)}\ne|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|-------3-2-0----|\nE|-0-0-3-------3-0|\n{end_of_tab}\n\n{start_of_verse: Verse}\n[E5]Placeholder verse over the [G5]riff\n[E5]Hold back, keep it [G5]tight\n{end_of_verse}\n\n{start_of_chorus}\n[C5]Chorus place[D5]holder, open it [E5]up\n{end_of_chorus}\n', 51),
    (v_song_hotel_california, E'{title: Hotel California}\n{artist: Eagles}\n{key: Bm}\n{tempo: 74}\n\n{start_of_verse: Verse 1}\n[Bm]Placeholder line, let the [F#]intro breathe\n[A]Second line moves [E]down a step\n[G]Third line, [D]easy now\n[Em]Fourth line turns [F#]round again\n{end_of_verse}\n\n{start_of_chorus}\n[G]Chorus place[D]holder\n[F#]Hold the harmony [Bm]here\n{end_of_chorus}\n\n{start_of_grid: Outro solo}\n| Bm . . . | F# . . . | A . . . | E . . . |\n| G . . . | D . . . | Em . . . | F# . . . |\n{end_of_grid}\n', 59)
  ON CONFLICT (song_id) DO NOTHING;

  -- My notes (private per member).
  INSERT INTO public.song_personal_notes (song_id, user_id, band_id, content) VALUES
    (v_song_sweet_child, v_eric_id, v_band_id, E'Practice the intro at 100 BPM first, then up to 122.'),
    (v_song_man_in_box, v_eric_id, v_band_id, E'Wah: heel down on beat 1, toe on the "and".'),
    (v_song_enter_sandman, v_mike_id, v_band_id, E'Count 4 bars of the clean intro before coming in.'),
    (v_song_jump, v_mike_id, v_band_id, E'Keys patch: "Oberheim brass" preset 34.'),
    (v_song_kickstart, v_sarah_id, v_band_id, E'Double kick in the last chorus only.')
  ON CONFLICT (song_id, user_id, band_id) DO NOTHING;

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
    -- Upcoming shows (relative to the day the seed runs)
    (
      v_show_spring_bash,
      v_band_id,
      'Spring Break Bash',
      'The Crocodile',
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '6 days 20 hours 30 minutes') AT TIME ZONE 'America/Los_Angeles',
      45,
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
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '20 days 16 hours') AT TIME ZONE 'America/Los_Angeles',
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
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '34 days 20 hours') AT TIME ZONE 'America/Los_Angeles',
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
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '48 days 19 hours') AT TIME ZONE 'America/Los_Angeles',
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

  -- Each show keeps its own copy of the set it was planned with (0.11.0); the
  -- original stays in Setlists. Spring Break Bash is confirmed.
  INSERT INTO public.setlists (
    name, band_id, context_type, context_id, created_by, notes, tags, items,
    status, show_id, source_setlist_id, copied_at
  )
  SELECT sl.name, sl.band_id, sl.context_type, sl.context_id, sl.created_by,
         sl.notes, sl.tags, sl.items, sl.status, sl.show_id, sl.id, NOW()
    FROM public.setlists sl
   WHERE sl.show_id IS NOT NULL AND sl.copied_at IS NULL;
  UPDATE public.shows sh SET setlist_id = c.id
    FROM public.setlists c
   WHERE c.show_id = sh.id AND c.copied_at IS NOT NULL;
  UPDATE public.setlists SET show_id = NULL
   WHERE show_id IS NOT NULL AND copied_at IS NULL;
  UPDATE public.shows SET confirmed = true WHERE id = v_show_spring_bash;

  -- ========================================
  -- 10. PRACTICE SESSIONS (with future dates 90+ days out)
  -- ========================================
  RAISE NOTICE '🥁 Seeding practice sessions...';

  INSERT INTO public.practice_sessions (
    id, band_id, type, scheduled_date, duration,
    location, notes, created_date, version
  ) VALUES
    -- Upcoming practices (relative to the day the seed runs)
    (
      v_practice_first,
      v_band_id,
      'rehearsal',
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '2 days 19 hours') AT TIME ZONE 'America/Los_Angeles',
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
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '9 days 19 hours') AT TIME ZONE 'America/Los_Angeles',
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
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '16 days 13 hours') AT TIME ZONE 'America/Los_Angeles',
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
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '30 days 12 hours') AT TIME ZONE 'America/Los_Angeles',
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
      (date_trunc('day', NOW() AT TIME ZONE 'America/Los_Angeles') + interval '44 days 15 hours') AT TIME ZONE 'America/Los_Angeles',
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

  -- ========================================
  -- PERSONAL SONGS (for jam session testing)
  -- Eric and Mike share All Star + Wonderwall so jam matching always finds 2 common songs.
  -- ========================================
  RAISE NOTICE '🎸 Seeding personal songs for jam session testing...';

  INSERT INTO public.songs (
    id, title, artist, duration, key, tempo, difficulty, guitar_tuning,
    context_type, context_id, created_by, visibility, created_date, notes, version
  ) VALUES
    -- Eric's personal catalog
    (gen_random_uuid(), 'All Star',    'Smash Mouth', 194, 'F#',  104, 2, 'Standard',
     'personal', v_eric_id::text, v_eric_id, 'personal', NOW(), 'My personal copy', 1),
    (gen_random_uuid(), 'Wonderwall',  'Oasis',       258, 'F#m',  87, 2, 'Standard',
     'personal', v_eric_id::text, v_eric_id, 'personal', NOW(), 'Capo 2', 1),
    (gen_random_uuid(), 'Sweet Home Chicago', 'Robert Johnson', 180, 'E', 120, 2, 'Standard',
     'personal', v_eric_id::text, v_eric_id, 'personal', NOW(), 'Blues classic', 1),

    -- Mike's personal catalog
    (gen_random_uuid(), 'All Star',    'Smash Mouth', 194, 'F#',  104, 2, 'Standard',
     'personal', v_mike_id::text, v_mike_id, 'personal', NOW(), 'My personal copy', 1),
    (gen_random_uuid(), 'Wonderwall',  'Oasis',       258, 'F#m',  87, 2, 'Standard',
     'personal', v_mike_id::text, v_mike_id, 'personal', NOW(), 'Capo 2', 1),
    (gen_random_uuid(), 'Bohemian Rhapsody', 'Queen', 354, 'Bb', 72, 4, 'Standard',
     'personal', v_mike_id::text, v_mike_id, 'personal', NOW(), 'Tricky key changes', 1),

    -- Sarah's personal catalog
    (gen_random_uuid(), 'Wonderwall',  'Oasis',       258, 'F#m',  87, 2, 'Standard',
     'personal', v_sarah_id::text, v_sarah_id, 'personal', NOW(), 'Capo 2', 1),
    (gen_random_uuid(), 'Bohemian Rhapsody', 'Queen', 354, 'Bb', 72, 4, 'Standard',
     'personal', v_sarah_id::text, v_sarah_id, 'personal', NOW(), 'Epic drums', 1)
  ON CONFLICT DO NOTHING;

  -- ── Notifications demo data (mobile-redesign-port) ──────────────────────
  -- Release notes (global) so the "What's new / Updates" surface is testable.
  INSERT INTO public.release_notes (version, title, body, published_at) VALUES
    ('0.3.0', 'Markdown notes + personal catalog',
     E'## New\n- Rich markdown song notes\n- Your own personal song catalog', NOW() - INTERVAL '30 days'),
    ('0.4.0', 'Events, Friends & a fresh look',
     E'## New in 0.4.0\n- **Events** — host a gig or jam and let people sign up to play\n- **Friends** — connect by code or QR\n- A refreshed dark look with a 5-tab layout', NOW() - INTERVAL '1 day')
  ON CONFLICT (version) DO NOTHING;

  -- A few notifications for the "you" user (Eric) — mix of kinds + read state.
  INSERT INTO public.notifications (user_id, kind, title, body, link, read_at, created_date) VALUES
    (v_eric_id, 'release', 'What''s new in 0.4.0', 'Events, Friends & a fresh look', '/notifications', NULL, NOW() - INTERVAL '1 day'),
    (v_eric_id, 'activity', 'Mike added a song', 'Mike added "Lump" to the band catalog', '/songs', NULL, NOW() - INTERVAL '5 hours'),
    (v_eric_id, 'activity', 'Sarah rehearsed Enter Sandman', 'Marked in a practice session', '/practices', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '3 hours'),
    (v_eric_id, 'activity', 'Setlist updated', 'The Summer Festival Set was updated', '/setlists', NOW() - INTERVAL '20 hours', NOW() - INTERVAL '2 days');

  -- ── Friends demo data (mobile-redesign-port) ────────────────────────────
  -- Eric (you): Friends = Sarah, Leo · Requests = Mike, Dana · Sent = Jess.
  -- Sarah is friends with Leo and Jess, so find_people shows mutual counts and
  -- Leo (friends_of_friends) accepts requests from Sarah's friends.
  INSERT INTO public.friendships (user_a, user_b) VALUES
    (LEAST(v_eric_id, v_sarah_id), GREATEST(v_eric_id, v_sarah_id)),
    (LEAST(v_eric_id, v_leo_id), GREATEST(v_eric_id, v_leo_id)),
    (LEAST(v_sarah_id, v_leo_id), GREATEST(v_sarah_id, v_leo_id)),
    (LEAST(v_sarah_id, v_jess_id), GREATEST(v_sarah_id, v_jess_id))
  ON CONFLICT (user_a, user_b) DO NOTHING;

  INSERT INTO public.friend_requests (requester_id, addressee_id, status, created_date) VALUES
    (v_mike_id, v_eric_id, 'pending', NOW() - INTERVAL '2 days'),
    (v_dana_id, v_eric_id, 'pending', NOW() - INTERVAL '5 hours'),
    (v_eric_id, v_jess_id, 'pending', NOW() - INTERVAL '1 day')
  ON CONFLICT (requester_id, addressee_id) DO NOTHING;

  -- ── Events demo data (mobile-redesign-port) ─────────────────────────────
  -- Eric hosts an event; Mike + Sarah are guests; one confirmed lineup song and
  -- one PENDING song request from Mike (the request → host-approve flow to test).
  INSERT INTO public.events (id, host_user_id, band_id, name, description, venue, scheduled_date, visibility, status, short_code)
  VALUES ('e1111111-1111-4111-8111-111111111111', v_eric_id, v_band_id,
    'Backyard Summer Jam', 'Bring a song to play!', E'Eric\'s Backyard',
    NOW() + INTERVAL '10 days', 'unlisted', 'scheduled', 'JAM4567')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp) VALUES
    ('e1111111-1111-4111-8111-111111111111', v_eric_id, 'host', 'going'),
    ('e1111111-1111-4111-8111-111111111111', v_mike_id, 'guest', 'going'),
    ('e1111111-1111-4111-8111-111111111111', v_sarah_id, 'guest', 'maybe')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  INSERT INTO public.event_lineup_items (event_id, position, source, owner_id, display_title, display_artist) VALUES
    ('e1111111-1111-4111-8111-111111111111', 1, 'band', v_eric_id, 'Mr. Brightside', 'The Killers')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.event_lineup_requests (event_id, requester_id, source, owner_id, display_title, display_artist, status) VALUES
    ('e1111111-1111-4111-8111-111111111111', v_mike_id, 'external', v_mike_id, 'Seven Nation Army', 'The White Stripes', 'pending')
  ON CONFLICT DO NOTHING;

  -- ── Jams (phase 7) ──────────────────────────────────────────────────────
  -- Codes (shown ABCD-EFGH):
  --   FRDY4JAM  Friday Night Jam      planned, Eric hosts, 'code' (lineup, pitches, Guitar 2,
  --                                   Harmonica, invited Leo, web guest Robin, house player Sam)
  --   TUES7JAM  Tuesday Open Jam      live, Eric hosts (stage / queue / played, house player Kai,
  --                                   web guest Alex)
  --   SRAH5JAM  Sarah's Basement      planned, Sarah hosts, 'friends' (Eric's Friends' jams)
  --   HALW3JAM  Halloween Jam         ended, played songs
  --   MKBD6JAM  Band Rehearsal Jam    planned, Mike hosts the band jam, invite only (Eric invited)
  --   JAM4567   Backyard Summer Jam   the legacy event (its pending request is backfilled below)
  -- Web guest tokens (for jam_state etc. with p_guest_token): Robin = 'seed-guest-robin'
  -- on FRDY4JAM, Alex = 'seed-guest-alex' on TUES7JAM.
  INSERT INTO public.events (id, host_user_id, band_id, name, venue, scheduled_date, timezone, visibility,
                             status, short_code, who_can_join, auto_approve)
  VALUES
    ('e2222222-2222-4222-8222-222222222201', v_eric_id, NULL, 'Friday Night Jam', 'Lucky''s',
     date_trunc('day', NOW()) + interval '3 days 20 hours', 'America/Los_Angeles', 'unlisted',
     'scheduled', 'FRDY4JAM', 'code', false),
    ('e2222222-2222-4222-8222-222222222202', v_eric_id, NULL, 'Tuesday Open Jam', 'The Anchor',
     NOW() - interval '1 hour', 'America/Los_Angeles', 'unlisted', 'live', 'TUES7JAM', 'code', true),
    ('e2222222-2222-4222-8222-222222222203', v_sarah_id, NULL, 'Sarah''s Basement Session', 'Sarah''s place',
     date_trunc('day', NOW()) + interval '5 days 19 hours', 'America/Los_Angeles', 'unlisted',
     'scheduled', 'SRAH5JAM', 'friends', false),
    ('e2222222-2222-4222-8222-222222222204', v_eric_id, NULL, 'Halloween Jam', 'The Anchor',
     NOW() - interval '20 days', 'America/Los_Angeles', 'unlisted', 'completed', 'HALW3JAM', 'code', false),
    ('e2222222-2222-4222-8222-222222222205', v_mike_id, v_band_id, 'Band Rehearsal Jam', 'Eric''s Garage',
     date_trunc('day', NOW()) + interval '7 days 18 hours', 'America/Los_Angeles', 'unlisted',
     'scheduled', 'MKBD6JAM', 'invite', false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.event_participants (id, event_id, user_id, guest_name, access_tier, rsvp, via, is_house, parts, invited_by) VALUES
    -- Friday Night Jam
    ('a2222222-2222-4222-8222-222222220101', 'e2222222-2222-4222-8222-222222222201', v_eric_id,  NULL, 'host',   'going',   'app',    false, '[{"key":"guitar"},{"key":"vox"}]', NULL),
    ('a2222222-2222-4222-8222-222222220102', 'e2222222-2222-4222-8222-222222222201', v_sarah_id, NULL, 'cohost', 'going',   'app',    false, '[{"key":"vox"},{"key":"keys"}]', v_eric_id),
    ('a2222222-2222-4222-8222-222222220103', 'e2222222-2222-4222-8222-222222222201', v_mike_id,  NULL, 'guest',  'going',   'app',    false, '[{"key":"drums"},{"key":"bass"}]', NULL),
    ('a2222222-2222-4222-8222-222222220104', 'e2222222-2222-4222-8222-222222222201', v_leo_id,   NULL, 'guest',  'pending', 'app',    false, '[]', v_eric_id),
    ('a2222222-2222-4222-8222-222222220105', 'e2222222-2222-4222-8222-222222222201', NULL, 'Robin',  'guest',  'going',   'web',    false, '[{"key":"bass"},{"key":"other","label":"Harmonica"}]', NULL),
    ('a2222222-2222-4222-8222-222222220106', 'e2222222-2222-4222-8222-222222222201', NULL, 'Sam',    'guest',  'going',   'walkup', true,  '[{"key":"drums"}]', NULL),
    -- Tuesday Open Jam (live)
    ('a2222222-2222-4222-8222-222222220201', 'e2222222-2222-4222-8222-222222222202', v_eric_id,  NULL, 'host',   'going', 'app',    false, '[{"key":"guitar"}]', NULL),
    ('a2222222-2222-4222-8222-222222220202', 'e2222222-2222-4222-8222-222222222202', v_mike_id,  NULL, 'guest',  'going', 'app',    false, '[{"key":"vox"},{"key":"drums"}]', NULL),
    ('a2222222-2222-4222-8222-222222220203', 'e2222222-2222-4222-8222-222222222202', v_sarah_id, NULL, 'guest',  'going', 'app',    false, '[{"key":"bass"}]', NULL),
    ('a2222222-2222-4222-8222-222222220204', 'e2222222-2222-4222-8222-222222222202', NULL, 'Alex',   'guest',  'going', 'web',    false, '[{"key":"guitar"}]', NULL),
    ('a2222222-2222-4222-8222-222222220205', 'e2222222-2222-4222-8222-222222222202', NULL, 'Kai',    'guest',  'going', 'walkup', true,  '[{"key":"drums"}]', NULL),
    -- Sarah's Basement Session (friends mode; Eric isn't in it)
    ('a2222222-2222-4222-8222-222222220301', 'e2222222-2222-4222-8222-222222222203', v_sarah_id, NULL, 'host',   'going', 'app', false, '[{"key":"vox"}]', NULL),
    ('a2222222-2222-4222-8222-222222220302', 'e2222222-2222-4222-8222-222222222203', v_leo_id,   NULL, 'guest',  'going', 'app', false, '[{"key":"guitar"}]', NULL),
    -- Halloween Jam (ended: guests already gone)
    ('a2222222-2222-4222-8222-222222220401', 'e2222222-2222-4222-8222-222222222204', v_eric_id,  NULL, 'host',   'going', 'app', false, '[{"key":"guitar"}]', NULL),
    ('a2222222-2222-4222-8222-222222220402', 'e2222222-2222-4222-8222-222222222204', v_mike_id,  NULL, 'guest',  'going', 'app', false, '[{"key":"drums"}]', NULL),
    -- Band Rehearsal Jam (invite only; Eric invited)
    ('a2222222-2222-4222-8222-222222220501', 'e2222222-2222-4222-8222-222222222205', v_mike_id,  NULL, 'host',   'going',   'app', false, '[{"key":"drums"}]', NULL),
    ('a2222222-2222-4222-8222-222222220502', 'e2222222-2222-4222-8222-222222222205', v_sarah_id, NULL, 'guest',  'going',   'app', false, '[{"key":"bass"}]', v_mike_id),
    ('a2222222-2222-4222-8222-222222220503', 'e2222222-2222-4222-8222-222222222205', v_eric_id,  NULL, 'guest',  'pending', 'app', false, '[]', v_mike_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.event_guest_tokens (token_hash, event_id, participant_id, kind) VALUES
    (extensions.digest('seed-guest-robin', 'sha256'), 'e2222222-2222-4222-8222-222222222201', 'a2222222-2222-4222-8222-222222220105', 'guest'),
    (extensions.digest('seed-guest-alex', 'sha256'),  'e2222222-2222-4222-8222-222222222202', 'a2222222-2222-4222-8222-222222220204', 'guest')
  ON CONFLICT (token_hash) DO NOTHING;

  INSERT INTO public.event_lineup_items (id, event_id, position, source, owner_id, song_id, display_title, display_artist,
                                         state, parts_needed, pitched_by, called_at, queue_position, created_date) VALUES
    -- Friday Night Jam: open songs with gaps, a Guitar 2, a custom Harmonica, two pending pitches
    ('f2222222-2222-4222-8222-222222220101', 'e2222222-2222-4222-8222-222222222201', 1, 'band', v_eric_id, v_song_mr_brightside,
     'Mr. Brightside', 'The Killers', 'open', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NULL, NULL, NOW() - interval '2 days'),
    ('f2222222-2222-4222-8222-222222220102', 'e2222222-2222-4222-8222-222222222201', 2, 'band', v_eric_id, v_song_seven_nation,
     'Seven Nation Army', 'The White Stripes', 'open', '[{"key":"vox"},{"key":"guitar"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NULL, NULL, NOW() - interval '2 days'),
    ('f2222222-2222-4222-8222-222222220103', 'e2222222-2222-4222-8222-222222222201', 3, 'external', v_eric_id, NULL,
     'Low Rider', 'War', 'open', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"},{"key":"other","label":"Harmonica"}]', NULL, NULL, NULL, NOW() - interval '1 day'),
    ('f2222222-2222-4222-8222-222222220104', 'e2222222-2222-4222-8222-222222222201', 4, 'external', v_mike_id, NULL,
     'Plush', 'Stone Temple Pilots', 'pending', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', 'a2222222-2222-4222-8222-222222220103', NULL, NULL, NOW() - interval '20 hours'),
    ('f2222222-2222-4222-8222-222222220105', 'e2222222-2222-4222-8222-222222222201', 5, 'external', NULL, NULL,
     'Wonderwall (Live)', 'Oasis', 'pending', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', 'a2222222-2222-4222-8222-222222220105', NULL, NULL, NOW() - interval '3 hours'),
    -- Tuesday Open Jam: played, on stage, queued, a pending pitch, an open song
    ('f2222222-2222-4222-8222-222222220201', 'e2222222-2222-4222-8222-222222222202', 1, 'band', v_eric_id, v_song_all_star,
     'All Star', 'Smash Mouth', 'played', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NOW() - interval '50 minutes', NULL, NOW() - interval '2 hours'),
    ('f2222222-2222-4222-8222-222222220202', 'e2222222-2222-4222-8222-222222222202', 2, 'band', v_eric_id, v_song_creep,
     'Creep', 'Radiohead', 'played', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NOW() - interval '30 minutes', NULL, NOW() - interval '2 hours'),
    ('f2222222-2222-4222-8222-222222220203', 'e2222222-2222-4222-8222-222222222202', 3, 'band', v_eric_id, v_song_black,
     'Black', 'Pearl Jam', 'stage', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NOW() - interval '12 minutes', NULL, NOW() - interval '2 hours'),
    ('f2222222-2222-4222-8222-222222220204', 'e2222222-2222-4222-8222-222222222202', 4, 'band', v_eric_id, v_song_enter_sandman,
     'Enter Sandman', 'Metallica', 'queued', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NULL, 1, NOW() - interval '2 hours'),
    ('f2222222-2222-4222-8222-222222220205', 'e2222222-2222-4222-8222-222222222202', 5, 'band', v_eric_id, v_song_zombie,
     'Zombie', 'The Cranberries', 'queued', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NULL, 2, NOW() - interval '2 hours'),
    ('f2222222-2222-4222-8222-222222220206', 'e2222222-2222-4222-8222-222222222202', 6, 'external', NULL, NULL,
     'Everlong', 'Foo Fighters', 'pending', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', 'a2222222-2222-4222-8222-222222220204', NULL, NULL, NOW() - interval '10 minutes'),
    ('f2222222-2222-4222-8222-222222220207', 'e2222222-2222-4222-8222-222222222202', 7, 'external', v_mike_id, NULL,
     'Hey Ya!', 'OutKast', 'open', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"},{"key":"keys"}]', 'a2222222-2222-4222-8222-222222220202', NULL, NULL, NOW() - interval '5 minutes'),
    -- Sarah's Basement Session
    ('f2222222-2222-4222-8222-222222220301', 'e2222222-2222-4222-8222-222222222203', 1, 'external', v_sarah_id, NULL,
     'Dreams', 'Fleetwood Mac', 'open', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NULL, NULL, NOW() - interval '1 day'),
    -- Halloween Jam: the night's played songs (in called order) and one that never made it
    ('f2222222-2222-4222-8222-222222220401', 'e2222222-2222-4222-8222-222222222204', 1, 'band', v_eric_id, v_song_zombie,
     'Zombie', 'The Cranberries', 'played', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NOW() - interval '20 days' + interval '30 minutes', NULL, NOW() - interval '21 days'),
    ('f2222222-2222-4222-8222-222222220402', 'e2222222-2222-4222-8222-222222222204', 2, 'band', v_eric_id, v_song_creep,
     'Creep', 'Radiohead', 'played', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NOW() - interval '20 days' + interval '1 hour', NULL, NOW() - interval '21 days'),
    ('f2222222-2222-4222-8222-222222220403', 'e2222222-2222-4222-8222-222222222204', 3, 'external', v_mike_id, NULL,
     'Thriller', 'Michael Jackson', 'played', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"},{"key":"keys"}]', NULL, NOW() - interval '20 days' + interval '15 minutes', NULL, NOW() - interval '21 days'),
    ('f2222222-2222-4222-8222-222222220404', 'e2222222-2222-4222-8222-222222222204', 4, 'external', v_mike_id, NULL,
     'Monster Mash', 'Bobby Pickett', 'removed', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NULL, NULL, NOW() - interval '21 days'),
    -- Band Rehearsal Jam
    ('f2222222-2222-4222-8222-222222220501', 'e2222222-2222-4222-8222-222222222205', 1, 'band', v_mike_id, v_song_plush,
     'Plush', 'Stone Temple Pilots', 'open', '[{"key":"vox"},{"key":"guitar"},{"key":"bass"},{"key":"drums"}]', NULL, NULL, NULL, NOW() - interval '1 day')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.event_hands (event_id, event_lineup_item_id, role_key, role_label, participant_id, user_id, user_name, status, resolved_date) VALUES
    -- Friday: Mr. Brightside (Eric cast on guitar; Mike and Robin up; vox open)
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220101', 'guitar', NULL, 'a2222222-2222-4222-8222-222222220101', v_eric_id,  'Eric Johnson',  'accepted', NOW() - interval '1 day'),
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220101', 'drums',  NULL, 'a2222222-2222-4222-8222-222222220103', v_mike_id,  'Mike Thompson', 'raised',   NULL),
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220101', 'bass',   NULL, 'a2222222-2222-4222-8222-222222220105', NULL,       'Robin',         'raised',   NULL),
    -- Friday: Seven Nation Army (Guitar 1 Eric, Guitar 2 Sarah, Mike up on bass)
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220102', 'guitar', NULL, 'a2222222-2222-4222-8222-222222220101', v_eric_id,  'Eric Johnson',  'accepted', NOW() - interval '1 day'),
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220102', 'guitar', NULL, 'a2222222-2222-4222-8222-222222220102', v_sarah_id, 'Sarah Chen',    'accepted', NOW() - interval '20 hours'),
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220102', 'bass',   NULL, 'a2222222-2222-4222-8222-222222220103', v_mike_id,  'Mike Thompson', 'raised',   NULL),
    -- Friday: Low Rider (Robin up on Harmonica, Sam cast on drums)
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220103', 'other', 'Harmonica', 'a2222222-2222-4222-8222-222222220105', NULL, 'Robin', 'raised',   NULL),
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220103', 'drums',  NULL, 'a2222222-2222-4222-8222-222222220106', NULL,       'Sam',           'accepted', NOW() - interval '1 day'),
    -- Friday: pitches (Mike on drums for his Plush, Sarah up on vox; Robin on bass for Wonderwall)
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220104', 'drums',  NULL, 'a2222222-2222-4222-8222-222222220103', v_mike_id,  'Mike Thompson', 'raised',   NULL),
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220104', 'vox',    NULL, 'a2222222-2222-4222-8222-222222220102', v_sarah_id, 'Sarah Chen',    'raised',   NULL),
    ('e2222222-2222-4222-8222-222222222201', 'f2222222-2222-4222-8222-222222220105', 'bass',   NULL, 'a2222222-2222-4222-8222-222222220105', NULL,       'Robin',         'raised',   NULL),
    -- Tuesday: Black on stage (full band), Enter Sandman queued (Kai cast, Alex up)
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220203', 'guitar', NULL, 'a2222222-2222-4222-8222-222222220201', v_eric_id,  'Eric Johnson',  'accepted', NOW() - interval '20 minutes'),
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220203', 'vox',    NULL, 'a2222222-2222-4222-8222-222222220202', v_mike_id,  'Mike Thompson', 'accepted', NOW() - interval '20 minutes'),
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220203', 'bass',   NULL, 'a2222222-2222-4222-8222-222222220203', v_sarah_id, 'Sarah Chen',    'accepted', NOW() - interval '20 minutes'),
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220203', 'drums',  NULL, 'a2222222-2222-4222-8222-222222220205', NULL,       'Kai',           'accepted', NOW() - interval '20 minutes'),
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220204', 'drums',  NULL, 'a2222222-2222-4222-8222-222222220205', NULL,       'Kai',           'accepted', NOW() - interval '15 minutes'),
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220204', 'guitar', NULL, 'a2222222-2222-4222-8222-222222220204', NULL,       'Alex',          'raised',   NULL),
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220206', 'guitar', NULL, 'a2222222-2222-4222-8222-222222220204', NULL,       'Alex',          'raised',   NULL),
    ('e2222222-2222-4222-8222-222222222202', 'f2222222-2222-4222-8222-222222220207', 'vox',    NULL, 'a2222222-2222-4222-8222-222222220202', v_mike_id,  'Mike Thompson', 'raised',   NULL)
  ON CONFLICT DO NOTHING;

  -- Eric's invite to Mike's band jam.
  INSERT INTO public.notifications (user_id, kind, title, body, link, payload, created_date) VALUES
    (v_eric_id, 'event', 'Mike invited you to Band Rehearsal Jam', 'Eric''s Garage', '/jam/e2222222-2222-4222-8222-222222222205',
     jsonb_build_object('type', 'jam_invite', 'event_id', 'e2222222-2222-4222-8222-222222222205', 'band_id', v_band_id),
     NOW() - interval '2 hours');

  -- Jam songs: personal songs tagged 'jam', titles written differently on each
  -- side to exercise the normalised match (punctuation, case, "The", "(Live)").
  --   Eric ↔ Mike: All Star, Mr. Brightside, Plush · Eric ↔ Sarah: Wonderwall, Black
  --   Mike ↔ Sarah: Bohemian Rhapsody · Sarah ↔ Leo: Don't Stop Believin'
  --   Eric's "Low Rider" isn't tagged (lineup shows "Add to jam songs").
  UPDATE public.songs SET tags = ARRAY['jam']
   WHERE context_type = 'personal'
     AND ((context_id = v_eric_id::text AND title IN ('All Star', 'Wonderwall'))
       OR (context_id = v_mike_id::text AND title IN ('All Star', 'Bohemian Rhapsody'))
       OR (context_id = v_sarah_id::text AND title IN ('Wonderwall', 'Bohemian Rhapsody')));
  INSERT INTO public.songs (id, title, artist, context_type, context_id, created_by, visibility, tags) VALUES
    ('44444444-4444-4444-8444-444444444401', 'Mr Brightside', 'the killers', 'personal', v_eric_id::text, v_eric_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444402', 'Plush (Live)', 'Stone Temple Pilots', 'personal', v_eric_id::text, v_eric_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444403', 'Black', 'Pearl Jam', 'personal', v_eric_id::text, v_eric_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444404', 'Low Rider', 'War', 'personal', v_eric_id::text, v_eric_id, 'personal', '{}'),
    ('44444444-4444-4444-8444-444444444411', 'Mr. Brightside', 'The Killers', 'personal', v_mike_id::text, v_mike_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444412', 'PLUSH', 'stone temple pilots', 'personal', v_mike_id::text, v_mike_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444413', 'Seven Nation Army', 'White Stripes', 'personal', v_mike_id::text, v_mike_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444421', 'Black [Live]', 'pearl jam', 'personal', v_sarah_id::text, v_sarah_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444422', 'Don''t Stop Believin''', 'Journey', 'personal', v_sarah_id::text, v_sarah_id, 'personal', ARRAY['jam']),
    ('44444444-4444-4444-8444-444444444431', 'Dont Stop Believin', 'Journey', 'personal', v_leo_id::text, v_leo_id, 'personal', ARRAY['jam'])
  ON CONFLICT (id) DO NOTHING;

  -- The legacy event's pending request becomes a pending lineup entry (the
  -- migration's backfill ran before this seed).
  PERFORM public._jam_backfill_requests();

  RAISE NOTICE '✅ MVP seed data complete!';
  RAISE NOTICE 'Test users: eric@testband.demo, mike@testband.demo, sarah@testband.demo';
  RAISE NOTICE 'Friends-page users: jess@, dana@, leo@, priya@testband.demo';
  RAISE NOTICE 'Password for all: test123';
  RAISE NOTICE 'Band: Demo Band';

END $$;

-- The 7-string song has no label alias: point it at the built-in directly.
UPDATE public.songs SET tuning_id = (SELECT id FROM public.tunings WHERE is_builtin AND slug = 'drop-a-7')
 WHERE id = '11111111-1111-1111-1111-111111111125';

-- Resolve seeded songs' guitar_tuning label → built-in tuning_id (the tunings
-- migration's backfill no-ops on a fresh reset because seed runs after migrations).
UPDATE public.songs s
   SET tuning_id = t.id
  FROM public.tunings t
 WHERE t.is_builtin
   AND t.slug = public.builtin_tuning_slug(s.guitar_tuning)
   AND s.tuning_id IS NULL;

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
SELECT 'Practice Sessions', COUNT(*) FROM public.practice_sessions
UNION ALL
SELECT 'Song Charts', COUNT(*) FROM public.song_charts
UNION ALL
SELECT 'Friendships', COUNT(*) FROM public.friendships;
