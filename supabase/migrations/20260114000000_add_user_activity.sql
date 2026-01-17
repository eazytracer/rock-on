-- Migration: Add user activity tracking
-- Purpose: Track when users were last active for multi-device sync optimization

-- Add last_active_at column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Create index for efficient queries on last_active_at
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active_at);

-- Function to update user's last_active_at timestamp
-- Called from the client when user performs actions
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET last_active_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_activity() TO authenticated;

-- Comment for documentation
COMMENT ON COLUMN public.users.last_active_at IS 'Timestamp of user''s last activity, used for multi-device sync optimization';
COMMENT ON FUNCTION update_user_activity() IS 'Updates the current user''s last_active_at timestamp';
