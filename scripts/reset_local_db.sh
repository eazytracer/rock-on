#!/bin/bash

# ============================================================================
# Reset Local Supabase Database Script
# ============================================================================
# Purpose: Drop and recreate the local Supabase database from fresh_init.sql
# Usage: ./scripts/reset_local_db.sh
# ============================================================================

set -e  # Exit on error

echo "=================================="
echo "Rock On - Database Reset Script"
echo "=================================="
echo ""

# Configuration
DB_CONTAINER="supabase_db_rock-on"
DB_USER="postgres"
DB_NAME="postgres"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRESH_INIT_SQL="$SCRIPT_DIR/fresh_init.sql"
SEED_DATA_SQL="$SCRIPT_DIR/seed_test_data.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker container is running
echo "Checking if Supabase container is running..."
if ! docker ps | grep -q "$DB_CONTAINER"; then
  echo -e "${RED}Error: Supabase container '$DB_CONTAINER' is not running${NC}"
  echo "Start it with: npx supabase start"
  exit 1
fi
echo -e "${GREEN}✓ Container is running${NC}"
echo ""

# Check if fresh_init.sql exists
if [ ! -f "$FRESH_INIT_SQL" ]; then
  echo -e "${RED}Error: fresh_init.sql not found at $FRESH_INIT_SQL${NC}"
  exit 1
fi

# Step 1: Drop all existing tables and policies
echo "Step 1: Dropping existing schema..."
echo "========================================"

docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<'EOF'
-- Disable RLS temporarily to allow drops
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bands DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.band_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invite_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.song_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.song_group_memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.setlists DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.practice_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.song_castings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.song_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assignment_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.casting_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.member_capabilities DISABLE ROW LEVEL SECURITY;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.member_capabilities CASCADE;
DROP TABLE IF EXISTS public.casting_templates CASCADE;
DROP TABLE IF EXISTS public.assignment_roles CASCADE;
DROP TABLE IF EXISTS public.song_assignments CASCADE;
DROP TABLE IF EXISTS public.song_castings CASCADE;
DROP TABLE IF EXISTS public.practice_sessions CASCADE;
DROP TABLE IF EXISTS public.setlists CASCADE;
DROP TABLE IF EXISTS public.song_group_memberships CASCADE;
DROP TABLE IF EXISTS public.song_groups CASCADE;
DROP TABLE IF EXISTS public.songs CASCADE;
DROP TABLE IF EXISTS public.invite_codes CASCADE;
DROP TABLE IF EXISTS public.band_memberships CASCADE;
DROP TABLE IF EXISTS public.bands CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_setlist_last_modified() CASCADE;

\echo '✓ Dropped all existing tables and functions'
EOF

echo -e "${GREEN}✓ Existing schema dropped${NC}"
echo ""

# Step 2: Run fresh initialization
echo "Step 2: Running fresh initialization..."
echo "========================================"

docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$FRESH_INIT_SQL"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Fresh schema created successfully${NC}"
else
  echo -e "${RED}✗ Failed to create fresh schema${NC}"
  exit 1
fi
echo ""

# Step 3: Seed test data (optional)
if [ -f "$SEED_DATA_SQL" ]; then
  echo "Step 3: Seeding test data..."
  echo "========================================"

  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$SEED_DATA_SQL"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Test data seeded successfully${NC}"
  else
    echo -e "${YELLOW}⚠ Warning: Failed to seed test data (non-critical)${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}⚠ Skipping test data seeding (seed_test_data.sql not found)${NC}"
  echo ""
fi

# Step 4: Verify tables were created
echo "Step 4: Verifying schema..."
echo "========================================"

TABLE_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")
POLICY_COUNT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';")

echo "Tables created: $TABLE_COUNT"
echo "RLS policies created: $POLICY_COUNT"

if [ "$TABLE_COUNT" -ge 15 ]; then
  echo -e "${GREEN}✓ Schema verification passed${NC}"
else
  echo -e "${YELLOW}⚠ Warning: Expected at least 15 tables, found $TABLE_COUNT${NC}"
fi
echo ""

# Step 5: Show table list
echo "Step 5: Database schema summary..."
echo "========================================"

docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" <<'EOF'
SELECT
  schemaname,
  tablename,
  CASE
    WHEN rowsecurity THEN 'Enabled'
    ELSE 'Disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
EOF

echo ""
echo -e "${GREEN}=================================="
echo "✓ Database reset complete!"
echo "==================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Start the dev server: npm run dev"
echo "  2. Test with Chrome MCP or manually"
echo "  3. Verify sync is working"
echo ""
