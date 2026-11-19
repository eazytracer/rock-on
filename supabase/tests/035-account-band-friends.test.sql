-- Test: phase 6 contract: owner role + backfill, create_band, band_preview_by_code,
--       join_band, regenerate_invite_code, set_member_role, remove_member,
--       transfer_ownership, leave_band, delete_band, update_band_profile,
--       list_my_contexts (mark), get_user_emails (owner), ensure_my_profile,
--       send_friend_request (policy), find_people, delete_account, and the
--       closed policies (docs/redesign/13-account-band-friends.md · 3.1).
-- Category: Functions + access
-- Created: 2026-11-18

begin;

select plan(145);

DO $$
DECLARE e TEXT;
BEGIN
  FOREACH e IN ARRAY ARRAY['own', 'adm', 'mem', 'mem2', 'out', 'solo',
                           'bf1', 'bf2', 'bf3', 'bf4', 'bf5', 'bf6', 'bf7', 'bf8', 'bf9',
                           'snd', 'evr', 'fof', 'cod', 'mut', 'stg',
                           'del', 'delown', 'delmate'] LOOP
    PERFORM tests.create_supabase_user('p6-' || e || '@test.com');
    PERFORM set_config('test.' || e, tests.get_supabase_uid('p6-' || e || '@test.com')::text, true);
  END LOOP;
END $$;

