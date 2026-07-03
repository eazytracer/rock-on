-- ============================================================================
-- Friends feature (mobile-redesign-port)
-- Discord-style friend graph: hidden-by-default, reachable by friend code / QR.
-- Supabase-only. Uses a SECURITY DEFINER RPC (resolve_friend_code) for hidden-user
-- lookup and a SECURITY DEFINER trigger to write the canonical friendship row on
-- accept — simpler than edge functions and works fully locally. Idempotent.
-- ============================================================================

-- ── friend_code generator (safe alphabet, no ambiguous chars) ───────────────
CREATE OR REPLACE FUNCTION public.gen_friend_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- ── user_profiles additions ─────────────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS discoverable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS friend_code TEXT;
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS friend_request_policy TEXT NOT NULL DEFAULT 'everyone'
    CHECK (friend_request_policy IN ('everyone','friends_of_friends','code_only'));

-- Backfill codes for existing profiles, then enforce UNIQUE.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.user_profiles WHERE friend_code IS NULL LOOP
    UPDATE public.user_profiles SET friend_code = public.gen_friend_code() WHERE id = r.id;
  END LOOP;
END $$;

DO $$ BEGIN
  ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_friend_code_key UNIQUE (friend_code);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── friend_requests (directed) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','cancelled')),
  created_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_date TIMESTAMPTZ,
  CONSTRAINT friend_requests_not_self CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);

-- ── friendships (ONE canonical row per pair; user_a < user_b) ────────────────
CREATE TABLE IF NOT EXISTS public.friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_b       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friendships_ordered CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee
  ON public.friend_requests (addressee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON public.friend_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_a ON public.friendships (user_a);
CREATE INDEX IF NOT EXISTS idx_friendships_user_b ON public.friendships (user_b);
CREATE INDEX IF NOT EXISTS idx_user_profiles_friend_code
  ON public.user_profiles (friend_code) WHERE friend_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_discoverable
  ON public.user_profiles (user_id) WHERE discoverable;

-- ── are_friends helper (SECURITY DEFINER) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.are_friends(u1 UUID, u2 UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_a = LEAST(u1, u2) AND user_b = GREATEST(u1, u2)
  );
$$;

-- ── resolve_friend_code RPC (bypasses RLS to find hidden users by code) ──────
-- Returns only non-sensitive identity fields for the matching user.
CREATE OR REPLACE FUNCTION public.resolve_friend_code(p_code TEXT)
RETURNS TABLE (user_id UUID, name TEXT, display_name TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT up.user_id, u.name, up.display_name
  FROM public.user_profiles up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.friend_code = upper(trim(p_code))
  LIMIT 1;
$$;

-- ── friendship-on-accept trigger (SECURITY DEFINER; writes canonical row) ────
CREATE OR REPLACE FUNCTION public.on_friend_request_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    INSERT INTO public.friendships (user_a, user_b)
    VALUES (LEAST(NEW.requester_id, NEW.addressee_id), GREATEST(NEW.requester_id, NEW.addressee_id))
    ON CONFLICT (user_a, user_b) DO NOTHING;
    NEW.responded_date := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_request_accepted ON public.friend_requests;
CREATE TRIGGER trg_friend_request_accepted
  BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.on_friend_request_accepted();

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO service_role;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_friend_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_friend_code() TO authenticated, service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships     ENABLE ROW LEVEL SECURITY;

-- friend_requests: either party can see; requester creates; either party updates
-- (addressee accepts/declines, requester cancels).
DROP POLICY IF EXISTS "friend_requests_select_party" ON public.friend_requests;
CREATE POLICY "friend_requests_select_party"
  ON public.friend_requests FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id));

DROP POLICY IF EXISTS "friend_requests_insert_self" ON public.friend_requests;
CREATE POLICY "friend_requests_insert_self"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id);

DROP POLICY IF EXISTS "friend_requests_update_party" ON public.friend_requests;
CREATE POLICY "friend_requests_update_party"
  ON public.friend_requests FOR UPDATE TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id));

DROP POLICY IF EXISTS "friend_requests_delete_party" ON public.friend_requests;
CREATE POLICY "friend_requests_delete_party"
  ON public.friend_requests FOR DELETE TO authenticated
  USING ((select auth.uid()) IN (requester_id, addressee_id));

-- friendships: a member can see their own; DELETE (unfriend) by a member. INSERT
-- happens only via the SECURITY DEFINER accept trigger (no authenticated INSERT policy).
DROP POLICY IF EXISTS "friendships_select_member" ON public.friendships;
CREATE POLICY "friendships_select_member"
  ON public.friendships FOR SELECT TO authenticated
  USING ((select auth.uid()) IN (user_a, user_b));

DROP POLICY IF EXISTS "friendships_delete_member" ON public.friendships;
CREATE POLICY "friendships_delete_member"
  ON public.friendships FOR DELETE TO authenticated
  USING ((select auth.uid()) IN (user_a, user_b));

-- user_profiles: allow discovering opted-in users + friends (in addition to any
-- existing profile policies). Hidden users are only reachable via resolve_friend_code.
DROP POLICY IF EXISTS "user_profiles_select_discoverable" ON public.user_profiles;
CREATE POLICY "user_profiles_select_discoverable"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (discoverable);

DROP POLICY IF EXISTS "user_profiles_select_friend" ON public.user_profiles;
CREATE POLICY "user_profiles_select_friend"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (public.are_friends((select auth.uid()), user_id));

-- ── Realtime (incoming-request badge) ───────────────────────────────────────
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- Migration Complete
-- ============================================================================
