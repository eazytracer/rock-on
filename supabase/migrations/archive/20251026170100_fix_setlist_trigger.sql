-- Fix setlist trigger to use correct function for last_modified column
-- The setlists table uses last_modified, not updated_date

-- Drop the incorrectly configured trigger
DROP TRIGGER IF EXISTS update_setlists_last_modified ON public.setlists;

-- Create function to update last_modified timestamp (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_last_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with correct function
CREATE TRIGGER update_setlists_last_modified
  BEFORE UPDATE ON public.setlists
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified_column();

-- Add comment
COMMENT ON TRIGGER update_setlists_last_modified ON public.setlists IS
  'Automatically updates last_modified timestamp on setlist updates';
