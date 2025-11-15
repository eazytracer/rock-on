#!/bin/bash
# Final migration consolidation script
# Applies remaining RLS policy fixes to baseline migration

MIGRATION_FILE="supabase/migrations/20251106000000_baseline_schema.sql"

echo "Applying final RLS policy fixes to baseline migration..."

# 1. Add users_insert_own policy after users_update_own
sed -i '/CREATE POLICY "users_update_own"/,/WITH CHECK.*id);$/{
  /WITH CHECK.*id);$/a\
\
-- INSERT: Users can only insert their own record during signup\
CREATE POLICY "users_insert_own"\
  ON public.users FOR INSERT TO authenticated\
  WITH CHECK (id = (select auth.uid()));
}' "$MIGRATION_FILE"

# 2. Replace bands_select_members with bands_select_members_or_creator
sed -i 's/CREATE POLICY "bands_select_members"/CREATE POLICY "bands_select_members_or_creator"/' "$MIGRATION_FILE"
sed -i '/CREATE POLICY "bands_select_members_or_creator"/,/USING.*uid())));$/{
  s/USING (is_band_member.*$/USING (\n    is_band_member(bands.id, (select auth.uid())) OR\n    created_by = (select auth.uid())\n  );/
}' "$MIGRATION_FILE"

# 3. Replace memberships_select_own with memberships_select_for_band_members
sed -i 's/CREATE POLICY "memberships_select_own"/CREATE POLICY "memberships_select_for_band_members"/' "$MIGRATION_FILE"
sed -i '/CREATE POLICY "memberships_select_for_band_members"/,/);$/{
  /user_id = (select auth.uid()) AND$/,/);$/ c\
    user_id = (select auth.uid())\
    OR\
    -- Can see other members for bands you belong to\
    -- Uses SECURITY DEFINER function to avoid infinite recursion\
    public.user_belongs_to_band(band_id, (select auth.uid()))\
  );
}' "$MIGRATION_FILE"

# 4. Update comment for bands_select policy
sed -i '/CREATE POLICY "bands_select_members_or_creator"/i\
-- SELECT: Users can see bands they are members of OR bands they created\
-- This fixes the RETURNING clause issue when creating bands
' "$MIGRATION_FILE"

# 5. Update comment for memberships_select policy
sed -i '/CREATE POLICY "memberships_select_for_band_members"/i\
-- SELECT: Users can see their own memberships and all members of bands they belong to
' "$MIGRATION_FILE"

echo "✅ RLS policy fixes applied successfully!"
echo "Next steps:"
echo "1. Test with: supabase db reset"
echo "2. Verify with: npm run test:db"
