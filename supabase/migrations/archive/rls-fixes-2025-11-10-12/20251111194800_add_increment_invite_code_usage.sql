-- Migration: Add function to increment invite code usage
-- Created: 2025-11-11T19:48
-- Purpose: Allow authenticated users to increment invite code usage when joining bands
--          without requiring admin permissions

-- Function: increment_invite_code_usage
-- Allows any authenticated user to increment the current_uses count for an invite code
-- This is needed because regular users joining via invite codes need to update the usage,
-- but the RLS policy restricts updates to band admins only

CREATE OR REPLACE FUNCTION public.increment_invite_code_usage(p_invite_code_id UUID)
RETURNS invite_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result invite_codes;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Increment current_uses atomically
  UPDATE public.invite_codes
  SET current_uses = current_uses + 1
  WHERE id = p_invite_code_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR current_uses < max_uses)
  RETURNING * INTO v_result;

  -- Check if update succeeded
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Invite code not found, expired, inactive, or at max uses';
  END IF;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_invite_code_usage(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.increment_invite_code_usage(UUID) IS
  'Securely increments invite code usage count. Can be called by any authenticated user when joining a band via invite code. Validates code is active, not expired, and under max uses before incrementing.';