-- ── Backfill (the migration's function, run on fixtures) ────────────────────
-- B1: two flag holders → the earlier joined; B2: creator still active; B3: the
-- creator left → earliest admin; B4: members only → earliest; B5: has an owner.
INSERT INTO public.bands (id, name, created_by) VALUES
  ('6b000000-0000-4000-8000-0000000000b1', 'B1', current_setting('test.bf1')::uuid),
  ('6b000000-0000-4000-8000-0000000000b2', 'B2', current_setting('test.bf3')::uuid),
  ('6b000000-0000-4000-8000-0000000000b3', 'B3', current_setting('test.bf5')::uuid),
  ('6b000000-0000-4000-8000-0000000000b4', 'B4', current_setting('test.bf1')::uuid),
  ('6b000000-0000-4000-8000-0000000000b5', 'B5', current_setting('test.bf1')::uuid);
INSERT INTO public.band_memberships (band_id, user_id, role, status, joined_date, permissions) VALUES
  ('6b000000-0000-4000-8000-0000000000b1', current_setting('test.bf1')::uuid, 'admin',  'active', '2024-03-01', '{owner,admin}'),
  ('6b000000-0000-4000-8000-0000000000b1', current_setting('test.bf2')::uuid, 'member', 'active', '2024-02-01', '{owner}'),
  ('6b000000-0000-4000-8000-0000000000b1', current_setting('test.bf3')::uuid, 'admin',  'active', '2024-01-01', '{admin}'),
  ('6b000000-0000-4000-8000-0000000000b2', current_setting('test.bf4')::uuid, 'admin',  'active', '2024-01-01', '{admin}'),
  ('6b000000-0000-4000-8000-0000000000b2', current_setting('test.bf3')::uuid, 'member', 'active', '2024-02-01', '{member}'),
  ('6b000000-0000-4000-8000-0000000000b3', current_setting('test.bf5')::uuid, 'admin',  'inactive', '2024-01-01', '{admin}'),
  ('6b000000-0000-4000-8000-0000000000b3', current_setting('test.bf6')::uuid, 'member', 'active', '2024-01-02', '{member}'),
  ('6b000000-0000-4000-8000-0000000000b3', current_setting('test.bf7')::uuid, 'admin',  'active', '2024-02-01', '{admin}'),
  ('6b000000-0000-4000-8000-0000000000b3', current_setting('test.bf8')::uuid, 'admin',  'active', '2024-03-01', '{admin}'),
  ('6b000000-0000-4000-8000-0000000000b4', current_setting('test.bf8')::uuid, 'member', 'active', '2024-02-01', '{member}'),
  ('6b000000-0000-4000-8000-0000000000b4', current_setting('test.bf9')::uuid, 'member', 'active', '2024-01-01', '{member}'),
  ('6b000000-0000-4000-8000-0000000000b5', current_setting('test.bf1')::uuid, 'member', 'active', '2024-01-01', '{member}'),
  ('6b000000-0000-4000-8000-0000000000b5', current_setting('test.bf2')::uuid, 'owner',  'active', '2024-02-01', '{owner}');

select lives_ok($$ SELECT public._backfill_band_owners() $$, 'backfill: runs');
select lives_ok($$ SELECT public._backfill_band_owners() $$, 'backfill: runs again (idempotent)');

CREATE TEMP TABLE _bf ON COMMIT DROP AS
SELECT b.name AS band, string_agg(
         CASE m.user_id::text
           WHEN current_setting('test.bf1') THEN 'bf1' WHEN current_setting('test.bf2') THEN 'bf2'
           WHEN current_setting('test.bf3') THEN 'bf3' WHEN current_setting('test.bf4') THEN 'bf4'
           WHEN current_setting('test.bf5') THEN 'bf5' WHEN current_setting('test.bf6') THEN 'bf6'
           WHEN current_setting('test.bf7') THEN 'bf7' WHEN current_setting('test.bf8') THEN 'bf8'
           WHEN current_setting('test.bf9') THEN 'bf9' END
         || '=' || m.role || CASE WHEN m.permissions = ARRAY[m.role] THEN '' ELSE '!' END,
         ' ' ORDER BY m.joined_date) AS roles
  FROM public.band_memberships m JOIN public.bands b ON b.id = m.band_id
 WHERE b.name IN ('B1', 'B2', 'B3', 'B4', 'B5')
 GROUP BY b.name;
GRANT SELECT ON _bf TO authenticated;

select is((SELECT roles FROM _bf WHERE band = 'B1'), 'bf3=admin bf2=owner bf1=admin',
  'backfill: of two flag holders the earliest joined owns; the other becomes admin');
select is((SELECT roles FROM _bf WHERE band = 'B2'), 'bf4=admin bf3=owner',
  'backfill: no flag → the creator, if still an active member');
select is((SELECT roles FROM _bf WHERE band = 'B3'), 'bf5=admin bf6=member bf7=owner bf8=admin',
  'backfill: creator gone → the earliest active admin');
select is((SELECT roles FROM _bf WHERE band = 'B4'), 'bf9=owner bf8=member',
  'backfill: no admins → the earliest active member');
select is((SELECT roles FROM _bf WHERE band = 'B5'), 'bf1=member bf2=owner',
  'backfill: a band that has an owner is left alone; permissions mirror the role everywhere');
select throws_ok(format($$ INSERT INTO public.band_memberships (band_id, user_id, role, status)
    VALUES ('6b000000-0000-4000-8000-0000000000b5', %L, 'owner', 'active') $$, current_setting('test.bf3')),
  '23505', NULL, 'owner index: a second active owner is refused');
select lives_ok(format($$ INSERT INTO public.band_memberships (band_id, user_id, role, status)
    VALUES ('6b000000-0000-4000-8000-0000000000b5', %L, 'owner', 'inactive') $$, current_setting('test.bf3')),
  'owner index: an inactive owner row doesn''t count');
select throws_ok(format($$ INSERT INTO public.band_memberships (band_id, user_id, role, status)
    VALUES ('6b000000-0000-4000-8000-0000000000b5', %L, 'boss', 'active') $$, current_setting('test.bf4')),
  '23514', NULL, 'membership_role_check: owner / admin / member / viewer only');

-- ── create_band ─────────────────────────────────────────────────────────────
select tests.authenticate_as('p6-own@test.com');
DO $$ BEGIN
  PERFORM set_config('test.band', (SELECT id::text FROM public.create_band(
    '  Phase Six ', '{"kind":"symbol","symbol":"bolt","color":"teal","lettering":"stencil"}')), true);
END $$;

select is((SELECT name FROM public.bands WHERE id = current_setting('test.band')::uuid), 'Phase Six',
  'create_band: the band, name trimmed');
select is((SELECT role || '/' || status FROM public.band_memberships
            WHERE band_id = current_setting('test.band')::uuid AND user_id = current_setting('test.own')::uuid),
  'owner/active', 'create_band: the caller is the owner');
select is((SELECT mark FROM public.bands WHERE id = current_setting('test.band')::uuid),
  '{"kind":"symbol","color":"teal","symbol":"bolt","initials":"PS","lettering":"stencil"}'::jsonb,
  'create_band: the mark is stored in the full shape, initials from the name');
select is((SELECT count(*)::int FROM public.invite_codes
            WHERE band_id = current_setting('test.band')::uuid AND is_active), 1,
  'create_band: one active invite code');
select ok((SELECT expires_at BETWEEN now() + interval '23 hours 59 minutes' AND now() + interval '24 hours 1 minute'
                  AND max_uses IS NULL AND char_length(code) = 8
             FROM public.invite_codes WHERE band_id = current_setting('test.band')::uuid AND is_active),
  'create_band: the code lasts 24 h with unlimited uses');
DO $$ BEGIN
  PERFORM set_config('test.code1', (SELECT code FROM public.invite_codes
    WHERE band_id = current_setting('test.band')::uuid AND is_active), true);
END $$;
select is((SELECT mark->>'kind' || ':' || (mark->>'initials') || ':' || (mark->>'color')
             FROM public.create_band('Solo act')), 'initials:SA:orange',
  'create_band: no mark → initials on orange');
select throws_ok($$ SELECT public.create_band('   ') $$, 'P0001', 'invalid_name',
  'create_band: a blank name → invalid_name');
select throws_ok($$ SELECT public.create_band(repeat('x', 61)) $$, 'P0001', 'invalid_name',
  'create_band: over 60 characters → invalid_name');
select throws_ok($$ SELECT public.create_band('X', '{"kind":"photo"}') $$, 'P0001', 'invalid_mark',
  'create_band: an unknown mark kind → invalid_mark');
select throws_ok($$ SELECT public.create_band('X', '{"kind":"symbol"}') $$, 'P0001', 'invalid_mark',
  'create_band: a symbol mark without a symbol → invalid_mark');
select ok(public.is_band_admin(current_setting('test.band')::uuid, current_setting('test.own')::uuid),
  'is_band_admin: true for the owner');

select throws_ok($$ UPDATE public.bands SET deleted_at = now() WHERE name = 'Solo act' $$,
  'P0001', 'forbidden', 'bands: a direct soft delete is refused (delete_band only)');
-- A direct insert (still allowed by policy) gets its owner from the creator trigger.
INSERT INTO public.bands (id, name) VALUES ('6b000000-0000-4000-8000-0000000000c1', 'Direct');
select is((SELECT role FROM public.band_memberships
            WHERE band_id = '6b000000-0000-4000-8000-0000000000c1' AND user_id = current_setting('test.own')::uuid),
  'owner', 'auto_add_band_creator: the creator is inserted as owner');

-- ── band_preview_by_code ────────────────────────────────────────────────────
select tests.authenticate_as('p6-out@test.com');
select is((SELECT name || '|' || member_count || '|' || song_count || '|' || array_to_string(member_first_names, ',')
                  || '|' || is_member || '|' || (mark->>'symbol')
             FROM public.band_preview_by_code(current_setting('test.code1'))),
  'Phase Six|1|0|p6-own|false|bolt', 'band_preview_by_code: name, counts, first names, mark');
select is((SELECT name FROM public.band_preview_by_code('  ' || lower(current_setting('test.code1')) || ' ')),
  'Phase Six', 'band_preview_by_code: case and spaces don''t matter');
select throws_ok($$ SELECT * FROM public.band_preview_by_code('NOPE1234') $$, 'P0001', 'invite_invalid',
  'band_preview_by_code: an unknown code → invite_invalid');
select throws_ok($$ SELECT * FROM public.band_preview_by_code(NULL) $$, 'P0001', 'invite_invalid',
  'band_preview_by_code: no code → invite_invalid');
select is(pg_get_function_result('public.band_preview_by_code(text)'::regprocedure),
  'TABLE(name text, mark jsonb, description text, member_first_names text[], member_count integer, song_count integer, is_member boolean)',
  'band_preview_by_code: returns only the preview fields (no ids, no emails)');
select ok(NOT has_function_privilege('anon', 'public.band_preview_by_code(text)', 'execute'),
  'band_preview_by_code: not callable signed out');

-- ── join_band ───────────────────────────────────────────────────────────────
select tests.authenticate_as('p6-adm@test.com');
select is((SELECT role || '/' || status FROM public.join_band(current_setting('test.code1'))), 'member/active',
  'join_band: joins as a member');
select throws_ok(format($$ SELECT public.join_band(%L) $$, current_setting('test.code1')), 'P0001', 'already_member',
  'join_band: twice → already_member');
select tests.authenticate_as('p6-mem@test.com');
select lives_ok(format($$ SELECT public.join_band(%L) $$, current_setting('test.code1')), 'join_band: a second member');
select is((SELECT is_member FROM public.band_preview_by_code(current_setting('test.code1'))), true,
  'band_preview_by_code: is_member for someone in the band');
select throws_ok($$ SELECT public.join_band('NOPE1234') $$, 'P0001', 'invite_invalid',
  'join_band: an unknown code → invite_invalid');

select tests.authenticate_as('p6-own@test.com');
select is((SELECT current_uses FROM public.invite_codes WHERE code = current_setting('test.code1')), 2,
  'join_band: counts uses');
select is((SELECT role FROM public.set_member_role(current_setting('test.band')::uuid, current_setting('test.adm')::uuid, 'admin')),
  'admin', 'set_member_role: the owner makes a member admin');
select is((SELECT count(*)::int FROM public.get_user_emails(ARRAY[current_setting('test.adm')::uuid, current_setting('test.mem')::uuid])),
  2, 'get_user_emails: the owner (role, no flag) sees bandmates'' emails');
select is((SELECT role || ':' || member_count || ':' || (mark->>'color')
             FROM public.list_my_contexts() WHERE band_id = current_setting('test.band')::uuid),
  'owner:3:teal', 'list_my_contexts: role, member count and the mark');

-- ── closed policies ─────────────────────────────────────────────────────────
select tests.authenticate_as('p6-out@test.com');
select throws_ok(format($$ INSERT INTO public.band_memberships (band_id, user_id, role, status)
    VALUES (%L, %L, 'admin', 'active') $$, current_setting('test.band'), current_setting('test.out')),
  '42501', NULL, 'policy: nobody can insert themselves into a band');
select is((SELECT count(*)::int FROM public.invite_codes), 0, 'policy: an outsider reads no invite codes');
select tests.authenticate_as('p6-mem@test.com');
select is((SELECT count(*)::int FROM public.invite_codes), 0, 'policy: a plain member reads no invite codes');
select is((SELECT count(*)::int FROM public.band_memberships WHERE band_id = current_setting('test.band')::uuid), 3,
  'policy: members still read the band''s memberships');
select lives_ok(format($$ UPDATE public.band_memberships SET role = 'owner' WHERE band_id = %L $$, current_setting('test.band')),
  'policy: a direct membership update runs…');
select lives_ok(format($$ DELETE FROM public.band_memberships WHERE band_id = %L $$, current_setting('test.band')),
  'policy: …and so does a direct delete…');
select is((SELECT string_agg(role, ',' ORDER BY role) FROM public.band_memberships WHERE band_id = current_setting('test.band')::uuid),
  'admin,member,owner', 'policy: …but neither changes anything');
select tests.authenticate_as('p6-adm@test.com');
select is((SELECT count(*)::int FROM public.invite_codes WHERE band_id = current_setting('test.band')::uuid), 1,
  'policy: an admin reads the band''s codes');

-- ── regenerate_invite_code ──────────────────────────────────────────────────
select tests.authenticate_as('p6-mem@test.com');
select throws_ok(format($$ SELECT public.regenerate_invite_code(%L) $$, current_setting('test.band')),
  'P0001', 'forbidden', 'regenerate_invite_code: a member → forbidden');
select tests.authenticate_as('p6-out@test.com');
select throws_ok(format($$ SELECT public.regenerate_invite_code(%L) $$, current_setting('test.band')),
  'P0001', 'forbidden', 'regenerate_invite_code: an outsider → forbidden');
select throws_ok($$ SELECT public.regenerate_invite_code('6b000000-0000-4000-8000-00000000dead') $$,
  'P0001', 'not_found', 'regenerate_invite_code: an unknown band → not_found');
select tests.authenticate_as('p6-adm@test.com');
DO $$ BEGIN
  PERFORM set_config('test.code2', (SELECT code FROM public.regenerate_invite_code(current_setting('test.band')::uuid)), true);
END $$;
select isnt(current_setting('test.code2'), current_setting('test.code1'), 'regenerate_invite_code: an admin gets a new code');
select is((SELECT count(*)::int FROM public.invite_codes WHERE band_id = current_setting('test.band')::uuid AND is_active), 1,
  'regenerate_invite_code: still one active code');
select throws_ok(format($$ SELECT * FROM public.band_preview_by_code(%L) $$, current_setting('test.code1')),
  'P0001', 'invite_invalid', 'regenerate_invite_code: the old code no longer previews');
select tests.authenticate_as('p6-mem2@test.com');
select throws_ok(format($$ SELECT public.join_band(%L) $$, current_setting('test.code1')),
  'P0001', 'invite_invalid', 'regenerate_invite_code: the old code no longer joins');

-- Expired: same single key, nothing revealed.
reset role;
UPDATE public.invite_codes SET expires_at = now() - interval '1 minute' WHERE code = current_setting('test.code2');
select throws_ok(format($$ INSERT INTO public.invite_codes (band_id, code, created_by) VALUES (%L, 'SECOND01', %L) $$,
    current_setting('test.band'), current_setting('test.own')),
  '23505', NULL, 'invite codes: a second active code for a band is refused');
select ok((SELECT column_default LIKE '%24:00:00%' FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'invite_codes' AND column_name = 'expires_at')
          AND (SELECT column_default IS NULL FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'invite_codes' AND column_name = 'max_uses'),
  'invite codes: defaults are 24 h and unlimited');
select tests.authenticate_as('p6-mem2@test.com');
select throws_ok(format($$ SELECT * FROM public.band_preview_by_code(%L) $$, current_setting('test.code2')),
  'P0001', 'invite_invalid', 'band_preview_by_code: an expired code → invite_invalid');
select throws_ok(format($$ SELECT public.join_band(%L) $$, current_setting('test.code2')),
  'P0001', 'invite_invalid', 'join_band: an expired code → invite_invalid');
select tests.authenticate_as('p6-own@test.com');
DO $$ BEGIN
  PERFORM set_config('test.code3', (SELECT code FROM public.regenerate_invite_code(current_setting('test.band')::uuid)), true);
END $$;
select tests.authenticate_as('p6-mem2@test.com');
select lives_ok(format($$ SELECT public.join_band(%L) $$, current_setting('test.code3')),
  'regenerate_invite_code: the owner issues a fresh code after expiry, and it joins');

-- ── set_member_role ─────────────────────────────────────────────────────────
select tests.authenticate_as('p6-adm@test.com');
select is((SELECT role FROM public.set_member_role(current_setting('test.band')::uuid, current_setting('test.mem2')::uuid, 'admin')),
  'admin', 'set_member_role: an admin may promote a member');
select throws_ok(format($$ SELECT public.set_member_role(%L, %L, 'member') $$, current_setting('test.band'), current_setting('test.mem2')),
  'P0001', 'forbidden', 'set_member_role: only the owner changes an admin');
select throws_ok(format($$ SELECT public.set_member_role(%L, %L, 'member') $$, current_setting('test.band'), current_setting('test.own')),
  'P0001', 'owner_role_fixed', 'set_member_role: the owner''s role → owner_role_fixed');
select throws_ok(format($$ SELECT public.set_member_role(%L, %L, 'owner') $$, current_setting('test.band'), current_setting('test.mem')),
  'P0001', 'invalid_role', 'set_member_role: owner isn''t settable → invalid_role');
select throws_ok(format($$ SELECT public.set_member_role(%L, %L, 'admin') $$, current_setting('test.band'), current_setting('test.out')),
  'P0001', 'not_found', 'set_member_role: someone not in the band → not_found');
select tests.authenticate_as('p6-mem@test.com');
select throws_ok(format($$ SELECT public.set_member_role(%L, %L, 'admin') $$, current_setting('test.band'), current_setting('test.mem')),
  'P0001', 'forbidden', 'set_member_role: a member → forbidden');
select tests.authenticate_as('p6-own@test.com');
select is((SELECT role || ':' || array_to_string(permissions, ',')
             FROM public.set_member_role(current_setting('test.band')::uuid, current_setting('test.mem2')::uuid, 'member')),
  'member:member', 'set_member_role: the owner demotes an admin; permissions follow');

-- ── remove_member ───────────────────────────────────────────────────────────
select tests.authenticate_as('p6-mem@test.com');
select throws_ok(format($$ SELECT public.remove_member(%L, %L) $$, current_setting('test.band'), current_setting('test.mem2')),
  'P0001', 'forbidden', 'remove_member: a member → forbidden');
select tests.authenticate_as('p6-adm@test.com');
select throws_ok(format($$ SELECT public.remove_member(%L, %L) $$, current_setting('test.band'), current_setting('test.own')),
  'P0001', 'cannot_remove_owner', 'remove_member: the owner → cannot_remove_owner');
select throws_ok(format($$ SELECT public.remove_member(%L, %L) $$, current_setting('test.band'), current_setting('test.adm')),
  'P0001', 'forbidden', 'remove_member: yourself → forbidden (leave instead)');
select is((SELECT status FROM public.remove_member(current_setting('test.band')::uuid, current_setting('test.mem2')::uuid)),
  'inactive', 'remove_member: an admin removes a member');
select ok(NOT public.is_band_member(current_setting('test.band')::uuid, current_setting('test.mem2')::uuid),
  'remove_member: they''re out');
select tests.authenticate_as('p6-mem2@test.com');
select is((SELECT role || '/' || status FROM public.join_band(current_setting('test.code3'))), 'member/active',
  'join_band: someone removed can rejoin with a live code');

-- ── transfer_ownership ──────────────────────────────────────────────────────
select tests.authenticate_as('p6-adm@test.com');
select throws_ok(format($$ SELECT public.transfer_ownership(%L, %L) $$, current_setting('test.band'), current_setting('test.adm')),
  'P0001', 'forbidden', 'transfer_ownership: an admin → forbidden');
select tests.authenticate_as('p6-own@test.com');
select throws_ok(format($$ SELECT public.transfer_ownership(%L, %L) $$, current_setting('test.band'), current_setting('test.out')),
  'P0001', 'not_found', 'transfer_ownership: to someone not in the band → not_found');
select throws_ok(format($$ SELECT public.transfer_ownership(%L, %L) $$, current_setting('test.band'), current_setting('test.own')),
  'P0001', 'not_found', 'transfer_ownership: to yourself → not_found');
select is((SELECT role FROM public.band_memberships
            WHERE band_id = current_setting('test.band')::uuid AND user_id = current_setting('test.own')::uuid),
  'owner', 'transfer_ownership: a refused transfer changes nothing (atomic)');
select is((SELECT role FROM public.transfer_ownership(current_setting('test.band')::uuid, current_setting('test.adm')::uuid)),
  'owner', 'transfer_ownership: the new owner');
select is((SELECT string_agg(role || '=' || CASE user_id::text WHEN current_setting('test.own') THEN 'own'
                                              WHEN current_setting('test.adm') THEN 'adm' ELSE 'x' END, ',' ORDER BY role)
             FROM public.band_memberships
            WHERE band_id = current_setting('test.band')::uuid AND role IN ('owner', 'admin') AND status = 'active'),
  'admin=own,owner=adm', 'transfer_ownership: the old owner is an admin; exactly one owner');
select throws_ok(format($$ SELECT public.transfer_ownership(%L, %L) $$, current_setting('test.band'), current_setting('test.mem')),
  'P0001', 'forbidden', 'transfer_ownership: the old owner can''t transfer again');

-- ── update_band_profile ─────────────────────────────────────────────────────
select tests.authenticate_as('p6-own@test.com');  -- an admin now
select is((SELECT city || '|' || array_to_string(genres, ',') || '|' || jsonb_array_length(links) || '|' || (mark->>'color')
             FROM public.update_band_profile(current_setting('test.band')::uuid,
               p_city => ' Seattle ', p_genres => ARRAY[' Punk', 'Grunge', 'punk', ''],
               p_links => '[{"label":"Site","url":"https://phasesix.example"}]',
               p_mark => '{"kind":"initials","color":"plum"}')),
  'Seattle|Punk,Grunge|1|plum', 'update_band_profile: an admin edits city, genres (trimmed, deduped, in order), links, mark');
select is((SELECT COALESCE(city, '∅') || '|' || name || '|' || (mark->>'initials')
             FROM public.update_band_profile(current_setting('test.band')::uuid, p_city => '')),
  '∅|Phase Six|PS', 'update_band_profile: '''' clears, NULL leaves alone');
select throws_ok(format($$ SELECT public.update_band_profile(%L, p_name => '') $$, current_setting('test.band')),
  'P0001', 'invalid_name', 'update_band_profile: a blank name → invalid_name');
select throws_ok(format($$ SELECT public.update_band_profile(%L, p_links => '[{"label":"x"}]') $$, current_setting('test.band')),
  'P0001', 'invalid_links', 'update_band_profile: a link with no url → invalid_links');
select throws_ok(format($$ SELECT public.update_band_profile(%L, p_mark => '"red"') $$, current_setting('test.band')),
  'P0001', 'invalid_mark', 'update_band_profile: a bad mark → invalid_mark');
select tests.authenticate_as('p6-mem@test.com');
select throws_ok(format($$ SELECT public.update_band_profile(%L, p_city => 'X') $$, current_setting('test.band')),
  'P0001', 'forbidden', 'update_band_profile: a member → forbidden');

-- ── leave_band ──────────────────────────────────────────────────────────────
select tests.authenticate_as('p6-adm@test.com');  -- the owner now
select throws_ok(format($$ SELECT public.leave_band(%L) $$, current_setting('test.band')),
  'P0001', 'owner_must_transfer', 'leave_band: the owner → owner_must_transfer');
select tests.authenticate_as('p6-mem2@test.com');
select is((SELECT status FROM public.leave_band(current_setting('test.band')::uuid)), 'inactive',
  'leave_band: a member leaves');
select throws_ok(format($$ SELECT public.leave_band(%L) $$, current_setting('test.band')),
  'P0001', 'forbidden', 'leave_band: not in the band → forbidden');
select tests.authenticate_as('p6-solo@test.com');
DO $$ BEGIN
  PERFORM set_config('test.soloband', (SELECT id::text FROM public.create_band('Just Me')), true);
END $$;
select throws_ok(format($$ SELECT public.leave_band(%L) $$, current_setting('test.soloband')),
  'P0001', 'owner_must_delete', 'leave_band: a sole owner → owner_must_delete');

-- ── delete_band ─────────────────────────────────────────────────────────────
select tests.authenticate_as('p6-own@test.com');  -- an admin
select throws_ok(format($$ SELECT public.delete_band(%L, 'Phase Six') $$, current_setting('test.band')),
  'P0001', 'forbidden', 'delete_band: an admin → forbidden');
select tests.authenticate_as('p6-adm@test.com');
select throws_ok(format($$ SELECT public.delete_band(%L, 'Phase 6') $$, current_setting('test.band')),
  'P0001', 'confirm_mismatch', 'delete_band: the wrong name → confirm_mismatch');
select ok((SELECT deleted_at IS NOT NULL FROM public.delete_band(current_setting('test.band')::uuid, '  phase six ')),
  'delete_band: the owner deletes with the typed name (any case)');
select is((SELECT count(*)::int FROM public.bands WHERE id = current_setting('test.band')::uuid), 0,
  'delete_band: the band can''t be read any more');
select is((SELECT count(*)::int FROM public.list_my_contexts() WHERE band_id = current_setting('test.band')::uuid), 0,
  'delete_band: gone from list_my_contexts');
select throws_ok(format($$ SELECT public.regenerate_invite_code(%L) $$, current_setting('test.band')),
  'P0001', 'not_found', 'delete_band: no more codes for a deleted band');
select tests.authenticate_as('p6-mem@test.com');
select ok(NOT public.is_band_member(current_setting('test.band')::uuid, current_setting('test.mem')::uuid),
  'delete_band: members lose access');
select tests.authenticate_as('p6-out@test.com');
select throws_ok(format($$ SELECT * FROM public.band_preview_by_code(%L) $$, current_setting('test.code3')),
  'P0001', 'invite_invalid', 'delete_band: its live code stops previewing');
reset role;
select is((SELECT count(*)::int FROM public.bands WHERE id = current_setting('test.band')::uuid AND deleted_at IS NOT NULL), 1,
  'delete_band: soft (the row stays)');

-- ── ensure_my_profile ───────────────────────────────────────────────────────
DELETE FROM public.user_profiles WHERE user_id IN (current_setting('test.snd')::uuid, current_setting('test.stg')::uuid);
select tests.authenticate_as('p6-snd@test.com');
select ok((SELECT friend_code IS NOT NULL AND user_id = current_setting('test.snd')::uuid FROM public.ensure_my_profile()),
  'ensure_my_profile: creates the missing row with a friend code');
select is((SELECT count(*)::int FROM public.user_profiles WHERE user_id = current_setting('test.snd')::uuid), 1,
  'ensure_my_profile: one row');
select is((SELECT id FROM public.ensure_my_profile()), (SELECT id FROM public.user_profiles WHERE user_id = current_setting('test.snd')::uuid),
  'ensure_my_profile: a second call returns the same row');
select has_column('public', 'user_profiles', 'personal_color', 'user_profiles.personal_color exists');

-- ── send_friend_request / find_people ───────────────────────────────────────
reset role;
INSERT INTO public.user_profiles (user_id) SELECT id FROM public.users
 WHERE id IN (current_setting('test.evr')::uuid, current_setting('test.fof')::uuid, current_setting('test.cod')::uuid,
              current_setting('test.mut')::uuid, current_setting('test.stg')::uuid)
ON CONFLICT (user_id) DO NOTHING;
UPDATE public.user_profiles SET friend_request_policy = 'everyone', discoverable = true,
       instruments = '{Guitar,Vocals}', personal_color = 'teal' WHERE user_id = current_setting('test.evr')::uuid;
UPDATE public.user_profiles SET friend_request_policy = 'friends_of_friends', discoverable = true
 WHERE user_id = current_setting('test.fof')::uuid;
UPDATE public.user_profiles SET friend_request_policy = 'code_only', friend_code = 'CODEONLY'
 WHERE user_id = current_setting('test.cod')::uuid;
INSERT INTO public.friendships (user_a, user_b) VALUES
  (LEAST(current_setting('test.snd')::uuid, current_setting('test.mut')::uuid), GREATEST(current_setting('test.snd')::uuid, current_setting('test.mut')::uuid)),
  (LEAST(current_setting('test.fof')::uuid, current_setting('test.mut')::uuid), GREATEST(current_setting('test.fof')::uuid, current_setting('test.mut')::uuid));

select tests.authenticate_as('p6-snd@test.com');
select is((SELECT status FROM public.send_friend_request(current_setting('test.evr')::uuid)), 'pending',
  'send_friend_request: to someone taking requests from everyone');
select throws_ok(format($$ SELECT public.send_friend_request(%L) $$, current_setting('test.evr')),
  'P0001', 'request_pending', 'send_friend_request: twice → request_pending');
select throws_ok(format($$ SELECT public.send_friend_request(%L) $$, current_setting('test.cod')),
  'P0001', 'requests_closed', 'send_friend_request: code only, without the code → requests_closed');
select throws_ok(format($$ SELECT public.send_friend_request(%L, 'WRONG123') $$, current_setting('test.cod')),
  'P0001', 'not_found', 'send_friend_request: the wrong code → not_found');
select is((SELECT addressee_id FROM public.send_friend_request(p_code => ' codeonly ')), current_setting('test.cod')::uuid,
  'send_friend_request: code only, with the code (no user id needed)');
select is((SELECT status FROM public.send_friend_request(current_setting('test.fof')::uuid)), 'pending',
  'send_friend_request: friends of friends, with a friend in common');
select throws_ok(format($$ SELECT public.send_friend_request(%L) $$, current_setting('test.mut')),
  'P0001', 'already_friends', 'send_friend_request: an existing friend → already_friends');
select throws_ok(format($$ SELECT public.send_friend_request(p_code => %L) $$,
    (SELECT friend_code FROM public.user_profiles WHERE user_id = current_setting('test.snd')::uuid)),
  'P0001', 'cannot_friend_self', 'send_friend_request: your own code → cannot_friend_self');
select throws_ok($$ SELECT public.send_friend_request('6b000000-0000-4000-8000-00000000dead') $$,
  'P0001', 'not_found', 'send_friend_request: an unknown person → not_found');
select throws_ok($$ SELECT public.send_friend_request() $$,
  'P0001', 'not_found', 'send_friend_request: nobody named → not_found');
select throws_ok(format($$ INSERT INTO public.friend_requests (requester_id, addressee_id) VALUES (%L, %L) $$,
    current_setting('test.snd'), current_setting('test.stg')),
  '42501', NULL, 'policy: no direct friend request inserts (the policy can''t be skipped)');
select lives_ok(format($$ UPDATE public.friend_requests SET status = 'accepted' WHERE addressee_id = %L $$, current_setting('test.cod')),
  'policy: the sender''s own accept runs…');
select is((SELECT status FROM public.friend_requests
            WHERE requester_id = current_setting('test.snd')::uuid AND addressee_id = current_setting('test.cod')::uuid),
  'pending', 'policy: …but can''t accept their own request');
select is((SELECT name || '|' || array_to_string(instruments, ',') || '|' || personal_color || '|' || mutual_count
             FROM public.find_people('p6-evr')),
  'p6-evr|Guitar,Vocals|teal|0', 'find_people: name, ordered instruments, colour, mutual count');
select is((SELECT mutual_count FROM public.find_people('p6-fof')), 1, 'find_people: counts shared friends');
select is((SELECT count(*)::int FROM public.find_people('p6-cod')), 0, 'find_people: not findable → not listed');
select is((SELECT count(*)::int FROM public.find_people('p6-snd')), 0, 'find_people: never yourself');
select is((SELECT count(*)::int FROM public.find_people('p')), 0, 'find_people: under 2 characters → nothing');

select tests.authenticate_as('p6-stg@test.com');
select throws_ok(format($$ SELECT public.send_friend_request(%L) $$, current_setting('test.fof')),
  'P0001', 'requests_closed', 'send_friend_request: friends of friends, nobody in common → requests_closed');
select tests.authenticate_as('p6-cod@test.com');
select lives_ok(format($$ UPDATE public.friend_requests SET status = 'accepted' WHERE requester_id = %L $$, current_setting('test.snd')),
  'policy: the addressee accepts');
select ok(public.are_friends(current_setting('test.snd')::uuid, current_setting('test.cod')::uuid),
  'policy: accepting makes the friendship');
select tests.authenticate_as('p6-evr@test.com');
select is((SELECT status FROM public.send_friend_request(current_setting('test.snd')::uuid)), 'accepted',
  'send_friend_request: to someone who already asked you → accepts theirs');
select ok(public.are_friends(current_setting('test.snd')::uuid, current_setting('test.evr')::uuid),
  'send_friend_request: …and you''re friends');
reset role;
UPDATE public.friend_requests SET status = 'declined'
 WHERE requester_id = current_setting('test.snd')::uuid AND addressee_id = current_setting('test.fof')::uuid;
select tests.authenticate_as('p6-snd@test.com');
select is((SELECT status FROM public.send_friend_request(current_setting('test.fof')::uuid)), 'pending',
  'send_friend_request: re-opens a declined request');

-- ── delete_account ──────────────────────────────────────────────────────────
select tests.authenticate_as('p6-delown@test.com');
DO $$ BEGIN
  PERFORM set_config('test.delband', (SELECT id::text FROM public.create_band('Keep Band')), true);
  PERFORM set_config('test.delcode', (SELECT code FROM public.invite_codes
    WHERE band_id = current_setting('test.delband')::uuid AND is_active), true);
END $$;
select throws_ok($$ SELECT public.delete_account() $$, 'P0001', 'owns_band',
  'delete_account: refused while you own a band');
select tests.authenticate_as('p6-del@test.com');
select lives_ok(format($$ SELECT public.join_band(%L) $$, current_setting('test.delcode')), 'delete_account: fixture join');
select tests.authenticate_as('p6-delmate@test.com');
select lives_ok(format($$ SELECT public.join_band(%L) $$, current_setting('test.delcode')), 'delete_account: fixture join 2');

-- Content made by `del` (claims set, RLS bypassed): band song / setlist / show /
-- tuning, and the same in their personal context; plus a friendship + prefs.
select tests.authenticate_as('p6-del@test.com');
reset role;
INSERT INTO public.songs (id, title, context_type, context_id, created_by) VALUES
  ('6b000000-0000-4000-8000-0000000000d1', 'Band Song', 'band', current_setting('test.delband'), current_setting('test.del')::uuid),
  ('6b000000-0000-4000-8000-0000000000d2', 'My Song', 'personal', current_setting('test.del'), current_setting('test.del')::uuid);
UPDATE public.songs SET notes = 'edited by del' WHERE id = '6b000000-0000-4000-8000-0000000000d1';
INSERT INTO public.setlists (id, name, band_id, context_type, context_id, created_by) VALUES
  ('6b000000-0000-4000-8000-0000000000d3', 'Band Set', current_setting('test.delband')::uuid, 'band', current_setting('test.delband'), current_setting('test.del')::uuid),
  ('6b000000-0000-4000-8000-0000000000d4', 'My Set', NULL, 'personal', current_setting('test.del'), current_setting('test.del')::uuid);
INSERT INTO public.shows (id, name, band_id, scheduled_date, created_by) VALUES
  ('6b000000-0000-4000-8000-0000000000d5', 'Band Show', current_setting('test.delband')::uuid, now() + interval '3 days', current_setting('test.del')::uuid);
INSERT INTO public.tunings (id, instrument, string_count, pitches, name, is_builtin, context_type, context_id, created_by) VALUES
  ('6b000000-0000-4000-8000-0000000000d6', 'guitar', 6, '{38,45,50,55,59,62}', 'Band Open', false, 'band', current_setting('test.delband'), current_setting('test.del')::uuid),
  ('6b000000-0000-4000-8000-0000000000d7', 'guitar', 6, '{38,45,50,55,59,63}', 'My Odd', false, 'personal', current_setting('test.del'), current_setting('test.del')::uuid);
INSERT INTO public.user_preferences (user_id) VALUES (current_setting('test.del')::uuid) ON CONFLICT DO NOTHING;
INSERT INTO public.user_profiles (user_id) VALUES (current_setting('test.del')::uuid) ON CONFLICT DO NOTHING;
INSERT INTO public.friendships (user_a, user_b) VALUES
  (LEAST(current_setting('test.del')::uuid, current_setting('test.mut')::uuid), GREATEST(current_setting('test.del')::uuid, current_setting('test.mut')::uuid));
INSERT INTO public.friend_requests (requester_id, addressee_id) VALUES (current_setting('test.del')::uuid, current_setting('test.evr')::uuid);
INSERT INTO public.song_note_entries (id, song_id, user_id, band_id, content, visibility) VALUES
  ('6b000000-0000-4000-8000-0000000000e1', '6b000000-0000-4000-8000-0000000000d1', current_setting('test.del')::uuid, current_setting('test.delband')::uuid, 'band note', 'band'),
  ('6b000000-0000-4000-8000-0000000000e2', '6b000000-0000-4000-8000-0000000000d1', current_setting('test.del')::uuid, current_setting('test.delband')::uuid, 'my note', 'personal');
INSERT INTO public.events (id, host_user_id, band_id, name, scheduled_date) VALUES
  ('6b000000-0000-4000-8000-0000000000e3', current_setting('test.del')::uuid, current_setting('test.delband')::uuid, 'Band Jam Night', now() + interval '5 days'),
  ('6b000000-0000-4000-8000-0000000000e4', current_setting('test.del')::uuid, NULL, 'My Open Mic', now() + interval '6 days');
select ok((SELECT count(*) > 0 FROM public.audit_log WHERE user_id = current_setting('test.del')::uuid),
  'delete_account: fixture has audit rows by the user');

select tests.authenticate_as('p6-del@test.com');
select lives_ok($$ SELECT public.delete_account() $$, 'delete_account: a member deletes their account');
reset role;
select is((SELECT count(*)::int FROM public.users WHERE id = current_setting('test.del')::uuid), 0,
  'delete_account: the public.users row is gone');
select is((SELECT count(*)::int FROM public.songs WHERE id = '6b000000-0000-4000-8000-0000000000d2')
          + (SELECT count(*)::int FROM public.setlists WHERE id = '6b000000-0000-4000-8000-0000000000d4')
          + (SELECT count(*)::int FROM public.tunings WHERE id = '6b000000-0000-4000-8000-0000000000d7'), 0,
  'delete_account: personal songs, setlists and tunings are gone');
select is((SELECT count(*)::int FROM public.songs WHERE id = '6b000000-0000-4000-8000-0000000000d1'
             AND created_by IS NULL AND last_modified_by IS NULL), 1,
  'delete_account: the band song stays, creator NULL');
select is((SELECT count(*)::int FROM public.setlists WHERE id = '6b000000-0000-4000-8000-0000000000d3' AND created_by IS NULL)
          + (SELECT count(*)::int FROM public.shows WHERE id = '6b000000-0000-4000-8000-0000000000d5' AND created_by IS NULL)
          + (SELECT count(*)::int FROM public.tunings WHERE id = '6b000000-0000-4000-8000-0000000000d6' AND created_by IS NULL), 3,
  'delete_account: band setlist, show and tuning stay, creator NULL');
select is((SELECT count(*)::int FROM public.user_profiles WHERE user_id = current_setting('test.del')::uuid)
          + (SELECT count(*)::int FROM public.user_preferences WHERE user_id = current_setting('test.del')::uuid)
          + (SELECT count(*)::int FROM public.band_memberships WHERE user_id = current_setting('test.del')::uuid)
          + (SELECT count(*)::int FROM public.friendships WHERE current_setting('test.del')::uuid IN (user_a, user_b))
          + (SELECT count(*)::int FROM public.friend_requests WHERE current_setting('test.del')::uuid IN (requester_id, addressee_id)), 0,
  'delete_account: profile, preferences, memberships, friendships and requests are gone');
select is((SELECT count(*)::int FROM public.song_note_entries WHERE id = '6b000000-0000-4000-8000-0000000000e1' AND user_id IS NULL)
          + (SELECT count(*)::int FROM public.song_note_entries WHERE id = '6b000000-0000-4000-8000-0000000000e2'), 1,
  'delete_account: band notes stay (author NULL), personal notes go');
select is((SELECT count(*)::int FROM public.events WHERE id = '6b000000-0000-4000-8000-0000000000e3'
             AND host_user_id = (SELECT id FROM public.users WHERE email = 'p6-delown@test.com'))
          + (SELECT count(*)::int FROM public.events WHERE id = '6b000000-0000-4000-8000-0000000000e4'), 1,
  'delete_account: band events pass to the band owner, personal events go');
select ok((SELECT count(*) = 0 FROM public.audit_log WHERE user_id = current_setting('test.del')::uuid)
          AND (SELECT count(*) > 0 FROM public.audit_log WHERE user_name = 'Former member'),
  'delete_account: the audit trail keeps the rows as "Former member"');
select lives_ok(format($$ DELETE FROM auth.users WHERE id = %L $$, current_setting('test.del')),
  'delete_account: the edge function can then delete the auth user');
select tests.authenticate_as('p6-delmate@test.com');
select is((SELECT count(*)::int FROM public.songs WHERE id = '6b000000-0000-4000-8000-0000000000d1'), 1,
  'delete_account: bandmates still see the band song');
select lives_ok($$ UPDATE public.songs SET notes = 'still works' WHERE id = '6b000000-0000-4000-8000-0000000000d1' $$,
  'delete_account: bandmates can still edit it (audit trigger fine)');
select lives_ok($$ SELECT * FROM public.list_my_contexts() $$, 'delete_account: list_my_contexts still works');
reset role;
select is((SELECT count(*)::int FROM pg_constraint
            WHERE contype = 'f' AND confrelid = 'public.users'::regclass AND confdeltype NOT IN ('c', 'n')), 0,
  'delete_account: no FK to users can block the delete');

-- ── grants ──────────────────────────────────────────────────────────────────
select ok((SELECT bool_and(has_function_privilege('authenticated', f, 'execute') AND NOT has_function_privilege('anon', f, 'execute'))
             FROM unnest(ARRAY[
               'public.create_band(text, jsonb)', 'public.band_preview_by_code(text)', 'public.join_band(text)',
               'public.regenerate_invite_code(uuid)', 'public.set_member_role(uuid, uuid, text)',
               'public.remove_member(uuid, uuid)', 'public.transfer_ownership(uuid, uuid)', 'public.leave_band(uuid)',
               'public.delete_band(uuid, text)', 'public.update_band_profile(uuid, text, text, jsonb, text, text[], jsonb)',
               'public.send_friend_request(uuid, text)', 'public.find_people(text)', 'public.ensure_my_profile()',
               'public.delete_account()', 'public.list_my_contexts()']) f),
  'grants: the RPCs are for signed-in users only');
select ok((SELECT bool_and(NOT has_function_privilege('authenticated', f, 'execute'))
             FROM unnest(ARRAY['public._backfill_band_owners()', 'public._issue_invite_code(uuid)',
                               'public._band_by_code(text)', 'public._my_membership(uuid)']) f),
  'grants: the helpers aren''t callable by clients');

select * from finish();
rollback;
