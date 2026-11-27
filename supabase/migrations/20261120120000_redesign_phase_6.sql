-- ============================================================================
-- Redesign phase 6: account, band, friends (decisions: docs/DECISIONS.md)
--
-- Schema
--   band_memberships   'owner' role; backfill (decision Part A · 4); one active
--                      owner per band (partial unique index); the creator
--                      trigger inserts 'owner'. permissions[] mirrors the role.
--   bands              mark JSONB {kind, initials, symbol, color, lettering},
--                      city, genres, links, deleted_at (soft delete).
--   invite_codes       24 h, unlimited uses (decision 10); one active code per
--                      band (partial unique index). Defaults enforce both.
--   user_profiles      personal_color; instruments reordered primary-first;
--                      a row backfilled for every user that has none.
--   FKs to users       every NO ACTION FK to public.users becomes nullable +
--                      ON DELETE SET NULL (band content outlives its author,
--                      decision 8).
--
-- RPCs (SECURITY DEFINER, access checked in each)
--   create_band, band_preview_by_code, join_band, regenerate_invite_code,
--   set_member_role, remove_member, transfer_ownership, leave_band, delete_band,
--   update_band_profile, send_friend_request, find_people, ensure_my_profile,
--   delete_account. list_my_contexts now returns the band mark; get_user_emails
--   reads the role instead of the old permissions flag.
--
-- Policies (decision 13)
--   band_memberships   no client writes (insert_self, insert_by_creator,
--                      update_by_creator, delete_self_or_creator dropped);
--                      members still read.
--   invite_codes       open select dropped; a band's admins / owner read its codes.
--   friend_requests    no client insert (send_friend_request enforces the
--                      policy); only the addressee may update (accept).
--   bands              soft-deleted bands are not readable.
--
-- Delete account: what the `delete-account` edge function must do
--   1. Verify the caller's JWT (gateway JWT verification on).
--   2. Call `rpc('delete_account')` WITH THE CALLER'S JWT (not the service
--      role: the RPC acts on auth.uid()). If it raises `owns_band`, return that
--      error to the client unchanged and stop.
--   3. On success, with the service-role client, call
--      `auth.admin.deleteUser(<caller id>)` to remove the auth.users row (no
--      FK links it to public.users; nothing else deletes it).
--   4. Return 204. If step 3 fails the public data is already gone; retrying
--      step 3 alone is safe (step 2 refuses nothing for a user with no row).
--
-- No release_notes row: the redesign ships as one release (Phase 5 decision 3).
-- Idempotent.
-- ============================================================================

-- ── 1. Owner role ─────────────────────────────────────────────────────────────
ALTER TABLE public.band_memberships DROP CONSTRAINT IF EXISTS membership_role_check;
ALTER TABLE public.band_memberships ADD CONSTRAINT membership_role_check
  CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'member'::text, 'viewer'::text]));

-- Backfill, for each band with no active owner yet: holders of the old
-- 'owner' flag (earliest joined wins), else bands.created_by if still an active
-- member, else the earliest active admin, else the earliest active member.
-- Other flag holders become admins; permissions[] then mirrors the role
-- (nothing reads the flag any more). A function so pgTAP can run it on fixtures.
CREATE OR REPLACE FUNCTION public._backfill_band_owners()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT m.id,
           row_number() OVER (
             PARTITION BY m.band_id
             ORDER BY CASE
                        WHEN 'owner' = ANY (COALESCE(m.permissions, '{}')) THEN 0
                        WHEN m.user_id = b.created_by THEN 1
                        WHEN m.role = 'admin' THEN 2
                        ELSE 3
                      END,
                      m.joined_date, m.id
           ) AS rn
      FROM public.band_memberships m
      JOIN public.bands b ON b.id = m.band_id
     WHERE m.status = 'active'
       AND NOT EXISTS (SELECT 1 FROM public.band_memberships o
                        WHERE o.band_id = m.band_id AND o.role = 'owner' AND o.status = 'active')
  )
  UPDATE public.band_memberships m SET role = 'owner'
    FROM ranked r
   WHERE r.id = m.id AND r.rn = 1;

  UPDATE public.band_memberships SET role = 'admin'
   WHERE 'owner' = ANY (COALESCE(permissions, '{}')) AND role NOT IN ('owner', 'admin');

  UPDATE public.band_memberships SET permissions = ARRAY[role]
   WHERE permissions IS DISTINCT FROM ARRAY[role];
$$;

SELECT public._backfill_band_owners();

CREATE UNIQUE INDEX IF NOT EXISTS band_memberships_one_owner
  ON public.band_memberships (band_id) WHERE role = 'owner' AND status = 'active';

