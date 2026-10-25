#!/bin/bash
# =============================================================================
# Rock-On Docker Startup Script
# =============================================================================
# Starts the full development stack:
# 1. Starts Supabase via the host CLI (creates DB, roles, runs migrations/seed)
#    and serves edge functions
# 2. Starts nginx proxy (if HOST_IP set, for phone testing)
# 3. Starts the Rock-On app container
#
# Usage:
#   ./start-docker.sh                           # Start with localhost
#   HOST_IP=192.168.1.100 ./start-docker.sh     # Start for phone testing
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=============================================="
echo "Rock-On Docker Development Stack"
echo -e "==============================================${NC}"

HOST_IP="${HOST_IP:-localhost}"
export HOST_IP

echo -e "${YELLOW}Host IP: $HOST_IP${NC}"
echo ""

# Step 1: Start Supabase with the host CLI (it runs its services in Docker).
# Current CLI releases are glibc-linked, so they can't run in an alpine init
# container — and the edge functions below need the host CLI anyway.
echo -e "${GREEN}[1/2] Starting Supabase...${NC}"
if ! command -v supabase >/dev/null 2>&1; then
    echo "Supabase CLI not found — install it: brew install supabase/tap/supabase" >&2
    exit 1
fi
if supabase status >/dev/null 2>&1; then
    echo "  ✓ Supabase is already running"
else
    supabase start
fi

# Edge functions (jam-view, Spotify search) aren't part of the app container;
# serve them with the host's Supabase CLI against the same local stack.
echo ""
echo -e "${GREEN}Starting edge functions...${NC}"
supabase functions serve --no-verify-jwt > /tmp/edge-functions.log 2>&1 &
echo "  Edge functions running (PID $!) → logs: /tmp/edge-functions.log"

# Step 2: Start the app (and proxy if external access needed)
echo ""
echo -e "${GREEN}[2/2] Starting Rock-On app...${NC}"

if [ "$HOST_IP" != "localhost" ]; then
    echo -e "${YELLOW}External access enabled - starting nginx proxy${NC}"
    docker compose --profile proxy up --build -d supabase-proxy
    echo ""
    echo -e "${GREEN}Access from phone:${NC}"
    echo "  App:     http://$HOST_IP:5173"
    echo "  API:     http://$HOST_IP:54321"
    echo "  Studio:  http://$HOST_IP:54323"
    echo ""
fi

docker compose up --build rock-on-dev
