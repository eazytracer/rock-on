-- Fix bands INSERT policy for remote Supabase
-- This ensures any authenticated user can create a band

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "bands_insert_any_authenticated" ON public.bands;

-- Recreate the policy
CREATE POLICY "bands_insert_any_authenticated"
  ON public.bands FOR INSERT TO authenticated
  WITH CHECK (true);

-- Verify RLS is enabled
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