-- The creator of a band is its owner.
CREATE OR REPLACE FUNCTION public.auto_add_band_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date, permissions)
    VALUES (v_user_id, NEW.id, 'owner', 'active', now(), ARRAY['owner'])
    ON CONFLICT (user_id, band_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Emails: your own, or all your bandmates' if you're an admin or the owner.
CREATE OR REPLACE FUNCTION public.get_user_emails(p_user_ids UUID[])
RETURNS TABLE (user_id UUID, email TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email
  FROM public.users u
  WHERE u.id = ANY(p_user_ids)
    AND (
      u.id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.band_memberships me
        JOIN public.band_memberships them ON them.band_id = me.band_id
        WHERE me.user_id = (SELECT auth.uid())
          AND them.user_id = u.id
          AND me.status = 'active'
          AND them.status = 'active'
          AND me.role IN ('owner', 'admin')
      )
    );
$$;

-- ── 2. Bands: mark, profile, soft delete ──────────────────────────────────────
ALTER TABLE public.bands ADD COLUMN IF NOT EXISTS mark JSONB NOT NULL
  DEFAULT '{"kind":"initials","initials":null,"symbol":null,"color":"orange","lettering":null}'::jsonb;
ALTER TABLE public.bands ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.bands ADD COLUMN IF NOT EXISTS genres TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.bands ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.bands ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Initials from a name: the first letters of the first two words, else the
-- first two letters ("Demo Band" → "DB", "Nirvana" → "NI").
CREATE OR REPLACE FUNCTION public._band_initials(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT upper(CASE
    WHEN array_length(w, 1) >= 2 THEN left(w[1], 1) || left(w[2], 1)
    ELSE left(COALESCE(w[1], ''), 2)
  END)
  FROM (SELECT regexp_split_to_array(btrim(regexp_replace(COALESCE(p_name, ''), '[^[:alnum:][:space:]]', '', 'g')), '\s+') AS w) x;
$$;

UPDATE public.bands SET mark = jsonb_set(mark, '{initials}', to_jsonb(public._band_initials(name)))
 WHERE mark->>'initials' IS NULL;

-- A mark as the client sent it → the stored shape, or invalid_mark.
CREATE OR REPLACE FUNCTION public._check_mark(p_mark JSONB, p_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_kind     TEXT := COALESCE(p_mark->>'kind', 'initials');
  v_initials TEXT := upper(btrim(COALESCE(p_mark->>'initials', '')));
  v_symbol   TEXT := NULLIF(btrim(COALESCE(p_mark->>'symbol', '')), '');
  v_color    TEXT := NULLIF(btrim(COALESCE(p_mark->>'color', '')), '');
  v_letter   TEXT := NULLIF(btrim(COALESCE(p_mark->>'lettering', '')), '');
BEGIN
  IF p_mark IS NOT NULL AND jsonb_typeof(p_mark) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_mark', HINT = 'Pick a mark.';
  END IF;
  IF v_initials = '' THEN v_initials := public._band_initials(p_name); END IF;
  IF v_kind NOT IN ('initials', 'symbol')
     OR char_length(v_initials) > 3
     OR (v_kind = 'symbol' AND v_symbol IS NULL)
     OR char_length(COALESCE(v_color, '')) > 32
     OR char_length(COALESCE(v_letter, '')) > 32
     OR char_length(COALESCE(v_symbol, '')) > 32 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_mark', HINT = 'Pick a mark.';
  END IF;
  RETURN jsonb_build_object('kind', v_kind, 'initials', v_initials, 'symbol', v_symbol,
                            'color', COALESCE(v_color, 'orange'), 'lettering', v_letter);
END;
$$;

-- Soft-deleted bands are not readable (delete_band also deactivates every
-- membership, so is_band_member and every band-scoped read drop it too).
DROP POLICY IF EXISTS "bands_select_members_or_creator" ON public.bands;
CREATE POLICY "bands_select_members_or_creator" ON public.bands FOR SELECT TO authenticated
  USING (deleted_at IS NULL
         AND (public.is_band_member(id, (SELECT auth.uid())) OR created_by = (SELECT auth.uid())));

-- Admins may still update bands directly (name / description / settings), but
-- only delete_band soft-deletes: a direct write of deleted_at is refused.
CREATE OR REPLACE FUNCTION public.bands_guard_deleted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Inside the SECURITY DEFINER RPCs current_user is their owner, not a client role.
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'Delete the band from its page.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS bands_guard_deleted_at ON public.bands;
CREATE TRIGGER bands_guard_deleted_at BEFORE UPDATE ON public.bands
  FOR EACH ROW EXECUTE FUNCTION public.bands_guard_deleted_at();

-- Personal + each band, now with the band's mark. (Return type changed → drop.)
DROP FUNCTION IF EXISTS public.list_my_contexts();
CREATE FUNCTION public.list_my_contexts()
RETURNS TABLE (band_id UUID, name TEXT, role TEXT, member_count INT, has_unread BOOLEAN, mark JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH seen AS (
    SELECT COALESCE(
      (SELECT notifications_seen_at FROM public.user_preferences WHERE user_id = auth.uid()),
      '-infinity'::timestamptz) AS at
  ), act AS (
    SELECT DISTINCT x.band_id FROM public._band_activity(auth.uid()) x, seen
     WHERE x.created_at > seen.at
  )
  SELECT b.id, b.name, m.role,
         (SELECT count(*)::int FROM public.band_memberships mm
           WHERE mm.band_id = b.id AND mm.status = 'active'),
         EXISTS (SELECT 1 FROM act WHERE act.band_id = b.id),
         b.mark
    FROM public.band_memberships m
    JOIN public.bands b ON b.id = m.band_id
   WHERE m.user_id = auth.uid() AND m.status = 'active' AND b.deleted_at IS NULL
   ORDER BY lower(b.name);
$$;

-- ── 3. Invite codes: 24 h, unlimited, one active per band ─────────────────────
ALTER TABLE public.invite_codes ALTER COLUMN max_uses DROP DEFAULT;
ALTER TABLE public.invite_codes ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- Keep each band's newest active code (with a fresh 24 h so shared links keep
-- working through the release); retire the rest.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY band_id ORDER BY created_date DESC, id) AS rn
    FROM public.invite_codes WHERE is_active
)
UPDATE public.invite_codes c SET is_active = false
  FROM ranked r WHERE r.id = c.id AND r.rn > 1;
UPDATE public.invite_codes
   SET max_uses = NULL,
       expires_at = GREATEST(COALESCE(expires_at, now()), now() + interval '24 hours')
 WHERE is_active AND (max_uses IS NOT NULL OR expires_at IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS invite_codes_one_active_per_band
  ON public.invite_codes (band_id) WHERE is_active;

DROP POLICY IF EXISTS "invite_codes_select_authenticated" ON public.invite_codes;
DROP POLICY IF EXISTS "invite_codes_select_admin" ON public.invite_codes;
CREATE POLICY "invite_codes_select_admin" ON public.invite_codes FOR SELECT TO authenticated
  USING (public.is_band_admin(band_id, (SELECT auth.uid())));

-- A fresh, unused code (same alphabet + length as friend codes).
CREATE OR REPLACE FUNCTION public._new_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := public.gen_friend_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Deactivate the band's codes and issue a new one (caller already checked).
CREATE OR REPLACE FUNCTION public._issue_invite_code(p_band_id UUID)
RETURNS public.invite_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.invite_codes;
BEGIN
  UPDATE public.invite_codes SET is_active = false WHERE band_id = p_band_id AND is_active;
  INSERT INTO public.invite_codes (band_id, code, created_by, created_date, expires_at, max_uses, is_active)
  VALUES (p_band_id, public._new_invite_code(), auth.uid(), now(), now() + interval '24 hours', NULL, true)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- The active band behind a code, or invite_invalid (one key for every reason).
CREATE OR REPLACE FUNCTION public._band_by_code(p_code TEXT)
RETURNS public.bands
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_band public.bands;
BEGIN
  SELECT b.* INTO v_band
    FROM public.invite_codes c
    JOIN public.bands b ON b.id = c.band_id
   WHERE c.code = upper(btrim(COALESCE(p_code, '')))
     AND c.is_active
     AND c.expires_at > now()
     AND (c.max_uses IS NULL OR c.current_uses < c.max_uses)
     AND b.deleted_at IS NULL;
  IF v_band.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invite_invalid',
      HINT = 'That code isn''t valid any more. Ask for a new link.';
  END IF;
  RETURN v_band;
END;
$$;

-- ── 4. Profiles ───────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS personal_color TEXT;

-- Ordered instruments: the primary first, no duplicates. primary_instrument is
-- kept but no longer read.
UPDATE public.user_profiles up
   SET instruments = x.ordered
  FROM (
    SELECT p.id,
           ARRAY(SELECT i FROM (
                   SELECT i, min(ord) AS ord FROM unnest(
                     CASE WHEN NULLIF(btrim(p.primary_instrument), '') IS NOT NULL
                          THEN ARRAY[btrim(p.primary_instrument)] || COALESCE(p.instruments, '{}')
                          ELSE COALESCE(p.instruments, '{}') END
                   ) WITH ORDINALITY AS t(i, ord)
                   WHERE NULLIF(btrim(i), '') IS NOT NULL
                   GROUP BY i) d
                 ORDER BY d.ord) AS ordered
      FROM public.user_profiles p
  ) x
 WHERE x.id = up.id AND up.instruments IS DISTINCT FROM x.ordered;

-- Every user gets a profile row (the app never inserted them; saves used .update()).
INSERT INTO public.user_profiles (user_id)
SELECT u.id FROM public.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- The caller's profile, created if missing (with a friend code).
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.user_profiles;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  INSERT INTO public.user_profiles (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO UPDATE
    SET friend_code = COALESCE(public.user_profiles.friend_code, public.gen_friend_code())
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- ── 5. Membership policies: reads only, writes through the RPCs ────────────────
DROP POLICY IF EXISTS "memberships_insert_self" ON public.band_memberships;
DROP POLICY IF EXISTS "memberships_insert_by_creator" ON public.band_memberships;
DROP POLICY IF EXISTS "memberships_update_by_creator" ON public.band_memberships;
DROP POLICY IF EXISTS "memberships_delete_self_or_creator" ON public.band_memberships;

-- ── 6. Band RPCs ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._require_signed_in()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  RETURN auth.uid();
END;
$$;

-- The caller's active membership in a live band, or not_found / forbidden.
CREATE OR REPLACE FUNCTION public._my_membership(p_band_id UUID)
RETURNS public.band_memberships
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._require_signed_in();
  v_m   public.band_memberships;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.bands WHERE id = p_band_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'That band isn''t here any more.';
  END IF;
  SELECT * INTO v_m FROM public.band_memberships
   WHERE band_id = p_band_id AND user_id = v_uid AND status = 'active';
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  RETURN v_m;
END;
$$;

CREATE OR REPLACE FUNCTION public._check_band_name(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_name',
      HINT = 'Give the band a name.';
  END IF;
  RETURN btrim(p_name);
END;
$$;

-- create_band: the band, the caller as owner (creator trigger), a fresh code.
CREATE OR REPLACE FUNCTION public.create_band(p_name TEXT, p_mark JSONB DEFAULT NULL)
RETURNS public.bands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := public._require_signed_in();
  v_name TEXT := public._check_band_name(p_name);
  v_band public.bands;
BEGIN
  INSERT INTO public.bands (name, created_by, mark)
  VALUES (v_name, v_uid, public._check_mark(p_mark, v_name))
  RETURNING * INTO v_band;
  PERFORM public._issue_invite_code(v_band.id);
  RETURN v_band;
END;
$$;

-- band_preview_by_code: what the join screen shows. Bad, expired, regenerated
-- or deleted → invite_invalid, revealing nothing.
CREATE OR REPLACE FUNCTION public.band_preview_by_code(p_code TEXT)
RETURNS TABLE (
  name               TEXT,
  mark               JSONB,
  description        TEXT,
  member_first_names TEXT[],
  member_count       INT,
  song_count         INT,
  is_member          BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := public._require_signed_in();
  v_band public.bands := public._band_by_code(p_code);
BEGIN
  RETURN QUERY
  SELECT v_band.name, v_band.mark, v_band.description,
         ARRAY(SELECT split_part(btrim(COALESCE(NULLIF(btrim(up.display_name), ''), u.name)), ' ', 1)
                 FROM public.band_memberships m
                 JOIN public.users u ON u.id = m.user_id
                 LEFT JOIN public.user_profiles up ON up.user_id = m.user_id
                WHERE m.band_id = v_band.id AND m.status = 'active'
                ORDER BY (m.role = 'owner') DESC, m.joined_date),
         (SELECT count(*)::int FROM public.band_memberships m
           WHERE m.band_id = v_band.id AND m.status = 'active'),
         (SELECT count(*)::int FROM public.songs s
           WHERE s.context_type = 'band' AND s.context_id = v_band.id::text),
         public.is_band_member(v_band.id, v_uid);
END;
$$;

-- join_band: become a member through an active code (re-activates someone who left).
CREATE OR REPLACE FUNCTION public.join_band(p_code TEXT)
RETURNS public.band_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := public._require_signed_in();
  v_band public.bands := public._band_by_code(p_code);
  v_m    public.band_memberships;
BEGIN
  IF public.is_band_member(v_band.id, v_uid) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'already_member',
      HINT = format('You''re already in %s.', v_band.name);
  END IF;
  INSERT INTO public.band_memberships (user_id, band_id, role, status, joined_date, permissions)
  VALUES (v_uid, v_band.id, 'member', 'active', now(), ARRAY['member'])
  ON CONFLICT (user_id, band_id) DO UPDATE
    SET role = 'member', status = 'active', joined_date = now(), permissions = ARRAY['member']
  RETURNING * INTO v_m;
  UPDATE public.invite_codes SET current_uses = current_uses + 1
   WHERE code = upper(btrim(p_code));
  RETURN v_m;
END;
$$;

-- regenerate_invite_code: admin / owner; the old code stops working now.
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(p_band_id UUID)
RETURNS public.invite_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me public.band_memberships := public._my_membership(p_band_id);
BEGIN
  IF v_me.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  RETURN public._issue_invite_code(p_band_id);
END;
$$;

-- The target's active membership, locked, or not_found.
CREATE OR REPLACE FUNCTION public._member_for_update(p_band_id UUID, p_user_id UUID)
RETURNS public.band_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_m public.band_memberships;
BEGIN
  SELECT * INTO v_m FROM public.band_memberships
   WHERE band_id = p_band_id AND user_id = p_user_id AND status = 'active'
   FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'They''re not in this band.';
  END IF;
  RETURN v_m;
END;
$$;

-- set_member_role: admin ↔ member. Owner / admins may promote members; only the
-- owner changes an admin. The owner's role changes only by transfer.
CREATE OR REPLACE FUNCTION public.set_member_role(p_band_id UUID, p_user_id UUID, p_role TEXT)
RETURNS public.band_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     public.band_memberships := public._my_membership(p_band_id);
  v_target public.band_memberships;
BEGIN
  IF p_role IS NULL OR p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_role',
      HINT = 'Pick admin or member.';
  END IF;
  IF v_me.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  v_target := public._member_for_update(p_band_id, p_user_id);
  IF v_target.role = 'owner' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_role_fixed',
      HINT = 'Transfer ownership to change the owner.';
  END IF;
  IF v_target.role = 'admin' AND v_me.role <> 'owner' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'Only the owner can change an admin.';
  END IF;
  UPDATE public.band_memberships SET role = p_role, permissions = ARRAY[p_role]
   WHERE id = v_target.id
  RETURNING * INTO v_target;
  RETURN v_target;
END;
$$;

-- remove_member: owner / admin. Never the owner; only the owner removes an admin.
CREATE OR REPLACE FUNCTION public.remove_member(p_band_id UUID, p_user_id UUID)
RETURNS public.band_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     public.band_memberships := public._my_membership(p_band_id);
  v_target public.band_memberships;
  v_name   TEXT;
BEGIN
  IF v_me.role NOT IN ('owner', 'admin') OR p_user_id = v_me.user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  v_target := public._member_for_update(p_band_id, p_user_id);
  IF v_target.role = 'owner' THEN
    SELECT name INTO v_name FROM public.users WHERE id = p_user_id;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'cannot_remove_owner',
      HINT = format('Transfer ownership before removing %s.', COALESCE(v_name, 'them'));
  END IF;
  IF v_target.role = 'admin' AND v_me.role <> 'owner' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'Only the owner can remove an admin.';
  END IF;
  UPDATE public.band_memberships SET status = 'inactive' WHERE id = v_target.id
  RETURNING * INTO v_target;
  RETURN v_target;
END;
$$;

-- transfer_ownership: owner only, one step: old owner → admin, new → owner.
-- Returns the new owner's membership.
CREATE OR REPLACE FUNCTION public.transfer_ownership(p_band_id UUID, p_user_id UUID)
RETURNS public.band_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     public.band_memberships := public._my_membership(p_band_id);
  v_target public.band_memberships;
BEGIN
  IF v_me.role <> 'owner' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'Only the owner can transfer the band.';
  END IF;
  IF p_user_id = v_me.user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'Pick another member.';
  END IF;
  -- Lock both rows; demote first so the one-owner index holds at every step.
  PERFORM 1 FROM public.band_memberships WHERE id = v_me.id FOR UPDATE;
  v_target := public._member_for_update(p_band_id, p_user_id);
  UPDATE public.band_memberships SET role = 'admin', permissions = ARRAY['admin']
   WHERE id = v_me.id;
  UPDATE public.band_memberships SET role = 'owner', permissions = ARRAY['owner']
   WHERE id = v_target.id
  RETURNING * INTO v_target;
  RETURN v_target;
END;
$$;

-- leave_band: any member but the owner (transfer first; alone → delete the band).
CREATE OR REPLACE FUNCTION public.leave_band(p_band_id UUID)
RETURNS public.band_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   public.band_memberships := public._my_membership(p_band_id);
  v_name TEXT;
BEGIN
  IF v_me.role = 'owner' THEN
    SELECT name INTO v_name FROM public.bands WHERE id = p_band_id;
    IF EXISTS (SELECT 1 FROM public.band_memberships
                WHERE band_id = p_band_id AND status = 'active' AND id <> v_me.id) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_must_transfer',
        HINT = format('You own %s. Transfer it first.', v_name);
    END IF;
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owner_must_delete',
      HINT = format('You''re the only one in %s. Delete the band instead.', v_name);
  END IF;
  UPDATE public.band_memberships SET status = 'inactive' WHERE id = v_me.id
  RETURNING * INTO v_me;
  RETURN v_me;
END;
$$;

-- delete_band: owner, typed name (trimmed, any case), soft. Members lose access
-- (memberships inactive, codes retired); songs already copied to My Songs stay.
CREATE OR REPLACE FUNCTION public.delete_band(p_band_id UUID, p_confirm_name TEXT)
RETURNS public.bands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   public.band_memberships := public._my_membership(p_band_id);
  v_band public.bands;
BEGIN
  IF v_me.role <> 'owner' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'Only the owner can delete the band.';
  END IF;
  SELECT * INTO v_band FROM public.bands WHERE id = p_band_id FOR UPDATE;
  IF lower(btrim(COALESCE(p_confirm_name, ''))) <> lower(btrim(v_band.name)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'confirm_mismatch',
      HINT = 'Type the band name to confirm.';
  END IF;
  UPDATE public.invite_codes SET is_active = false WHERE band_id = p_band_id AND is_active;
  UPDATE public.band_memberships SET status = 'inactive'
   WHERE band_id = p_band_id AND status = 'active';
  UPDATE public.bands SET deleted_at = now(), is_active = false WHERE id = p_band_id
  RETURNING * INTO v_band;
  RETURN v_band;
END;
$$;

-- update_band_profile: owner / admin. NULL = leave as is; '' clears city /
-- description; '{}' / '[]' clear genres / links.
CREATE OR REPLACE FUNCTION public.update_band_profile(
  p_band_id     UUID,
  p_name        TEXT    DEFAULT NULL,
  p_description TEXT    DEFAULT NULL,
  p_mark        JSONB   DEFAULT NULL,
  p_city        TEXT    DEFAULT NULL,
  p_genres      TEXT[]  DEFAULT NULL,
  p_links       JSONB   DEFAULT NULL
)
RETURNS public.bands
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   public.band_memberships := public._my_membership(p_band_id);
  v_band public.bands;
  v_name TEXT;
BEGIN
  IF v_me.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'forbidden',
      HINT = 'You don''t have access to this.';
  END IF;
  SELECT * INTO v_band FROM public.bands WHERE id = p_band_id FOR UPDATE;
  v_name := CASE WHEN p_name IS NULL THEN v_band.name ELSE public._check_band_name(p_name) END;
  IF p_links IS NOT NULL AND (jsonb_typeof(p_links) <> 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_links) l
                   WHERE jsonb_typeof(l) <> 'object' OR NULLIF(btrim(l->>'url'), '') IS NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'invalid_links',
      HINT = 'Each link needs an address.';
  END IF;
  UPDATE public.bands SET
    name        = v_name,
    description = CASE WHEN p_description IS NULL THEN description
                       ELSE NULLIF(btrim(p_description), '') END,
    mark        = CASE WHEN p_mark IS NULL THEN mark ELSE public._check_mark(p_mark, v_name) END,
    city        = CASE WHEN p_city IS NULL THEN city ELSE NULLIF(btrim(p_city), '') END,
    genres      = CASE WHEN p_genres IS NULL THEN genres
                       ELSE ARRAY(SELECT d.g FROM (
                                    SELECT DISTINCT ON (lower(btrim(t.g))) btrim(t.g) AS g, t.ord
                                      FROM unnest(p_genres) WITH ORDINALITY AS t(g, ord)
                                     WHERE NULLIF(btrim(t.g), '') IS NOT NULL
                                     ORDER BY lower(btrim(t.g)), t.ord) d
                                  ORDER BY d.ord) END,
    links       = COALESCE(p_links, links)
  WHERE id = p_band_id
  RETURNING * INTO v_band;
  RETURN v_band;
END;
$$;

-- ── 7. Friends ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "friend_requests_insert_self" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_update_party" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_update_addressee" ON public.friend_requests;
CREATE POLICY "friend_requests_update_addressee" ON public.friend_requests FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = addressee_id)
  WITH CHECK ((SELECT auth.uid()) = addressee_id);

CREATE OR REPLACE FUNCTION public._mutual_friend_count(p_a UUID, p_b UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH fa AS (
    SELECT CASE WHEN user_a = p_a THEN user_b ELSE user_a END AS f
      FROM public.friendships WHERE p_a IN (user_a, user_b)
  ), fb AS (
    SELECT CASE WHEN user_a = p_b THEN user_b ELSE user_a END AS f
      FROM public.friendships WHERE p_b IN (user_a, user_b)
  )
  SELECT count(*)::int FROM fa JOIN fb USING (f);
$$;

-- send_friend_request: by user id (name search) and/or friend code. A code
-- skips the request policy; without one, friends_of_friends needs a mutual
-- friend and code_only refuses — both as requests_closed (one neutral key).
-- If they already asked you, this accepts their request.
CREATE OR REPLACE FUNCTION public.send_friend_request(
  p_target_user_id UUID DEFAULT NULL,
  p_code           TEXT DEFAULT NULL
)
RETURNS public.friend_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := public._require_signed_in();
  v_target UUID := p_target_user_id;
  v_code   TEXT := NULLIF(upper(btrim(COALESCE(p_code, ''))), '');
  v_policy TEXT;
  v_row    public.friend_requests;
BEGIN
  IF v_code IS NOT NULL THEN
    SELECT user_id INTO v_target FROM public.user_profiles
     WHERE friend_code = v_code AND (p_target_user_id IS NULL OR user_id = p_target_user_id);
    IF v_target IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
        HINT = 'No one with that code yet.';
    END IF;
  ELSIF v_target IS NULL OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_target) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'not_found',
      HINT = 'We couldn''t find them.';
  END IF;
  IF v_target = v_uid THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'cannot_friend_self',
      HINT = 'That''s you.';
  END IF;
  IF public.are_friends(v_uid, v_target) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'already_friends',
      HINT = 'You''re already friends.';
  END IF;

  -- They already asked: accept (the trigger writes the friendship).
  UPDATE public.friend_requests SET status = 'accepted'
   WHERE requester_id = v_target AND addressee_id = v_uid AND status = 'pending'
  RETURNING * INTO v_row;
  IF v_row.id IS NOT NULL THEN
    RETURN v_row;
  END IF;

  IF EXISTS (SELECT 1 FROM public.friend_requests
              WHERE requester_id = v_uid AND addressee_id = v_target AND status = 'pending') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'request_pending',
      HINT = 'Request already sent.';
  END IF;

  IF v_code IS NULL THEN
    SELECT friend_request_policy INTO v_policy FROM public.user_profiles WHERE user_id = v_target;
    IF COALESCE(v_policy, 'everyone') = 'code_only'
       OR (v_policy = 'friends_of_friends' AND public._mutual_friend_count(v_uid, v_target) = 0) THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'requests_closed',
        HINT = 'They aren''t taking requests this way. Ask for their friend code.';
    END IF;
  END IF;

  -- New, or re-open a stale row (declined / cancelled / accepted-then-unfriended).
  INSERT INTO public.friend_requests (requester_id, addressee_id, status)
  VALUES (v_uid, v_target, 'pending')
  ON CONFLICT (requester_id, addressee_id) DO UPDATE
    SET status = 'pending', responded_date = NULL, created_date = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- find_people: discoverable people by name (as search_discoverable_users) with
-- their ordered instruments and how many friends you share.
CREATE OR REPLACE FUNCTION public.find_people(p_query TEXT)
RETURNS TABLE (
  user_id        UUID,
  name           TEXT,
  instruments    TEXT[],
  personal_color TEXT,
  mutual_count   INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.user_id, u.name, COALESCE(up.instruments, '{}'), up.personal_color,
         public._mutual_friend_count((SELECT auth.uid()), up.user_id)
  FROM public.user_profiles up
  JOIN public.users u ON u.id = up.user_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND up.discoverable
    AND up.user_id <> (SELECT auth.uid())
    AND length(btrim(COALESCE(p_query, ''))) >= 2
    AND u.name ILIKE '%' ||
        replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_')
        || '%' ESCAPE '\'
  ORDER BY u.name
  LIMIT 20;
$$;

-- ── 8. Delete account (decision 8) ────────────────────────────────────────────
-- Band content outlives its author: every NO ACTION FK to public.users becomes
-- nullable + ON DELETE SET NULL. Band notes too (song_note_entries.user_id was
-- CASCADE): they stay in the band's log as "Former member".
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('invite_codes', 'created_by'),
    ('songs', 'created_by'),
    ('songs', 'last_modified_by'),
    ('song_groups', 'created_by'),
    ('song_group_memberships', 'added_by'),
    ('setlists', 'created_by'),
    ('setlists', 'last_modified_by'),
    ('shows', 'created_by'),
    ('shows', 'last_modified_by'),
    ('practice_sessions', 'last_modified_by'),
    ('jam_sessions', 'last_modified_by'),
    ('events', 'last_modified_by'),
    ('song_castings', 'created_by'),
    ('song_assignments', 'added_by'),
    ('casting_templates', 'created_by'),
    ('casting_assignments', 'created_by'),
    ('tunings', 'created_by'),
    ('tunings', 'last_modified_by'),
    ('song_note_entries', 'user_id'),
    ('audit_log', 'user_id')
  ) AS t(tbl, col) LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', r.tbl, r.col);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE SET NULL',
                   r.tbl, r.tbl || '_' || r.col || '_fkey', r.col);
  END LOOP;
END $$;

-- tunings_lock_ownership kept created_by fixed, which would undo the SET NULL
-- above. It may now go NULL, but only once its user is gone.
CREATE OR REPLACE FUNCTION public.tunings_lock_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (NEW.created_by IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = OLD.created_by)) THEN
    NEW.created_by := OLD.created_by;
  END IF;
  NEW.context_type := OLD.context_type;
  NEW.context_id   := OLD.context_id;
  NEW.is_builtin   := OLD.is_builtin;
  NEW.slug         := OLD.slug;
  RETURN NEW;
END $$;

-- delete_account: the signed-in user, for themselves. Refused while they own a
-- band. Personal things go; band songs / setlists / shows stay with the band,
-- their creator set to NULL ("Former member"). The edge function then deletes
-- auth.users (see the header).
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := public._require_signed_in();
  v_owned TEXT;
BEGIN
  SELECT string_agg(b.name, ', ' ORDER BY lower(b.name)) INTO v_owned
    FROM public.band_memberships m
    JOIN public.bands b ON b.id = m.band_id
   WHERE m.user_id = v_uid AND m.role = 'owner' AND m.status = 'active' AND b.deleted_at IS NULL;
  IF v_owned IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'owns_band',
      HINT = format('Transfer %s first. You own it.', v_owned);
  END IF;

  -- From here on, triggers (last_modified_by, version, audit) must not stamp a
  -- user who is about to disappear: drop the caller from this transaction's
  -- JWT so auth.uid() is NULL ("System" in the audit trail).
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '', true);

  -- Personal context.
  DELETE FROM public.casting_assignments WHERE context_type = 'personal' AND context_id = v_uid;
  DELETE FROM public.song_castings       WHERE context_type = 'personal' AND context_id = v_uid::text;
  DELETE FROM public.setlists            WHERE context_type = 'personal' AND context_id = v_uid::text;
  DELETE FROM public.songs               WHERE context_type = 'personal' AND context_id = v_uid::text;
  DELETE FROM public.tunings             WHERE context_type = 'personal' AND context_id = v_uid::text
                                           AND NOT is_builtin;
  DELETE FROM public.song_note_entries   WHERE user_id = v_uid AND visibility = 'personal';
  -- A band's events belong to the band: hand ones this user hosts to its owner
  -- (never this user, refused above). Personal events and jams go with them.
  UPDATE public.events e
     SET host_user_id = o.user_id
    FROM public.band_memberships o
   WHERE e.host_user_id = v_uid AND e.band_id = o.band_id
     AND o.role = 'owner' AND o.status = 'active';
  -- The person.
  DELETE FROM public.user_preferences    WHERE user_id = v_uid;
  DELETE FROM public.user_profiles       WHERE user_id = v_uid;
  DELETE FROM public.friend_requests     WHERE v_uid IN (requester_id, addressee_id);
  DELETE FROM public.friendships         WHERE v_uid IN (user_a, user_b);
  DELETE FROM public.band_memberships    WHERE user_id = v_uid;
  UPDATE public.audit_log SET user_name = 'Former member' WHERE user_id = v_uid;
  -- Everything else that hangs off the user cascades (personal notes,
  -- notifications, hidden songs, personal events and jams) or goes NULL (band
  -- content and band notes).
  DELETE FROM public.users WHERE id = v_uid;
END;
$$;

-- ── 9. Grants ─────────────────────────────────────────────────────────────────
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.list_my_contexts()',
    'public.get_user_emails(uuid[])',
    'public.ensure_my_profile()',
    'public.create_band(text, jsonb)',
    'public.band_preview_by_code(text)',
    'public.join_band(text)',
    'public.regenerate_invite_code(uuid)',
    'public.set_member_role(uuid, uuid, text)',
    'public.remove_member(uuid, uuid)',
    'public.transfer_ownership(uuid, uuid)',
    'public.leave_band(uuid)',
    'public.delete_band(uuid, text)',
    'public.update_band_profile(uuid, text, text, jsonb, text, text[], jsonb)',
    'public.send_friend_request(uuid, text)',
    'public.find_people(text)',
    'public.delete_account()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public._backfill_band_owners()',
    'public._band_initials(text)',
    'public._check_mark(jsonb, text)',
    'public._new_invite_code()',
    'public._issue_invite_code(uuid)',
    'public._band_by_code(text)',
    'public._require_signed_in()',
    'public._my_membership(uuid)',
    'public._check_band_name(text)',
    'public._member_for_update(uuid, uuid)',
    'public._mutual_friend_count(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
