-- =====================================================
-- FIX SONG DELETE POLICY
-- =====================================================
-- Allow band members to delete band songs, not just creator
-- =====================================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "songs_delete_creator" ON public.songs;

-- Create updated policy:
-- - Personal songs: only creator can delete
-- - Band songs: any band member can delete
CREATE POLICY "songs_delete_creator_or_band_member"
  ON public.songs FOR DELETE
  TO authenticated
  USING (
    -- Creator can always delete their songs
    created_by = auth.uid()
    OR
    -- Band members can delete band songs
    (
      context_type = 'band'
      AND public.user_is_band_member(context_id::uuid, auth.uid())
    )
  );
