-- ============================================================================
-- Event-code join (mobile-redesign-port) — band-less user flow Phase 2
-- ============================================================================
-- Lets an INVITED (but not-yet-participant) user find and join an event by its
-- short_code — the "I have an event code" path at signup. Events RLS
-- (events_select) only exposes host / participant / public events, so a
-- non-participant cannot read an unlisted event by code with a direct query.
--
-- This migration adds:
--   1. gen_event_code()          — confusable-free 8-char code generator (SECURITY
--                                   DEFINER so its uniqueness check sees all events).
--   2. a BEFORE INSERT trigger   — auto-assigns a short_code to any NON-PRIVATE
--                                   event created without one (private events stay
--                                   invite-only, no guessable code).
--   3. join_event_by_code(code)  — SECURITY DEFINER RPC: resolves the event by
--                                   code and joins the CALLER as a 'guest'
--                                   participant, returning a minimal preview.
--   4. Hardened event_participants self-insert / self-update policies so a guest
--      can NOT self-escalate to host/cohost (closes a pre-existing WITH-CHECK gap
--      that this feature would otherwise make broadly reachable).
--
-- Security notes (adversarial-reviewed — see review findings 1 & 2):
--   * The RPC forces access_tier = 'guest' and uses ON CONFLICT DO NOTHING, so it
--     can NEVER escalate an existing participant nor grant host/cohost — the only
--     thing a code buys is guest membership of exactly the event it matches.
--   * Participant is always auth.uid() (server-derived) — a caller can't join
--     someone else, and unauthenticated callers get zero rows.
--   * It only reveals an event the caller supplies a valid code for; it does not
--     enable enumeration (no code → no row; wrong code → no row).
--   * FINDING 1 FIX (critical): the events migration's event_participants_update
--     had no WITH CHECK, letting a self-owned row set access_tier='host'. Combined
--     with a code-obtained guest row + leaked event id that was a full-takeover
--     path. We re-issue both self policies with a WITH CHECK that pins a
--     non-manager's tier to ('guest','viewer'); managers keep full control.
--   * FINDING 2 FIX: only unlisted/public events get an auto-code (private stays
--     invite-only); codes are 8 chars (32^8 ≈ 2^40) to match the friend-code
--     search space and make brute-force harvesting infeasible.
--   * DEFERRED (finding 3, low): a joined guest can read the full event row incl.
--     view_token; view_token is unused by the events UI today (jam-only concept).
--     Tracked as a follow-up (column-narrowing view) — not a takeover vector.
--   * SECURITY DEFINER + owner postgres + pinned search_path (no RLS recursion,
--     no search-path injection). Idempotent.
-- ============================================================================

-- ── gen_event_code(): unique, confusable-free (no I/O/0/1) 8-char code ────────
CREATE OR REPLACE FUNCTION public.gen_event_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code     TEXT;
  i        INT;
  attempts INT := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.events WHERE short_code = code);
    attempts := attempts + 1;
    -- Vanishingly unlikely; grow the code rather than loop forever.
    IF attempts > 20 THEN
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      EXIT;
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

ALTER FUNCTION public.gen_event_code() OWNER TO postgres;

-- ── Backfill existing NON-PRIVATE events that predate short-code generation ──
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.events
             WHERE short_code IS NULL AND visibility <> 'private' LOOP
    UPDATE public.events SET short_code = public.gen_event_code() WHERE id = r.id;
  END LOOP;
END $$;

-- ── BEFORE INSERT trigger: non-private events get a shareable code ───────────
-- Private events stay invite-only (no guessable code); unlisted/public are the
-- code-joinable social tier.
CREATE OR REPLACE FUNCTION public.set_event_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.short_code IS NULL AND NEW.visibility <> 'private' THEN
    NEW.short_code := public.gen_event_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_event_short_code ON public.events;
CREATE TRIGGER trg_set_event_short_code
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_event_short_code();

-- ── join_event_by_code(code): resolve + join as guest, return a preview ──────
-- OUT params are prefixed out_* so they don't shadow event_participants columns
-- (notably event_id) inside the function body's INSERT ... ON CONFLICT.
CREATE OR REPLACE FUNCTION public.join_event_by_code(p_code TEXT)
RETURNS TABLE (out_event_id UUID, out_name TEXT, out_host_name TEXT, out_scheduled_date TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := (select auth.uid());
  v_code   TEXT := upper(trim(coalesce(p_code, '')));
  v_event  public.events%ROWTYPE;
BEGIN
  -- Unauthenticated or empty code → no match (no enumeration surface).
  IF v_caller IS NULL OR v_code = '' THEN
    RETURN;
  END IF;

  SELECT * INTO v_event FROM public.events e WHERE e.short_code = v_code LIMIT 1;
  IF NOT FOUND THEN
    RETURN;  -- wrong code → no row; caller learns nothing
  END IF;

  -- Join as the lowest-privilege tier. ON CONFLICT DO NOTHING preserves an
  -- existing participant's tier (no escalation, no downgrade).
  INSERT INTO public.event_participants (event_id, user_id, access_tier, rsvp)
  VALUES (v_event.id, v_caller, 'guest', 'going')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  RETURN QUERY
    SELECT v_event.id,
           v_event.name,
           (SELECT u.name FROM public.users u WHERE u.id = v_event.host_user_id),
           v_event.scheduled_date;
END;
$$;

ALTER FUNCTION public.join_event_by_code(TEXT) OWNER TO postgres;

-- ── Grants ──────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.gen_event_code()          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_event_by_code(TEXT)  TO authenticated;

COMMENT ON FUNCTION public.join_event_by_code IS
  'Resolves an event by short_code and joins the calling user as a guest participant (ON CONFLICT DO NOTHING). Returns a minimal preview. The "I have an event code" signup path.';

-- ── FINDING 1 FIX: pin a non-manager's own participant tier ──────────────────
-- The events migration granted self-insert/self-update on event_participants but
-- did NOT constrain access_tier, and the UPDATE policy had no WITH CHECK — so a
-- user could set their OWN row's tier to 'host'/'cohost' and become a manager.
-- Re-issue both policies (idempotent) with a WITH CHECK: a self-service row may
-- only be 'guest'/'viewer'; elevated tiers require the manager branch. This does
-- not change the createEvent host insert (host_user_id=self ⇒ is_event_manager),
-- nor the SECURITY DEFINER join RPC (it bypasses RLS as owner postgres).
DROP POLICY IF EXISTS "event_participants_insert_self" ON public.event_participants;
CREATE POLICY "event_participants_insert_self" ON public.event_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    is_event_manager(event_id, (select auth.uid()))
    OR (user_id = (select auth.uid()) AND access_tier IN ('guest','viewer'))
  );

DROP POLICY IF EXISTS "event_participants_update" ON public.event_participants;
CREATE POLICY "event_participants_update" ON public.event_participants
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR is_event_manager(event_id, (select auth.uid())))
  WITH CHECK (
    is_event_manager(event_id, (select auth.uid()))
    OR (user_id = (select auth.uid()) AND access_tier IN ('guest','viewer'))
  );

-- ============================================================================
-- Migration Complete
-- ============================================================================
